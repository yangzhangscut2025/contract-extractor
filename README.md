# 📋 合同智能提取工具

> 多语言劳动合同/调薪文件智能提取桌面应用（V1.2）

基于 **Electron + React + TypeScript + Ant Design** 构建，批量导入 PDF 合同文件，自动识别文件类型、提取 43 个关键字段，支持人工校对与 Excel 导出。

---

## 功能概览

| 模块 | 功能 |
|------|------|
| 📥 **文件导入** | 批量选择/拖拽 PDF 文件，MD5 自动去重，文件名解析员工编号 |
| 🤖 **智能分类** | 关键词匹配 + 大模型快速分类（劳动合同 / 调薪文件 / 其他） |
| 📄 **文本提取** | pdf.js 提取文字型 PDF，阿里云 OCR 处理扫描件，混合型分页策略 |
| 🔢 **编号生成** | 合同编号自动生成（员工编号_序号），序号不填补删除空缺 |
| 🧠 **大模型提取** | DeepSeek / 智谱 AI，40 字段劳动合同 + 6 字段调薪文件，鲁棒 JSON 解析 |
| ✅ **格式校验** | 邮箱/日期/电话/金额/年龄 5 种校验规则，异常字段自动标记 |
| ✏️ **人工校对** | 左右分栏（原文+字段表格），点击字段高亮定位原文，可编辑修正值 |
| 📊 **Excel 导出** | 43 列标准模板，冻结表头、校验高亮、斑马纹，空值显示为空白单元格 |
| ⚙️ **配置管理** | LLM 服务商切换，API Key 本地加密存储，模型名称自定义 |

---

## 技术栈

| 层面 | 技术 | 说明 |
|------|------|------|
| 桌面框架 | Electron 31 | 跨平台桌面应用 |
| 构建工具 | electron-vite | 统一 main/preload/renderer 构建 |
| UI 框架 | React 18 + Ant Design 5 | 企业级 UI 组件 |
| 状态管理 | Zustand | 轻量状态管理 |
| PDF 处理 | pdfjs-dist | 文字提取 + 加密检测 |
| OCR | 阿里云 OCR（@alicloud/ocr-api20210707） | 扫描件识别 |
| 大模型 | DeepSeek / 智谱 AI（OpenAI SDK） | 字段智能提取 |
| 数据库 | sql.js（SQLite WASM） | 本地持久化 |
| Excel 导出 | exceljs | 纯 JS 无原生依赖 |
| 配置存储 | JSON 文件（electron-store 替代） | API Key 加密存储 |

---

## 快速开始

### 环境要求

- **Node.js** >= 18
- **npm** >= 9
- **操作系统**: Windows 10/11 或 macOS 11+

### 安装与启动

```bash
# 1. 进入项目目录
cd aiprocess

# 2. 安装依赖
npm install

# 3. 启动开发模式（热更新）
npm run dev
```

### 构建与打包

```bash
# 构建（输出到 out/）
npm run build

# 打包为安装程序（输出到 dist/）
npm run dist
```

---

## 使用指南

### 1. 配置 API 服务

首次使用前，打开左侧「设置」页面：

- **大模型配置**: 选择 DeepSeek 或智谱 AI，填入 API Key 和模型名称
- **OCR 配置**: 填入阿里云 AccessKey ID/Secret（处理扫描件 PDF 时需要）

> API Key 仅存储在本地，不上传到任何服务器。

### 2. 导入合同文件

在「文件管理」页面：

- **点击上传区域** 选择 PDF 文件，或 **直接拖拽** 文件到窗口
- 文件名格式：`CE3E5PLL__1.Mr.Chanon - Employment_agreement.pdf`
  - 工具自动解析 `__` 左侧 `CE3E5PLL` 作为员工编号
- 重复文件（MD5 相同）自动跳过

### 3. 开始处理

1. 勾选需要处理的文件（或直接点击「开始处理」处理全部待处理文件）
2. 工具自动执行 6 步流水线：
   ```
   文件名解析 → 文件分类 → 文本提取(OCR) → 合同编号生成 → 大模型提取 → 格式校验
   ```
3. 进度面板实时显示处理状态

### 4. 人工校对

在「校对审核」页面：

- **左侧**: 合同原文，支持搜索和关键词高亮
- **右侧**: 43 个字段提取结果表格，点击单元格即可编辑修正
- **联动定位**: 点击字段名，左侧自动滚动并高亮该值在原文中的位置
- 修改后自动保存，点击「标记为已验证」记录审核状态

### 5. 导出 Excel

在「导出」页面：

- 可选择「导出选中文件」或「导出全部已完成」
- 自动生成 43 列标准模板，校验异常字段以黄色标记
- 导出文件命名：`合同提取结果_年月日时分秒.xlsx`

---

## 项目结构

```
aiprocess/
├── config/
│   └── fields.json                      # 43 字段定义（可热更新）
├── src/
│   ├── main/                            # Electron 主进程
│   │   ├── index.ts                     # 窗口创建 & 生命周期
│   │   ├── ipc/                         # IPC 通信层
│   │   │   ├── index.ts                 # 注册所有 handlers
│   │   │   ├── fileHandlers.ts          # 文件导入/列表/删除
│   │   │   ├── processHandlers.ts       # 处理流水线启动/取消
│   │   │   ├── reviewHandlers.ts        # 校对字段读写
│   │   │   ├── exportHandlers.ts        # Excel 导出
│   │   │   └── configHandlers.ts        # 配置读写
│   │   ├── services/                    # 核心业务逻辑
│   │   │   ├── pipeline.ts              # 6 步处理流水线
│   │   │   ├── textExtractor.ts         # pdf.js 逐页文本提取
│   │   │   ├── ocrService.ts            # 阿里云 OCR
│   │   │   ├── fileClassifier.ts        # 关键词 + LLM 文件分类
│   │   │   ├── fileParser.ts            # 文件名解析 → 员工编号
│   │   │   ├── contractNumberGenerator.ts # 合同编号自动生成
│   │   │   ├── llmService.ts            # DeepSeek/智谱 LLM 调用
│   │   │   ├── postValidator.ts         # 邮箱/日期/电话/金额/年龄校验
│   │   │   └── excelExporter.ts         # 43 列 Excel 生成
│   │   ├── database/                    # SQLite 数据层
│   │   │   ├── connection.ts            # 数据库连接
│   │   │   ├── migrations.ts            # 建表迁移
│   │   │   └── repositories/           # CRUD 操作
│   │   ├── config/
│   │   │   └── store.ts                 # 配置存储（JSON 文件）
│   │   └── utils/
│   │       ├── crypto.ts                # MD5 计算 & 脱敏
│   │       ├── concurrency.ts           # 并发信号量
│   │       ├── logger.ts                # 日志
│   │       └── pdfToImage.ts            # PDF 页面 → 图片
│   ├── preload/                         # 预加载脚本
│   │   ├── index.ts                     # contextBridge API
│   │   └── index.d.ts                   # 类型声明
│   └── renderer/                        # React 前端
│       ├── main.tsx                     # React 入口
│       ├── App.tsx                      # 根组件
│       ├── components/
│       │   ├── Layout/AppLayout.tsx     # 主布局（导航 + 内容区）
│       │   ├── FileInput/DropZone.tsx   # PDF 拖拽上传
│       │   ├── FileInput/FileList.tsx   # 文件列表表格
│       │   ├── Processing/ProcessButton.tsx  # 开始/取消处理
│       │   ├── Processing/ProgressPanel.tsx  # 处理进度
│       │   ├── Review/ReviewPanel.tsx   # 校对面板（左原文 + 右表格）
│       │   ├── Review/FieldTable.tsx    # 可编辑字段表格
│       │   ├── Export/ExportButton.tsx  # 导出按钮
│       │   └── Config/ConfigPanel.tsx   # 配置表单
│       ├── store/appStore.ts            # Zustand 全局状态
│       ├── types/                       # TypeScript 类型定义
│       └── styles/global.css            # 全局样式
├── package.json
├── electron.vite.config.ts
├── electron-builder.yml                 # 打包配置
├── tsconfig.json
└── tsconfig.node.json
```

---

## 43 列导出字段

| 序号 | 字段名（英文） | 中文名 | 来源 |
|------|---------------|--------|------|
| 1 | employee_id | 员工系统编号 | 系统 |
| 2 | contract_number | 合同编号 | 系统 |
| 3 | contract_type | 合同类别 | 系统 |
| 4 | is_signed_both | 是否双签版合同 | LLM |
| 5 | full_name | 法定姓名 | LLM |
| 6 | employment_country | 就职国家/地区 | LLM |
| 7 | employer_name | 雇主名称 | LLM |
| 8 | gender | 性别 | LLM |
| 9 | personal_email | 个人邮箱 | LLM |
| 10 | work_email | 工作邮箱 | LLM |
| 11 | start_date | 入职时间 | LLM |
| 12-13 | contract_duration(*) | 合同期限 | LLM |
| 14-15 | contract_start/end_date | 合同生效/结束日期 | LLM |
| 16-17 | probation_duration(*) | 试用期 | LLM |
| 18 | job_title | 岗位名称 | LLM |
| 19-22 | annual/monthly_gross_salary(*) | 税前年薪/月薪及币种 | LLM |
| 23-26 | *_allowance / bonus | 补贴/奖金 | LLM |
| 27-35 | nationality~~place_of_birth | 个人信息 | LLM |
| 36-37 | *_leave_days | 年假/病假 | LLM |
| 38-43 | bank_* / iban / swift_code | 银行信息 | LLM |

> 调薪文件仅填充 6 列（full_name、effective_date、new_monthly_salary、new_annual_salary、currency、notes），其余留空。

---

## 异常处理

| 场景 | 处理方式 |
|------|---------|
| 非 PDF 文件 | 拒绝导入，提示不支持 |
| PDF 已加密 | 尝试空密码，失败提示用户提供 |
| 重复文件导入 | MD5 去重，提示已处理 |
| 网络中断 | 处理失败标记，可重新处理 |
| 大模型返回非 JSON | 3 次鲁棒解析重试，失败提示人工处理 |
| OCR 额度不足 | 提示购买资源包 |
| 合同编号异常 | 强制重置，记录警告日志 |

---

## 开发

```bash
npm run dev        # 开发模式（主进程+渲染进程热更新）
npm run build      # 构建
npm run pack       # 打包目录（不压缩）
npm run dist       # 打包安装程序
```

### 关键依赖版本

- Electron 31 / electron-vite 2
- React 18 / Ant Design 5
- pdfjs-dist 2（CommonJS 兼容）/ exceljs 4
- sql.js 1 / zustand 4
- TypeScript 5
