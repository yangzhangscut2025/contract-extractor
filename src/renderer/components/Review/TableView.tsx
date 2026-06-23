import { useEffect, useState, useCallback, useMemo } from 'react'
import { Table, Input, Tag, Button, Space, Select, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useAppStore } from '../../store/appStore'

interface TableRow {
  key: number
  fileId: number
  fileName: string
  employeeId: string
  contractNumber: string
  contractType: string
  status: string
  isVerified: number
  errorMsg: string
  fields: Record<string, { eid: number; extracted: string | null; manual: string | null; validation: string; validMsg: string | null }>
  colorIdx: number
}

export function TableView(): JSX.Element {
  const [rawData, setRawData] = useState<unknown[][]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const loadFiles = useAppStore(s => s.loadFiles)
  const loadFileForReview = useAppStore(s => s.loadFileForReview)
  const setActiveView = useAppStore(s => s.setActiveView)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const data = await window.electronAPI.reviewGetTableData()
        setRawData(data)
      } catch { message.error('加载数据失败') }
      setLoading(false)
    })()
  }, [])

  // Assign alternating color index per unique employee
  const empColorMap = useMemo(() => {
    const seen = new Map<string, number>()
    let idx = 0
    for (const row of rawData) {
      const eid = String(row[2] || '')
      if (!seen.has(eid) && eid) { seen.set(eid, idx++ % 3) }
    }
    return seen
  }, [rawData])

  // Build rows from raw SQL data
  const rows = useMemo(() => {
    const map = new Map<number, TableRow>()
    for (const row of rawData) {
      const [fid, fileName, empId, contractNum, contractType, status, isVerified, errorMsg,
        eid, fieldName, extracted, manual, validation, validMsg] = row as any[]
      if (!map.has(fid)) {
        map.set(fid, {
          key: fid, fileId: fid,
          fileName: String(fileName || ''),
          employeeId: String(empId || ''),
          contractNumber: String(contractNum || ''),
          contractType: String(contractType || ''),
          status: String(status || ''),
          isVerified: Number(isVerified || 0),
          errorMsg: String(errorMsg || ''),
          fields: {},
          colorIdx: empColorMap.get(String(empId || '')) ?? 0
        })
      }
      if (eid && fieldName) {
        map.get(fid)!.fields[String(fieldName)] = {
          eid: Number(eid),
          extracted: extracted ? String(extracted) : null,
          manual: manual ? String(manual) : null,
          validation: String(validation || 'ok'),
          validMsg: validMsg ? String(validMsg) : null
        }
      }
    }
    return [...map.values()]
  }, [rawData])

  // Field columns (from fields config)
  const fieldKeys = useMemo(() => {
    const keys: string[] = []
    const seen = new Set<string>()
    for (const row of rows) {
      for (const k of Object.keys(row.fields)) {
        if (!seen.has(k)) { seen.add(k); keys.push(k) }
      }
    }
    // Sort: system fields first, then LLM fields
    const systemFirst = ['employee_id', 'contract_number', 'contract_type']
    return [...systemFirst.filter(k => keys.includes(k)), ...keys.filter(k => !systemFirst.includes(k))]
  }, [rows])

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (filter === 'all') return rows
    if (filter === 'unverified') return rows.filter(r => !r.isVerified && (r.status === 'completed' || r.status === 'ocr_failed' || r.status === 'failed'))
    if (filter === 'verified') return rows.filter(r => r.isVerified)
    if (filter === 'failed') return rows.filter(r => r.status === 'failed' || r.status === 'ocr_failed')
    return rows
  }, [rows, filter])

  const handleSave = useCallback(async (eid: number, value: string) => {
    try {
      await window.electronAPI.reviewUpdateField(eid, value)
      // Update local state
      setRawData(prev => prev.map(row => {
        if (row[8] === eid) { const r = [...row]; r[11] = value; return r }
        return row
      }))
    } catch { message.error('保存失败') }
  }, [])

  const handleMarkVerified = useCallback(async (fid: number) => {
    try {
      await window.electronAPI.reviewMarkVerified(fid)
      setRawData(prev => prev.map(row => {
        if (row[0] === fid) { const r = [...row]; r[6] = 1; return r }
        return row
      }))
      message.success('已标记')
    } catch { message.error('标记失败') }
  }, [])

  // Editable cell
  const EditableCell = useCallback(({ eid, value, status: vStatus }: { eid: number; value: string | null; status: string }) => {
    const [editing, setEditing] = useState(false)
    const [val, setVal] = useState(value || '')
    const bg = vStatus === 'warning' || vStatus === 'error' ? '#fffbe6' : undefined
    if (editing) {
      return <Input size="small" autoFocus value={val} onChange={e => setVal(e.target.value)}
        onBlur={() => { handleSave(eid, val); setEditing(false) }}
        onPressEnter={() => { handleSave(eid, val); setEditing(false) }} />
    }
    return <div onClick={() => setEditing(true)} style={{ cursor: 'pointer', minHeight: 22, background: bg, padding: '0 4px' }}>
      {val || '-'}
    </div>
  }, [handleSave])

  // Build columns
  const columns: ColumnsType<TableRow> = [
    { title: '文件名', dataIndex: 'fileName', width: 200, fixed: 'left' as const, ellipsis: true,
      render: (v: string, r: TableRow) => (
        <span title={`双击跳转到校对页\n${v}`} style={{ cursor: 'pointer', color: '#1677ff' }}
          onDoubleClick={async () => {
            await loadFileForReview(r.fileId)
            setActiveView('review')
          }}>
          {v.length > 30 ? v.slice(0, 30) + '...' : v}
        </span>
      ) },
    { title: '员工编号', dataIndex: 'employeeId', width: 110, fixed: 'left' as const },
    { title: '合同编号', dataIndex: 'contractNumber', width: 130 },
    { title: '合同类别', dataIndex: 'contractType', width: 100,
      render: (v: string) => v === 'EmploymentContract' ? '劳动合同' : v === 'SalaryAdjustment' ? '调薪文件' : v || '-' },
    { title: '状态', dataIndex: 'status', width: 80,
      render: (v: string) => {
        const m: Record<string, { color: string; label: string }> = {
          completed: { color: 'success', label: '完成' }, failed: { color: 'error', label: '失败' },
          ocr_failed: { color: 'orange', label: 'OCR失败' }, pending: { color: 'default', label: '待处理' },
          processing: { color: 'processing', label: '处理中' }, skipped: { color: 'warning', label: '跳过' }
        }
        const t = m[v] || { color: 'default', label: v }
        return <Tag color={t.color}>{t.label}</Tag>
      }
    },
    { title: '校验', dataIndex: 'isVerified', width: 70,
      render: (_: unknown, r: TableRow) => r.isVerified ? <Tag color="green">是</Tag> :
        <Button size="small" type="link" onClick={() => handleMarkVerified(r.fileId)}>标记</Button>
    },
    ...fieldKeys.filter(k => !['employee_id', 'contract_number', 'contract_type'].includes(k)).map(k => ({
      title: k, dataIndex: k as string, key: k, width: 150, ellipsis: true,
      render: (_: unknown, r: TableRow) => {
        const f = r.fields[k]
        if (!f) return <span style={{ color: '#ccc' }}>-</span>
        const display = f.manual ?? f.extracted
        return <EditableCell eid={f.eid} value={display} status={f.validation} />
      }
    }))
  ]

  return (
    <div style={{ padding: 16, background: '#fff', borderRadius: 8 }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Select size="small" value={filter} onChange={setFilter} style={{ width: 120 }}
            options={[
              { label: '全部', value: 'all' }, { label: '未校验', value: 'unverified' },
              { label: '已校验', value: 'verified' }, { label: '失败', value: 'failed' }
            ]} />
          <span style={{ color: '#666' }}>共 {filteredRows.length} 条</span>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={filteredRows}
        loading={loading}
        scroll={{ x: 2000, y: 'calc(100vh - 250px)' }}
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
        size="small"
        rowClassName={(r: TableRow) => {
          const colors = ['', 'table-row-alt-1', 'table-row-alt-2']
          return colors[r.colorIdx] || ''
        }}
      />
    </div>
  )
}
