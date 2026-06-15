import { useEffect, useRef, useCallback, useState } from 'react'
import { Empty, Spin } from 'antd'
import * as pdfjsLib from 'pdfjs-dist'
// Vite ?url imports the file as a URL string
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

interface PdfViewerProps {
  pdfBase64: string | null
  highlightText: string
}

interface TextItem {
  str: string
  x: number; y: number; w: number; h: number
  pageNum: number
}

const SCALE = 1.5

// Month names for date variant generation
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/**
 * Generate search variants from a field value so it can match
 * different date/number/name formats in the PDF text.
 */
function generateSearchVariants(value: string): string[] {
  const v = value.trim()
  if (!v) return []

  const variants = new Set<string>([v, v.toLowerCase()])

  // Date: YYYY-MM-DD → multiple formats
  const dateMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateMatch) {
    const [, y, m, d] = dateMatch
    const mi = parseInt(m) - 1
    const monEn = MONTHS_EN[mi]
    const monShort = MONTHS_SHORT[mi]
    const day = parseInt(d)

    variants.add(`${monEn} ${day}, ${y}`)
    variants.add(`${monEn} ${day} ${y}`)
    variants.add(`${day} ${monEn} ${y}`)
    variants.add(`${day} ${monShort} ${y}`)
    variants.add(`${day} ${monShort}. ${y}`)
    variants.add(`${day}/${m}/${y}`)
    variants.add(`${day}.${m}.${y}`)
    variants.add(`${m}/${day}/${y}`)
    variants.add(`${y}/${m}/${d}`)
    variants.add(`${y}.${m}.${d}`)
    // Also add lowercase versions
    for (const s of [...variants]) {
      variants.add(s.toLowerCase())
    }
  }

  // Number/Amount: strip formatting, add variants
  const digitsOnly = v.replace(/[, %$€£¥]/g, '').replace(/\s/g, '')
  if (/^\d+(\.\d+)?$/.test(digitsOnly) && digitsOnly.length > 3) {
    variants.add(digitsOnly)
    // With comma formatting
    if (!v.includes(',')) {
      const num = parseInt(digitsOnly)
      if (!isNaN(num)) {
        variants.add(num.toLocaleString('en-US'))
        variants.add(num.toLocaleString('de-DE'))
      }
    }
    // Without comma formatting
    variants.add(v.replace(/,/g, ''))
    variants.add(v.replace(/,/g, '').replace(/\./g, ''))
  }

  // Email: add local part
  if (v.includes('@')) {
    const [local] = v.split('@')
    if (local.length > 2) {
      variants.add(local)
      variants.add(local.toLowerCase())
    }
  }

  // Name: split into individual words for partial match
  const words = v.split(/[\s,.-]+/).filter((w) => w.length > 2)
  for (const word of words) {
    variants.add(word)
    variants.add(word.toLowerCase())
  }

  // Phone: last N digits
  const phoneDigits = v.replace(/[\s+\-()]/g, '')
  if (phoneDigits.length >= 8 && /^\d+$/.test(phoneDigits)) {
    variants.add(phoneDigits)
    variants.add(phoneDigits.slice(-6))  // last 6 digits
    variants.add(phoneDigits.slice(-4))  // last 4 digits
  }

  return [...variants]
}

export function PdfViewer({ pdfBase64, highlightText }: PdfViewerProps): JSX.Element {
  const [loading, setLoading] = useState(false)
  const [pageCount, setPageCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const textItemsRef = useRef<TextItem[]>([])
  const pageRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const overlayRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const docRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)

  // Step 1: Decode base64 and open PDF document
  useEffect(() => {
    pageRefs.current.clear()
    overlayRefs.current.clear()
    textItemsRef.current = []
    setPageCount(0)
    setError(null)
    docRef.current = null

    if (!pdfBase64) {
      setLoading(false)
      return
    }

    setLoading(true)

    let cancelled = false

    const init = async () => {
      try {
        // Decode base64 to binary
        const binary = atob(pdfBase64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }

        const doc = await pdfjsLib.getDocument({
          data: bytes,
          disableWorker: true
        }).promise

        if (cancelled) return
        docRef.current = doc
        setPageCount(doc.numPages)
        // Don't setLoading(false) yet — wait for rendering
      } catch (err) {
        if (!cancelled) {
          console.error('PDF open error:', err)
          setError(String(err))
          setLoading(false)
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, [pdfBase64])

  // Step 2: After React renders canvas DOM, render each page
  useEffect(() => {
    if (pageCount === 0 || !docRef.current) return

    const doc = docRef.current
    const items: TextItem[] = []
    let cancelled = false

    const renderAll = async () => {
      // Wait for React to finish painting canvas elements
      await new Promise((r) => setTimeout(r, 50))

      for (let i = 1; i <= pageCount; i++) {
        if (cancelled) return

        const canvas = pageRefs.current.get(i)
        const overlay = overlayRefs.current.get(i)
        if (!canvas || !overlay) {
          console.warn(`Canvas not found for page ${i}`)
          continue
        }

        try {
          const page = await doc.getPage(i)
          const viewport = page.getViewport({ scale: SCALE })

          canvas.height = viewport.height
          canvas.width = viewport.width
          overlay.height = viewport.height
          overlay.width = viewport.width

          const ctx = canvas.getContext('2d')
          if (!ctx) continue

          await page.render({ canvasContext: ctx, viewport }).promise

          // Extract text positions (convert PDF coords → Canvas coords)
          const textContent = await page.getTextContent()
          for (const item of textContent.items) {
            const str = (item as { str?: string }).str
            if (!str || !str.trim()) continue
            const tx = (item as { transform: number[] }).transform
            const w = (item as { width?: number }).width ?? 50
            const h = (item as { height?: number }).height ?? 12
            // PDF Y=0 at bottom, Canvas Y=0 at top → flip Y
            const x = tx[4] * SCALE
            const y = viewport.height - tx[5] * SCALE - h * SCALE
            items.push({
              str,
              x,
              y,
              w: w * SCALE,
              h: h * SCALE,
              pageNum: i
            })
          }
        } catch (err) {
          console.error(`Render page ${i} error:`, err)
        }
      }

      if (!cancelled) {
        textItemsRef.current = items
        setLoading(false)
      }
    }

    renderAll()
    return () => { cancelled = true }
  }, [pageCount])

  // Step 3: Draw highlights with smart multi-variant search
  useEffect(() => {
    // Clear all overlays first
    for (const [_, overlay] of overlayRefs.current) {
      const ctx = overlay.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height)
    }

    if (!highlightText.trim()) return

    // Generate search variants based on value type
    const searchTerms = generateSearchVariants(highlightText)
    const lowerTerms = searchTerms.map((t) => t.toLowerCase())

    // Match any text item that contains any search variant
    const matchedItems = new Map<string, TextItem>() // dedupe by x,y,page
    for (const item of textItemsRef.current) {
      const itemLower = item.str.toLowerCase()
      for (const term of lowerTerms) {
        if (itemLower.includes(term)) {
          const key = `${item.pageNum}-${item.x.toFixed(0)}-${item.y.toFixed(0)}`
          if (!matchedItems.has(key)) {
            matchedItems.set(key, item)
          }
          break
        }
      }
    }

    const matches = [...matchedItems.values()]

    for (const item of matches) {
      const overlay = overlayRefs.current.get(item.pageNum)
      if (!overlay) continue
      const ctx = overlay.getContext('2d')
      if (!ctx) continue
      ctx.fillStyle = 'rgba(255, 200, 0, 0.45)'
      ctx.fillRect(item.x, item.y, Math.max(item.w, 30), Math.max(item.h, 14))
    }

    if (matches.length > 0) {
      const canvas = pageRefs.current.get(matches[0].pageNum)
      if (canvas) canvas.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightText, pageCount])

  // Callback refs to capture canvas elements after React mounts them
  const setCanvasRef = useCallback((pageNum: number) => (el: HTMLCanvasElement | null) => {
    if (el) pageRefs.current.set(pageNum, el)
    else pageRefs.current.delete(pageNum)
  }, [])

  const setOverlayRef = useCallback((pageNum: number) => (el: HTMLCanvasElement | null) => {
    if (el) overlayRefs.current.set(pageNum, el)
    else overlayRefs.current.delete(pageNum)
  }, [])

  if (!pdfBase64) {
    return <Empty description="请选择文件查看原文" style={{ marginTop: 80 }} />
  }

  if (error) {
    return <div style={{ padding: 24, color: '#ff4d4f' }}>加载 PDF 失败: {error}</div>
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#525659', padding: 8 }}>
      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin tip="渲染 PDF..." />
        </div>
      )}
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => (
        <div
          key={pageNum}
          style={{
            position: 'relative',
            marginBottom: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            lineHeight: 0,
            background: '#fff'
          }}
        >
          <canvas
            ref={setCanvasRef(pageNum)}
            style={{ display: 'block', width: '100%' }}
          />
          <canvas
            ref={setOverlayRef(pageNum)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none'
            }}
          />
        </div>
      ))}
      {!loading && pageCount === 0 && !error && (
        <div style={{ textAlign: 'center', padding: 40, color: '#fff' }}>无内容</div>
      )}
    </div>
  )
}
