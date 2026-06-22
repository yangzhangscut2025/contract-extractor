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

  const akId = (config.ocrAccessKeyId || '').replace(/[^\x20-\x7E]/g, '').trim()
  const akSecret = (config.ocrAccessKeySecret || '').replace(/[^\x20-\x7E]/g, '').trim()

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
  const urlObj = new URL(url)

  const resp = await new Promise<{ statusCode: number; data: string }>((resolve, reject) => {
    const http = require('https')
    const req = http.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': imageBuffer.length
      }
    }, (res: any) => {
      let data = ''
      res.on('data', (c: string) => data += c)
      res.on('end', () => resolve({ statusCode: res.statusCode, data }))
    })
    req.on('error', reject)
    req.write(imageBuffer)
    req.end()
  })

  if (resp.statusCode !== 200) {
    throw new Error(`HTTP ${resp.statusCode}: ${resp.data.substring(0, 200)}`)
  }

  const data = JSON.parse(resp.data) as { Code?: string; Message?: string; Data?: string }

  if (data.Code && data.Code !== '200' && data.Code !== '0') {
    throw new Error(data.Message || `API error: ${data.Code}`)
  }

  return extractText(data as Record<string, unknown>)
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
    // Generate valid test image (API requires min 15x15)
    const c = createCanvas(100, 100)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 100, 100)
    ctx.fillStyle = '#000'; ctx.font = '14px sans-serif'
    ctx.fillText('Test', 10, 50)
    const testPng = c.toBuffer('image/png')
    await callOcrApi(testPng, config.ocrAccessKeyId, config.ocrAccessKeySecret)
    return { success: true, message: '阿里云 OCR 连接成功（区域: cn-hangzhou）' }
  } catch (err: unknown) {
    const msg = String(err)
    return { success: false, message: `OCR 连接失败: ${msg.length > 100 ? msg.substring(0, 100) + '...' : msg}` }
  }
}
