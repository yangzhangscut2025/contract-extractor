import { contextBridge, ipcRenderer } from 'electron'

// Type-safe API exposed to renderer process
const electronAPI = {
  // File management
  fileImport: (): Promise<string[]> => ipcRenderer.invoke('file:import'),
  fileAddByPaths: (paths: string[]): Promise<unknown[]> =>
    ipcRenderer.invoke('file:add-by-paths', { paths }),
  fileList: (): Promise<unknown[]> => ipcRenderer.invoke('file:list'),
  fileRemove: (id: number): Promise<void> => ipcRenderer.invoke('file:remove', { id }),
  fileGetText: (id: number): Promise<string> => ipcRenderer.invoke('file:get-text', { id }),
  fileOpen: (id: number): Promise<void> => ipcRenderer.invoke('file:open', { id }),
  fileCleanupDuplicates: (): Promise<number> => ipcRenderer.invoke('file:cleanup-duplicates'),
  fileGetPath: (id: number): Promise<string> => ipcRenderer.invoke('file:get-path', { id }),
  fileReadPdf: (id: number): Promise<string> => ipcRenderer.invoke('file:read-pdf', { id }),
  fileTranslate: (id: number): Promise<string> => ipcRenderer.invoke('file:translate', { id }),

  // Processing
  processStart: (ids: number[]): Promise<void> => ipcRenderer.invoke('process:start', { ids }),
  processCancel: (): Promise<void> => ipcRenderer.invoke('process:cancel'),
  processStatus: (): Promise<unknown> => ipcRenderer.invoke('process:status'),

  // Review
  reviewGetFields: (fileId: number): Promise<unknown[]> =>
    ipcRenderer.invoke('review:get-fields', { fileId }),
  reviewUpdateField: (id: number, manualValue: string): Promise<void> =>
    ipcRenderer.invoke('review:update-field', { id, manualValue }),
  reviewMarkVerified: (fileId: number): Promise<void> =>
    ipcRenderer.invoke('review:mark-verified', { fileId }),
  reviewSearchInText: (fileId: number, query: string): Promise<number[]> =>
    ipcRenderer.invoke('review:search-text', { fileId, query }),

  // Export
  exportExcel: (fileIds: number[]): Promise<string> =>
    ipcRenderer.invoke('export:excel', { fileIds }),

  // Configuration
  configGet: (): Promise<unknown> => ipcRenderer.invoke('config:get'),
  configSet: (key: string, value: unknown): Promise<void> =>
    ipcRenderer.invoke('config:set', { key, value }),
  configTestOcr: (): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke('config:test-ocr'),
  configTestLlm: (): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke('config:test-llm'),

  // Event subscriptions (main -> renderer)
  onProcessProgress: (callback: (data: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown): void => callback(data)
    ipcRenderer.on('process:progress', handler)
    return () => ipcRenderer.removeListener('process:progress', handler)
  },
  onProcessFileComplete: (callback: (data: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown): void => callback(data)
    ipcRenderer.on('process:file-complete', handler)
    return () => ipcRenderer.removeListener('process:file-complete', handler)
  },
  onProcessError: (callback: (data: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown): void => callback(data)
    ipcRenderer.on('process:error', handler)
    return () => ipcRenderer.removeListener('process:error', handler)
  },
  onProcessBatchComplete: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('process:batch-complete', handler)
    return () => ipcRenderer.removeListener('process:batch-complete', handler)
  },
  onProcessRequestPassword: (callback: (data: { fileId: number; fileName: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { fileId: number; fileName: string }): void => callback(data)
    ipcRenderer.on('process:request-password', handler)
    return () => ipcRenderer.removeListener('process:request-password', handler)
  },
  processProvidePassword: (fileId: number, password: string): Promise<void> =>
    ipcRenderer.invoke('process:provide-password', { fileId, password }),
  processReprocess: (id: number): Promise<void> =>
    ipcRenderer.invoke('process:reprocess', { id })
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
