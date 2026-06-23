import * as ExcelJS from 'exceljs'
import { findFileRecordById } from '../database/repositories/fileRecordRepo'
import { findResultsByFileId } from '../database/repositories/extractionResultRepo'
import { getCurrentSequence } from '../database/repositories/sequenceRepo'
import { logger } from '../utils/logger'

// 43 columns in exact order per the requirements (Appendix A)
const COLUMNS = [
  { header: '文件名称', key: 'file_name' },
  { header: '员工系统编号', key: 'employee_id' },
  { header: '合同编号', key: 'contract_number' },
  { header: '合同类别', key: 'contract_type' },
  { header: '是否双签版合同', key: 'is_signed_both' },
  { header: '法定姓名', key: 'full_name' },
  { header: '就职国家/地区', key: 'employment_country' },
  { header: '雇主名称', key: 'employer_name' },
  { header: '性别', key: 'gender' },
  { header: '个人邮箱', key: 'personal_email' },
  { header: '工作邮箱', key: 'work_email' },
  { header: '入职时间', key: 'start_date' },
  { header: '合同类型', key: 'contract_category' },
  { header: '期限类型', key: 'contract_term_type' },
  { header: '合同期限', key: 'contract_duration' },
  { header: '合同期限单位', key: 'contract_duration_unit' },
  { header: '合同生效日期', key: 'contract_start_date' },
  { header: '合同结束日期', key: 'contract_end_date' },
  { header: '试用期时长', key: 'probation_duration' },
  { header: '试用期时长单位', key: 'probation_duration_unit' },
  { header: '岗位名称', key: 'job_title' },
  { header: '税前年薪', key: 'annual_gross_salary' },
  { header: '税前年薪币种', key: 'annual_gross_currency' },
  { header: '税前月薪', key: 'monthly_gross_salary' },
  { header: '税前月薪币种', key: 'monthly_gross_currency' },
  { header: '税前时薪', key: 'hourly_gross_salary' },
  { header: '税前时薪币种', key: 'hourly_gross_currency' },
  { header: '交通补贴', key: 'transportation_allowance' },
  { header: '餐补', key: 'meal_allowance' },
  { header: '奖金', key: 'bonus' },
  { header: '其他补贴福利', key: 'other_allowances' },
  { header: '国籍', key: 'nationality' },
  { header: '生日', key: 'date_of_birth' },
  { header: '年龄', key: 'age' },
  { header: '婚姻状况', key: 'marital_status' },
  { header: '居住地址', key: 'residential_address' },
  { header: '身份证件类型+ID', key: 'identity_document' },
  { header: '电话号码', key: 'phone_number' },
  { header: '社保号', key: 'social_security_number' },
  { header: '出身地', key: 'place_of_birth' },
  { header: '年假天数', key: 'annual_leave_days' },
  { header: '病假天数', key: 'sick_leave_days' },
  { header: '员工开户银行名称', key: 'bank_name' },
  { header: '员工开户银行地址', key: 'bank_address' },
  { header: '员工银行账户名', key: 'bank_account_name' },
  { header: '员工银行账号', key: 'bank_account_number' },
  { header: '员工国际银行账户号码', key: 'iban' },
  { header: '员工银行SWIFT代码', key: 'swift_code' },
  { header: '错误信息', key: 'error_message' }
]

export async function exportToExcel(fileIds: number[], outputPath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = '合同智能提取工具'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('合同提取结果')

  // Set columns with headers
  worksheet.columns = COLUMNS.map((col) => ({
    header: col.header,
    key: col.key,
    width: 22
  }))

  // Style the header row
  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, size: 11 }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  }
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
  headerRow.height = 24

  // Freeze header row
  worksheet.views = [{ state: 'frozen', ySplit: 1 }]

  // Process each file
  let rowIndex = 2
  for (const fileId of fileIds) {
    const record = await findFileRecordById(fileId)
    if (!record || (record.status !== 'completed' && record.status !== 'failed' && record.status !== 'ocr_failed')) continue

    const results = await findResultsByFileId(fileId)
    const fieldMap = new Map<string, string | null>()
    for (const r of results) {
      // Use manual_value if available, otherwise extracted_value
      fieldMap.set(r.field_name, r.manual_value ?? r.extracted_value)
    }

    // Build row data
    const rowData: Record<string, string | null> = {}

    // Error message for failed files
    rowData['error_message'] = record.error_message || null

    // File name (first column)
    rowData['file_name'] = record.file_name

    // System fields (3)
    rowData['employee_id'] = record.employee_id
    // For failed files without contract_number, compute expected number (read-only, no DB increment)
    if (record.contract_number && record.contract_number !== 'null') {
      rowData['contract_number'] = record.contract_number
    } else if (record.employee_id) {
      const seq = await getCurrentSequence(record.employee_id)
      const nextSeq = String(seq + 1).padStart(2, '0')
      rowData['contract_number'] = `${record.employee_id}_${nextSeq}`
    } else {
      rowData['contract_number'] = null
    }
    rowData['contract_type'] = record.contract_type === 'EmploymentContract' ? '劳动合同'
      : record.contract_type === 'SalaryAdjustment' ? '调薪文件'
      : record.contract_type

    // LLM fields (40) — leave empty if not in the extraction results
    for (const col of COLUMNS) {
      if (['file_name', 'employee_id', 'contract_number', 'contract_type'].includes(col.key)) continue
      rowData[col.key] = fieldMap.get(col.key) ?? null
    }

    // Add row
    const row = worksheet.addRow(rowData)

    // Color code validation warnings
    COLUMNS.forEach((col, colIdx) => {
      const cell = row.getCell(colIdx + 1)
      const fieldResult = results.find((r) => r.field_name === col.key)
      if (fieldResult && (fieldResult.validation_status === 'warning' || fieldResult.validation_status === 'error')) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFF00' } // Yellow highlight
        }
        if (fieldResult.validation_message) {
          cell.note = {
            texts: [{ text: fieldResult.validation_message, font: { size: 10 } }]
          }
        }
      }
    })

    // Alternate row styling (zebra striping)
    if (rowIndex % 2 === 0) {
      row.eachCell((cell) => {
        if (!cell.fill || (cell.fill as ExcelJS.Fill).type !== 'pattern') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF2F2F2' }
          }
        }
      })
    }

    rowIndex++
  }

  // Auto-fit column widths (approximate)
  worksheet.columns.forEach((column) => {
    if (column.values) {
      const lengths = column.values
        .filter((v) => v !== undefined && v !== null)
        .map((v) => String(v).length)
      const maxLen = Math.max(...lengths, 10)
      column.width = Math.min(maxLen + 4, 40)
    } else {
      column.width = 20
    }
  })

  // Write file
  await workbook.xlsx.writeFile(outputPath)
  logger.info(`Excel exported to ${outputPath} (${fileIds.length} files)`)
}
