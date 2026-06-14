import { app } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import initSqlJs, { Database } from 'sql.js'
import { runMigrations } from './migrations'

let db: Database | null = null
let dbPath: string = ''

export function getDbPath(): string {
  if (!dbPath) {
    const userDataPath = app.getPath('userData')
    const dataDir = join(userDataPath, 'data')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    dbPath = join(dataDir, 'contracts.db')
  }
  return dbPath
}

export async function getDatabase(): Promise<Database> {
  if (db) return db

  const SQL = await initSqlJs()
  const path = getDbPath()

  if (fs.existsSync(path)) {
    const buffer = fs.readFileSync(path)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  // Enable WAL mode for better concurrent access
  db.run('PRAGMA journal_mode=WAL')
  db.run('PRAGMA foreign_keys=ON')

  // Run migrations
  runMigrations(db)

  return db
}

export function saveDatabase(): void {
  if (!db) return
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(getDbPath(), buffer)
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase()
    db.close()
    db = null
  }
}
