# CLAUDE.md — 合同智能提取工具

Electron 桌面应用，批量导入 PDF → 提取 46 字段 → 校对+翻译 → Excel 导出。
作者张阳，V1.7.1，2026-06。

## 启动

```bash
unset ELECTRON_RUN_AS_NODE && npm run dev
```

## 技术栈

Electron 31 | electron-vite 2 | React 18 + Ant Design 5 | Zustand | pdfjs-dist 2.16 | sql.js | exceljs | @napi-rs/canvas | TypeScript 5

## 坑（重要）

- **LLM 不能用 fetch**：Node 20 的 fetch body 含非 ASCII 字符抛 ByteString 错误。用 `https.request`。
- **API Key/OCR Key 清洗**：`replace(/[^\x20-\x7E]/g, '')` — 复制粘贴可能带入不可见字符。
- **pdfjs-dist CJS require**：`require('pdfjs-dist/legacy/build/pdf.js')`
- **OCR SDK CJS**：`require('@alicloud/ocr-api20210707').default`
- **canvas 桥接**：`node_modules/canvas/index.js` → `@napi-rs/canvas`
- **PDF 高亮 Y 轴翻转**：`viewport.height - tx[5]*SCALE - h*SCALE`
- **主进程改代码必须重启 Electron**
- **便携版必须带 node_modules**：electron-vite externalize 了依赖

## 核心流程

```
pdfjs 文字提取 → 不够20词+OCR配了 → OCR → 分类(默认劳动合同) → 合同编号 → LLM提取 → 校验
并发 ConcurrencyLimiter(3)，失败自动重试1次
重提：保留 manual_value，清 translated_text
```

## 数据库

`%APPDATA%/contract-extractor/data/contracts.db`
`file_records` | `extraction_results` | `employee_sequences`

## 便携版

```bash
npx electron-vite build
# 手动：out/ + electron/dist → electron/ + node_modules(去dev包) + 启动.bat → zip
```

## Git

- GitHub: yangzhangscut2025/contract-extractor
- Gitee: zhiyuan-yang-021/contracts
