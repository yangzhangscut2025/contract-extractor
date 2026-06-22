import { Upload, message } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import { useAppStore } from '../../store/appStore'

const { Dragger } = Upload

export function DropZone(): JSX.Element {
  const addFilesByPaths = useAppStore((s) => s.addFilesByPaths)
  const loadFiles = useAppStore((s) => s.loadFiles)

  const doImport = async (paths: string[]) => {
    if (paths.length === 0) return
    const before = useAppStore.getState().files.length
    await addFilesByPaths(paths)
    const after = useAppStore.getState().files.length
    const added = after - before
    if (added > 0) {
      const dupes = paths.length - added
      message.success(`导入 ${added} 个文件${dupes > 0 ? `，${dupes} 个重复已跳过` : ''}`)
    } else {
      message.info('文件已存在，未新增')
    }
  }

  const handleImport = async (): Promise<void> => {
    try {
      const paths = await window.electronAPI.fileImport()
      await doImport(paths)
    } catch (err) {
      message.error('文件导入失败: ' + String(err))
    }
  }

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    accept: '.pdf',
    showUploadList: false,
    beforeUpload: () => false,
    onChange: async (info) => {
      const paths = info.fileList
        .filter((f) => f.name.toLowerCase().endsWith('.pdf'))
        .map((f) => (f.originFileObj as File)?.path || f.name)
      await doImport(paths)
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
