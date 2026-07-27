本文件只属于 lancelot-gamepal-ui-playground，不代表、不替代也不修改 lancelot-gamepal 主项目的规划和进度。

# Findings & Decisions

## Requirements

- 独立公开仓库：`EasonXavier/lancelot-gamepal-ui-playground`，默认分支 `main`，独立 GitHub Pages。
- 技术栈：Vite、React、TypeScript、Framer Motion、Canvas 2D、`web-vitals`、Vitest、RTL、ESLint、Prettier。
- 移动优先，覆盖 375×812、390×844、393×852、430×932、844×390。
- 品牌为“朗世乐”；游戏为三角洲行动、CS2、Valorant、Steam 游戏。
- 六个入口为趣味单、小时单、自助下单、客服接待、活动专区、全部服务；入口为不同宽高的非正方形布局。
- 底栏为首页、挑选、订单、消息、我的。
- Glass Mode：Real Blur、Simulated Glass、Preblur Layer、Blur Off；一次只激活一种。
- 毛玻璃普通边缘不发光，仅选中的游戏、导航或实验选项允许强调光效。
- 真实性能 HUD、30 秒 Benchmark、本地报告导出、微信 UA 标记和 feature detection。
- 不模拟 CPU、GPU、温度、整机功耗或其他浏览器无法取得的数据。

## Research Findings

- 2026-07-27 现场检查确认目标 GitHub 仓库原先不存在，随后已创建为 PUBLIC。
- 当前仓库根目录为 `C:/Project/lancelot-gamepal-ui-playground`，分支为 `main`，唯一远程为目标仓库 `origin`。
- 当前目录此前为空，不含旧试验场代码，也未访问主项目仓库。
- GitHub CLI 在 Windows 实际环境中登录为 `EasonXavier`，具备 `repo` 与 `workflow` scope。
- 用户随后明确将 Demo 字体替换为 `LSVIS TD.woff2`；文件具有有效 `wOF2` 签名，继续使用集中式 `LSVIS TD Demo` CSS family token。
- GitHub API 验证字体文件大小为 2,982,360 bytes，blob SHA 为 `fdbd8b76283f9f9b41b0c5e95bda3dc44f4696b1`，原始下载地址来自 `raw.githubusercontent.com/EasonXavier/EasonXavier.github.io/main/...`。
- 已下载字体，SHA-256 为 `AB0A8DEE8D2821F23616029A7FC8CE4BCAB3FFC46E6D6FDA7DB4D15273B132FF`，大小与 GitHub API 元数据一致。
- 新 WOFF2 大小为 2,982,896 bytes，SHA-256 为 `4BBB34BD34B7525CFF4447E38192AA123614E4CFCB64B97CFA3DD169F16A84BC`；它替换 7,207,444 bytes 的 OTF，字体载荷减少约 58.6%。
- 用户人物图原始尺寸为 1122×1402、仅带 DPI 信息；重新编码后的 `character-source.png` 为 RGB PNG、`info={}`、SHA-256 `64A4DCE7C8113641D4985EC7749B927E26DFD652137DA85EEF1F21FBAF970E0F`。
- 当前沙箱 PATH 不含 `node`/`npm`；Codex bundled Node 位于 `.../dependencies/node/bin/node.exe`，bundled pnpm 版本为 11.9.0；`C:/Program Files/nodejs` 未发现系统安装。
- 用户允许后续按需安装系统级 Node/npm；当前检查点使用 bundled Node 与已恢复的项目依赖即可完成验证，因此未增加电脑级安装或 PATH 改动。
- bundled Node 为 v24.14.0；临时官方 npm 11.5.2 可在为该进程加入 bundled Node 路径后运行。npm latest 当时要求 Node 24.15.0，故不使用不兼容版本。
- npm registry 当前版本快照：React 19.2.8、Vite 8.1.5、Vitest 4.1.10、Framer Motion 12.42.2、web-vitals 6.0.0、ESLint 10.8.0。
- `typescript-eslint@8.65.0` 支持 ESLint 10，但 TypeScript peer 范围为 `<6.1.0`；因此不能采用 registry 最新 TypeScript 7.0.2，需锁定 TypeScript 6.0.x。
- 兼容选择为 TypeScript 6.0.3 与 `@types/node` 26.1.1；`@vitejs/plugin-react` 的额外 Babel/Rolldown peers 均标记为 optional，无需加入默认依赖。
- Vite 8.1.5、Vitest 4.1.10 与 jsdom 29.1.1 均支持 bundled Node 24.14.0。
- Task 3 的现有基础类型只有通用 `Availability`；新增快照必须把 `unsupported`、`waiting` 与 `not-measurable` 作为可观察状态，而不是用数值 0 代替。
- 已安装的 `web-vitals@6.0.0` 从主入口导出 `onTTFB`、`onFCP`、`onLCP`、`onCLS` 与 `onINP`；实现可在应用挂载后动态导入该入口。
- `web-vitals@6` 回调提供 `name`、`value`、`rating`、`delta` 与去重 `id`，注册函数不返回清理句柄；本地 store 停止后必须忽略迟到回调。
- TypeScript DOM 声明已包含 `PerformanceObserver.supportedEntryTypes` 与 `PerformanceResourceTiming`，非标准 device memory/network 字段仍需通过窄接口注入和显式 `null` 表示不可用。
- Task 3 采用按 entry type 共享的观察器注册表：同类多个消费者只创建一个底层 observer，最后一个 cleanup 才 disconnect；这避免 HUD 与报告层重复注册全局观察器。
- 资源传输大小只有在所有条目提供正有限值时才汇总为 `available`；缺失或 0 统一标记 `not-measurable`，避免把跨域不可见数据误报为零流量。
- 当前 typecheck 与 lint 均通过；帧数学与采样器为 2 files / 10 tests passed。
- 原 lint 错误已通过将测试 fake cancel 改为无参数实现修复；未降低或关闭规则。
- GitHub 远端 `main` 已包含基础提交 `9f26f73`、可部署入口/Pages 提交 `d20b849` 与构建元数据提交 `e26b75c`。
- 首次生产构建稳定失败于 `Failed to resolve /src/main.tsx`；根因是 `index.html` 已声明入口但 Phase 2 尚未创建该文件，而非 Vite、React 或 Node 版本不兼容。
- 新增入口后的 TS2882 来自缺少 `vite/client` 类型声明；补齐标准 `src/vite-env.d.ts` 即可让 CSS 副作用导入保留类型安全。
- GitHub 官方 Actions 的当前稳定主版本已通过仓库 API 核对：checkout v7、setup-node v7、configure-pages v6、upload-pages-artifact v5、deploy-pages v5；Pages 已启用为 workflow 发布源。
- GitHub Actions run `30239061058` 的 build 与 deploy job 均成功；实际 Pages 地址继承账号自定义域名，为 `https://easonx.me/lancelot-gamepal-ui-playground/`。
- 线上 390×844 验证确认页面标题、语义结构、工作构建号、字体族、人物资源 URL 与 Pages 子路径正确；`clientWidth`/`scrollWidth` 均为 390，控制台无 error/warning。
- 提交前公开扫描结果：无本机绝对路径、无凭据值模式、无 `.env` 文件、`package-lock.json` 无本地路径引用。
- 实施计划自检未发现 `TBD`、`TODO` 或未定义占位语；核心类型名称在任务间保持一致。

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| 使用单页本地状态而非服务端路由 | Pages 子路径刷新可靠，无需后端 rewrite |
| 将 RAF 采样写入固定容量环形缓冲 | 限制内存并避免 React 每帧渲染 |
| HUD 通过订阅快照最多 4Hz 更新 | 控制观察工具自身开销 |
| Visibility hidden 时暂停、visible 时清除后台长间隔并重新校准 | 防止后台节流污染帧指标 |
| Glass Mode 只切换 CSS class/背景层策略 | 保持 DOM、内容与动画一致，便于公平比较 |
| 角色原图作为独立 `<picture>`/背景层，UI 全部代码原生 | 可替换、可响应式裁切，避免把 UI 烘焙进图片 |
| 使用 Canvas 2D 单层粒子，并按 DPR 上限调整 backing store | 在高 DPR 手机上控制像素成本 |
| `LSVIS TD.woff2` 通过 `@font-face` 和 CSS 变量集中引用 | 使用更适合 Web 的压缩格式，后期替换仍只需更改一处令牌 |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| 沙箱 Git 用户与 Windows 目录所有者不同 | 对仓库级命令显式传入 `safe.directory`，不扩大系统信任范围 |
| 初始图像生成误加未授权游戏图标 | 后续概念修正；最终规则由用户改为仅选中游戏可显示近似图标 |
| `rg` 在“未找到占位语”时以退出码 1 结束 | 将其解释为自检通过，后续避免把无匹配当成实施失败 |
| Web 打开 GitHub 二进制 blob 页面返回 cache miss | 改用 GitHub API 验证文件元数据与原始下载地址 |
| 沙箱 PATH 无 `node`/`npm` 且标准 Program Files 路径不存在 | 使用 Codex bundled Node 与包管理运行时；继续定位可用 npm 入口以满足 npm 锁文件要求 |
| bundled Python 不含 `fontTools`，无法读取 OTF 完整 name/license 表 | 不为一次性检查增加依赖；改用 Windows PrivateFontCollection 验证可加载且 family name 为 `LSVIS TD`，授权以用户明确提供为依据 |
| 初次 GREEN 中刷新基准被长帧污染 | 测试捕获 8ms 预期变成 12ms；使用低四分位筛选稳定窗口后通过 |
| 测试 fake cancel 的参数触发 lint | 改为类型兼容的无参数函数；lint 通过，规则保持启用 |

## Resources

- 仓库：https://github.com/EasonXavier/lancelot-gamepal-ui-playground
- 实际 Pages：https://easonx.me/lancelot-gamepal-ui-playground/
- Demo 字体：用户提供的 `LSVIS TD.woff2`，仓库文件名为 `public/assets/fonts/lsvis-td.woff2`
- 主界面概念：本次 Codex 会话生成的已确认概念图；仅作为实现参考，不作为仓库生产素材。
- 控制面板概念：本次 Codex 会话生成的已确认概念图；仅作为实现参考，不作为仓库生产素材。

## Visual/Browser Findings

- 主界面：深石墨与去饱和青绿环境；暖香槟色只用于图标和选中态；人物在右侧/中部，上半身清晰，下半身被玻璃层覆盖。
- 游戏栏：单行四项、低高度细长，只有选中“三角洲行动”显示近似三角图标与短下划线。
- 功能入口：六个不同宽高的非正方形玻璃矩形；人物细节透过并被模糊，形成复杂 Blur 场景。
- 普通玻璃：中性低透明细边框、内高光、模糊/折射、阴影和噪点；禁止边缘发光。
- 选中态：允许暖色局部发光；底栏只突出“首页”。
- 控制面板：大面积底部玻璃抽屉覆盖人物与入口；四种 Blur 实现同时可见但互斥选择；只有选中项发光。

## Resume Checkpoint

1. 重读 `task_plan.md`、本文件和 `progress.md`。
2. 确认工作树与最新提交状态，再运行 typecheck、lint 与 frame tests 复核基线。
3. 从实施计划 Task 3 开始：先写 observers/environment 的失败测试，再写生产实现。
4. 当前 Pages 仅发布明确标注开发状态的检查点；完整 UI 的 typecheck/lint/test/build、浏览器与安全验证完成前不要创建正式版本。

发布检查点复核确认：三个规划文件均包含恢复检查点；现有门禁通过，可部署提交为 `d20b849`，Pages workflow 与线上检查点均已验证。

---

*每两次视觉、浏览或搜索后更新本文件。*
