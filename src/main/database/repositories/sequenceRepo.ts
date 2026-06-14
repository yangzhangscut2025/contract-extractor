import { Database } from 'sql.js'
import { getDatabase, saveDatabase } from '../connection'

export async function getAndIncrementSequence(employeeId: string): Promise<number> {
  const db = await getDatabase()

  // Try to find existing sequence
  const results = db.exec('SELECT max_sequence FROM employee_sequences WHERE employee_id = ?', [employeeId])

  let newSequence: number
  if (results.length > 0 && results[0].values.length > 0) {
    // Employee exists — atomically increment
    const currentMax = results[0].values[0][0] as number
    newSequence = currentMax + 1
    db.run('UPDATE employee_sequences SET max_sequence = ?, updated_at = datetime(\'now\') WHERE employee_id = ?', [newSequence, employeeId])
  } else {
    // New employee — start at 1
    newSequence = 1
    db.run('INSERT INTO employee_sequences (employee_id, max_sequence) VALUES (?, ?)', [employeeId, newSequence])
  }

  saveDatabase()
  return newSequence
}

export async function getCurrentSequence(employeeId: string): Promise<number> {
  const db = await getDatabase()
  const results = db.exec('SELECT max_sequence FROM employee_sequences WHERE employee_id = ?', [employeeId])
  if (results.length > 0 && results[0].values.length > 0) {
    return results[0].values[0][0] as number
  }
  return 0
}

export async function forceResetSequence(employeeId: string): Promise<void> {
  const db = await getDatabase()
  db.run('DELETE FROM employee_sequences WHERE employee_id = ?', [employeeId])
  saveDatabase()
}

export async function getAllSequences(): Promise<Map<string, number>> {
  const db = await getDatabase()
  const results = db.exec('SELECT employee_id, max_sequence FROM employee_sequences ORDER BY employee_id')
  const map = new Map<string, number>()
  if (results.length > 0) {
    for (const row of results[0].values) {
      map.set(row[0] as string, row[1] as number)
    }
  }
  return map
}
