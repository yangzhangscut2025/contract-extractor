import OpenAI from 'openai'
import { getConfig } from '../config/store'
import { logger } from '../utils/logger'

/**
 * Call the LLM API (DeepSeek or Zhipu AI) with a prompt and get JSON response.
 * Implements robust JSON parsing with 3 fallback strategies.
 * Retry: up to 2 retries with 2s interval.
 */
export async function callLlm(prompt: string): Promise<Record<string, unknown>> {
  const config = getConfig()

  if (!config.llmApiKey) {
    throw new Error('大模型 API Key 未配置。请在设置页面配置 API Key。')
  }

  const baseURL = config.llmProvider === 'zhipu'
    ? 'https://open.bigmodel.cn/api/paas/v4'
    : 'https://api.deepseek.com'

  const client = new OpenAI({
    apiKey: config.llmApiKey,
    baseURL,
    timeout: 60000
  })

  let lastError: Error | null = null

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        logger.info(`LLM retry attempt ${attempt + 1}/3`)
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      const response = await client.chat.completions.create({
        model: config.llmModel || 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的 JSON 输出助手。只输出纯 JSON，不要包含任何其他解释、说明或 Markdown 标记。'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 4096
      })

      const content = response.choices[0]?.message?.content || ''

      // Try to parse JSON from response
      const parsed = robustParseJson(content)
      return parsed
    } catch (err: unknown) {
      lastError = err as Error
      logger.warn(`LLM call failed (attempt ${attempt + 1}): ${String(err)}`)

      // Don't retry on auth or config errors
      const msg = String(err)
      if (msg.includes('401') || msg.includes('403') || msg.includes('invalid api key')) {
        throw new Error('API Key 无效或授权失败，请检查设置。')
      }
    }
  }

  throw new Error(`大模型调用失败（已重试3次）: ${lastError?.message || '未知错误'}`)
}

/**
 * Robust JSON parsing with 3 strategies:
 * 1. Direct JSON.parse
 * 2. Extract from markdown code block
 * 3. Find first { and last }
 */
function robustParseJson(raw: string): Record<string, unknown> {
  // Attempt 1: Direct parse
  try {
    return JSON.parse(raw)
  } catch {
    // continue
  }

  // Attempt 2: Extract from markdown code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1])
    } catch {
      // continue
    }
  }

  // Attempt 3: Find first { and last }
  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1))
    } catch {
      // continue
    }
  }

  throw new Error(`无法解析 LLM 返回的 JSON: ${raw.substring(0, 200)}...`)
}

/**
 * Call the LLM API and return raw text response (no JSON parsing).
 * Used for translation and other free-text tasks.
 */
export async function callLlmRaw(prompt: string): Promise<string> {
  const config = getConfig()

  if (!config.llmApiKey) {
    throw new Error('大模型 API Key 未配置。请在设置页面配置 API Key。')
  }

  const baseURL = config.llmProvider === 'zhipu'
    ? 'https://open.bigmodel.cn/api/paas/v4'
    : 'https://api.deepseek.com'

  const client = new OpenAI({
    apiKey: config.llmApiKey,
    baseURL,
    timeout: 60000
  })

  let lastError: Error | null = null

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        logger.info(`LLM raw retry attempt ${attempt + 1}/3`)
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      const response = await client.chat.completions.create({
        model: config.llmModel || 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 4096
      })

      return response.choices[0]?.message?.content || ''
    } catch (err: unknown) {
      lastError = err as Error
      logger.warn(`LLM raw call failed (attempt ${attempt + 1}): ${String(err)}`)
      const msg = String(err)
      if (msg.includes('401') || msg.includes('403') || msg.includes('invalid api key')) {
        throw new Error('API Key 无效或授权失败，请检查设置。')
      }
    }
  }

  throw new Error(`大模型调用失败（已重试3次）: ${lastError?.message || '未知错误'}`)
}

/**
 * Quick classification call (short response expected).
 */
export async function classifyWithLlm(classificationPrompt: string): Promise<string> {
  const config = getConfig()

  if (!config.llmApiKey) {
    // Fallback: return 'Other' if LLM not configured
    logger.warn('LLM not configured, defaulting classification to Other')
    return 'Other'
  }

  try {
    const baseURL = config.llmProvider === 'zhipu'
      ? 'https://open.bigmodel.cn/api/paas/v4'
      : 'https://api.deepseek.com'

    const client = new OpenAI({
      apiKey: config.llmApiKey,
      baseURL,
      timeout: 30000
    })

    const response = await client.chat.completions.create({
      model: 'deepseek-chat', // Use fast model for classification
      messages: [{ role: 'user', content: classificationPrompt }],
      temperature: 0,
      max_tokens: 50
    })

    const content = response.choices[0]?.message?.content?.trim() || 'Other'

    if (content.includes('SalaryAdjustment') || content.includes('Salary')) return 'SalaryAdjustment'
    if (content.includes('EmploymentContract') || content.includes('Employment')) return 'EmploymentContract'
    return 'Other'
  } catch (err) {
    logger.warn(`LLM classification failed: ${String(err)}`)
    return 'Other'
  }
}
