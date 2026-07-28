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
- 原始规格将 Motion Level 固定为 `off | low | medium | high | maximum`，Particle Count 为 `0 | 20 | 50 | 100 | maximum`，DPR 为 `native | cap-2 | cap-1.5`。
- Benchmark 固定总长 30 秒：预热 3 秒、静止动态 8 秒、动态压力 8 秒、滚动和转场 8 秒、结果整理 3 秒；进入后台的数据必须排除并把结果标为未完整保持前台。

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
- PR #1 已以 merge commit `4f42867` 合并到 `main`；Pages run `30273041434` 的 build 与 deploy job 均成功。
- 在线检查返回 HTTP 200，HTML 引用 `index-DCtTWxh3.js` 与 `index-BsZojuUi.css`；JS 包含“朗世乐”，CSS 包含原生 modal backdrop、人物与 WOFF2 的正确 Pages 子路径。
- 在主仓库保留嵌套 linked worktree 时运行 `eslint .` 会让 typescript-eslint 同时发现两个 `tsconfig` 根并报解析错误；移除已合并 worktree 后同一门禁通过，因此该错误不是合并代码回归。
- 线上 390×844 验证确认页面标题、语义结构、工作构建号、字体族、人物资源 URL 与 Pages 子路径正确；`clientWidth`/`scrollWidth` 均为 390，控制台无 error/warning。
- Task 6 本地生产预览在 375×812、390×844、393×852、430×932、844×390 五个外层视口完成检查；各视口 `scrollWidth === clientWidth`，底栏可见，`--app-height` 与旋转后的高度一致，控制台无 error/warning。
- 本地浏览器实测：Glass/Motion/HUD 设置即时生效；Benchmark 运行时 Motion/粒子/DPR/动态开关与重置被锁定，取消后恢复；复制 JSON 显示 `已复制`。人物背景资源在 Pages 子路径正确加载。
- Safe Area 使用 `env(safe-area-inset-*)` 并接入页头、内容、底栏、HUD 与控制面板；桌面模拟环境的 inset 为 0，真实非零 inset 和微信 WebView UA 仍需真机复核。微信识别逻辑已有 `MicroMessenger` 单元测试，但不等同于真机证据。
- 整体审查的两个非阻断 Minor 已延期：Canvas 每帧仍读取尺寸/DPR；HUD hidden 模式仍保留 store 订阅。两项未在最终修复波次中恶化。
- PR #2 已合并为 `feced285`；Pages run `30305196701` 的 build 31 秒、deploy 9 秒，两个 job 均成功。
- 线上缓存破除验证加载 `index-BEsYy-mJ.js` 与 `index-C3mvqVYK.css`；Task 6 实验入口、Canvas、人物 Pages 子路径和 `--app-height` 正常，390×844 外层视口无横向溢出，控制台 0 error/warn。
- Phase 5 新独立工作树基线为 17 files / 136 tests，TypeScript 与 Vitest 均通过；依赖复用主工作树现有 `node_modules` junction，没有安装或升级依赖。
- Phase 5 本地浏览器首轮复核：页面标题与品牌正确、内容非空、无框架错误覆盖，`viewport-fit=cover` 与 `--app-height: 844px` 生效，控制台 0 error/warn；当前浏览器的 390px 外层覆盖实际报告 375px 内容宽度，因此不能把它当作真实 390px CSS viewport 证据。
- 本地交互复核确认 `Preblur Layer` 会把共享页面切到 `data-glass-mode="preblur"`；Benchmark 运行时 Motion、粒子、DPR、动态开关与重置被锁定，取消后状态变为 `cancelled` 且控制恢复，HUD 模式仍可调整。
- 当前截图继续符合已确认方向：人物下半身被玻璃服务卡遮挡，普通玻璃边缘无发光，选中游戏与首页导航使用单一暖色强调；真实非零 Safe Area 与微信 WebView 仍需真机证据。
- Phase 5 重新跑完五个指定外层视口：375×812、390×844、393×852、430×932、844×390 的 `innerWidth`/`innerHeight` 均等于请求值；所有视口 `scrollWidth === clientWidth`、底栏可见且贴合视口底部、`--app-height` 等于实际高度。
- 390×844 展开控制面板的页面与面板本身均无横向溢出（document/body 为 375/375，panel 为 349/349）；截图底部出现的灰色横条属于应用内浏览器外层控件，不是页面滚动条。人物视差层可超出主容器约 4px，但由页面裁剪且未扩大 document scroll width。
- Phase 5 视觉对照未发现需要本轮改代码的 material mismatch：品牌/控制在顶部、四项细长游戏栏、六块不等宽高服务卡和五项底栏符合线框；深色半透明、人物主体、玻璃覆盖人物下半身与单一暖色选中光符合风格参考；游戏陪玩信息架构取代电商商品卡属于已确认的有意偏离。
- 视觉复核的剩余证据缺口是物理刘海/圆角下的非零 Safe Area、微信字体和合成差异、真机触摸与完整 30 秒报告导出；这些不能由桌面截图替代。
- Task 7 文档初审发现取消报告仍可能带 `completedInForeground: true`，且 schema 1 不导出 Benchmark `status`/`elapsedMs`；文档已改为必须同时保留 UI `completed`、未取消和完整前台三类证据，取消报告不得进入正式比较。
- Task 7 文档已按真实实现补充 3/8/8/8/3 阶段、压力覆盖、Reduced Motion 例外、整窗聚合/no per-phase 与 `settings.*` 基线边界；定向复审 APPROVED，0 个新 Critical/Important。
- 提交前公开扫描结果：无本机绝对路径、无凭据值模式、无 `.env` 文件、`package-lock.json` 无本地路径引用。
- 实施计划自检未发现 `TBD`、`TODO` 或未定义占位语；核心类型名称在任务间保持一致。

## Technical Decisions

| Decision                                                       | Rationale                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------- |
| 使用单页本地状态而非服务端路由                                 | Pages 子路径刷新可靠，无需后端 rewrite                              |
| 将 RAF 采样写入固定容量环形缓冲                                | 限制内存并避免 React 每帧渲染                                       |
| HUD 通过订阅快照最多 4Hz 更新                                  | 控制观察工具自身开销                                                |
| Visibility hidden 时暂停、visible 时清除后台长间隔并重新校准   | 防止后台节流污染帧指标                                              |
| Glass Mode 只切换 CSS class/背景层策略                         | 保持 DOM、内容与动画一致，便于公平比较                              |
| 角色原图作为独立 `<picture>`/背景层，UI 全部代码原生           | 可替换、可响应式裁切，避免把 UI 烘焙进图片                          |
| 使用 Canvas 2D 单层粒子，并按 DPR 上限调整 backing store       | 在高 DPR 手机上控制像素成本                                         |
| `LSVIS TD.woff2` 通过 `@font-face` 和 CSS 变量集中引用         | 使用更适合 Web 的压缩格式，后期替换仍只需更改一处令牌               |
| Task 4 的 Benchmark 继续使用注入时钟与动作接口                 | 保持状态机脱离 React，可用假时钟精确验证 3/8/8/8/3 秒阶段与取消恢复 |
| 报告导出采用显式白名单模式而非递归复制应用状态                 | 防止 cookie、token、IP、位置或用户身份字段意外进入本地报告          |
| Benchmark 运行期间禁用所有会改变粒子设置的 UI 路径             | 保证完成或取消后能恢复捕获现场，压力配置仍只作为瞬态覆盖            |
| 报告操作以递增序号和 StrictMode 安全的 mounted 生命周期发布    | 防止并发旧结果覆盖新状态，同时忽略真实卸载后的迟到 Promise          |
| 报告页面标识只允许 `/` 与已知 Pages 子路径，其余值 fail closed | 不让凭据、IP、token 或身份路径进入本地导出 JSON                     |
| Motion 档位使用单一 typed profile 映射到真实负载系数           | 保证 low/medium/high/maximum 可比较；数值仅为 playground 技术调参   |
| Benchmark 报告持有完成/取消时的不可变快照                      | 后续 HUD、可见性或设置变化不应污染已捕获的 30 秒结果                |
| Long Task、LoAF 和资源只保留 O(1) 累计摘要                     | 避免原始历史无界增长及每 250ms 重扫对被测页面造成自扰               |

## Issues Encountered

| Issue                                                              | Resolution                                                                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 沙箱 Git 用户与 Windows 目录所有者不同                             | 对仓库级命令显式传入 `safe.directory`，不扩大系统信任范围                                                                   |
| 初始图像生成误加未授权游戏图标                                     | 后续概念修正；最终规则由用户改为仅选中游戏可显示近似图标                                                                    |
| `rg` 在“未找到占位语”时以退出码 1 结束                             | 将其解释为自检通过，后续避免把无匹配当成实施失败                                                                            |
| Web 打开 GitHub 二进制 blob 页面返回 cache miss                    | 改用 GitHub API 验证文件元数据与原始下载地址                                                                                |
| 沙箱 PATH 无 `node`/`npm` 且标准 Program Files 路径不存在          | 使用 Codex bundled Node 与包管理运行时；继续定位可用 npm 入口以满足 npm 锁文件要求                                          |
| bundled Python 不含 `fontTools`，无法读取 OTF 完整 name/license 表 | 不为一次性检查增加依赖；改用 Windows PrivateFontCollection 验证可加载且 family name 为 `LSVIS TD`，授权以用户明确提供为依据 |
| 初次 GREEN 中刷新基准被长帧污染                                    | 测试捕获 8ms 预期变成 12ms；使用低四分位筛选稳定窗口后通过                                                                  |
| 测试 fake cancel 的参数触发 lint                                   | 改为类型兼容的无参数函数；lint 通过，规则保持启用                                                                           |

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
- 2026-07-27 用户明确选择 Task 5 方案 A：四种 Blur 共用唯一 React/DOM 结构，只切换模式类与表面策略；不采用四套组件或 Canvas 主导界面。

## Task 5 Checkpoint: 2026-07-27

- 首页使用唯一的 React/DOM 组合：`HomeScreen` 组装 `GameRail`、`ServiceGrid`、`BottomNav` 与 `ExperimentalPlaceholder`，四种 Glass mode 不渲染四套页面。
- `GlassSurface` 始终保留同一子树，仅通过 `glass-surface--real`、`glass-surface--simulated`、`glass-surface--preblur` 或 `glass-surface--off` 切换表面策略；`data-glass-mode` 保持可观察。
- 基础玻璃只使用中性边框、内高光和阴影；`glass-surface--selected` 是唯一引入 `--selected-glow` 的路径，游戏栏和底栏的选中状态明确使用 `aria-pressed`/`aria-current`。
- 六个服务入口均可打开可见的 `Experimental / Mock` 对话框；四个游戏和五个底栏项保持要求的精确文案与 44px 级触摸目标。

## Resume Checkpoint

1. 重读 `task_plan.md`、本文件和 `progress.md`。
2. 当前位于 Phase 4 暂停点：Task 6.1 已通过独立审查；Task 6.2 已提交为 `549fa19`，但尚未独立审查。
3. 不重做 Task 6.1/6.2 实现；恢复后先审查 `d09b410..549fa19`，review clean 后才进入 Task 6.3 性能 HUD RED。
4. 停止前 Task 6.2 已通过 focused 9/9、全量 11 files / 63 tests、typecheck、ESLint、scoped Prettier 和 `git diff --check`；这些是既有证据，暂停后不要无目的重复测试。

历史发布背景：Task 5 已通过 PR #1 合并为 `4f42867`，Pages run `30273041434` 成功；当前 `agent/experiment-controls` 的 Task 6 提交仅在本地，尚未 push、deploy、tag 或 release。

恢复检查点复核确认：三个规划文件均包含当前 Phase 4/Task 6 RED 指令；历史 Pages 检查点与当前本地状态已明确区分。

---

_每两次视觉、浏览或搜索后更新本文件。_
