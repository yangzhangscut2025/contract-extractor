import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerAllHandlers } from './ipc'

const isDev = !app.isPackaged

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1366,
    minHeight: 768,
    show: false,
    title: '合同智能提取工具',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.contract-extractor')

  app.on('browser-window-created', (_, window) => {
    window.webContents.on('before-input-event', (_event, input) => {
      if (input.type === 'keyDown') {
        if (!isDev) {
          if (input.code === 'KeyR' && (input.control || input.meta))
            _event.preventDefault()
        } else {
          if (input.code === 'F12') {
            if (window.webContents.isDevToolsOpened()) {
              window.webContents.closeDevTools()
            } else {
              window.webContents.openDevTools({ mode: 'undocked' })
            }
          }
        }
      }
    })
  })

  registerAllHandlers()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
