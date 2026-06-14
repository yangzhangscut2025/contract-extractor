import * as crypto from 'crypto'
import * as fs from 'fs'

export function computeFileMd5(filePath: string): string {
  const buffer = fs.readFileSync(filePath)
  return crypto.createHash('md5').update(buffer).digest('hex')
}

export function sanitizeLogData(value: string | null | undefined): string {
  if (!value) return ''
  // Redact sensitive fields (bank account, SSN, ID document, IBAN)
  return value.replace(/[0-9]{6,}/g, (match) => '***' + match.slice(-2))
}

export function generateRandomId(): string {
  return crypto.randomBytes(8).toString('hex')
}
