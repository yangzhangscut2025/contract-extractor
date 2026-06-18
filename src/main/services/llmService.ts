import { getConfig } from '../config/store'
import { logger } from '../utils/logger'

/**
 * Shared LLM API call using native fetch (no SDK dependency).
 * Supports DeepSeek and Zhipu AI, both OpenAI-compatible.
 * Retry: up to 2 retries with 2s interval.
 */
async function llmRequest(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  temperature: number
): Promise<string> {
  const config = getConfig()

  // Clean non-ASCII chars that may slip into API key during copy/paste
  const apiKey = config.llmApiKey.replace(/[^\x20-\x7E]/g, '').trim()
  if (!apiKey) {
    throw new Error('大模型 API Key 未配置。请在设置页面配置 API Key。')
  }

  const baseURL = config.llmProvider === 'zhipu'
    ? 'https://open.bigmodel.cn/api/paas/v4'
    : 'https://api.deepseek.com'

  let lastError: Error | null = null

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        logger.info(`LLM retry attempt ${attempt + 1}/3`)
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      const body = JSON.stringify({
        model: config.llmModel || 'deepseek-chat',
        messages,
        temperature,
        max_tokens: maxTokens
      })

      // Use https.request to avoid Node 20 fetch ByteString issues with Unicode
      const url = new URL(`${baseURL}/chat/completions`)
      const content = await new Promise<string>((resolve, reject) => {
        const http = url.protocol === 'https:' ? require('https') : require('http')
        const req = http.request({
          hostname: url.hostname, path: url.pathname, method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Content-Length': Buffer.byteLength(body)
          }
        }, (res: any) => {
          let data = ''
          res.on('data', (chunk: string) => data += chunk)
          res.on('end', () => {
            if (res.statusCode !== 200) reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`))
            else resolve(data)
          })
        })
        req.on('error', reject)
        req.write(body)
        req.end()
      })

      const data = JSON.parse(content) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      return data.choices?.[0]?.message?.content || ''
    } catch (err: unknown) {
      lastError = err as Error
      logger.warn(`LLM call failed (attempt ${attempt + 1}): ${String(err)}`)

      const msg = String(err)
      if (msg.includes('401') || msg.includes('403') || msg.includes('invalid')) {
        throw new Error('API Key 无效或授权失败，请检查设置。')
      }
    }
  }

  throw new Error(`大模型调用失败（已重试3次）: ${lastError?.message || '未知错误'}`)
}

/**
 * Call LLM and parse JSON response.
 * 3 fallback strategies for JSON extraction.
 */
export async function callLlm(prompt: string): Promise<Record<string, unknown>> {
  const content = await llmRequest(
    [
      {
        role: 'system',
        content: '你是一个专业的 JSON 输出助手。只输出纯 JSON，不要包含任何其他解释、说明或 Markdown 标记。'
      },
      { role: 'user', content: prompt }
    ],
    4096,
    0.1
  )

  return robustParseJson(content)
}

/**
 * Call LLM and return raw text (no JSON parsing).
 * Used for translation and other free-text tasks.
 */
export async function callLlmRaw(prompt: string): Promise<string> {
  return await llmRequest(
    [{ role: 'user', content: prompt }],
    4096,
    0.1
  )
}

/**
 * Quick classification call (short response expected).
 */
export async function classifyWithLlm(classificationPrompt: string): Promise<string> {
  const config = getConfig()

  if (!config.llmApiKey) {
    logger.warn('LLM not configured, defaulting classification to Other')
    return 'Other'
  }

  try {
    const content = await llmRequest(
      [{ role: 'user', content: classificationPrompt }],
      50,
      0
    )
    const trimmed = content.trim()

    if (trimmed.includes('SalaryAdjustment') || trimmed.includes('Salary')) return 'SalaryAdjustment'
    if (trimmed.includes('EmploymentContract') || trimmed.includes('Employment')) return 'EmploymentContract'
    return 'Other'
  } catch (err) {
    logger.warn(`LLM classification failed: ${String(err)}`)
    return 'Other'
  }
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
  } catch { /* continue */ }

  // Attempt 2: Extract from markdown code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1])
    } catch { /* continue */ }
  }

  // Attempt 3: Find first { and last }
  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1))
    } catch { /* continue */ }
  }

  throw new Error(`无法解析 LLM 返回的 JSON: ${raw.substring(0, 200)}...`)
}
