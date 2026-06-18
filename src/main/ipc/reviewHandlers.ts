import { ipcMain } from 'electron'
import { findResultsByFileId, updateExtractionResult, insertExtractionResult } from '../database/repositories/extractionResultRepo'
import { findFileRecordById, updateFileRecord } from '../database/repositories/fileRecordRepo'
import * as fieldsConfig from '../../../config/fields.json'

export function registerReviewHandlers(): void {
  ipcMain.handle('review:get-fields', async (_event, { fileId }: { fileId: number }) => {
    let results = await findResultsByFileId(fileId)

    // Auto-create empty fields if file has no extraction results yet
    if (results.length === 0) {
      const fields = fieldsConfig as Array<{ english_name: string }>
      for (const field of fields) {
        const r = await insertExtractionResult({
          file_record_id: fileId,
          field_name: field.english_name,
          extracted_value: null,
          manual_value: null,
          validation_status: 'ok',
          validation_message: null
        })
        results.push(r)
      }
    }

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
