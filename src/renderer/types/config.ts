export interface AppConfig {
  llmProvider: 'deepseek' | 'zhipu'
  llmApiKey: string
  llmModel: string
  ocrAccessKeyId: string
  ocrAccessKeySecret: string
  ocrRegion: string
  outputLanguage: 'english_preferred' | 'original'
}

export const DEFAULT_CONFIG: AppConfig = {
  llmProvider: 'deepseek',
  llmApiKey: '',
  llmModel: 'deepseek-chat',
  ocrAccessKeyId: '',
  ocrAccessKeySecret: '',
  ocrRegion: 'cn-hangzhou',
  outputLanguage: 'english_preferred'
}
