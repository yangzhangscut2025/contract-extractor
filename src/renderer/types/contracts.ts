export interface FileRecord {
  id: number
  file_path: string
  file_name: string
  file_md5: string
  file_size: number | null
  employee_id: string | null
  contract_number: string | null
  contract_type: 'EmploymentContract' | 'SalaryAdjustment' | 'Other' | null
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
  ocr_used: boolean
  original_text: string | null
  error_message: string | null
  is_verified: boolean
  created_at: string
  updated_at: string
}

export interface ExtractionResult {
  id: number
  file_record_id: number
  field_name: string
  extracted_value: string | null
  manual_value: string | null
  validation_status: 'ok' | 'warning' | 'error'
  validation_message: string | null
  // Computed on read: effective_value = manual_value ?? extracted_value
  effectiveValue?: string | null
}

export interface FieldDefinition {
  index: number
  chinese_name: string
  english_name: string
  type: 'string' | 'number' | 'date'
  source: 'system' | 'llm'
}

export interface ProcessStatus {
  isRunning: boolean
  totalFiles: number
  completedFiles: number
  failedFiles: number
  currentFileId: number | null
  currentStep: string | null
}

export interface ProgressEvent {
  fileId: number
  fileName: string
  step: string
  percent: number
}

export interface FileCompleteEvent {
  fileId: number
  fileName: string
  success: boolean
  contractType: string | null
  errorMessage: string | null
}

export interface ProcessErrorEvent {
  fileId: number
  fileName: string
  step: string
  message: string
}
