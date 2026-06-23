import { create } from 'zustand'
import type { FileRecord, ExtractionResult, ProcessStatus } from '../types/contracts'
import type { AppConfig } from '../types/config'

interface AppState {
  // File list
  files: FileRecord[]
  selectedFileIds: number[]
  loadFiles: () => Promise<void>
  addFilesByPaths: (paths: string[]) => Promise<void>
  removeFile: (id: number) => Promise<void>
  toggleSelectFile: (id: number) => void
  selectAllFiles: () => void
  clearSelection: () => void

  // Processing
  processStatus: ProcessStatus
  isProcessing: boolean
  startProcessing: (ids: number[]) => Promise<void>
  cancelProcessing: () => Promise<void>
  updateProcessStatus: (status: Partial<ProcessStatus>) => void

  // Review
  currentFileId: number | null
  currentFields: ExtractionResult[]
  currentText: string
  loadFileForReview: (id: number) => Promise<void>
  updateFieldValue: (resultId: number, value: string) => Promise<void>
  markVerified: (fileId: number) => Promise<void>

  // Config
  config: AppConfig | null
  loadConfig: () => Promise<void>
  saveConfig: (key: string, value: unknown) => Promise<void>

  // Navigation
  activeView: 'files' | 'review' | 'export' | 'config' | 'table'
  setActiveView: (view: 'files' | 'review' | 'export' | 'config') => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // File list
  files: [],
  selectedFileIds: [],

  loadFiles: async () => {
    const files = await window.electronAPI.fileList()
    set({ files })
  },

  addFilesByPaths: async (paths: string[]) => {
    const newRecords = await window.electronAPI.fileAddByPaths(paths)
    if (newRecords.length > 0) {
      await get().loadFiles()
    }
  },

  removeFile: async (id: number) => {
    await window.electronAPI.fileRemove(id)
    await get().loadFiles()
    set((s) => ({ selectedFileIds: s.selectedFileIds.filter((fid) => fid !== id) }))
  },

  toggleSelectFile: (id: number) => {
    set((s) => ({
      selectedFileIds: s.selectedFileIds.includes(id)
        ? s.selectedFileIds.filter((fid) => fid !== id)
        : [...s.selectedFileIds, id]
    }))
  },

  selectAllFiles: () => {
    set((s) => ({ selectedFileIds: s.files.map((f) => f.id) }))
  },

  clearSelection: () => {
    set({ selectedFileIds: [] })
  },

  // Processing
  processStatus: {
    isRunning: false,
    totalFiles: 0,
    completedFiles: 0,
    failedFiles: 0,
    currentFileId: null,
    currentStep: null
  },
  isProcessing: false,

  startProcessing: async (ids: number[]) => {
    set({
      isProcessing: true,
      processStatus: {
        isRunning: true,
        totalFiles: ids.length,
        completedFiles: 0,
        failedFiles: 0,
        currentFileId: null,
        currentStep: null
      }
    })
    await window.electronAPI.processStart(ids)
  },

  cancelProcessing: async () => {
    await window.electronAPI.processCancel()
  },

  updateProcessStatus: (status: Partial<ProcessStatus>) => {
    set((s) => ({ processStatus: { ...s.processStatus, ...status } }))
  },

  // Review
  currentFileId: null,
  currentFields: [],
  currentText: '',

  loadFileForReview: async (id: number) => {
    const [fields, text] = await Promise.all([
      window.electronAPI.reviewGetFields(id),
      window.electronAPI.fileGetText(id)
    ])
    set({
      currentFileId: id,
      currentFields: fields,
      currentText: text
    })
  },

  updateFieldValue: async (resultId: number, value: string) => {
    await window.electronAPI.reviewUpdateField(resultId, value)
    set((s) => ({
      currentFields: s.currentFields.map((f) =>
        f.id === resultId ? { ...f, manual_value: value, effectiveValue: value } : f
      )
    }))
  },

  markVerified: async (fileId: number) => {
    await window.electronAPI.reviewMarkVerified(fileId)
    await get().loadFiles()
  },

  // Config
  config: null,

  loadConfig: async () => {
    const config = await window.electronAPI.configGet()
    set({ config })
  },

  saveConfig: async (key: string, value: unknown) => {
    await window.electronAPI.configSet(key, value)
    set((s) => ({
      config: s.config ? { ...s.config, [key]: value } : null
    }))
  },

  // Navigation
  activeView: 'files',

  setActiveView: (view) => {
    set({ activeView: view })
  }
}))
