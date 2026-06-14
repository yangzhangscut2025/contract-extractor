import { ipcMain } from 'electron'
import { getConfig, setConfigKey, AppConfig } from '../config/store'

export function registerConfigHandlers(): void {
  ipcMain.handle('config:get', async () => {
    // Return config without exposing raw API key in certain contexts
    const config = getConfig()
    return {
      ...config,
      llmApiKey: config.llmApiKey ? '••••••••' + config.llmApiKey.slice(-4) : '',
      ocrAccessKeySecret: config.ocrAccessKeySecret ? '••••••••' + config.ocrAccessKeySecret.slice(-4) : ''
    }
  })

  ipcMain.handle('config:set', async (_event, { key, value }: { key: string; value: unknown }) => {
    setConfigKey(key as keyof AppConfig, value as never)
  })

  ipcMain.handle('config:test-ocr', async () => {
    const config = getConfig()
    if (!config.ocrAccessKeyId || !config.ocrAccessKeySecret) {
      return { success: false, message: '请先配置阿里云 OCR AccessKey 和 Secret' }
    }
    // Will be implemented when OCR service is ready
    return { success: false, message: 'OCR 测试功能将在 Phase 2 中实现' }
  })

  ipcMain.handle('config:test-llm', async () => {
    const config = getConfig()
    if (!config.llmApiKey) {
      return { success: false, message: '请先配置大模型 API Key' }
    }
    // Will be implemented when LLM service is ready
    return { success: false, message: '大模型测试功能将在 Phase 3 中实现' }
  })
}
