# 朗世乐移动 UI 性能试验场

这是一个独立、公开的移动端 UI 性能试验项目，用同一套 React/DOM 内容比较不同毛玻璃与动态负载在浏览器、移动 WebView 中的表现。它不是朗世乐业务系统，也不包含真实订单、账户、客服、消息或后端接口。

- 在线预览：<https://easonx.me/lancelot-gamepal-ui-playground/>
- 源码仓库：<https://github.com/EasonXavier/lancelot-gamepal-ui-playground>
- 安全与隐私边界：[SECURITY.md](./SECURITY.md)
- 素材与字体来源：[ASSET_SOURCES.md](./ASSET_SOURCES.md)
- 指标口径：[docs/performance-metrics.md](./docs/performance-metrics.md)
- 真机记录模板：[docs/device-test-template.md](./docs/device-test-template.md)
- 视觉探索与验收账本：[docs/ui-exploration-plan.md](./docs/ui-exploration-plan.md)

## 当前实验场景

首页以人物被多层半透明界面遮挡的复杂构图作为 Blur 压力场景，并提供：

- 四种互斥 Glass Mode：`Real Blur`、`Simulated Glass`、`Preblur Layer`、`Blur Off`；内容、布局、图片与交互树保持一致。
- 五档动态、五档粒子数量、三档 Canvas DPR，以及背景动态、触摸视差、卡片浮动和模拟减少动态开关。
- `compact`、`expanded`、`hidden` 三种性能 HUD 显示方式；HUD 默认是可点击的单行胶囊，隐藏后可从设置恢复。
- 单模式 30 秒 Benchmark，以及固定顺序的四模式 Baseline Suite；报告可在本地复制 JSON/摘要或下载 JSON。
- 页面隐藏时按测试类型应用不同规则，并在 schema v2 报告中保留完成性与比较资格。

页面采用移动优先布局。品牌固定为“朗世乐”；游戏栏为低高度四选项，只有当前游戏显示近似图标；六个服务入口保持不同宽高；普通玻璃不发光，仅选中态使用暖色强调。

## 本地运行

需要 Node.js `>=22.12.0` 与 npm `>=11.0.0`。

```powershell
npm ci
npm run dev
```

生产预览：

```powershell
npm run build
npm run preview
```

GitHub Pages 使用固定 base：`/lancelot-gamepal-ui-playground/`。本地直接打开 `dist/index.html` 不能替代 HTTP 预览；请使用 `npm run preview`。

## 验证命令

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Pages workflow 会在 `main` 推送时运行 `npm ci`，再执行 lint、测试与生产构建，最后部署 `dist/`。仓库目前没有独立的 PR CI workflow；不能把“未显示 PR checks”解读为测试已通过。

## 使用实验控制

1. 打开右上角“实验控制”。控制区是约 `82dvh` 的模态底部抽屉；闲置时可用 Escape 或遮罩关闭。
2. 先固定设备、方向、网络与 Glass 之外的设置。Glass、动态、粒子、DPR 与 HUD 设置保存在当前浏览器的 `localStorage`，可用“重置设置”恢复默认值。
3. 推荐点击“四模式 Baseline Suite”。它固定按 `Real Blur → Simulated → Preblur → Blur Off` 执行；每个模式先稳定 3 秒，再完整运行现有 30 秒 Benchmark，名义计划时长为 132 秒。浏览器定时器和主线程调度可能使实际 `benchmark.elapsedMs` 略高于 `132000`；四次临时 Glass 覆盖不会写入 `localStorage`。
4. 如只需检查当前 Glass，也可运行单模式 30 秒 Benchmark。单模式与 Suite 互斥；运行期间会锁定所有会改变负载的设置，复制、下载和取消仍可用。
5. 等待状态进入 `completed` 后，再使用“复制 JSON”“下载 JSON”或“复制摘要”保存 schema v2 报告。报告只在浏览器内存中生成，新测试会替换旧报告，不会上传或建立历史数据库。

Benchmark 的固定阶段为：`warmup` 3 秒、`ambient` 8 秒、`stress` 8 秒、`scroll-transition` 8 秒、`summarize` 3 秒。各阶段如何应用设置、如何滚动/开合面板，以及报告的聚合边界见[性能指标说明](./docs/performance-metrics.md)。

## 已验证与当前局限

自动化测试以假时钟覆盖 Suite 的固定顺序与精确 `132000ms` 计划边界，并覆盖取消/后台/旋转终止、报告结构、焦点循环和运行锁定。当前分支的桌面生产预览已检查 375×812、390×844、393×852、430×932、844×390：无横向溢出、服务区与底栏无重叠、抽屉保持视口内且可独立滚动，控制台无 warning/error；390×844 还完成了一次名义 132 秒 Suite。复制 UI 显示成功，但隔离浏览器未开放页面写入的剪贴板内容，因此 JSON 字段继续以自动化序列化测试为证。以上仍只代表桌面浏览器环境。

以下项目仍为 **pending**，不能由桌面设备模拟器代替：

- 刘海屏、灵动岛等设备上的非零 Safe Area 实际表现。
- iOS/Android 微信内置 WebView 的渲染、触摸、前后台切换与报告导出。
- 真机温度、功耗、GPU/CPU 利用率和系统级丢帧。浏览器未提供可靠接口，本项目不会伪造这些数值。

浏览器对 Performance API 的支持并不一致。HUD/JSON 中的 `waiting`、`unsupported`、`not-measurable` 是有效状态，不应当当作数值 `0`。最终结论必须附设备与环境记录，并优先比较同设备、同浏览器版本、同方向和同网络条件下的多次运行。

schema v2 将单模式与 Suite 统一为顶层 `benchmark` 和 `runs[]`。每个可比较 run 必须是完整 30 秒、`completedInForeground: true` 且 `eligibleForComparison: true`；Suite 的最终横向比较只接受四个完整前台 run。取消或失败会丢弃活动 run，但可保留此前完整完成的 run；报告同时记录累计 `benchmark.interruptions` 与固定四键的 `benchmark.interruptionsByMode`，并保留终态、完成模式、终止阶段和失败原因。单模式报告的逐模式中断图固定全为 0。

固定 Suite 顺序方便一次真机操作得到四模式 baseline，但后运行模式可能受设备热衰减影响。当前真机验收允许一次完整 Suite；需要严格统计时，应在设备冷却到相近状态后重复完整 Suite，并报告原始结果与离散程度，而不是将固定顺序解释为无偏随机实验。

## 安全与素材

项目不接收、上传或持久化敏感信息。不要提交包含身份、Cookie、凭据、精确位置、私有 URL 或业务数据的报告。公开报告前仍应人工复核 `userAgent` 等环境字段。人物素材与临时 Demo 字体的授权、处理和替换说明见 [ASSET_SOURCES.md](./ASSET_SOURCES.md)；安全披露规则见 [SECURITY.md](./SECURITY.md)。

本项目没有正式 Release 或版本标签；界面中的 build version 只用于追踪工作构建。
