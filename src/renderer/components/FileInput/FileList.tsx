import { Table, Button, Tag, Space, Popconfirm, message } from 'antd'
import { DeleteOutlined, EyeOutlined, FilePdfOutlined, ClearOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useAppStore } from '../../store/appStore'
import type { FileRecord } from '../../types/contracts'

const statusMap: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待处理' },
  processing: { color: 'processing', label: '处理中' },
  completed: { color: 'success', label: '已完成' },
  failed: { color: 'error', label: '失败' },
  skipped: { color: 'warning', label: '已跳过' },
  ocr_failed: { color: 'orange', label: 'OCR失败' }
}

export function FileList(): JSX.Element {
  const files = useAppStore((s) => s.files)
  const selectedFileIds = useAppStore((s) => s.selectedFileIds)
  const toggleSelectFile = useAppStore((s) => s.toggleSelectFile)
  const selectAllFiles = useAppStore((s) => s.selectAllFiles)
  const clearSelection = useAppStore((s) => s.clearSelection)
  const removeFile = useAppStore((s) => s.removeFile)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const loadFileForReview = useAppStore((s) => s.loadFileForReview)

  const handleReview = async (record: FileRecord): Promise<void> => {
    await loadFileForReview(record.id)
    setActiveView('review')
  }

  const handleOpenOriginal = async (record: FileRecord): Promise<void> => {
    try {
      await window.electronAPI.fileOpen(record.id)
    } catch (err) {
      message.error('打开文件失败: ' + String(err))
    }
  }

  const handleCleanupDuplicates = async (): Promise<void> => {
    try {
      const removed = await window.electronAPI.fileCleanupDuplicates()
      if (removed > 0) {
        message.success(`已清理 ${removed} 条重复记录`)
        await useAppStore.getState().loadFiles()
      } else {
        message.info('没有重复文件')
      }
    } catch (err) {
      message.error('清理失败: ' + String(err))
    }
  }

  const columns: ColumnsType<FileRecord> = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      render: (_: unknown, _record: FileRecord, index: number) => index + 1
    },
    {
      title: '文件名',
      dataIndex: 'file_name',
      key: 'file_name',
      ellipsis: true,
      width: 300,
      render: (name: string, record: FileRecord) => (
        <span title={record.file_path}>{name}</span>
      )
    },
    {
      title: '员工编号',
      dataIndex: 'employee_id',
      key: 'employee_id',
      width: 130
    },
    {
      title: '合同编号',
      dataIndex: 'contract_number',
      key: 'contract_number',
      width: 150,
      render: (val: string | null) => val || '-'
    },
    {
      title: '合同类别',
      dataIndex: 'contract_type',
      key: 'contract_type',
      width: 120,
      render: (val: string | null) => {
        if (!val) return '-'
        const labels: Record<string, string> = {
          EmploymentContract: '劳动合同',
          SalaryAdjustment: '调薪文件',
          Other: '其他'
        }
        return labels[val] || val
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const info = statusMap[status] || { color: 'default', label: status }
        return <Tag color={info.color}>{info.label}</Tag>
      }
    },
    {
      title: '已验证',
      dataIndex: 'is_verified',
      key: 'is_verified',
      width: 80,
      render: (val: number) => val ? <Tag color="green">是</Tag> : <Tag>否</Tag>
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      key: 'error_message',
      width: 150,
      ellipsis: true,
      render: (val: string | null) => val ? <span style={{ color: '#ff4d4f', fontSize: 12 }} title={val}>{val}</span> : '-'
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: FileRecord) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<FilePdfOutlined />}
            onClick={() => handleOpenOriginal(record)}
          >
            原件
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleReview(record)}
            disabled={record.status !== 'completed'}
          >
            校对
          </Button>
          <Popconfirm
            title="确定删除此文件记录？"
            description="删除后将同时清除提取结果"
            onConfirm={() => removeFile(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  const rowSelection = {
    selectedRowKeys: selectedFileIds,
    onChange: (_: React.Key[], selectedRows: FileRecord[]) => {
      // We'll use the individual toggle for precise control
    },
    onSelect: (record: FileRecord) => {
      toggleSelectFile(record.id)
    },
    onSelectAll: (selected: boolean) => {
      if (selected) {
        selectAllFiles()
      } else {
        clearSelection()
      }
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
        <span>
          {selectedFileIds.length > 0
            ? `已选择 ${selectedFileIds.length} 个文件`
            : `共 ${files.length} 个文件`}
        </span>
        <Button size="small" icon={<ClearOutlined />} onClick={handleCleanupDuplicates} title="清理重复文件（保留提取字段最多的）">
          清理重复
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={files}
        rowSelection={rowSelection}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
        size="middle"
        scroll={{ x: 1000 }}
        locale={{ emptyText: '暂无文件，请导入 PDF 文件' }}
      />
    </div>
  )
}
