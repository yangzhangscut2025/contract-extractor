import { ipcMain } from 'electron'
import { getConfig, setConfigKey, AppConfig } from '../config/store'
import { testOcrConnection } from '../services/ocrService'
import { callLlm } from '../services/llmService'

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
    return await testOcrConnection()
  })

  ipcMain.handle('config:test-llm', async () => {
    const config = getConfig()
    if (!config.llmApiKey) {
      return { success: false, message: '请先配置大模型 API Key' }
    }
    try {
      await callLlm('请用JSON格式回复: {"status": "ok"}')
      return { success: true, message: '大模型连接测试成功' }
    } catch (err: unknown) {
      return { success: false, message: '大模型连接测试失败: ' + String(err) }
    }
  })
}
