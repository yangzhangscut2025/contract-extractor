import { useState, useCallback } from 'react'
import { Typography, Select, Button, Space, Input, Empty } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useAppStore } from '../../store/appStore'
import { FieldTable } from './FieldTable'

const { Title, Text } = Typography

export function ReviewPanel(): JSX.Element {
  const files = useAppStore((s) => s.files)
  const currentFileId = useAppStore((s) => s.currentFileId)
  const currentText = useAppStore((s) => s.currentText)
  const loadFileForReview = useAppStore((s) => s.loadFileForReview)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null)

  const completedFiles = files.filter((f) => f.status === 'completed')

  const handleFileSelect = useCallback(async (fileId: number) => {
    await loadFileForReview(fileId)
    setSearchQuery('')
    setHighlightedLine(null)
  }, [loadFileForReview])

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !currentFileId) return
    try {
      const lines = await window.electronAPI.reviewSearchInText(currentFileId, searchQuery)
      if (lines.length > 0) {
        setHighlightedLine(lines[0])
      }
    } catch {
      // Ignore search errors
    }
  }, [searchQuery, currentFileId])

  const handleFieldClick = useCallback(async (value: string) => {
    if (!value || !currentFileId) return
    setSearchQuery(value)
    try {
      const lines = await window.electronAPI.reviewSearchInText(currentFileId, value)
      if (lines.length > 0) {
        setHighlightedLine(lines[0])
      }
    } catch {
      // Ignore
    }
  }, [currentFileId])

  const renderTextWithHighlight = (): JSX.Element => {
    if (!currentText) return <Text type="secondary">暂无文本内容</Text>

    const lines = currentText.split('\n')
    return (
      <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}>
        {lines.map((line, idx) => {
          const lineNum = idx + 1
          const isHighlighted = highlightedLine === lineNum
          let displayLine = line

          // Highlight search query
          if (searchQuery && line.toLowerCase().includes(searchQuery.toLowerCase())) {
            const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
            const parts = line.split(regex)
            displayLine = ''
            // We'll handle it via react elements
            return (
              <div
                key={lineNum}
                style={{
                  backgroundColor: isHighlighted ? '#fff3cd' : 'transparent',
                  padding: '0 4px'
                }}
                id={`line-${lineNum}`}
              >
                <span style={{ color: '#999', marginRight: 8, userSelect: 'none' }}>
                  {String(lineNum).padStart(4, ' ')}
                </span>
                {parts.map((part: string, i: number) =>
                  part.toLowerCase() === searchQuery.toLowerCase() ? (
                    <mark key={i} style={{ backgroundColor: '#ffc069' }}>{part}</mark>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </div>
            )
          }

          return (
            <div
              key={lineNum}
              style={{
                backgroundColor: isHighlighted ? '#fff3cd' : 'transparent',
                padding: '0 4px'
              }}
              id={`line-${lineNum}`}
            >
              <span style={{ color: '#999', marginRight: 8, userSelect: 'none' }}>
                {String(lineNum).padStart(4, ' ')}
              </span>
              <span>{displayLine}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 150px)' }}>
      {/* Left panel: Original text */}
      <div
        style={{
          flex: '0 0 45%',
          background: '#fff',
          borderRadius: 8,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          <Select
            style={{ flex: 1 }}
            placeholder="选择已处理的文件"
            value={currentFileId || undefined}
            onChange={handleFileSelect}
            options={completedFiles.map((f) => ({
              label: `${f.file_name} (${f.contract_number || '-'})`,
              value: f.id
            }))}
            showSearch
            optionFilterProp="label"
          />
        </div>
        <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
          <Input
            placeholder="搜索原文..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onPressEnter={handleSearch}
            suffix={<Button type="link" size="small" icon={<SearchOutlined />} onClick={handleSearch} />}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 4, padding: 8 }}>
          {currentText ? renderTextWithHighlight() : (
            <Empty description="请选择文件查看原文" />
          )}
        </div>
      </div>

      {/* Right panel: Field table */}
      <div
        style={{
          flex: '0 0 55%',
          background: '#fff',
          borderRadius: 8,
          padding: 16,
          overflow: 'auto'
        }}
      >
        {currentFileId ? (
          <FieldTable onFieldClick={handleFieldClick} />
        ) : (
          <Empty description="请在左侧选择文件" />
        )}
      </div>
    </div>
  )
}
