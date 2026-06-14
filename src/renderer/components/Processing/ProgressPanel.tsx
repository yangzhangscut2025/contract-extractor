import { Progress, Space, Tag } from 'antd'
import { useAppStore } from '../../store/appStore'

export function ProgressPanel(): JSX.Element {
  const processStatus = useAppStore((s) => s.processStatus)
  const isProcessing = useAppStore((s) => s.isProcessing)

  if (!isProcessing && processStatus.completedFiles === 0 && processStatus.failedFiles === 0) {
    return <></>
  }

  const total = processStatus.totalFiles || 1
  const done = processStatus.completedFiles + processStatus.failedFiles
  const percent = Math.round((done / total) * 100)

  return (
    <div style={{ marginBottom: 16, padding: 16, background: '#fafafa', borderRadius: 8 }}>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span>
          {isProcessing ? '处理中...' : '处理完成'}
        </span>
        <Space>
          <Tag color="success">完成: {processStatus.completedFiles}</Tag>
          <Tag color="error">失败: {processStatus.failedFiles}</Tag>
          {processStatus.currentStep && (
            <Tag color="processing">当前: {processStatus.currentStep}</Tag>
          )}
        </Space>
      </div>
      <Progress percent={percent} status={isProcessing ? 'active' : 'success'} />
    </div>
  )
}
