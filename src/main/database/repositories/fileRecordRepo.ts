import { getDatabase, saveDatabase } from '../connection'

export interface FileRecordRow {
  id: number
  file_path: string
  file_name: string
  file_md5: string
  file_size: number | null
  employee_id: string | null
  contract_number: string | null
  contract_type: string | null
  status: string
  ocr_used: number
  original_text: string | null
  error_message: string | null
  is_verified: number
  translated_text: string | null
  created_at: string
  updated_at: string
}

function rowToRecord(row: unknown[]): FileRecordRow {
  return {
    id: row[0] as number,
    file_path: row[1] as string,
    file_name: row[2] as string,
    file_md5: row[3] as string,
    file_size: row[4] as number | null,
    employee_id: row[5] as string | null,
    contract_number: row[6] as string | null,
    contract_type: row[7] as string | null,
    status: row[8] as string,
    ocr_used: row[9] as number,
    original_text: row[10] as string | null,
    error_message: row[11] as string | null,
    is_verified: row[12] as number,
    translated_text: row[13] as string | null,
    created_at: row[14] as string,
    updated_at: row[15] as string
  }
}

export async function findAllFileRecords(): Promise<FileRecordRow[]> {
  const db = await getDatabase()
  const results = db.exec(
    'SELECT id, file_path, file_name, file_md5, file_size, employee_id, contract_number, contract_type, status, ocr_used, original_text, error_message, is_verified, translated_text, created_at, updated_at FROM file_records ORDER BY employee_id ASC, created_at ASC'
  )
  if (results.length === 0) return []
  return results[0].values.map(rowToRecord)
}

export async function findFileRecordById(id: number): Promise<FileRecordRow | null> {
  const db = await getDatabase()
  const results = db.exec(
    'SELECT id, file_path, file_name, file_md5, file_size, employee_id, contract_number, contract_type, status, ocr_used, original_text, error_message, is_verified, translated_text, created_at, updated_at FROM file_records WHERE id = ?',
    [id]
  )
  if (results.length === 0 || results[0].values.length === 0) return null
  return rowToRecord(results[0].values[0])
}

export async function findFileRecordByMd5(md5: string): Promise<FileRecordRow | null> {
  const db = await getDatabase()
  const results = db.exec(
    'SELECT id, file_path, file_name, file_md5, file_size, employee_id, contract_number, contract_type, status, ocr_used, original_text, error_message, is_verified, translated_text, created_at, updated_at FROM file_records WHERE file_md5 = ?',
    [md5]
  )
  if (results.length === 0 || results[0].values.length === 0) return null
  return rowToRecord(results[0].values[0])
}

export async function insertFileRecord(record: Omit<FileRecordRow, 'id' | 'created_at' | 'updated_at'>): Promise<FileRecordRow> {
  const db = await getDatabase()
  db.run(
    `INSERT INTO file_records (file_path, file_name, file_md5, file_size, employee_id, contract_number, contract_type, status, ocr_used, original_text, error_message, is_verified, translated_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.file_path,
      record.file_name,
      record.file_md5,
      record.file_size,
      record.employee_id,
      record.contract_number,
      record.contract_type,
      record.status,
      record.ocr_used,
      record.original_text,
      record.error_message,
      record.is_verified,
      record.translated_text
    ]
  )
  saveDatabase()

  const results = db.exec('SELECT last_insert_rowid()')
  const id = results[0].values[0][0] as number
  return (await findFileRecordById(id))!
}

export async function updateFileRecord(id: number, updates: Partial<FileRecordRow>): Promise<void> {
  const db = await getDatabase()
  const fields: string[] = []
  const values: unknown[] = []

  if (updates.employee_id !== undefined) { fields.push('employee_id = ?'); values.push(updates.employee_id) }
  if (updates.contract_number !== undefined) { fields.push('contract_number = ?'); values.push(updates.contract_number) }
  if (updates.contract_type !== undefined) { fields.push('contract_type = ?'); values.push(updates.contract_type) }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status) }
  if (updates.ocr_used !== undefined) { fields.push('ocr_used = ?'); values.push(updates.ocr_used) }
  if (updates.original_text !== undefined) { fields.push('original_text = ?'); values.push(updates.original_text) }
  if (updates.error_message !== undefined) { fields.push('error_message = ?'); values.push(updates.error_message) }
  if (updates.is_verified !== undefined) { fields.push('is_verified = ?'); values.push(updates.is_verified) }
  if (updates.translated_text !== undefined) { fields.push('translated_text = ?'); values.push(updates.translated_text) }

  if (fields.length === 0) return

  fields.push("updated_at = datetime('now')")
  values.push(id)

  db.run(`UPDATE file_records SET ${fields.join(', ')} WHERE id = ?`, values)
  saveDatabase()
}

export async function deleteFileRecord(id: number): Promise<void> {
  const db = await getDatabase()
  // Delete extraction results first (CASCADE)
  db.run('DELETE FROM extraction_results WHERE file_record_id = ?', [id])
  db.run('DELETE FROM file_records WHERE id = ?', [id])
  saveDatabase()
}
