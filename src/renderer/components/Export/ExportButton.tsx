import { Button, Space, message, List, Checkbox, Typography } from 'antd'
import { ExportOutlined, FileExcelOutlined, WarningOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useAppStore } from '../../store/appStore'

const { Text } = Typography

export function ExportButton(): JSX.Element {
  const files = useAppStore((s) => s.files)
  const selectedFileIds = useAppStore((s) => s.selectedFileIds)
  const [exporting, setExporting] = useState(false)

  const exportableFiles = files.filter((f) => f.status === 'completed' || f.status === 'failed' || f.status === 'ocr_failed')
  const failedFiles = files.filter((f) => f.status === 'failed' || f.status === 'ocr_failed')

  const handleExport = async (exportAll: boolean): Promise<void> => {
    const ids = exportAll
      ? exportableFiles.map((f) => f.id)
      : selectedFileIds.length > 0
        ? selectedFileIds.filter((id) => exportableFiles.some((f) => f.id === id))
        : []

    if (ids.length === 0) {
      message.warning('没有可导出的文件（含失败）')
      return
    }

    setExporting(true)
    try {
      const savedPath = await window.electronAPI.exportExcel(ids)
      if (savedPath) {
        message.success(`已导出到: ${savedPath}`)
      }
    } catch (err) {
      message.error('导出失败: ' + String(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<FileExcelOutlined />}
          onClick={() => handleExport(false)}
          loading={exporting}
        >
          导出选中文件
        </Button>
        <Button
          icon={<ExportOutlined />}
          onClick={() => handleExport(true)}
          loading={exporting}
        >
          导出全部已处理
        </Button>
        <Button
          danger
          icon={<WarningOutlined />}
          onClick={() => {
            if (failedFiles.length === 0) {
              message.warning('没有失败的文件')
              return
            }
            setExporting(true)
            window.electronAPI.exportExcel(failedFiles.map((f) => f.id))
              .then((savedPath) => { if (savedPath) message.success(`已导出到: ${savedPath}`) })
              .catch((err) => message.error('导出失败: ' + String(err)))
              .finally(() => setExporting(false))
          }}
          loading={exporting}
        >
          导出失败 ({failedFiles.length})
        </Button>
      </Space>

      {exportableFiles.length > 0 ? (
        <div>
          <Text strong>可导出的文件（含失败） ({exportableFiles.length}):</Text>
          <List
            size="small"
            dataSource={exportableFiles}
            renderItem={(f) => (
              <List.Item>
                <Text>
                  {f.file_name} — {f.contract_number || '-'} ({f.contract_type || '-'})
                </Text>
              </List.Item>
            )}
            style={{ maxHeight: 300, overflow: 'auto', marginTop: 8 }}
          />
        </div>
      ) : (
        <Text type="secondary">暂无已处理文件可供导出</Text>
      )}
    </div>
  )
}
