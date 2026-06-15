import { useState, useCallback, useEffect } from 'react'
import { Typography, Select, Button, Space, Input, Empty, message } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { useAppStore } from '../../store/appStore'
import { FieldTable } from './FieldTable'
import { PdfViewer } from './PdfViewer'

const { Title } = Typography

export function ReviewPanel(): JSX.Element {
  const files = useAppStore((s) => s.files)
  const currentFileId = useAppStore((s) => s.currentFileId)
  const loadFileForReview = useAppStore((s) => s.loadFileForReview)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<number[]>([])
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [highlightText, setHighlightText] = useState('')
  const [reprocessing, setReprocessing] = useState(false)

  const completedFiles = files.filter((f) => f.status === 'completed')

  // Load PDF when currentFileId changes (from file list or dropdown)
  useEffect(() => {
    if (!currentFileId) {
      setPdfBase64(null)
      return
    }
    setPdfBase64(null)
    setHighlightText('')
    window.electronAPI.fileReadPdf(currentFileId)
      .then(setPdfBase64)
      .catch(() => {})
  }, [currentFileId])

  const handleFileSelect = useCallback(async (fileId: number) => {
    await loadFileForReview(fileId)
    setSearchQuery('')
    setSearchResults([])
  }, [loadFileForReview])

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !currentFileId) return
    try {
      const lines = await window.electronAPI.reviewSearchInText(currentFileId, searchQuery)
      setSearchResults(lines)
      if (lines.length > 0) {
        message.info(`找到 ${lines.length} 处匹配（行号: ${lines.slice(0, 5).join(', ')}${lines.length > 5 ? '...' : ''}）`)
      } else {
        message.info('未找到匹配')
      }
    } catch {
      // Ignore
    }
  }, [searchQuery, currentFileId])

  const handleFieldClick = useCallback(async (value: string) => {
    if (!value || !currentFileId) return
    setHighlightText(value)
    setSearchQuery(value)
    try {
      const lines = await window.electronAPI.reviewSearchInText(currentFileId, value)
      setSearchResults(lines)
    } catch {
      // Ignore
    }
  }, [currentFileId])

  const handleReprocess = useCallback(async () => {
    if (!currentFileId) return
    setReprocessing(true)
    try {
      await window.electronAPI.processReprocess(currentFileId)
      message.success('已提交重新提取，完成后请刷新查看')
    } catch (err) {
      message.error('重新提取失败: ' + String(err))
    } finally {
      setReprocessing(false)
    }
  }, [currentFileId])

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 150px)' }}>
      {/* Left panel: PDF viewer */}
      <div
        style={{
          flex: '0 0 50%',
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
            style={{ flex: 1, maxWidth: 'calc(100% - 100px)' }}
            placeholder="选择已处理的文件"
            value={currentFileId || undefined}
            onChange={handleFileSelect}
            options={completedFiles.map((f) => ({
              label: f.file_name.length > 60
                ? `${f.file_name.substring(0, 50)}... (${f.contract_number || '-'})`
                : `${f.file_name} (${f.contract_number || '-'})`,
              value: f.id
            }))}
            showSearch
            optionFilterProp="label"
          />
          <Button
            icon={<ReloadOutlined />}
            loading={reprocessing}
            onClick={handleReprocess}
            disabled={!currentFileId}
            title="用最新 Prompt 重新提取当前文件"
            style={{ flexShrink: 0 }}
          >
            重提
          </Button>
        </div>
        <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
          <Input
            placeholder="在原文中搜索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onPressEnter={handleSearch}
            suffix={<Button type="link" size="small" icon={<SearchOutlined />} onClick={handleSearch} />}
          />
        </div>
        {searchResults.length > 0 && (
          <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
            匹配行号: {searchResults.slice(0, 20).join(', ')}{searchResults.length > 20 ? ` ...共${searchResults.length}处` : ''}
          </div>
        )}
        <div style={{ flex: 1, overflow: 'hidden', border: '1px solid #f0f0f0', borderRadius: 4 }}>
          <PdfViewer pdfBase64={pdfBase64} highlightText={highlightText} />
        </div>
      </div>

      {/* Right panel: Field table */}
      <div
        style={{
          flex: '0 0 50%',
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
