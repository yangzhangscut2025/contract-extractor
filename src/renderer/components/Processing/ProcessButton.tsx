import { Button, message } from 'antd'
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons'
import { useAppStore } from '../../store/appStore'

export function ProcessButton(): JSX.Element {
  const selectedFileIds = useAppStore((s) => s.selectedFileIds)
  const isProcessing = useAppStore((s) => s.isProcessing)
  const startProcessing = useAppStore((s) => s.startProcessing)
  const cancelProcessing = useAppStore((s) => s.cancelProcessing)
  const files = useAppStore((s) => s.files)

  const handleStart = async (): Promise<void> => {
    const ids = selectedFileIds.length > 0
      ? selectedFileIds
      : files.filter((f) => f.status === 'pending').map((f) => f.id)

    if (ids.length === 0) {
      message.warning('没有可处理的文件')
      return
    }

    try {
      await startProcessing(ids)
    } catch (err) {
      message.error('处理启动失败: ' + String(err))
    }
  }

  if (isProcessing) {
    return (
      <Button
        danger
        icon={<PauseCircleOutlined />}
        onClick={cancelProcessing}
      >
        取消处理
      </Button>
    )
  }

  return (
    <Button
      type="primary"
      icon={<PlayCircleOutlined />}
      onClick={handleStart}
      disabled={files.filter((f) => f.status === 'pending').length === 0 && selectedFileIds.length === 0}
    >
      开始处理
    </Button>
  )
}
