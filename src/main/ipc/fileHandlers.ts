import { ipcMain, dialog, BrowserWindow } from 'electron'
import { computeFileMd5 } from '../utils/crypto'
import { parseFilename } from '../services/fileParser'
import * as fs from 'fs'
import {
  findAllFileRecords,
  findFileRecordById,
  findFileRecordByMd5,
  insertFileRecord,
  deleteFileRecord,
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
        is_verified: 0
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
}
