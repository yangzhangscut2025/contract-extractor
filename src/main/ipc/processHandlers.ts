import { ipcMain, BrowserWindow } from 'electron'
import { processFiles, abortProcessing, processState, resolvePassword } from '../services/pipeline'

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
    return { ...processState }
  })

  ipcMain.handle('process:provide-password', async (_event, { fileId, password }: { fileId: number; password: string }) => {
    resolvePassword(fileId, password)
  })

  // Re-process a single file (for re-extraction after prompt updates)
  ipcMain.handle('process:reprocess', async (event, { id }: { id: number }) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    processFiles([id], window).catch((err) => {
      console.error('Re-process error:', err)
    })
  })
}
