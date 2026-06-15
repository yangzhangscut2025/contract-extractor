import { ipcMain, dialog, BrowserWindow, shell } from 'electron'
import { computeFileMd5 } from '../utils/crypto'
import { parseFilename } from '../services/fileParser'
import * as fs from 'fs'
import { callLlmRaw } from '../services/llmService'
import {
  findAllFileRecords,
  findFileRecordById,
  findFileRecordByMd5,
  insertFileRecord,
  deleteFileRecord,
  updateFileRecord,
  FileRecordRow
} from '../database/repositories/fileRecordRepo'

export function registerFileHandlers(): void {
  // Open native file dialog to select PDFs
  ipcMain.handle('file:import', async () => {
    const window = BrowserWindow.getFocusedWindow()
    if (!window) return []

    const result = await dialog.showOpenDialog(window, {
      title: '选择合同 PDF 文件',
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
      properties: ['openFile', 'multiSelections']
    })

    return result.canceled ? [] : result.filePaths
  })

  // Add files by paths (from drag-drop or file dialog)
  ipcMain.handle('file:add-by-paths', async (_event, { paths }: { paths: string[] }) => {
    const records: FileRecordRow[] = []

    for (const filePath of paths) {
      // Validate file exists
      if (!fs.existsSync(filePath)) continue

      // Validate PDF extension
      if (!filePath.toLowerCase().endsWith('.pdf')) continue

      const fileName = filePath.split(/[/\\]/).pop() || filePath
      const fileStats = fs.statSync(filePath)
      const fileMd5 = computeFileMd5(filePath)

      // Check for duplicates
      const existing = await findFileRecordByMd5(fileMd5)
      if (existing) {
        records.push(existing)
        continue
      }

      // Parse employee ID from filename
      const employeeId = parseFilename(fileName)

      // Insert new record
      const record = await insertFileRecord({
        file_path: filePath,
        file_name: fileName,
        file_md5: fileMd5,
        file_size: fileStats.size,
        employee_id: employeeId,
        contract_number: null,
        contract_type: null,
        status: 'pending',
        ocr_used: 0,
        original_text: null,
        error_message: null,
        is_verified: 0,
        translated_text: null
      })

      records.push(record)
    }

    return records
  })

  // List all file records
  ipcMain.handle('file:list', async () => {
    return await findAllFileRecords()
  })

  // Remove a file record and its extraction results
  ipcMain.handle('file:remove', async (_event, { id }: { id: number }) => {
    await deleteFileRecord(id)
  })

  // Get original text for a file
  ipcMain.handle('file:get-text', async (_event, { id }: { id: number }) => {
    const record = await findFileRecordById(id)
    return record?.original_text || ''
  })

  // Open original PDF file with system default viewer
  ipcMain.handle('file:open', async (_event, { id }: { id: number }) => {
    const record = await findFileRecordById(id)
    if (!record) {
      throw new Error('文件记录不存在')
    }
    const result = await shell.openPath(record.file_path)
    if (result) {
      throw new Error(`无法打开文件: ${result}`)
    }
  })

  // Get file path for PDF viewing
  ipcMain.handle('file:get-path', async (_event, { id }: { id: number }) => {
    const record = await findFileRecordById(id)
    if (!record) {
      throw new Error('文件记录不存在')
    }
    return record.file_path
  })

  // Translate original_text to Chinese (cached in DB)
  ipcMain.handle('file:translate', async (_event, { id }: { id: number }) => {
    const record = await findFileRecordById(id)
    if (!record) throw new Error('文件记录不存在')
    if (!record.original_text) throw new Error('原文为空，无法翻译')

    // Return cached translation if available
    if (record.translated_text) return record.translated_text

    const prompt = `你是一位专业的多语言翻译专家。请将以下合同文本翻译成中文。

要求：
- 日期格式保持不变（如 2024-01-15）
- 金额数字保持不变
- 人名、公司名、地名保留原文，不翻译
- 邮箱、电话、IBAN、SWIFT、护照号等标识信息保留原文
- 保持原文的段落结构
- 只输出翻译结果，不要加解释

原文：
${record.original_text.substring(0, 12000)}`

    const text = await callLlmRaw(prompt)

    // Cache in DB
    await updateFileRecord(id, { translated_text: text.substring(0, 50000) })

    return text
  })

  // Read PDF file as base64 for in-app viewing
  ipcMain.handle('file:read-pdf', async (_event, { id }: { id: number }) => {
    const record = await findFileRecordById(id)
    if (!record) {
      throw new Error('文件记录不存在')
    }
    if (!fs.existsSync(record.file_path)) {
      throw new Error('PDF 文件不存在')
    }
    const buffer = fs.readFileSync(record.file_path)
    return buffer.toString('base64')
  })
}
