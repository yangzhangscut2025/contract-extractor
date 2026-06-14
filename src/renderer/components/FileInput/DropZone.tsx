import { Upload, message } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import { useAppStore } from '../../store/appStore'

const { Dragger } = Upload

export function DropZone(): JSX.Element {
  const addFilesByPaths = useAppStore((s) => s.addFilesByPaths)
  const loadFiles = useAppStore((s) => s.loadFiles)

  const handleImport = async (): Promise<void> => {
    try {
      const paths = await window.electronAPI.fileImport()
      if (paths.length > 0) {
        await addFilesByPaths(paths)
        message.success(`成功导入 ${paths.length} 个文件`)
      }
    } catch (err) {
      message.error('文件导入失败: ' + String(err))
    }
  }

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    accept: '.pdf',
    showUploadList: false,
    beforeUpload: (file) => {
      // Return false to prevent default upload; we handle via Electron API
      return false
    },
    onChange: async (info) => {
      const files = info.fileList
        .filter((f) => f.name.toLowerCase().endsWith('.pdf'))
        .map((f) => (f.originFileObj as File)?.path || f.name)

      if (files.length > 0) {
        await addFilesByPaths(files)
        message.success(`成功导入 ${files.length} 个文件`)
      }
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <Dragger {...uploadProps}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽 PDF 文件到此处</p>
        <p className="ant-upload-hint">
          支持单个或批量导入，仅接受 .pdf 格式文件
        </p>
      </Dragger>
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <a onClick={handleImport} style={{ cursor: 'pointer' }}>
          或点击此处选择文件
        </a>
      </div>
    </div>
  )
}
