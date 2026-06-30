import { BrowserWindow } from 'electron'
import { findFileRecordById, updateFileRecord } from '../database/repositories/fileRecordRepo'
import {
  deleteResultsByFileId,
  insertExtractionResult,
  findResultsByFileId
} from '../database/repositories/extractionResultRepo'
import { parseFilename } from './fileParser'
import { extractTextPerPage, combinePageTexts, checkEncrypted, extractTextWithPassword } from './textExtractor'
import { classifyByKeywords, getClassificationPrompt } from './fileClassifier'
import { generateContractNumber } from './contractNumberGenerator'
import { classifyWithLlm, callLlm } from './llmService'
import { recognizePdfWithOcr, isOcrConfigured } from './ocrService'
import { validateField } from './postValidator'
import { logger } from '../utils/logger'
import { ConcurrencyLimiter } from '../utils/concurrency'

// Max chars to store in original_text to prevent DB bloat
const MAX_ORIGINAL_TEXT_LENGTH = 100_000

// Contract extraction prompt (42 fields, used for both EmploymentContract and SalaryAdjustment)
const EXTRACTION_PROMPT = `你是一位专业的HR合同信息提取专家。请从以下OCR识别的合同文本中，严格按照要求提取字段。
只输出一个JSON，不要包含任何其他解释、说明或Markdown标记。
严格约束：不得编造任何信息。若字段在原文中完全没有提及，值设为 null。

注意：合同编号、合同类别、员工系统编号不需要提取，已由系统自动生成。

待提取字段列表（共44个字段）：

{
  "is_signed_both": "",
  "full_name": "",
  "employment_country": "",
  "employer_name": "",
  "gender": "",
  "personal_email": "",
  "work_email": "",
  "start_date": "",
  "contract_category": "",
  "contract_term_type": "",
  "contract_duration": "",
  "contract_duration_unit": "",
  "contract_start_date": "",
  "contract_end_date": "",
  "probation_duration": "",
  "probation_duration_unit": "",
  "job_title": "",
  "annual_gross_salary": "",
  "annual_gross_currency": "",
  "monthly_gross_salary": "",
  "monthly_gross_currency": "",
  "hourly_gross_salary": "",
  "hourly_gross_currency": "",
  "transportation_allowance": "",
  "meal_allowance": "",
  "bonus": "",
  "other_allowances": "",
  "nationality": "",
  "date_of_birth": "",
  "age": "",
  "marital_status": "",
  "residential_address": "",
  "identity_document": "",
  "phone_number": "",
  "social_security_number": "",
  "place_of_birth": "",
  "annual_leave_days": "",
  "sick_leave_days": "",
  "bank_name": "",
  "bank_address": "",
  "bank_account_name": "",
  "bank_account_number": "",
  "iban": "",
  "swift_code": ""
}

提取规则：
- contract_category：合同类型，必须为以下之一：全职劳动合同 / 顾问协议 / 竞业协议 / 隐私协议 / 授权协议 / 实习协议 / Offer / 其他
- contract_term_type：期限类型，若合同明确为永久/无固定期限则填"无固定期限"，否则填"固定期限"
- gender：男性/女性/未知。若原文中能明确判断性别（如 Mr./Mrs./Male/Female/男/女），提取对应值"男"或"女"。若无法判断（如名字性别不明、无称呼前缀、无性别代词），填"未知"。不得返回null或空字符串。
- 日期统一转换为 YYYY/MM/DD 格式。
- **contract_start_date（重要）**：
  * 这是合同的生效/执行日期，是提取的关键字段。
  * 优先查找："Effective Date"、"Commencement Date"、"Start Date"、"Contract Date"、"生效日期"、"合同生效日期"、"开始日期"、"执行日期"。
  * 对于调薪文件/薪资调整函：查找 "Salary Adjustment Date"、"Effective Date of Change"、"调薪生效日期"、"调整生效日期"、"New Salary Effective"、"Effective from"、"With effect from"。
  * 如果找不到明确的生效日期，查找文档中最新的日期（通常在签名附近或文档开头）。
  * 如果仍找不到，使用 Signature Date（签署日期）。
  * 绝对不能返回 null，除非文档确实没有任何日期。
- contract_end_date：优先取合同结束日期；若为无固定期限合同（permanent/indefinite），设为 null。
- 金额只保留纯数字，不带任何符号和空格。
- 数字字段只保留整数或小数，不保留单位。
- currency字段使用合同中实际出现的货币代码或货币缩写（大写）。
- 多语言输出原则：原文是英文，信息按英文输出；只有外文则输出外文。
- 仅输出纯JSON，不要包裹在代码块中。

合同原文：
"""
{text}
"""`

let abortFlag = false

// Password prompt mechanism for encrypted PDFs
const passwordResolvers = new Map<number, (password: string) => void>()

export function resolvePassword(fileId: number, password: string): void {
  const resolver = passwordResolvers.get(fileId)
  if (resolver) {
    passwordResolvers.delete(fileId)
    resolver(password)
  }
}

function requestPassword(fileId: number, fileName: string, window: BrowserWindow): Promise<string> {
  return new Promise<string>((resolve) => {
    passwordResolvers.set(fileId, resolve)
    if (window && !window.isDestroyed()) {
      window.webContents.send('process:request-password', { fileId, fileName })
    }
    // Timeout after 5 minutes to avoid leaking
    setTimeout(() => {
      if (passwordResolvers.has(fileId)) {
        passwordResolvers.delete(fileId)
        resolve('')
      }
    }, 300000)
  })
}

export interface ProcessState {
  isRunning: boolean
  totalFiles: number
  completedFiles: number
  failedFiles: number
  currentFileId: number | null
  currentStep: string | null
}

export const processState: ProcessState = {
  isRunning: false,
  totalFiles: 0,
  completedFiles: 0,
  failedFiles: 0,
  currentFileId: null,
  currentStep: null
}

export function abortProcessing(): void {
  abortFlag = true
}

export function resetAbortFlag(): void {
  abortFlag = false
}

function resetProcessState(): void {
  processState.isRunning = false
  processState.totalFiles = 0
  processState.completedFiles = 0
  processState.failedFiles = 0
  processState.currentFileId = null
  processState.currentStep = null
}

function sendProgress(window: BrowserWindow | null, event: string, data: unknown): void {
  // Update process state for status queries
  if (event === 'process:progress') {
    const d = data as { fileId: number; fileName: string; step: string; percent: number }
    processState.currentFileId = d.fileId
    processState.currentStep = d.step
  } else if (event === 'process:file-complete') {
    const d = data as { success: boolean }
    if (d.success) {
      processState.completedFiles++
    } else {
      processState.failedFiles++
    }
  }

  if (window && !window.isDestroyed()) {
    window.webContents.send(event, data)
  }
}

export async function processFiles(fileIds: number[], window?: BrowserWindow | null): Promise<void> {
  const mainWindow = window || BrowserWindow.getAllWindows()[0]
  resetAbortFlag()
  resetProcessState()

  processState.isRunning = true
  processState.totalFiles = fileIds.length

  // Process up to 3 files concurrently
  const limiter = new ConcurrencyLimiter(3)

  const tasks = fileIds.map((fileId) =>
    limiter.run(() => processOneFile(fileId, mainWindow))
  )

  await Promise.allSettled(tasks)

  processState.isRunning = false
  processState.currentFileId = null
  processState.currentStep = null
  sendProgress(mainWindow, 'process:batch-complete', {})
}

async function processOneFile(fileId: number, mainWindow: BrowserWindow, retry = false): Promise<void> {
  if (abortFlag) {
    logger.info('Processing aborted by user, skipping file')
    return
  }

  const record = await findFileRecordById(fileId)
  if (!record) return

  try {
    // Update status to processing, clear old translation cache
    await updateFileRecord(fileId, { status: 'processing', translated_text: null })
    sendProgress(mainWindow, 'process:progress', {
      fileId,
      fileName: record.file_name,
      step: '开始处理',
      percent: 0
    })

      // Step 0: Parse filename → employee_id
      const employeeId = parseFilename(record.file_name)
      await updateFileRecord(fileId, { employee_id: employeeId })
      sendProgress(mainWindow, 'process:progress', {
        fileId,
        fileName: record.file_name,
        step: '文件名解析',
        percent: 5
      })

      // Step 2: Text extraction
      let originalText = ''
      let ocrUsed = false
      let ocrFailed = false
      let ocrErrorMessage = ''

      sendProgress(mainWindow, 'process:progress', {
        fileId,
        fileName: record.file_name,
        step: '文本提取',
        percent: 10
      })

      try {
        // Check if encrypted
        const isEncrypted = await checkEncrypted(record.file_path)
        if (isEncrypted) {
          // Ask user for password
          const password = await requestPassword(fileId, record.file_name, mainWindow)
          try {
            const pages = await extractTextWithPassword(record.file_path, password)
            originalText = combinePageTexts(pages)
          } catch {
            throw new Error('PDF 密码错误或无法解密，请检查密码后重试')
          }
        } else {
          // Step 1: try pdfjs text extraction first (free, works for most PDFs)
          const pages = await extractTextPerPage(record.file_path)
          originalText = combinePageTexts(pages)

          // Step 2: if text quality is poor and OCR is configured, try OCR
          const wordCount = (originalText.match(/[a-zA-Z一-鿿]{2,}/g) || []).length
          if (wordCount < 20 && isOcrConfigured()) {
            sendProgress(mainWindow, 'process:progress', {
              fileId, fileName: record.file_name,
              step: 'OCR 识别', percent: 30
            })
            try {
              originalText = await recognizePdfWithOcr(record.file_path)
              ocrUsed = true
            } catch (ocrErr) {
              logger.error(`OCR failed: ${String(ocrErr)}`)
              ocrFailed = true
              ocrErrorMessage = String(ocrErr).substring(0, 200)
              await updateFileRecord(fileId, {
                error_message: `[OCR失败，使用PDF文字层] ${ocrErrorMessage}`
              })
              // Keep pdfjs text as-is, don't throw
            }
          }

          if (!originalText.trim()) {
            throw new Error('PDF 文字层为空。若为扫描件，请配置 OCR。')
          }
        }
      } catch (err: unknown) {
        const msg = String(err)
        if (msg.includes('OCR') || msg.includes('加密')) {
          throw err
        }
        // For other extraction errors, try to proceed
        originalText = ''
      }

      // Truncate to prevent DB bloat (100KB limit)
      const truncatedText = originalText.length > MAX_ORIGINAL_TEXT_LENGTH
        ? originalText.substring(0, MAX_ORIGINAL_TEXT_LENGTH) + '\n\n[... 原文过长，已截断 ...]'
        : originalText
      await updateFileRecord(fileId, { original_text: truncatedText, ocr_used: ocrUsed ? 1 : 0 })
      sendProgress(mainWindow, 'process:progress', {
        fileId,
        fileName: record.file_name,
        step: '文本提取完成',
        percent: 40
      })

      // Step 1: Classify document type
      sendProgress(mainWindow, 'process:progress', {
        fileId,
        fileName: record.file_name,
        step: '文件分类',
        percent: 45
      })

      let contractType = classifyByKeywords(originalText)
      if (!contractType) {
        // Use LLM for classification
        const prompt = getClassificationPrompt(originalText)
        const llmType = await classifyWithLlm(prompt)
        contractType = llmType as 'EmploymentContract' | 'SalaryAdjustment' | 'Other'
      }

      // Default to EmploymentContract if classification is uncertain
      // (multilingual contracts may not match keywords or LLM classification)
      if (contractType === 'Other') {
        contractType = 'EmploymentContract'
      }

      await updateFileRecord(fileId, { contract_type: contractType })

      // Step 3: Generate contract number
      sendProgress(mainWindow, 'process:progress', {
        fileId,
        fileName: record.file_name,
        step: '生成合同编号',
        percent: 50
      })

      const contractNumber = await generateContractNumber(employeeId)
      await updateFileRecord(fileId, { contract_number: contractNumber })

      // Step 4: LLM extraction
      sendProgress(mainWindow, 'process:progress', {
        fileId,
        fileName: record.file_name,
        step: '大模型提取',
        percent: 55
      })

      // Save old manual values before clearing
      const oldResults = await findResultsByFileId(fileId)
      const manualValues = new Map<string, string | null>()
      for (const r of oldResults) {
        if (r.manual_value !== null && r.manual_value !== undefined) {
          manualValues.set(r.field_name, r.manual_value)
        }
      }

      // Clear previous extraction results
      await deleteResultsByFileId(fileId)

      const prompt = EXTRACTION_PROMPT.replace('{text}', originalText)

      let extractedFields: Record<string, unknown> = {}
      try {
        extractedFields = await callLlm(prompt)
        sendProgress(mainWindow, 'process:progress', {
          fileId,
          fileName: record.file_name,
          step: '大模型提取完成',
          percent: 80
        })
      } catch (err: unknown) {
        logger.error(`LLM extraction failed for file ${fileId}: ${String(err)}`)
        await updateFileRecord(fileId, {
          status: 'failed',
          error_message: `大模型提取失败: ${String(err)}`
        })
        sendProgress(mainWindow, 'process:file-complete', {
          fileId,
          fileName: record.file_name,
          success: false,
          contractType,
          errorMessage: String(err)
        })
        return
      }

      // Post-extraction gap fill: if contract_start_date is missing, ask LLM specifically
      if (!extractedFields['contract_start_date']) {
        sendProgress(mainWindow, 'process:progress', {
          fileId,
          fileName: record.file_name,
          step: '补提生效日期',
          percent: 78
        })
        try {
          const datePrompt = `从以下文档中提取"合同生效日期"或"调薪生效日期"。只输出一个日期字符串（YYYY/MM/DD格式），不要JSON，不要其他文字。若确实没有任何日期，输出"NONE"。

常见日期出现位置：文档开头、签名附近、薪酬信息附近。
常见标签：Effective Date, Commencement Date, Start Date, 生效日期, Salary Adjustment Date, Effective from, 执行日期。

文档：
"""
${originalText.substring(0, 4000)}
"""`

          const dateResult = await callLlm(datePrompt)
          const trimmed = String(dateResult).trim()
          if (trimmed && trimmed !== 'NONE' && /^\d{4}[-\/]\d{2}[-\/]\d{2}$/.test(trimmed)) {
            extractedFields['contract_start_date'] = trimmed
            logger.info(`Gap fill: contract_start_date = ${trimmed}`)
          }
        } catch (gapErr) {
          logger.warn(`Gap fill failed for file ${fileId}: ${String(gapErr)}`)
        }
      }

      // Store extraction results
      for (const [fieldName, value] of Object.entries(extractedFields)) {
        const strValue = value !== null && value !== undefined ? String(value) : null
        const validation = validateField(fieldName, strValue)

        // Restore old manual value if user previously edited this field
        const oldManual = manualValues.get(fieldName) ?? null

        await insertExtractionResult({
          file_record_id: fileId,
          field_name: fieldName,
          extracted_value: strValue,
          manual_value: oldManual,
          validation_status: validation.status,
          validation_message: validation.message
        })
      }

      // Step 5: Post-validation is done inline (validateField above)

      // Mark as completed (or OCR failed if fallback was used)
      await updateFileRecord(fileId, {
        status: ocrFailed ? 'ocr_failed' : 'completed'
      })
      sendProgress(mainWindow, 'process:file-complete', {
        fileId,
        fileName: record.file_name,
        success: true,
        contractType,
        errorMessage: null
      })

    } catch (err: unknown) {
      const errorMessage = String(err)
      logger.error(`Processing failed for file ${fileId}: ${errorMessage}`)

      // Retry once for transient errors
      const isPermanent = errorMessage.includes('无法识别的文件类型') ||
                          errorMessage.includes('AccessKey') ||
                          errorMessage.includes('OCR 服务未配置') ||
                          errorMessage.includes('API Key')
      if (!retry && !isPermanent) {
        logger.info(`Retrying file ${fileId} (attempt 2/2)`)
        await new Promise((r) => setTimeout(r, 3000))
        return await processOneFile(fileId, mainWindow, true)
      }

      await updateFileRecord(fileId, {
        status: 'failed',
        error_message: errorMessage
      })
      sendProgress(mainWindow, 'process:error', {
        fileId,
        fileName: record.file_name,
        step: 'error',
        message: errorMessage
      })
    }
}
