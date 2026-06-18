import * as fs from 'fs'
import * as crypto from 'crypto'
import { getConfig } from '../config/store'
import { logger } from '../utils/logger'

// pdfjs-dist & canvas for PDF→image rendering
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')
const { createCanvas } = require('@napi-rs/canvas')

const canvasFactory = {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height)
    const context = canvas.getContext('2d')
    return { canvas, context }
  },
  reset(c: { canvas: ReturnType<typeof createCanvas>; context: unknown }, w: number, h: number) {
    c.canvas.width = w; c.canvas.height = h
  },
  destroy(_c: { canvas: ReturnType<typeof createCanvas>; context: unknown }) {}
}

async function renderPageToPng(pdfPath: string, pageNum: number, scale = 1.5): Promise<Buffer> {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, CanvasFactory: canvasFactory }).promise
  const page = await doc.getPage(pageNum)
  const viewport = page.getViewport({ scale })
  const { canvas, context } = canvasFactory.create(viewport.width, viewport.height)
  await page.render({ canvasContext: context as unknown as CanvasRenderingContext2D, viewport }).promise
  return canvas.toBuffer('image/png')
}

/**
 * Call Aliyun OCR RecognizeMultiLanguage via raw HTTPS (SDK has broken Languages serialization).
 */
export async function recognizePdfWithOcr(pdfPath: string): Promise<string> {
  const config = getConfig()
  if (!config.ocrAccessKeyId || !config.ocrAccessKeySecret) {
    throw new Error('OCR 服务未配置。请在设置页面配置阿里云 OCR AccessKey。')
  }

  const akId = config.ocrAccessKeyId
  const akSecret = config.ocrAccessKeySecret

  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, CanvasFactory: canvasFactory }).promise
  const pageCount = doc.numPages
  logger.info(`OCR: ${pdfPath} has ${pageCount} pages`)

  const pageTexts: string[] = []
  let failedPages = 0

  for (let i = 1; i <= pageCount; i++) {
    try {
      logger.info(`OCR page ${i}/${pageCount}`)
      const png = await renderPageToPng(pdfPath, i, 1.5)
      const text = await callOcrApi(png, akId, akSecret)
      if (text.trim()) pageTexts.push(`[Page ${i}]\n${text}`)
    } catch (err: unknown) {
      failedPages++
      const msg = String(err)
      logger.error(`OCR page ${i} failed: ${msg}`)
      if (msg.includes('InvalidAccessKeyId') || msg.includes('invalid')) throw new Error('阿里云 AccessKey 无效')
      if (msg.includes('quota') || msg.includes('InsufficientBalance')) throw new Error('阿里云 OCR 额度不足')
      if (msg.includes('timeout') || msg.includes('ECONNREFUSED')) throw new Error('阿里云 OCR 连接超时')
      pageTexts.push(`[Page ${i}]\n[OCR failed]`)
    }
  }

  if (failedPages > 0 && failedPages === pageCount) {
    throw new Error(`全部 ${pageCount} 页 OCR 识别失败`)
  }

  return pageTexts.join('\n\n')
}

/**
 * Raw HTTPS call to Aliyun RecognizeMultiLanguage with HMAC-SHA1 signing.
 */
async function callOcrApi(imageBuffer: Buffer, akId: string, akSecret: string): Promise<string> {
  const nonce =Date.now().toString() + Math.random().toString(36).slice(2)
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

  const params: Record<string, string> = {
    Action: 'RecognizeMultiLanguage',
    Version: '2021-07-07',
    Format: 'JSON',
    SignatureMethod: 'HMAC-SHA1',
    SignatureVersion: '1.0',
    SignatureNonce: nonce,
    Timestamp: timestamp,
    AccessKeyId: akId,
    Languages: 'eng,chn,tai,rus,lading,kor,ja,viet',
    NeedRotate: 'true',
    NeedSortPage: 'true',
    OutputCharInfo: 'false',
    OutputTable: 'true'
  }

  // Build canonical query string
  const sortedKeys = Object.keys(params).sort()
  const queryString = sortedKeys.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&')

  // HMAC-SHA1 signature
  const stringToSign = `POST&${encodeURIComponent('/')}&${encodeURIComponent(queryString)}`
  const signature = crypto.createHmac('sha1', `${akSecret}&`).update(stringToSign).digest('base64')

  const url = `https://ocr-api.cn-hangzhou.aliyuncs.com/?${queryString}&Signature=${encodeURIComponent(signature)}`

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: imageBuffer.buffer.slice(imageBuffer.byteOffset, imageBuffer.byteOffset + imageBuffer.byteLength)
  })

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`HTTP ${resp.status}: ${errText.substring(0, 200)}`)
  }

  const data = await resp.json() as { Code?: string; Message?: string; Data?: string }
  if (data.Code && data.Code !== '200' && data.Code !== '0') {
    throw new Error(data.Message || `API error: ${data.Code}`)
  }

  return extractText(data)
}

function extractText(data: Record<string, unknown>): string {
  if (typeof data.content === 'string' && data.content.trim()) return data.content
  const words = data.prism_wordsInfo as Array<{ word?: string }> | undefined
  if (words?.length) return words.map(w => w.word || '').join(' ')
  return typeof data.Data === 'string' ? data.Data : ''
}

export function isOcrConfigured(): boolean {
  const config = getConfig()
  return !!(config.ocrAccessKeyId && config.ocrAccessKeySecret)
}

export async function testOcrConnection(): Promise<{ success: boolean; message: string }> {
  const config = getConfig()
  if (!config.ocrAccessKeyId || !config.ocrAccessKeySecret) {
    return { success: false, message: '请先配置阿里云 OCR AccessKey 和 Secret' }
  }
  try {
    const testPng = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82])
    await callOcrApi(testPng, config.ocrAccessKeyId, config.ocrAccessKeySecret)
    return { success: true, message: '阿里云 OCR 连接成功（区域: cn-hangzhou）' }
  } catch (err: unknown) {
    const msg = String(err)
    return { success: false, message: `OCR 连接失败: ${msg.length > 100 ? msg.substring(0, 100) + '...' : msg}` }
  }
}
