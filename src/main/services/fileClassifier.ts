type ContractType = 'EmploymentContract' | 'SalaryAdjustment' | 'Other'

// Keywords for each document type (case-insensitive matching)
const EMPLOYMENT_KEYWORDS = [
  'employment agreement',
  'employment contract',
  'contract of employment',
  '劳动合同',
  '雇佣合同',
  'labor contract',
  'labour contract',
  'service agreement',
  'terms of employment'
]

const SALARY_KEYWORDS = [
  'salary adjustment',
  'salary increase',
  'salary review',
  '调薪',
  'compensation adjustment',
  'salary revision',
  'pay adjustment',
  'wage adjustment',
  'pay increase',
  'salary change'
]

/**
 * Classify document type by keyword matching on the first N characters of text.
 * Returns null if uncertain (needs LLM classification).
 */
export function classifyByKeywords(text: string): ContractType | null {
  const normalizedText = text.substring(0, 2000).toLowerCase()

  // Check for employment contract keywords
  for (const keyword of EMPLOYMENT_KEYWORDS) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      return 'EmploymentContract'
    }
  }

  // Check for salary adjustment keywords
  for (const keyword of SALARY_KEYWORDS) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      return 'SalaryAdjustment'
    }
  }

  // Additional heuristics
  const hasSalaryTerms = /\b(salary|wage|compensation|remuneration)\b/i.test(normalizedText)
  const hasEmploymentTerms = /\b(employer|employee|probation|termination|dismissal)\b/i.test(normalizedText)
  const hasContractTerms = /\b(agreement|contract|hereby|herein|hereinafter|parties)\b/i.test(normalizedText)

  // Strong indicators for employment contract
  if (hasContractTerms && hasEmploymentTerms) {
    return 'EmploymentContract'
  }

  // Salary document with no employment terms
  if (hasSalaryTerms && !hasEmploymentTerms) {
    return 'SalaryAdjustment'
  }

  // Cannot determine
  return null
}

/**
 * Get the LLM classification prompt.
 */
export function getClassificationPrompt(text: string): string {
  const truncated = text.substring(0, 2000)
  return `判断以下文档属于哪一类，只输出一个单词：
- EmploymentContract（劳动合同）
- SalaryAdjustment（调薪文件）
- Other（其他）

文档开头部分（前2000字符）：
"""
${truncated}
"""`}
