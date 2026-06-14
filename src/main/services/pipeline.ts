import { BrowserWindow } from 'electron'
import { findFileRecordById, updateFileRecord } from '../database/repositories/fileRecordRepo'
import {
  deleteResultsByFileId,
  insertExtractionResult
} from '../database/repositories/extractionResultRepo'
import { parseFilename } from './fileParser'
import { extractTextPerPage, combinePageTexts, checkEncrypted, extractTextWithPassword, needsFullOcr } from './textExtractor'
import { classifyByKeywords, getClassificationPrompt } from './fileClassifier'
import { generateContractNumber } from './contractNumberGenerator'
import { classifyWithLlm, callLlm } from './llmService'
import { recognizePdfWithOcr, isOcrConfigured } from './ocrService'
import { validateField } from './postValidator'
import { logger } from '../utils/logger'

// Contract extraction prompt (40 fields)
const LABOR_CONTRACT_PROMPT = `你是一位专业的HR合同信息提取专家。请从以下OCR识别的合同文本中，严格按照要求提取字段。
只输出一个JSON，不要包含任何其他解释、说明或Markdown标记。
严格约束：不得编造任何信息。若字段在原文中完全没有提及，值设为 null。

注意：合同编号、合同类别、员工系统编号不需要提取，已由系统自动生成。

待提取字段列表（共40个字段）：

{
  "is_signed_both": "",
  "full_name": "",
  "employment_country": "",
  "employer_name": "",
  "gender": "",
  "personal_email": "",
  "work_email": "",
  "start_date": "",
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
- 日期统一转换为 YYYY-MM-DD 格式。
- 金额只保留纯数字，不带任何符号和空格。
- 数字字段只保留整数或小数，不保留单位。
- currency字段使用合同中实际出现的货币代码或货币缩写（大写）。
- 多语言输出原则：原文是英文，信息按英文输出；只有外文则输出外文。
- 仅输出纯JSON，不要包裹在代码块中。

合同原文：
"""
{text}
"""`

const SALARY_ADJUSTMENT_PROMPT = `你是一位专业的HR信息提取专家。请从以下合同内容中提取调薪相关字段。
注意：合同编号、合同类别、员工系统编号已由系统生成，不需要提取。只输出以下字段。

只输出一个JSON，不要包含任何其他解释。

待提取字段：
{
  "full_name": "",
  "effective_date": "",
  "new_monthly_salary": "",
  "new_annual_salary": "",
  "currency": "",
  "notes": ""
}

规则：不得编造，缺失为null。日期统一格式 YYYY-MM-DD。

原文：
"""
{text}
"""`

let abortFlag = false

export function abortProcessing(): void {
  abortFlag = true
}

export function resetAbortFlag(): void {
  abortFlag = false
}

function sendProgress(window: BrowserWindow | null, event: string, data: unknown): void {
  if (window && !window.isDestroyed()) {
    window.webContents.send(event, data)
  }
}

export async function processFiles(fileIds: number[], window?: BrowserWindow | null): Promise<void> {
  const mainWindow = window || BrowserWindow.getAllWindows()[0]
  resetAbortFlag()

  for (const fileId of fileIds) {
    if (abortFlag) {
      logger.info('Processing aborted by user')
      break
    }

    const record = await findFileRecordById(fileId)
    if (!record) continue

    try {
      // Update status to processing
      await updateFileRecord(fileId, { status: 'processing' })
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
          // Try empty password
          try {
            const pages = await extractTextWithPassword(record.file_path, '')
            originalText = combinePageTexts(pages)
          } catch {
            throw new Error('PDF 已加密，请提供密码后重试')
          }
        } else {
          const pages = await extractTextPerPage(record.file_path)
          const fullText = combinePageTexts(pages)

          // Check if OCR is needed
          if (needsFullOcr(pages)) {
            sendProgress(mainWindow, 'process:progress', {
              fileId,
              fileName: record.file_name,
              step: 'OCR 识别',
              percent: 30
            })

            if (isOcrConfigured()) {
              originalText = await recognizePdfWithOcr(record.file_path)
              ocrUsed = true
            } else {
              // Without OCR, use what text we have
              originalText = fullText
              if (!originalText.trim()) {
                throw new Error('PDF 为扫描件且 OCR 未配置。请在设置页面配置阿里云 OCR。')
              }
            }
          } else {
            originalText = fullText
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

      await updateFileRecord(fileId, { original_text: originalText, ocr_used: ocrUsed ? 1 : 0 })
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

      await updateFileRecord(fileId, { contract_type: contractType })

      if (contractType === 'Other') {
        await updateFileRecord(fileId, { status: 'skipped', error_message: '无法识别的文件类型' })
        sendProgress(mainWindow, 'process:file-complete', {
          fileId,
          fileName: record.file_name,
          success: true,
          contractType: 'Other',
          errorMessage: '文件类型未识别，已跳过'
        })
        continue
      }

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

      // Clear previous extraction results
      await deleteResultsByFileId(fileId)

      const prompt = contractType === 'SalaryAdjustment'
        ? SALARY_ADJUSTMENT_PROMPT.replace('{text}', originalText)
        : LABOR_CONTRACT_PROMPT.replace('{text}', originalText)

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
        continue
      }

      // Store extraction results
      for (const [fieldName, value] of Object.entries(extractedFields)) {
        const strValue = value !== null && value !== undefined ? String(value) : null
        const validation = validateField(fieldName, strValue)

        await insertExtractionResult({
          file_record_id: fileId,
          field_name: fieldName,
          extracted_value: strValue,
          manual_value: null,
          validation_status: validation.status,
          validation_message: validation.message
        })
      }

      // Step 5: Post-validation is done inline (validateField above)

      // Mark as completed
      await updateFileRecord(fileId, { status: 'completed' })
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

  sendProgress(mainWindow, 'process:batch-complete', {})
}
