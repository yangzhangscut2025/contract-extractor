# 合同智能提取工具 — Claude 开发参考

## 项目概要
Electron 桌面应用，批量导入 PDF 合同 → 自动提取 46 个字段 → 人工校对 → Excel 导出。
作者：张阳，当前版本 V1.6。

## 技术栈
- **框架**: Electron 31 + electron-vite 2.3
- **前端**: React 18 + Ant Design 5 + Zustand
- **数据库**: sql.js (SQLite in WebAssembly，文件在 `%APPDATA%/contract-extractor/data/contracts.db`)
- **PDF 解析**: pdfjs-dist 2.16（legacy build，CJS `require()`）
- **LLM**: 原生 `fetch()` 调 DeepSeek/智谱 OpenAI 兼容 API
- **OCR**: 阿里云 RecognizeMultiLanguage（PDF 逐页转 PNG → API）
- **PDF 渲染(校对页)**: pdfjs-dist + @napi-rs/canvas（主进程，Canvas 渲染页）
- **Excel**: exceljs

## 注意事项（最新）
- **OCR**：改用原生 HTTPS + HMAC-SHA1 直接调阿里云 API（SDK 的 Languages 序列化有 bug）
- OCR 语言代码：`eng,chn,tai,rus,lading,kor,ja,viet`（不是 `chs/tha/jpn`）
- 重提时会清 `translated_text` 缓存，翻译需要重新调用
- 校对页显示所有状态文件（`processing` 除外）
- 无提取结果时自动创建空字段
- OCR 失败 + 回退文字 ≥20 词 → 标 `completed`（不标 `ocr_failed`），仅备注
- 去重按钮保留提取字段最多的那条

## 启动
```bash
npm run dev    # 开发模式
npm run build  # 生产构建
```

⚠️ **环境变量**：当前 shell 设置了 `ELECTRON_RUN_AS_NODE=1`，必须 `unset` 才能启动 Electron GUI：
```bash
unset ELECTRON_RUN_AS_NODE && npm run dev
```

## 目录结构
```
src/main/           # Electron 主进程
  index.ts          # 入口，创建窗口（不再依赖 @electron-toolkit/utils）
  config/store.ts   # JSON 配置文件读写
  database/
    connection.ts   # sql.js 连接（WAL 模式）
    migrations.ts   # 建表迁移（001_core_tables + 002_translated_text）
    repositories/   # CRUD
  ipc/              # IPC 处理器（file/process/review/export/config）
  services/
    pipeline.ts     # ⭐ 核心处理流水线（468 行，最复杂的文件）
    llmService.ts   # LLM 调用（callLlm/callLlmRaw/classifyWithLlm）
    ocrService.ts   # 阿里云 OCR（PDF→PNG 逐页识别）
    textExtractor.ts # pdfjs 文字提取
    fileClassifier.ts # 关键词分类 + LLM 分类
    excelExporter.ts # Excel 导出（46 列 + 错误信息）
    postValidator.ts # 字段校验（邮箱/日期/金额/性别/合同期限类型）
  utils/            # 工具（concurrency/crypto/logger/pdfToImage）
src/preload/        # contextBridge API
src/renderer/       # React 前端
  components/
    Layout/AppLayout.tsx    # 主布局 + 密码弹窗
    FileInput/FileList.tsx  # 文件列表（含错误信息列、原件按钮）
    Review/ReviewPanel.tsx  # 校对面板（PDF Viewer + 翻译 + 高亮）
    Review/PdfViewer.tsx    # Canvas PDF 渲染 + 智能高亮（339 行）
    Review/FieldTable.tsx   # 字段表格（可编辑）
    Config/ConfigPanel.tsx  # 设置页
    Export/ExportButton.tsx # 导出按钮（3个：选中/全部/失败）
config/fields.json  # 46 字段定义
```

## 核心流程 (pipeline.ts processOneFile)
1. 文件名解析 → employee_id（第一个 `__` 左侧）
2. 文本提取：OCR 已配置 → 直接 OCR；未配置 → pdfjs 文字提取
3. 文件分类：关键词 → LLM 分类 → 不确定默认 EmploymentContract（**不再跳过**）
4. 合同编号生成
5. LLM 提取 43 字段（callLlm → JSON 解析）
6. 补漏：contract_start_date 为空 → 二次 LLM 追问
7. 校验 + 存储
8. 并发：ConcurrencyLimiter(3)

## 重要改动历程
- **openai 已删除**：用原生 fetch() 调 API，无外部 SDK 依赖
- **@electron-toolkit/utils 已删除**：index.ts 内联了 isDev/快捷键逻辑
- **调薪文件不再单独处理**：和劳动合同共用 43 字段 Prompt
- **OCR 策略**：OCR 配置了就全走 OCR（PDF→PNG→API），OCR 失败回退 pdfjs
- **翻译功能**：校对面板"翻译"按钮，LLM 译中文，缓存到 translated_text 字段
- **跳过策略**：分类结果 Other → 默认 EmploymentContract，不跳过
- **导出**：失败文件可单独导出，含员工编号、合同编号（推算）、错误信息列
- **字段**: 46 列（3 系统 + 43 LLM），含 contract_term_type、hourly_gross_salary

## 打包
便携版制作（electron-builder 因 GitHub 被墙无法用）：
```bash
# 1. 构建
npx electron-vite build
# 2. 复制到 dist/合同智能提取工具-v1.6/
#    - out/
#    - node_modules/electron/dist/ → electron/
#    - 全量 node_modules（删 dev 包）
#    - 启动.bat
# 3. PowerShell Compress-Archive 打包 zip
```
输出：`dist/合同智能提取工具-v1.6.zip`（~225MB）

## 数据库表
- `file_records`: id, file_path, file_name, file_md5, employee_id, contract_number, contract_type, status, ocr_used, original_text, error_message, is_verified, translated_text
- `extraction_results`: id, file_record_id, field_name, extracted_value, manual_value, validation_status
- `employee_sequences`: employee_id, max_sequence

## 注意事项
- pdfjs-dist 必须用 `require('pdfjs-dist/legacy/build/pdf.js')`（CJS 兼容）
- @alicloud/ocr-api20210707 必须用 `require().default`（CJS default export）
- @napi-rs/canvas 用于 OCR 的 PDF 逐页渲染（需要自定义 CanvasFactory 给 pdfjs）
- 校对页 PDF Viewer 用 `disableWorker: true` + `?url` import worker
- 高亮坐标：PDF Y=0 在底部，Canvas Y=0 在顶部，需要 `viewport.height - tx[5]*SCALE - h*SCALE`
- 翻译缓存：点翻译时先查 DB 缓存，不重复调 LLM
- 重提不清理翻译缓存
- `gendoc.js` 生成合并文档 HTML
- `.gitignore` 排除了 dist/、node_modules/、*.db
