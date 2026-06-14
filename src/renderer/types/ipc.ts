// IPC channel name constants
export const IPC_CHANNELS = {
  // File
  FILE_IMPORT: 'file:import',
  FILE_ADD_BY_PATHS: 'file:add-by-paths',
  FILE_LIST: 'file:list',
  FILE_REMOVE: 'file:remove',
  FILE_GET_TEXT: 'file:get-text',

  // Process
  PROCESS_START: 'process:start',
  PROCESS_CANCEL: 'process:cancel',
  PROCESS_STATUS: 'process:status',

  // Review
  REVIEW_GET_FIELDS: 'review:get-fields',
  REVIEW_UPDATE_FIELD: 'review:update-field',
  REVIEW_MARK_VERIFIED: 'review:mark-verified',
  REVIEW_SEARCH_TEXT: 'review:search-text',

  // Export
  EXPORT_EXCEL: 'export:excel',

  // Config
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_TEST_OCR: 'config:test-ocr',
  CONFIG_TEST_LLM: 'config:test-llm',

  // Events (main -> renderer)
  PROCESS_PROGRESS: 'process:progress',
  PROCESS_FILE_COMPLETE: 'process:file-complete',
  PROCESS_ERROR: 'process:error',
  PROCESS_BATCH_COMPLETE: 'process:batch-complete'
} as const
