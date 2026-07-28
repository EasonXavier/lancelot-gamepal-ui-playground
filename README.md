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
- `compact`、`expanded`、`hidden` 三种性能 HUD 显示方式。
- 固定 30 秒 Benchmark、本地 JSON/摘要复制和 JSON 下载。
- 页面隐藏时暂停采样；Benchmark 若未全程处于前台，会在报告中标记。

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

1. 打开右上角“实验控制”。
2. 先固定设备、方向、网络与其余设置，只改变一个待比较变量。
3. 选择 Glass、动态、粒子、DPR 与 HUD 模式；设置保存在当前浏览器的 `localStorage`，可用“重置设置”恢复默认值。
4. 点击“运行 30 秒 Benchmark”。运行期间会锁定会改变负载的设置；可随时取消。
5. 等待控制面板状态显示 `completed`，确认本轮没有点击取消，再使用“复制 JSON”“下载 JSON”或“复制摘要”保存结果。报告只在浏览器本地生成，不会上传。

Benchmark 的固定阶段为：`warmup` 3 秒、`ambient` 8 秒、`stress` 8 秒、`scroll-transition` 8 秒、`summarize` 3 秒。各阶段如何应用设置、如何滚动/开合面板，以及报告的聚合边界见[性能指标说明](./docs/performance-metrics.md)。

## 已验证与当前局限

已在桌面浏览器的 375×812、390×844、393×852、430×932、844×390 外层视口验证无横向溢出，并验证 Glass/Motion/HUD 切换、Benchmark 锁定与取消恢复、JSON 复制以及 Pages 子路径资源加载。该证据只代表桌面浏览器模拟环境。

以下项目仍为 **pending**，不能由桌面设备模拟器代替：

- 刘海屏、灵动岛等设备上的非零 Safe Area 实际表现。
- iOS/Android 微信内置 WebView 的渲染、触摸、前后台切换与报告导出。
- 真机温度、功耗、GPU/CPU 利用率和系统级丢帧。浏览器未提供可靠接口，本项目不会伪造这些数值。

浏览器对 Performance API 的支持并不一致。HUD/JSON 中的 `waiting`、`unsupported`、`not-measurable` 是有效状态，不应当当作数值 `0`。最终结论必须附设备与环境记录，并优先比较同设备、同浏览器版本、同方向和同网络条件下的多次运行。

`benchmark.completedInForeground: true` 只能说明运行期间没有观察到页面进入后台，不能单独证明 30 秒流程完成。只有同时在 UI 观察到终态 `completed`、确认没有取消，且该字段为 `true` 的报告才能用于正式横向比较；取消时捕获的报告必须排除。当前 schema 1 JSON 不导出 Benchmark 的 `status` 或 `elapsedMs`，因此必须在设备记录中另存 UI 终态证据。

## 安全与素材

项目不接收、上传或持久化敏感信息。不要提交包含身份、Cookie、凭据、精确位置、私有 URL 或业务数据的报告。公开报告前仍应人工复核 `userAgent` 等环境字段。人物素材与临时 Demo 字体的授权、处理和替换说明见 [ASSET_SOURCES.md](./ASSET_SOURCES.md)；安全披露规则见 [SECURITY.md](./SECURITY.md)。

本项目没有正式 Release 或版本标签；界面中的 build version 只用于追踪工作构建。
