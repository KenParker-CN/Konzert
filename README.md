# Konzert

本地优先的音乐播放器：在设备上读取标签与封面、整理曲库并播放，全程无需联网。

基于 Next.js（静态导出）+ Tauri 构建，同一套前端代码可以运行在 Tauri 桌面端 / 移动端，也可以直接部署为纯浏览器应用。

## 功能特性

- **曲库扫描** — 选择音乐文件夹后自动遍历、解析音频标签并写入本机 IndexedDB，支持中途取消
- **标签与封面** — 读取标题、艺术家、专辑、年份、音轨/碟号、时长、码率、采样率、编码格式（含无损判断）与内嵌封面
- **播放器** — 播放/暂停、上一曲/下一曲、随机、单曲/列表循环、音量与静音；下次启动自动还原播放偏好
- **曲库视图** — 专辑网格、专辑详情、艺术家头像与详情页、曲目列表，以及收藏视图和播放历史
- **音频信息** — 展示位深度、采样率、发行日期、流派与高解析度音频徽标
- **个性化界面** — 浅色/深色主题、强调色、可收起侧栏与长标题自动滚动
- **快速导入** — 支持直接拖拽文件/文件夹导入
- **曲库维护** — 支持刷新元数据、Tauri 文件夹监控与扫描进度节流
- **双运行环境** — Tauri 下通过本地路径直接读取文件；浏览器下使用 File System Access API
- **原生窗口** — Tauri 无边框窗口 + 自定义标题栏

## 技术栈

| 层          | 技术                                                                                          |
|-------------|-----------------------------------------------------------------------------------------------|
| 前端        | Next.js 16（`output: "export"` 静态导出）、React 19、TypeScript、Tailwind CSS 4、Tabler Icons |
| 桌面/移动壳 | Tauri 2（dialog / fs / log 插件，protocol-asset）                                             |
| 音频解析    | music-metadata（标签）、@audio/decode-aac（AAC 解码）                                         |
| 数据存储    | IndexedDB（曲库、封面、播放记录全部保存在本机）                                               |

## 目录结构

```
app/                    # Next.js App Router 入口、页面与全局样式
components/             # 业务 UI（播放器、曲库、专辑、作品详情等）
components/ui/          # 可复用的 Base UI / shadcn 组件
components/views/       # 侧边栏导航对应的页面视图
lib/                    # 领域逻辑、Provider、数据访问、格式化与测试
public/                 # 浏览器静态资源（高解析度音频徽标等）
src-tauri/              # Tauri 壳（Rust）、权限、打包配置与平台图标
```

组件按产品领域放在 `components/`，基础 UI 放在 `components/ui/`，数据和业务逻辑放在
`lib/`；构建产物（`.next/`、`out/`、`src-tauri/target/`）和本地日志不属于源码目录，
由 `.gitignore` 排除。

## 开发

前置要求：

- Node.js 20+
- Rust 1.77.2+（仅构建 Tauri 端时需要）

```bash
npm install

# 仅前端（浏览器）：Next.js 开发服务器
npm run dev

# Tauri 桌面端开发模式（自动启动 beforeDevCommand）
npm run tauri:dev
```

## 构建与检查

```bash
npm run build       # 静态导出到 out/（供 Tauri 内嵌或任意静态服务器托管）
npm run preview     # 本地预览静态导出结果
npm run tauri:build # 打包桌面应用安装包
npm run lint        # ESLint
npm run typecheck   # TypeScript 类型检查
```

## 架构说明

- **无服务端**：Next.js 使用静态导出，不使用 Server Actions / Route Handlers 等服务端能力，`out/` 可被 Tauri asset 协议或任意静态服务器直接托管
- **数据不出设备**：曲库、封面、播放记录全部保存在本机 IndexedDB；音频文件只记录"指向方式"（Tauri 绝对路径 / File System Access 句柄 / 会话内存），不复制音频内容
- **播放偏好还原**：音量、随机、循环模式与上次播放的曲目会持久化，下次启动时恢复
