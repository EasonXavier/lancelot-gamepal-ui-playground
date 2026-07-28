# 性能指标说明

本文描述性能 HUD 与 `schemaVersion: 2` JSON 报告的真实口径。所有数据均在当前页面、当前浏览器会话内采集，不是操作系统级遥测。

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

单模式与四模式 Suite 使用同一 schema。顶层固定为
`schemaVersion`、`reportType`、`generatedAt`、`page`、`environment`、`benchmark` 和 `runs[]`；新测试开始时会替换内存中的旧报告。

| 路径/字段                         | 单位或取值                                                      | 采集方式与口径                                                              |
| --------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `schemaVersion`                   | 当前为 `2`                                                      | 报告结构版本，不是产品正式版本                                              |
| `reportType`                      | `single` / `suite`                                              | 单模式或四模式 Baseline Suite                                               |
| `generatedAt`                     | ISO 8601                                                        | 报告开始时的客户端时间                                                      |
| `page.url`                        | `/`、Pages base 或 `[redacted]`                                 | 仅允许两个已知路径；其他 URL 默认脱敏                                       |
| `environment.userAgent`           | 字符串                                                          | 浏览器提供；公开前仍需人工检查                                              |
| `environment.isWeChat`            | 布尔值                                                          | UA 是否匹配 `MicroMessenger`；只能表明 UA 特征，不能证明已完成真机微信验收  |
| `environment.operatingSystem`     | 当前为 `null`                                                   | 未从 UA 猜测操作系统                                                        |
| `environment.viewport` / `screen` | CSS px                                                          | 报告开始时的视口与屏幕尺寸                                                  |
| `environment.devicePixelRatio`    | 比率                                                            | 浏览器报告的原生 DPR；Canvas 实际 DPR 还受设置上限影响                      |
| `benchmark.status`                | `idle/running/completed/cancelled/failed`                       | 当前报告的终态；只有 `completed` 才可能形成完整比较                         |
| `benchmark.order`                 | Glass Mode 数组                                                 | Suite 固定为 `real, simulated, preblur, off`；单模式只有启动时模式          |
| `benchmark.settleDurationMs`      | Suite `3000`；单模式 `0`                                        | 每个 Suite 模式开始 30 秒采样前的稳定窗口；稳定阶段不采样                   |
| `benchmark.runDurationMs`         | `30000`                                                         | 每个完整 run 的 Benchmark 时长                                              |
| `benchmark.elapsedMs`             | ms                                                              | 整个单模式或 Suite 从开始到终止的实际经过时间；浏览器中可能高于名义计划时长 |
| `benchmark.completedModes`        | Glass Mode 数组                                                 | 只包含已完整完成并写入 `runs[]` 的模式                                      |
| `benchmark.interruptions`         | 次                                                              | Suite 终止时记录的前台可见性中断计数；应结合状态与失败原因解释              |
| `benchmark.interruptionsByMode`   | 四模式数值图                                                    | 固定含 `real/simulated/preblur/off`；记录各模式中断次数，单模式全为 0       |
| `benchmark.terminatedPhase`       | Benchmark phase / Suite phase / `null`                          | 取消或失败发生时的阶段；正常完成为 `null`                                   |
| `benchmark.failureReason`         | `visibility-interruption-limit` / `orientation-change` / `null` | Suite 失败原因；取消与正常完成不是失败                                      |
| `runs[].glassMode`                | `real/simulated/preblur/off`                                    | 该完整 run 实际使用的临时 Glass 模式                                        |
| `runs[].settings.*`               | 枚举/布尔值                                                     | 套件启动时冻结的有效设置，只改变 `glassMode`；不记录阶段内瞬时压力覆盖      |
| `runs[].performance`              | 完整白名单化快照                                                | 帧、Web Vitals、主线程、资源和能力状态                                      |
| `runs[].elapsedMs`                | 成功项为 `30000`                                                | 该独立 run 的完整采样时长                                                   |
| `runs[].completedInForeground`    | 布尔值                                                          | 该 run 是否全程在前台；单模式可完成但为 `false`                             |
| `runs[].eligibleForComparison`    | 布尔值                                                          | 只有完整前台 run 才为 `true`；Suite 比较还要求四模式全部完成                |

单模式成功报告包含 1 个 run，取消包含 0 个。完整 Suite 包含 4 个有序 run；取消或失败会统一丢弃活动 run 的部分指标，但保留此前完整完成的 run。不要把“报告里有 run”与“整套测试 completed”等同起来。

单模式允许在后台计时完成，但该 run 必须同时标记
`completedInForeground: false` 与 `eligibleForComparison: false`。Suite 进入后台会立即作废活动 run；回到前台后从该模式的 3 秒稳定阶段重新开始。同一模式连续第三次被后台中断时以
`visibility-interruption-limit` 失败。横竖屏切换会立即以
`orientation-change` 失败，保留已完成 run 并丢弃活动 run，避免混合不同视口。

## 四模式 Baseline Suite

Suite 固定执行以下序列，不接受运行中重排：

| 顺序 | Glass Mode  | 稳定阶段 | Benchmark | 累计无中断边界 |
| ---- | ----------- | -------- | --------- | -------------- |
| 1    | `real`      | 3 秒     | 30 秒     | 33 秒          |
| 2    | `simulated` | 3 秒     | 30 秒     | 66 秒          |
| 3    | `preblur`   | 3 秒     | 30 秒     | 99 秒          |
| 4    | `off`       | 3 秒     | 30 秒     | 132 秒         |

表中的 132 秒是四段计划时长相加得到的名义边界。假时钟自动化测试会在精确 `132000ms` 完成；真实浏览器的定时器、渲染和主线程调度可能延迟回调，因此成功报告的实际 `benchmark.elapsedMs` 可以略高于 `132000`，不应据此判定 run 不完整。

每次进入 30 秒窗口都独立执行 metrics reset、sampling start、capture 和 freeze，不跨模式合并样本。Suite 开始时冻结当前有效设置，四次只使用临时 `glassMode` 覆盖；完成、取消或失败后恢复原设置、页面场景、滚动位置和抽屉状态。

结果卡只横向比较 Average FPS、P95 Frame Time 和 Estimated Dropped Frames，不生成未经定义的综合分数。完整 JSON 仍保留其余白名单指标，供诊断而不是替代三项 baseline 对照。

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

`baselineFrameTime`、`averageFrameTime`、`sampleCount` 与 `stutterFrameRatio` 存在于运行时内部快照，但 schema v2 导出白名单不包含它们。

### Web Vitals

`ttfb`、`fcp`、`lcp`、`cls`、`inp` 由 `web-vitals` 延迟注册采集。可用值包含 `value`、`delta`、`rating` 和事件 `id`。TTFB/FCP/LCP/INP 通常以毫秒表示，CLS 无单位。INP 需要真实交互；LCP 等指标还可能在页面生命周期后续更新，因此同一次页面加载内应在相同时间点导出。

### 主线程、资源与能力

- `mainThread.longTasks` 与 `longAnimationFrames`：若可用，汇总 `count`、`totalDuration`、`maxDuration`，单位为毫秒；这是浏览器 PerformanceObserver 条目，不是 CPU 占用率。
- `resources.resourceCount`：观察到的资源数。
- `resources.totalDuration`：所有有效资源 duration 的累计毫秒数；多个资源并行时不可解释为页面总加载时长。
- `resources.transferSize` / `decodedBodySize`：所有条目都提供正有限值时才汇总为字节；跨域或缓存使任一条目不可可靠测量时可能是 `not-measurable`。
- `capabilities.*`：`navigation`、`paint`、`largestContentfulPaint`、`layoutShift`、`eventTiming`、`longTask`、`longAnimationFrame` 的浏览器能力状态。

Navigation Timing 在运行时也会采集 TTFB、请求时长、DOM Interactive 与 Load Event，但 schema v2 报告未导出 navigation 快照；不要从缺失字段推断数值为 0。

## 浏览器能测与不能测

| 范围                                                                    | 本项目状态                                                        |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| RAF 帧间隔、Web Vitals、部分 Long Task/LoAF、Navigation/Resource Timing | 浏览器支持时可测，仍需遵守状态与口径                              |
| 当前视口、屏幕、DPR、UA、触点数、部分网络提示                           | 浏览器可能提供；schema v2 只导出其中白名单字段                    |
| 是否为微信 UA                                                           | 可由 `MicroMessenger` 特征标记，但不是 WebView 内核或真机兼容认证 |
| CPU/GPU 利用率、温度、功耗、整机内存、系统合成器丢帧                    | 浏览器无法可靠取得，本项目不测、不估算、不伪造                    |
| 非零 Safe Area、微信前后台策略、分享/下载行为                           | 必须用目标真机和真实微信 WebView 验证                             |

## 公平对比方法

1. 固定同一设备、系统版本、微信/浏览器版本、页面版本、屏幕方向、亮度、网络和电源状态。
2. 关闭其他高负载应用；若设备已经明显发热，等待恢复到相近起始状态。
3. 刷新页面，记录 build version；选择并记录一组基线设置。
4. 本轮真机验收可运行一次完整 Suite，在名义 132 秒计划时长之外继续保持前台直至 UI 显示完成；它会一次得到 `real → simulated → preblur → off` 四个 baseline，避免手动切换时误改其他设置。
5. 确认 `benchmark.status === "completed"`、`benchmark.completedModes` 与 `runs[]` 都是四个固定顺序项，并逐项确认 `completedInForeground === true` 与 `eligibleForComparison === true`。取消、失败、部分完成或无效 run 均不能进入四模式比较。
6. 固定顺序会让后运行模式更容易受到热累积或电源调度影响，因此一次 Suite 适合真机验收和初始 baseline，不等同于随机化实验。
7. 需要严格统计时，在设备冷却到相近状态后重复完整 Suite，至少保留每次原始四行结果；报告中位数与离散程度，不只挑最好一次。当前实现不提供反向顺序或随机顺序。
8. Suite 表重点比较 FPS、P95 frame 与 Estimated dropped；JSON 中的 Max frame、`framesOver33`/`framesOver50` 等可用于诊断，但 FPS 单项不应作为唯一结论。
9. 将 JSON 与填写完成的[真机记录模板](./device-test-template.md)一起保存；公开前移除可识别信息。

建议文件名包含匿名设备代号、页面 build、日期、方向和模式，例如 `device-a_build-xxxx_portrait_real_run-01.json`，不要写姓名、电话号码或精确位置。
