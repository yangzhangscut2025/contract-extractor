import { registerFileHandlers } from './fileHandlers'
import { registerProcessHandlers } from './processHandlers'
import { registerReviewHandlers } from './reviewHandlers'
import { registerExportHandlers } from './exportHandlers'
import { registerConfigHandlers } from './configHandlers'

export function registerAllHandlers(): void {
  registerFileHandlers()
  registerProcessHandlers()
  registerReviewHandlers()
  registerExportHandlers()
  registerConfigHandlers()
}
