# CLAUDE.md — 合同智能提取工具

Electron 桌面应用，批量导入 PDF → 提取 46 字段 → 校对+翻译 → Excel 导出。
作者张阳，V1.7，2026-06-18。

## 启动

```bash
npm run dev
# shell 里 ELECTRON_RUN_AS_NODE=1 会导致 electron.app undefined，必须先清掉
unset ELECTRON_RUN_AS_NODE && npm run dev
```

## 技术栈

Electron 31 | electron-vite 2 | React 18 + Ant Design 5 | Zustand | pdfjs-dist 2.16 | sql.js | exceljs | @napi-rs/canvas | TypeScript 5

## 坑

- **LLM 不能用 fetch**：Node 20 fetch 的 body 字符串含非 ASCII 字符会抛 `ByteString` 错误。已改用 `https.request`，llmService.ts。
- **API Key 清洗**：`config.llmApiKey.replace(/[^\x20-\x7E]/g, '')` — 复制粘贴可能带入不可见字符。
- **pdfjs-dist 必须 CJS require**：`require('pdfjs-dist/legacy/build/pdf.js')`，ESM import 在 electron-vite 里会挂。
- **阿里云 OCR SDK**：`require('@alicloud/ocr-api20210707').default`，default export 必须显式取。
- **canvas 桥接**：pdfjs 内部 `require('canvas')`，所以 `node_modules/canvas/index.js` 重导出 `@napi-rs/canvas`。
- **PDF 高亮 Y 轴翻转**：PDF 原点在底部，Canvas 在顶部。`y = viewport.height - tx[5]*SCALE - h*SCALE`。
- **主进程改代码必须重启 Electron**：热更新只覆盖渲染进程。
- **便携版要带 node_modules**：electron-vite 把依赖 externalize 了，打包必须包含。

## 核心文件

| 文件 | 作用 |
|------|------|
| pipeline.ts | 处理流水线（468行，核心） |
| llmService.ts | https.request 调 DeepSeek/智谱 |
| ocrService.ts | 阿里云 OCR，原生 HTTPS+HMAC |
| PdfViewer.tsx | Canvas 渲染 PDF + 智能高亮 |
| ReviewPanel.tsx | 校对面板（PDF+翻译+字段表） |
| excelExporter.ts | 46 列 Excel 导出 |

## 流程

```
导入 → MD5去重 → 文件名解析(employee_id)
处理 → OCR优先(失败回退pdfjs) → 分类(默认劳动合同) → 合同编号 → LLM提取 → 校验
校对 → 左侧Canvas PDF + 字段高亮 / 翻译中文
导出 → Excel 46列 + 校验标黄 + 失败文件含错误信息
```

## 数据库

`%APPDATA%/contract-extractor/data/contracts.db` (SQLite via sql.js)

三张表：`file_records` | `extraction_results` | `employee_sequences`

## 便携版打包

```bash
npx electron-vite build
# 手动组装：out/ + electron/dist → electron/ + node_modules(去dev包) + 启动.bat → zip
```

## Git

- GitHub: yangzhangscut2025/contract-extractor
- Gitee: zhiyuan-yang-021/contracts
