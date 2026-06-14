import { ipcMain, BrowserWindow } from 'electron'
import { processFiles, abortProcessing } from '../services/pipeline'

export function registerProcessHandlers(): void {
  ipcMain.handle('process:start', async (event, { ids }: { ids: number[] }) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    // Run processing asynchronously (don't block the IPC call)
    processFiles(ids, window).catch((err) => {
      console.error('Pipeline error:', err)
    })
  })

  ipcMain.handle('process:cancel', async () => {
    abortProcessing()
  })

  ipcMain.handle('process:status', async () => {
    return {
      isRunning: false,
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0,
      currentFileId: null,
      currentStep: null
    }
  })
}
