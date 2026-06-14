import { Database } from 'sql.js'
import { getDatabase, saveDatabase } from '../connection'

export interface ExtractionResultRow {
  id: number
  file_record_id: number
  field_name: string
  extracted_value: string | null
  manual_value: string | null
  validation_status: string
  validation_message: string | null
  created_at: string
  updated_at: string
}

function rowToResult(row: unknown[]): ExtractionResultRow {
  return {
    id: row[0] as number,
    file_record_id: row[1] as number,
    field_name: row[2] as string,
    extracted_value: row[3] as string | null,
    manual_value: row[4] as string | null,
    validation_status: row[5] as string,
    validation_message: row[6] as string | null,
    created_at: row[7] as string,
    updated_at: row[8] as string
  }
}

export async function findResultsByFileId(fileRecordId: number): Promise<ExtractionResultRow[]> {
  const db = await getDatabase()
  const results = db.exec(
    'SELECT id, file_record_id, field_name, extracted_value, manual_value, validation_status, validation_message, created_at, updated_at FROM extraction_results WHERE file_record_id = ? ORDER BY id',
    [fileRecordId]
  )
  if (results.length === 0) return []
  return results[0].values.map(rowToResult)
}

export async function insertExtractionResult(result: Omit<ExtractionResultRow, 'id' | 'created_at' | 'updated_at'>): Promise<ExtractionResultRow> {
  const db = await getDatabase()
  db.run(
    `INSERT INTO extraction_results (file_record_id, field_name, extracted_value, manual_value, validation_status, validation_message)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [result.file_record_id, result.field_name, result.extracted_value, result.manual_value, result.validation_status, result.validation_message]
  )

  const idResult = db.exec('SELECT last_insert_rowid()')
  const id = idResult[0].values[0][0] as number
  saveDatabase()
  return {
    ...result,
    id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

export async function updateExtractionResult(id: number, updates: { manual_value?: string; validation_status?: string; validation_message?: string }): Promise<void> {
  const db = await getDatabase()
  const fields: string[] = []
  const values: unknown[] = []

  if (updates.manual_value !== undefined) { fields.push('manual_value = ?'); values.push(updates.manual_value) }
  if (updates.validation_status !== undefined) { fields.push('validation_status = ?'); values.push(updates.validation_status) }
  if (updates.validation_message !== undefined) { fields.push('validation_message = ?'); values.push(updates.validation_message) }

  if (fields.length === 0) return

  fields.push("updated_at = datetime('now')")
  values.push(id)

  db.run(`UPDATE extraction_results SET ${fields.join(', ')} WHERE id = ?`, values)
  saveDatabase()
}

export async function deleteResultsByFileId(fileRecordId: number): Promise<void> {
  const db = await getDatabase()
  db.run('DELETE FROM extraction_results WHERE file_record_id = ?', [fileRecordId])
  saveDatabase()
}
