import { ipcMain } from 'electron'
import { findResultsByFileId, updateExtractionResult } from '../database/repositories/extractionResultRepo'
import { findFileRecordById, updateFileRecord } from '../database/repositories/fileRecordRepo'

export function registerReviewHandlers(): void {
  ipcMain.handle('review:get-fields', async (_event, { fileId }: { fileId: number }) => {
    const results = await findResultsByFileId(fileId)
    return results.map((r) => ({
      ...r,
      effectiveValue: r.manual_value ?? r.extracted_value
    }))
  })

  ipcMain.handle('review:update-field', async (_event, { id, manualValue }: { id: number; manualValue: string }) => {
    await updateExtractionResult(id, { manual_value: manualValue })
  })

  ipcMain.handle('review:mark-verified', async (_event, { fileId }: { fileId: number }) => {
    await updateFileRecord(fileId, { is_verified: 1 })
  })

  ipcMain.handle('review:search-text', async (_event, { fileId, query }: { fileId: number; query: string }) => {
    const record = await findFileRecordById(fileId)
    if (!record?.original_text) return []

    const text = record.original_text
    const lines = text.split('\n')
    const matchingLines: number[] = []

    const lowerQuery = query.toLowerCase()
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(lowerQuery)) {
        matchingLines.push(i + 1) // 1-based line numbers
      }
    }

    return matchingLines
  })
}
