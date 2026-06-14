import * as fs from 'fs'
import { getConfig } from '../config/store'
import { logger } from '../utils/logger'

/**
 * Call Aliyun OCR RecognizePdf API to extract text from a PDF.
 * This handles scanned/image-based PDFs.
 *
 * Uses the @alicloud/ocr-api20210707 SDK or direct HTTP API.
 * API Reference: https://help.aliyun.com/document_detail/434694.html
 *
 * For now, this is a stub — full implementation requires:
 * 1. Valid Aliyun AccessKey credentials
 * 2. @alicloud/ocr-api20210707 SDK properly configured
 */
export async function recognizePdfWithOcr(pdfPath: string): Promise<string> {
  const config = getConfig()

  if (!config.ocrAccessKeyId || !config.ocrAccessKeySecret) {
    logger.error('OCR credentials not configured')
    throw new Error('OCR 服务未配置。请在设置页面配置阿里云 OCR AccessKey。')
  }

  // Read PDF file
  const pdfBuffer = fs.readFileSync(pdfPath)
  const pdfBase64 = pdfBuffer.toString('base64')

  // TODO: Call Aliyun OCR API with the SDK
  // This requires the @alicloud/ocr-api20210707 package which may need
  // specific configuration. For now, return an informative error.
  logger.info(`OCR requested for ${pdfPath} (${pdfBuffer.length} bytes)`)

  // Placeholder for actual OCR call:
  // const client = new OcrClient({ accessKeyId, accessKeySecret, regionId })
  // const result = await client.recognizePdf({ body: pdfBase64 })
  // return result.data

  throw new Error('OCR 服务尚未完成实现。请先使用文字型 PDF 测试。')
}

/**
 * Check if OCR service is configured and available.
 */
export function isOcrConfigured(): boolean {
  const config = getConfig()
  return !!(config.ocrAccessKeyId && config.ocrAccessKeySecret)
}
