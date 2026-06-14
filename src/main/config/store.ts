import { app } from 'electron'
import { join } from 'path'
import * as fs from 'fs'

// Simple JSON-based config store (alternative to electron-store which may have native deps)
const CONFIG_FILENAME = 'config.json'

function getConfigPath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, CONFIG_FILENAME)
}

export interface AppConfig {
  llmProvider: 'deepseek' | 'zhipu'
  llmApiKey: string
  llmModel: string
  ocrAccessKeyId: string
  ocrAccessKeySecret: string
  ocrRegion: string
  outputLanguage: 'english_preferred' | 'original'
}

const DEFAULT_CONFIG: AppConfig = {
  llmProvider: 'deepseek',
  llmApiKey: '',
  llmModel: 'deepseek-chat',
  ocrAccessKeyId: '',
  ocrAccessKeySecret: '',
  ocrRegion: 'cn-hangzhou',
  outputLanguage: 'english_preferred'
}

let cachedConfig: AppConfig | null = null

export function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig

  const configPath = getConfigPath()
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8')
      cachedConfig = { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
    } else {
      cachedConfig = { ...DEFAULT_CONFIG }
      saveConfig(cachedConfig)
    }
  } catch {
    cachedConfig = { ...DEFAULT_CONFIG }
  }

  return cachedConfig
}

export function saveConfig(config: AppConfig): void {
  const configPath = getConfigPath()
  const dir = join(configPath, '..')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
  cachedConfig = config
}

export function getConfig(): AppConfig {
  return loadConfig()
}

export function setConfigKey<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
  const config = loadConfig()
  config[key] = value
  saveConfig(config)
}

export function getConfigKey<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return loadConfig()[key]
}
