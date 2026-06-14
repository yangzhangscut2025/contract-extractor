import { Table, Input, Tag, Button, Space, message, Tooltip } from 'antd'
import { CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, EditOutlined } from '@ant-design/icons'
import { useState, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import type { ExtractionResult } from '../../types/contracts'
import type { ColumnsType } from 'antd/es/table'

interface EditableCellProps {
  record: ExtractionResult
  onSave: (id: number, value: string) => Promise<void>
}

function EditableCell({ record, onSave }: EditableCellProps): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(record.manual_value ?? record.extracted_value ?? '')

  const handleSave = async (): Promise<void> => {
    await onSave(record.id, value)
    setEditing(false)
  }

  if (editing) {
    return (
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onPressEnter={handleSave}
        autoFocus
        size="small"
      />
    )
  }

  return (
    <div
      style={{ cursor: 'pointer', minHeight: 22 }}
      onClick={() => setEditing(true)}
    >
      <span>{record.effectiveValue || '-'}</span>
      <EditOutlined style={{ marginLeft: 8, color: '#bbb', fontSize: 12 }} />
    </div>
  )
}

interface FieldTableProps {
  onFieldClick?: (value: string) => void
}

export function FieldTable({ onFieldClick }: FieldTableProps): JSX.Element {
  const currentFields = useAppStore((s) => s.currentFields)
  const currentFileId = useAppStore((s) => s.currentFileId)
  const updateFieldValue = useAppStore((s) => s.updateFieldValue)
  const markVerified = useAppStore((s) => s.markVerified)

  const handleSaveField = useCallback(
    async (id: number, value: string) => {
      try {
        await updateFieldValue(id, value)
        message.success('已保存')
      } catch {
        message.error('保存失败')
      }
    },
    [updateFieldValue]
  )

  const validationIcon = (status: string, msg: string | null): JSX.Element => {
    switch (status) {
      case 'warning':
        return (
          <Tooltip title={msg}>
            <WarningOutlined style={{ color: '#faad14' }} />
          </Tooltip>
        )
      case 'error':
        return (
          <Tooltip title={msg}>
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
          </Tooltip>
        )
      default:
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
    }
  }

  const columns: ColumnsType<ExtractionResult> = [
    {
      title: '字段名',
      dataIndex: 'field_name',
      key: 'field_name',
      width: 180,
      render: (name: string) => (
        <span
          style={{ cursor: 'pointer', color: '#1677ff' }}
          onClick={() => {
            const field = currentFields.find((f) => f.field_name === name)
            if (field?.effectiveValue && onFieldClick) {
              onFieldClick(field.effectiveValue)
            }
          }}
        >
          {name}
        </span>
      )
    },
    {
      title: '提取值',
      dataIndex: 'extracted_value',
      key: 'extracted_value',
      width: 200,
      ellipsis: true,
      render: (val: string | null) => val || '-'
    },
    {
      title: '修正值',
      key: 'manual_value',
      width: 200,
      render: (_: unknown, record: ExtractionResult) => (
        <EditableCell record={record} onSave={handleSaveField} />
      )
    },
    {
      title: '校验',
      key: 'validation',
      width: 60,
      align: 'center',
      render: (_: unknown, record: ExtractionResult) =>
        validationIcon(record.validation_status, record.validation_message)
    }
  ]

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>共 {currentFields.length} 个字段</span>
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={async () => {
            if (currentFileId) {
              await markVerified(currentFileId)
              message.success('已标记为已验证')
            }
          }}
        >
          标记为已验证
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={currentFields}
        pagination={false}
        size="small"
        scroll={{ y: 'calc(100vh - 320px)' }}
      />
    </div>
  )
}
