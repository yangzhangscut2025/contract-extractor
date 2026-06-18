# 合同智能提取工具

批量导入 PDF 合同 → 自动提取 46 个字段 → 人工校对 + 翻译辅助 → Excel 导出

**V1.7** | Electron + React + TypeScript | Windows

---

## 功能

- 拖拽/批量导入 PDF，MD5 自动去重，文件名解析员工编号
- 关键词 + LLM 智能分类（劳动合同/调薪文件）
- PDF 文字提取 + 阿里云 OCR 扫描件识别（可选）
- 合同编号自动生成（员工编号_序号递增）
- LLM 提取 43 个字段（DeepSeek / 智谱 AI）
- 格式校验（邮箱/日期/电话/金额/年龄/性别/期限类型）
- PDF 原版校对（Canvas 渲染 + 字段点击高亮 + 智能搜索）
- 翻译辅助（LLM 译中文，关键信息保留原文）
- Excel 导出（46 列 + 校验高亮 + 失败文件含错误信息）
- 文件列表按员工编号排序，一键清理重复

## 快速开始

```bash
npm install
npm run dev
```

> 启动前确保 shell 中没有 `ELECTRON_RUN_AS_NODE` 环境变量。

## 打包

```bash
npx electron-vite build
# 手动组装便携版：out/ + electron/dist/ + node_modules/ + 启动.bat
```

## 技术栈

Electron 31 · React 18 · Ant Design 5 · Zustand · pdfjs-dist · sql.js · exceljs · @napi-rs/canvas

## 项目结构

```
src/
├── main/           # Electron 主进程
│   ├── ipc/        # IPC handlers
│   ├── services/   # pipeline, llm, ocr, textExtractor, excelExporter, ...
│   ├── database/   # SQLite (sql.js)
│   ├── config/     # JSON 配置存储
│   └── utils/      # crypto, concurrency, logger
├── preload/        # contextBridge API
└── renderer/       # React UI
    ├── components/ # Layout, FileInput, Review, Export, Config
    ├── store/      # Zustand
    └── types/      # TypeScript types
```

## 文档

- [需求文档](需求文档.md)
- [使用说明](使用说明.md)
