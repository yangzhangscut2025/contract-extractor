type LogLevel = 'debug' | 'info' | 'warn' | 'error'

class Logger {
  private levels: LogLevel[] = ['debug', 'info', 'warn', 'error']

  private log(level: LogLevel, message: string, data?: unknown): void {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`

    if (data !== undefined) {
      // Sanitize: don't log raw data that might contain PII
      const safeData = typeof data === 'string' ? '[string data]' : '[object data]'
      console.log(`${prefix} ${message} ${safeData}`)
    } else {
      console.log(`${prefix} ${message}`)
    }
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data)
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data)
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data)
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data)
  }
}

export const logger = new Logger()
