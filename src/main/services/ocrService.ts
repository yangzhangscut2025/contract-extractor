import * as fs from 'fs'
import { Readable } from 'stream'
import { getConfig } from '../config/store'
import { logger } from '../utils/logger'

// pdfjs-dist & canvas for PDF→image rendering
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')
const { createCanvas } = require('@napi-rs/canvas')

// Aliyun OCR SDK (CJS default export)
const OcrClient = require('@alicloud/ocr-api20210707').default
const { RecognizeMultiLanguageRequest } = require('@alicloud/ocr-api20210707')
const $OpenApi = require('@alicloud/openapi-client')

function createOcrClient() {
  const config = getConfig()
  if (!config.ocrAccessKeyId || !config.ocrAccessKeySecret) {
    throw new Error('OCR 服务未配置。请在设置页面配置阿里云 OCR AccessKey。')
  }
  const credential = new $OpenApi.Config({
    accessKeyId: config.ocrAccessKeyId,
    accessKeySecret: config.ocrAccessKeySecret
  })
  credential.endpoint = `ocr-api.${config.ocrRegion || 'cn-hangzhou'}.aliyuncs.com`
  return new OcrClient(credential)
}

// Custom canvas factory: bridges @napi-rs/canvas to pdfjs-dist's expected API
const canvasFactory = {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height)
    const context = canvas.getContext('2d')
    return { canvas, context }
  },
  reset(canvasAndContext: { canvas: ReturnType<typeof createCanvas>; context: unknown }, width: number, height: number) {
    canvasAndContext.canvas.width = width
    canvasAndContext.canvas.height = height
  },
  destroy(_canvasAndContext: { canvas: ReturnType<typeof createCanvas>; context: unknown }) {
    // no-op
  }
}

/**
 * Render PDF page to PNG buffer using pdfjs-dist + @napi-rs/canvas.
 */
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
 * OCR a single image buffer via Aliyun RecognizeMultiLanguage.
 */
async function ocrImage(client: ReturnType<typeof createOcrClient>, imageBuffer: Buffer): Promise<string> {
  const stream = Readable.from(imageBuffer)
  const request = new RecognizeMultiLanguageRequest({
    languages: ['auto'],
    body: stream,
    needRotate: true,
    needSortPage: true,
    outputCharInfo: false,
    outputTable: true
  })

  const response = await client.recognizeMultiLanguage(request)
  const data = response?.body?.data ? JSON.parse(response.body.data) : {}
  return extractText(data)
}

function extractText(data: Record<string, unknown>): string {
  if (typeof data.content === 'string' && data.content.trim()) return data.content
  const words = data.prism_wordsInfo as Array<{ word?: string }> | undefined
  if (words?.length) return words.map(w => w.word || '').join(' ')
  return typeof data.data === 'string' ? data.data : ''
}

/**
 * Recognize text from a PDF via OCR.
 * Renders each page to PNG, then calls Aliyun OCR per page.
 */
export async function recognizePdfWithOcr(pdfPath: string): Promise<string> {
  const config = getConfig()
  if (!config.ocrAccessKeyId || !config.ocrAccessKeySecret) {
    throw new Error('OCR 服务未配置。请在设置页面配置阿里云 OCR AccessKey。')
  }

  const client = createOcrClient()

  // Get page count
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, CanvasFactory: canvasFactory }).promise
  const pageCount = doc.numPages
  logger.info(`OCR: ${pdfPath} has ${pageCount} pages`)

  const pageTexts: string[] = []

  for (let i = 1; i <= pageCount; i++) {
    try {
      logger.info(`OCR page ${i}/${pageCount}`)
      const png = await renderPageToPng(pdfPath, i, 1.5)
      const text = await ocrImage(client, png)
      if (text.trim()) {
        pageTexts.push(`[Page ${i}]\n${text}`)
      }
    } catch (err: unknown) {
      const msg = String(err)
      logger.error(`OCR page ${i} failed: ${msg}`)
      if (msg.includes('InvalidAccessKeyId') || msg.includes('invalid')) {
        throw new Error('阿里云 AccessKey 无效，请检查设置。')
      }
      if (msg.includes('quota') || msg.includes('InsufficientBalance')) {
        throw new Error('阿里云 OCR 额度不足，请充值或购买资源包。')
      }
      if (msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
        throw new Error('阿里云 OCR 连接超时，请检查网络。')
      }
      // Single page failure is non-fatal
      pageTexts.push(`[Page ${i}]\n[OCR failed]`)
    }
  }

  const result = pageTexts.join('\n\n')
  logger.info(`OCR completed: ${result.length} chars from ${pageCount} pages`)
  return result
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
    const client = createOcrClient()
    // Test with a 1x1 white PNG (pre-encoded)
    const testPng = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
      0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
      0x44, 0xAE, 0x42, 0x60, 0x82
    ])
    const _ = await ocrImage(client as ReturnType<typeof createOcrClient>, testPng)
    return { success: true, message: '阿里云 OCR 连接成功（区域: ' + (config.ocrRegion || 'cn-hangzhou') + '）' }
  } catch (err: unknown) {
    const msg = String(err)
    return { success: false, message: `OCR 连接失败: ${msg.length > 100 ? msg.substring(0, 100) + '...' : msg}` }
  }
}
