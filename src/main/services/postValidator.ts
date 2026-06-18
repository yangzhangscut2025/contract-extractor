export interface ValidationResult {
  status: 'ok' | 'warning' | 'error'
  message: string | null
}

// Email regex
const EMAIL_REGEX = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/

// Date formats to try parsing
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

// Phone regex: after stripping formatting chars, must have >= 8 digits
const PHONE_DIGIT_THRESHOLD = 8

// Amount regex: only digits and at most one decimal point
const AMOUNT_REGEX = /^\d+(\.\d+)?$/

// Age range
const AGE_MIN = 0
const AGE_MAX = 120

/**
 * Validate a single extracted field value.
 */
export function validateField(fieldName: string, value: string | null): ValidationResult {
  if (value === null || value === undefined || value === '') {
    return { status: 'ok', message: null }
  }

  const strValue = String(value)

  // Gender
  if (fieldName === 'gender') {
    if (strValue !== '男' && strValue !== '女' && strValue !== '未知') {
      return { status: 'warning', message: '期望值：男/女/未知' }
    }
    return { status: 'ok', message: null }
  }

  // Email fields
  if (fieldName === 'personal_email' || fieldName === 'work_email') {
    if (!EMAIL_REGEX.test(strValue)) {
      return { status: 'warning', message: '待核对邮箱' }
    }
    return { status: 'ok', message: null }
  }

  // Date fields
  if (fieldName === 'start_date' || fieldName === 'contract_start_date' ||
      fieldName === 'contract_end_date' || fieldName === 'date_of_birth' ||
      fieldName === 'effective_date') {
    if (!DATE_REGEX.test(strValue)) {
      return { status: 'warning', message: '日期格式异常' }
    }
    const year = parseInt(strValue.substring(0, 4))
    if (year < 1900 || year > 2100) {
      return { status: 'warning', message: '日期超出范围' }
    }
    return { status: 'ok', message: null }
  }

  // Phone number
  if (fieldName === 'phone_number') {
    const digitsOnly = strValue.replace(/[\s+\-()]/g, '')
    if (digitsOnly.replace(/\D/g, '').length < PHONE_DIGIT_THRESHOLD) {
      return { status: 'warning', message: '电话格式可疑' }
    }
    return { status: 'ok', message: null }
  }

  // Amount fields (salary, allowance)
  if (fieldName === 'annual_gross_salary' || fieldName === 'monthly_gross_salary' ||
      fieldName === 'hourly_gross_salary' ||
      fieldName === 'transportation_allowance' || fieldName === 'meal_allowance') {
    if (strValue === 'null' || strValue === 'nil') {
      return { status: 'ok', message: null }
    }
    if (!AMOUNT_REGEX.test(strValue.replace(/[, ]/g, ''))) {
      return { status: 'warning', message: '金额待清理' }
    }
    return { status: 'ok', message: null }
  }

  // Contract term type
  if (fieldName === 'contract_term_type') {
    if (strValue !== '有固定期限' && strValue !== '无固定期限') {
      return { status: 'warning', message: '期望值：有固定期限 或 无固定期限' }
    }
    return { status: 'ok', message: null }
  }

  // Age
  if (fieldName === 'age') {
    const age = parseInt(strValue)
    if (isNaN(age) || age < AGE_MIN || age > AGE_MAX) {
      return { status: 'warning', message: '年龄超出范围' }
    }
    return { status: 'ok', message: null }
  }

  return { status: 'ok', message: null }
}

