import * as fs from 'fs'
import { logger } from '../utils/logger'

// pdfjs-dist v2.16.105: CommonJS-compatible, must use require() with legacy build path
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')

export interface PageText {
  pageNum: number
  text: string
  charCount: number
  needsOcr: boolean
}

/**
 * Extract text from each page of a PDF file.
 * Returns array of PageText with per-page text content.
 */
export async function extractTextPerPage(pdfPath: string): Promise<PageText[]> {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false }).promise

  const pages: PageText[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()

    const texts: string[] = []
    for (const item of content.items) {
      if ('str' in item) {
        texts.push(item.str)
      }
    }

    const combined = texts.join(' ')
    const meaningfulChars = combined.replace(/\s/g, '').length

    pages.push({
      pageNum: i,
      text: combined,
      charCount: meaningfulChars,
      needsOcr: meaningfulChars < 100 // Less than 100 meaningful chars = likely scanned
    })
  }

  logger.info(`Extracted text from ${doc.numPages} pages in ${pdfPath}`)
  return pages
}

/**
 * Combine all page texts into a single string.
 */
export function combinePageTexts(pages: PageText[]): string {
  return pages.map((p) => `[Page ${p.pageNum}]\n${p.text}`).join('\n\n')
}

/**
 * Check if a PDF is encrypted/password-protected.
 */
export async function checkEncrypted(pdfPath: string): Promise<boolean> {
  try {
    const data = new Uint8Array(fs.readFileSync(pdfPath))
    await pdfjsLib.getDocument({ data, useWorkerFetch: false }).promise
    return false
  } catch (err: unknown) {
    const msg = String(err)
    if (msg.includes('password') || msg.includes('encrypted')) {
      return true
    }
    throw err
  }
}

/**
 * Try to open encrypted PDF with provided password.
 */
export async function extractTextWithPassword(pdfPath: string, password: string): Promise<PageText[]> {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, password, useWorkerFetch: false }).promise

  const pages: PageText[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const texts = content.items.filter((item) => 'str' in item).map((item) => ('str' in item ? item.str : ''))
    const combined = texts.join(' ')
    const meaningfulChars = combined.replace(/\s/g, '').length

    pages.push({
      pageNum: i,
      text: combined,
      charCount: meaningfulChars,
      needsOcr: meaningfulChars < 30
    })
  }

  return pages
}
