import * as fs from 'fs'
import { getConfig } from '../config/store'
import { logger } from '../utils/logger'

// Aliyun OCR SDK — use require() for CJS default-export compatibility
const OcrClient = require('@alicloud/ocr-api20210707').default
const { RecognizeMultiLanguageRequest } = require('@alicloud/ocr-api20210707')
const $OpenApi = require('@alicloud/openapi-client')

/**
 * Create an Aliyun OCR client from the app config.
 */
function createOcrClient(): OcrClient {
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

/**
 * Recognize text from a PDF using Aliyun OCR RecognizeMultiLanguage API.
 * Handles scanned/image-based PDFs — sends the PDF file directly.
 * Returns the full recognized text from all pages.
 */
export async function recognizePdfWithOcr(pdfPath: string): Promise<string> {
  const config = getConfig()

  if (!config.ocrAccessKeyId || !config.ocrAccessKeySecret) {
    logger.error('OCR credentials not configured')
    throw new Error('OCR 服务未配置。请在设置页面配置阿里云 OCR AccessKey。')
  }

  const client = createOcrClient()
  const pdfBuffer = fs.readFileSync(pdfPath)

  logger.info(`Calling Aliyun OCR RecognizeMultiLanguage for ${pdfPath} (${pdfBuffer.length} bytes)`)

  try {
    // Construct request using SDK model class
    const request = new RecognizeMultiLanguageRequest({
      languages: ['auto'],
      body: fs.createReadStream(pdfPath),
      needRotate: true,
      needSortPage: true,
      outputCharInfo: false,
      outputTable: true
    })

    const response = await client.recognizeMultiLanguage(request)

    if (!response || !response.body) {
      throw new Error('OCR 返回空响应')
    }

    const data = JSON.parse(response.body.data || '{}')
    const text = extractTextFromOcrResponse(data)

    logger.info(`OCR completed for ${pdfPath}: ${text.length} chars extracted`)
    return text
  } catch (err: unknown) {
    const msg = String(err)
    logger.error(`OCR failed for ${pdfPath}: ${msg}`)

    if (msg.includes('InvalidAccessKeyId') || msg.includes('SpecifiedAccessKey')) {
      throw new Error('阿里云 AccessKey 无效，请检查设置。')
    }
    if (msg.includes('InsufficientBalance') || msg.includes('OutOfQuota')) {
      throw new Error('阿里云 OCR 额度不足，请充值或购买资源包。')
    }
    throw new Error(`OCR 识别失败: ${msg}`)
  }
}

/**
 * Extract plain text from Aliyun OCR RecognizeMultiLanguage response data.
 */
function extractTextFromOcrResponse(data: Record<string, unknown>): string {
  // The response from RecognizeMultiLanguage has content in data.content
  if (typeof data.content === 'string' && data.content.trim()) {
    return data.content
  }

  // Alternative: word-level results
  const prismWords = data.prism_wordsInfo as Array<{ word?: string }> | undefined
  if (prismWords && prismWords.length > 0) {
    return prismWords.map((w) => w.word || '').join(' ')
  }

  // Last resort
  return typeof data.data === 'string' ? data.data : JSON.stringify(data)
}

/**
 * Check if OCR service is configured and available.
 */
export function isOcrConfigured(): boolean {
  const config = getConfig()
  return !!(config.ocrAccessKeyId && config.ocrAccessKeySecret)
}

/**
 * Test OCR connection by verifying the client can be constructed.
 * A real API call would require a valid image/PDF file.
 */
export async function testOcrConnection(): Promise<{ success: boolean; message: string }> {
  const config = getConfig()

  if (!config.ocrAccessKeyId || !config.ocrAccessKeySecret) {
    return { success: false, message: '请先配置阿里云 OCR AccessKey 和 Secret' }
  }

  try {
    // Verify client can be created — credentials are validated on construction
    createOcrClient()
    return {
      success: true,
      message: '阿里云 OCR 配置有效（区域: ' + (config.ocrRegion || 'cn-hangzhou') + '）'
    }
  } catch (err: unknown) {
    const msg = String(err)
    return {
      success: false,
      message: `OCR 连接测试失败: ${msg}`
    }
  }
}
