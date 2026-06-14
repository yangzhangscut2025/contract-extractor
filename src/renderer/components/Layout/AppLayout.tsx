import { useEffect, useState } from 'react'
import { Layout, Menu, Typography } from 'antd'
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ExportOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { useAppStore } from '../../store/appStore'
import { DropZone } from '../FileInput/DropZone'
import { FileList } from '../FileInput/FileList'
import { ProcessButton } from '../Processing/ProcessButton'
import { ProgressPanel } from '../Processing/ProgressPanel'
import { ReviewPanel } from '../Review/ReviewPanel'
import { ExportButton } from '../Export/ExportButton'
import { ConfigPanel } from '../Config/ConfigPanel'

const { Sider, Content, Header } = Layout
const { Title } = Typography

const menuItems = [
  { key: 'files', icon: <FileTextOutlined />, label: '文件管理' },
  { key: 'review', icon: <CheckCircleOutlined />, label: '校对审核' },
  { key: 'export', icon: <ExportOutlined />, label: '导出' },
  { key: 'config', icon: <SettingOutlined />, label: '设置' }
]

export function AppLayout(): JSX.Element {
  const activeView = useAppStore((s) => s.activeView)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const loadFiles = useAppStore((s) => s.loadFiles)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    loadFiles()

    const unsubProgress = window.electronAPI.onProcessProgress((data: any) => {
      useAppStore.getState().updateProcessStatus({
        currentFileId: data.fileId,
        currentStep: data.step
      })
    })

    const unsubComplete = window.electronAPI.onProcessFileComplete((data: any) => {
      const store = useAppStore.getState()
      if (data.success) {
        store.updateProcessStatus({
          completedFiles: store.processStatus.completedFiles + 1
        })
      } else {
        store.updateProcessStatus({
          failedFiles: store.processStatus.failedFiles + 1
        })
      }
      loadFiles()
    })

    const unsubError = window.electronAPI.onProcessError(() => {
      loadFiles()
    })

    const unsubBatch = window.electronAPI.onProcessBatchComplete(() => {
      useAppStore.getState().updateProcessStatus({ isRunning: false })
      useAppStore.setState({ isProcessing: false })
      loadFiles()
    })

    return () => {
      unsubProgress()
      unsubComplete()
      unsubError()
      unsubBatch()
    }
  }, [])

  return (
    <Layout style={{ height: '100%' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        style={{ borderRight: '1px solid #f0f0f0' }}
      >
        <div
          style={{
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #f0f0f0'
          }}
        >
          <Title level={5} style={{ margin: 0, whiteSpace: 'nowrap' }}>
            {collapsed ? '📋' : '📋 合同提取工具'}
          </Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activeView]}
          items={menuItems}
          onClick={({ key }) => setActiveView(key as 'files' | 'review' | 'export' | 'config')}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 48
          }}
        >
          <Title level={5} style={{ margin: 0 }}>
            {menuItems.find((m) => m.key === activeView)?.label}
          </Title>
          {activeView === 'files' && <ProcessButton />}
        </Header>
        <Content
          style={{
            padding: 24,
            overflow: 'auto',
            background: '#f5f5f5'
          }}
        >
          {activeView === 'files' && (
            <div style={{ padding: 24, background: '#fff', borderRadius: 8 }}>
              <ProgressPanel />
              <DropZone />
              <FileList />
            </div>
          )}
          {activeView === 'review' && <ReviewPanel />}
          {activeView === 'export' && (
            <div style={{ padding: 24, background: '#fff', borderRadius: 8 }}>
              <Title level={4}>导出 Excel</Title>
              <ExportButton />
            </div>
          )}
          {activeView === 'config' && (
            <div style={{ padding: 24, background: '#fff', borderRadius: 8 }}>
              <Title level={4}>设置</Title>
              <ConfigPanel />
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  )
}
