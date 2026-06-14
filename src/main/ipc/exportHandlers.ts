import { ipcMain, dialog, BrowserWindow } from 'electron'
import { exportToExcel } from '../services/excelExporter'
import { logger } from '../utils/logger'

export function registerExportHandlers(): void {
  ipcMain.handle('export:excel', async (_event, { fileIds }: { fileIds: number[] }) => {
    const window = BrowserWindow.getFocusedWindow()
    if (!window) return ''

    const now = new Date()
    const timestamp = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0')

    const result = await dialog.showSaveDialog(window, {
      title: '导出 Excel',
      defaultPath: `合同提取结果_${timestamp}.xlsx`,
      filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }]
    })

    if (result.canceled || !result.filePath) return ''

    try {
      await exportToExcel(fileIds, result.filePath)
      logger.info(`Excel exported: ${result.filePath}`)
      return result.filePath
    } catch (err) {
      logger.error(`Excel export failed: ${String(err)}`)
      throw err
    }
  })
}
