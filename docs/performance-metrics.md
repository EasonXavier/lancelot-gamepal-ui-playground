# 性能指标说明

本文描述性能 HUD 与 `schemaVersion: 1` JSON 报告的真实口径。所有数据均在当前页面、当前浏览器会话内采集，不是操作系统级遥测。

## 可用状态

结构化指标使用显式状态，避免把“没有数据”错误解释为 `0`：

| 状态             | 含义                                                 | 比较时如何处理                      |
| ---------------- | ---------------------------------------------------- | ----------------------------------- |
| `available`      | 浏览器支持且已经取得测量值                           | 可以在相同环境下比较 `value`        |
| `waiting`        | 当前尚未产生有效事件或样本                           | 继续交互/等待后重测；不参与数值比较 |
| `unsupported`    | 当前浏览器不支持对应 API/entry type                  | 记录浏览器版本；不替换为 0          |
| `not-measurable` | API 存在，但数据受跨域、缓存或浏览器限制不可可靠汇总 | 记录状态；不替换为 0                |
| `null`           | 报告白名单字段没有可用值或尚无可冻结结果             | 说明上下文后排除                    |

`waiting`、`unsupported`、`not-measurable` 不是性能好坏等级。Web Vitals 的 `good`、`needs-improvement`、`poor` 才是 `web-vitals` 返回的评级。

## 报告结构

| 路径/字段                         | 单位或取值                      | 采集方式与口径                                                                           |
| --------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| `schemaVersion`                   | 当前为 `1`                      | 报告结构版本，不是产品正式版本                                                           |
| `generatedAt`                     | ISO 8601                        | 生成报告的客户端时间                                                                     |
| `page.url`                        | `/`、Pages base 或 `[redacted]` | 仅允许两个已知路径；其他 URL 默认脱敏                                                    |
| `environment.userAgent`           | 字符串                          | 浏览器提供；公开前仍需人工检查                                                           |
| `environment.isWeChat`            | 布尔值                          | UA 是否匹配 `MicroMessenger`；只能表明 UA 特征，不能证明已完成真机微信验收               |
| `environment.operatingSystem`     | 当前为 `null`                   | 未从 UA 猜测操作系统                                                                     |
| `environment.viewport` / `screen` | CSS px                          | 报告生成时的视口与屏幕尺寸                                                               |
| `environment.devicePixelRatio`    | 比率                            | 浏览器报告的原生 DPR；Canvas 实际 DPR 还受设置上限影响                                   |
| `settings.*`                      | 枚举/布尔值                     | 报告生成时的基线/有效 Glass、Motion、粒子、DPR、HUD 与动态开关；不记录阶段内瞬时压力覆盖 |
| `benchmark.completedInForeground` | `true` / `false` / `null`       | 运行期间是否一直在前台；未运行时为 `null`，`true` 也不能单独证明流程完成                 |

当前 schema 1 JSON 不导出 Benchmark 的 `status` 或 `elapsedMs`。取消操作也会捕获当时的聚合快照，并且如果取消前一直在前台，`completedInForeground` 仍可能为 `true`。因此正式比较必须同时满足：控制面板 UI 已观察到终态 `completed`、本轮没有取消、`completedInForeground === true`。任何取消报告都应排除，并在设备记录中保存 UI 终态证据。

## 30 秒 Benchmark 阶段

| 阶段                | 时长 | 实际行为                                                                           |
| ------------------- | ---- | ---------------------------------------------------------------------------------- |
| `warmup`            | 3 秒 | 保持当前 effective settings，重置指标并开始采样                                    |
| `ambient`           | 8 秒 | 继续保持当前 effective settings                                                    |
| `stress`            | 8 秒 | 将 Motion 与 Particle 瞬时覆盖为 `maximum`，并强制开启背景动态、触摸视差与卡片浮动 |
| `scroll-transition` | 8 秒 | 保持与 `stress` 相同的最大压力覆盖，关闭实验面板并滚动到文档底部                   |
| `summarize`         | 3 秒 | 保持最大压力覆盖并打开实验面板，然后在阶段结束时冻结整段结果                       |

若系统 `prefers-reduced-motion` 已开启，或启用了“模拟减少动态”，上述压力阶段不会强制开启动效：Motion 为 `off`、Particle 为 `0`，三个动态开关保持关闭。流程结束或取消后会退出瞬时压力覆盖，并恢复开始前的游戏、面板开合与滚动位置；用户设置本身仍是当前基线。

报告只包含整个采样窗口的聚合结果，不提供 per-phase 指标。`settings.*` 写入的是基线/有效设置，不是 `stress`、`scroll-transition` 或 `summarize` 的瞬时覆盖；因此不能从导出 JSON 单独重建每阶段负载或比较各阶段性能。

### 帧指标

帧指标来自 `requestAnimationFrame` 间隔，使用固定容量缓冲，避免每帧更新 React。浏览器定时、刷新率、系统调度和后台节流都会影响结果。

| 字段                     | 单位       | 口径                                                                                                                                                                |
| ------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `averageFps`             | fps        | 最近 30 个有效帧间隔中位数换算的当前 FPS；名称为兼容既有报告，不能视为整段算术平均 FPS                                                                              |
| `p95FrameTime`           | ms         | 有效帧间隔的第 95 百分位，越低越稳定                                                                                                                                |
| `maxFrameTime`           | ms         | 采样窗口内最大有效帧间隔                                                                                                                                            |
| `estimatedDroppedFrames` | 帧（估算） | 完整 JSON 路径为 `performance.frames.estimatedDroppedFrames.value`；外层对象同时带 `label: "Estimated"`，以低四分位稳定窗口推导的基线帧时长估算，不是系统合成器真值 |
| `framesOver33`           | 次         | 帧间隔大于 33.3 ms 的样本数                                                                                                                                         |
| `framesOver50`           | 次         | 帧间隔大于 50 ms 的样本数                                                                                                                                           |

`baselineFrameTime`、`averageFrameTime`、`sampleCount` 与 `stutterFrameRatio` 存在于运行时内部快照，但当前 schema 1 导出白名单不包含它们。

### Web Vitals

`ttfb`、`fcp`、`lcp`、`cls`、`inp` 由 `web-vitals` 延迟注册采集。可用值包含 `value`、`delta`、`rating` 和事件 `id`。TTFB/FCP/LCP/INP 通常以毫秒表示，CLS 无单位。INP 需要真实交互；LCP 等指标还可能在页面生命周期后续更新，因此同一次页面加载内应在相同时间点导出。

### 主线程、资源与能力

- `mainThread.longTasks` 与 `longAnimationFrames`：若可用，汇总 `count`、`totalDuration`、`maxDuration`，单位为毫秒；这是浏览器 PerformanceObserver 条目，不是 CPU 占用率。
- `resources.resourceCount`：观察到的资源数。
- `resources.totalDuration`：所有有效资源 duration 的累计毫秒数；多个资源并行时不可解释为页面总加载时长。
- `resources.transferSize` / `decodedBodySize`：所有条目都提供正有限值时才汇总为字节；跨域或缓存使任一条目不可可靠测量时可能是 `not-measurable`。
- `capabilities.*`：`navigation`、`paint`、`largestContentfulPaint`、`layoutShift`、`eventTiming`、`longTask`、`longAnimationFrame` 的浏览器能力状态。

Navigation Timing 在运行时也会采集 TTFB、请求时长、DOM Interactive 与 Load Event，但当前 schema 1 报告未导出 navigation 快照；不要从缺失字段推断数值为 0。

## 浏览器能测与不能测

| 范围                                                                    | 本项目状态                                                        |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| RAF 帧间隔、Web Vitals、部分 Long Task/LoAF、Navigation/Resource Timing | 浏览器支持时可测，仍需遵守状态与口径                              |
| 当前视口、屏幕、DPR、UA、触点数、部分网络提示                           | 浏览器可能提供；schema 1 只导出其中白名单字段                     |
| 是否为微信 UA                                                           | 可由 `MicroMessenger` 特征标记，但不是 WebView 内核或真机兼容认证 |
| CPU/GPU 利用率、温度、功耗、整机内存、系统合成器丢帧                    | 浏览器无法可靠取得，本项目不测、不估算、不伪造                    |
| 非零 Safe Area、微信前后台策略、分享/下载行为                           | 必须用目标真机和真实微信 WebView 验证                             |

## 公平对比方法

1. 固定同一设备、系统版本、微信/浏览器版本、页面版本、屏幕方向、亮度、网络和电源状态。
2. 关闭其他高负载应用；若设备已经明显发热，等待恢复到相近起始状态。
3. 刷新页面，记录 build version；选择一组基线设置。
4. 每轮只改变一个变量，例如只从 `real` 切换到 `simulated`，不要同时改粒子和 DPR。
5. 每个配置至少运行 3 次完整 30 秒 Benchmark，保持页面前台；每次都要另行记录 UI 终态 `completed` 且未取消。舍弃取消报告、没有完成证据的报告，以及 `completedInForeground !== true` 的报告。
6. 模式顺序使用轮换或交错，例如 A-B-C-D、D-C-B-A，降低热累积和运行顺序偏差。
7. 先比较状态是否一致，再比较中位数；同时报告离散程度或完整原始结果，不只挑最好一次。
8. 重点观察 P95/Max frame、`framesOver33`/`framesOver50` 与估算丢帧；FPS 单项不应作为唯一结论。
9. 将 JSON 与填写完成的[真机记录模板](./device-test-template.md)一起保存；公开前移除可识别信息。

建议文件名包含匿名设备代号、页面 build、日期、方向和模式，例如 `device-a_build-xxxx_portrait_real_run-01.json`，不要写姓名、电话号码或精确位置。
