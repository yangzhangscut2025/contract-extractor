import { Database } from 'sql.js'

export function runMigrations(db: Database): void {
  // Track migrations in a meta table
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const applied = new Set<string>()
  const results = db.exec("SELECT name FROM _migrations")
  if (results.length > 0) {
    const rows = results[0].values
    for (const row of rows) {
      applied.add(row[0] as string)
    }
  }

  // Migration 001: Core tables
  if (!applied.has('001_core_tables')) {
    db.run(`
      CREATE TABLE IF NOT EXISTS file_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_md5 TEXT NOT NULL UNIQUE,
        file_size INTEGER,
        employee_id TEXT,
        contract_number TEXT,
        contract_type TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        ocr_used INTEGER NOT NULL DEFAULT 0,
        original_text TEXT,
        error_message TEXT,
        is_verified INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_file_records_employee_id ON file_records(employee_id)
    `)
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_file_records_status ON file_records(status)
    `)
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_file_records_md5 ON file_records(file_md5)
    `)
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_file_records_contract_type ON file_records(contract_type)
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS extraction_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_record_id INTEGER NOT NULL,
        field_name TEXT NOT NULL,
        extracted_value TEXT,
        manual_value TEXT,
        validation_status TEXT DEFAULT 'ok',
        validation_message TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (file_record_id) REFERENCES file_records(id) ON DELETE CASCADE
      )
    `)

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_extraction_results_file ON extraction_results(file_record_id)
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS employee_sequences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id TEXT NOT NULL UNIQUE,
        max_sequence INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_sequences_id ON employee_sequences(employee_id)
    `)

    db.run("INSERT INTO _migrations (name) VALUES ('001_core_tables')")
  }
}
