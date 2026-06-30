# CLAUDE.md — 合同智能提取工具

Electron 桌面应用，批量导入 PDF → 提取 47 字段 → 校对+翻译+表格校验 → Excel 导出。
作者张阳，V1.8，2026-06-23。

## 启动

```bash
unset ELECTRON_RUN_AS_NODE && npm run dev
```

## 技术栈

Electron 31 | electron-vite 2 | React 18 + Ant Design 5 | Zustand | pdfjs-dist 2.16 | sql.js | exceljs | @napi-rs/canvas | TypeScript 5

## 核心文件

| 文件 | 作用 |
|------|------|
| pipeline.ts | 处理流水线，468行 |
| llmService.ts | https.request 调 DeepSeek/智谱 |
| ocrService.ts | 阿里云 OCR，原生 HTTPS+HMAC |
| PdfViewer.tsx | Canvas 渲染 PDF + 智能高亮 |
| ReviewPanel.tsx | 校对面板（PDF+翻译+字段表+翻页） |
| TableView.tsx | 表格校验页（Excel式批量编辑） |
| excelExporter.ts | 47 列 Excel 导出 |

## 坑（重要）

- **LLM 不能用 fetch**：Node 20 fetch body 含非 ASCII 字符抛 ByteString。用 `https.request`。
- **API Key/OCR Key 清洗**：`replace(/[^\x20-\x7E]/g, '')`
- **pdfjs-dist CJS**：`require('pdfjs-dist/legacy/build/pdf.js')`
- **OCR SDK CJS**：`require('@alicloud/ocr-api20210707').default`
- **canvas 桥接**：`node_modules/canvas/index.js` → `@napi-rs/canvas`
- **PDF 高亮 Y 轴翻转**：`viewport.height - tx[5]*SCALE - h*SCALE`
- **主进程改代码必须重启 Electron**
- **便携版必须带 node_modules**：electron-vite externalize 了依赖

## 字段体系（47 字段，3 系统 + 44 LLM）

- 合同类型 `contract_category`：全职劳动合同/顾问协议/竞业协议/隐私协议/授权协议/实习协议/Offer/其他
- 期限类型 `contract_term_type`：固定期限/无固定期限
- 系统字段（employee_id, contract_number, contract_type）不在校验页显示

## 流程

```
pdfjs 文字提取 → <20词+OCR配了 → OCR → 分类(默认劳动合同) → 合同编号 → LLM提取 → 校验
并发 ConcurrencyLimiter(3)，失败重试1次
重提：保留 manual_value，清 translated_text
```

## 三个校验入口

1. **校对审核**：PDF 原版 + 字段表 + 高亮 + 翻译 + ◀▶翻页
2. **表格校验**：Excel 式全文件表格，双击文件名跳转校对，员工同色
3. **导出 Excel**：48 列

## 数据库

`%APPDATA%/contract-extractor/data/contracts.db`

## 打包

```bash
npx electron-vite build
# 手动：out/ + electron/dist → electron/ + node_modules(-dev) + 启动.bat → zip
```

