# 真机与微信 WebView 测试记录模板

> 复制本文件或下面的区块，为每台设备建立一份记录。不要填写姓名、电话号码、微信号、IP、精确位置、Cookie、Token 或其他可识别信息。

## 1. 测试身份

| 字段                 | 填写值 |
| -------------------- | ------ |
| 匿名设备代号         | `TODO` |
| 测试日期/时区        | `TODO` |
| 测试人员代号（可选） | `TODO` |
| 页面 URL             | `TODO` |
| 页面 build version   | `TODO` |
| 报告 schemaVersion   | `TODO` |

## 2. 设备与软件环境

| 字段                                   | 填写值                    |
| -------------------------------------- | ------------------------- |
| 设备厂商/型号                          | `TODO`                    |
| 操作系统及版本                         | `TODO`                    |
| 系统标称物理分辨率（人工记录）         | `TODO`                    |
| 系统标称/当前刷新率（人工记录）        | `TODO`；JSON 不提供该字段 |
| 浏览器或 WebView                       | `TODO`                    |
| 浏览器版本/内核版本（能确认时）        | `TODO`                    |
| 微信版本                               | `TODO` / `不适用`         |
| 入口（微信聊天链接/收藏/外部浏览器等） | `TODO`                    |
| 低电量模式/省电模式                    | `开` / `关` / `未知`      |
| `prefers-reduced-motion`               | `开启` / `关闭` / `未知`  |

## 3. 网络与运行前状态

| 字段               | 填写值                                   |
| ------------------ | ---------------------------------------- |
| 网络类型           | `Wi-Fi` / `5G` / `4G` / `其他`           |
| 网络条件说明       | `TODO`（不要记录 SSID、IP 或精确位置）   |
| VPN/代理           | `无` / `有（匿名说明）` / `未知`         |
| 电量区间           | `TODO`（例如 60–80%）                    |
| 充电状态           | `充电中` / `未充电`                      |
| 设备温度主观状态   | `冷` / `正常` / `偏热`（不是传感器测量） |
| 测试前后台应用处理 | `TODO`                                   |
| 页面加载方式       | `冷启动` / `刷新` / `同会话重复`         |

## 4. 视口、方向与 Safe Area

| 检查项                                 | Portrait            | Landscape           | 证据/备注                        |
| -------------------------------------- | ------------------- | ------------------- | -------------------------------- |
| `viewport.width × height`              | `TODO`              | `TODO`              | JSON 或开发工具记录              |
| JSON `screen.width × height`（CSS px） | `TODO`              | `TODO`              | 与系统标称物理分辨率不是同一口径 |
| DPR                                    | `TODO`              | `TODO`              | JSON 记录                        |
| 顶部非零 Safe Area 可见                | `pass/fail/pending` | `pass/fail/pending` | 截图编号                         |
| 底部非零 Safe Area 可见                | `pass/fail/pending` | `pass/fail/pending` | 截图编号                         |
| 品牌/控制按钮未被遮挡                  | `pass/fail/pending` | `pass/fail/pending` |                                  |
| 底栏未被 Home Indicator 遮挡           | `pass/fail/pending` | `pass/fail/pending` |                                  |
| 无横向溢出                             | `pass/fail/pending` | `pass/fail/pending` |                                  |
| 旋转后高度与布局恢复                   | `pass/fail/pending` | `pass/fail/pending` |                                  |

当前仓库只确认 CSS 已使用 `env(safe-area-inset-*)`。非零 inset 必须在具有真实切口/Home Indicator 的目标设备上记录；桌面模拟结果不能填写为真机 `pass`。

## 5. 微信 WebView 行为

| 检查项                               | 结果                      | 证据/备注                             |
| ------------------------------------ | ------------------------- | ------------------------------------- |
| 报告 `environment.isWeChat === true` | `pass/fail/pending`       |                                       |
| 页面首次加载与刷新                   | `pass/fail/pending`       |                                       |
| 人物、字体、Canvas 与玻璃资源加载    | `pass/fail/pending`       |                                       |
| 触摸按钮与滚动无误触                 | `pass/fail/pending`       |                                       |
| 触摸视差可用/降级合理                | `pass/fail/pending`       |                                       |
| 前台运行 30 秒 Benchmark             | `pass/fail/pending`       |                                       |
| UI 已观察到终态 `completed`          | `pass/fail/pending`       | 必填截图/录屏编号；JSON 不导出 status |
| 确认本轮未点击“取消 Benchmark”       | `pass/fail/pending`       | 必填人工记录                          |
| 切后台后暂停并标记未完整前台         | `pass/fail/pending`       |                                       |
| 回前台后页面可继续操作               | `pass/fail/pending`       |                                       |
| 复制 JSON                            | `pass/fail/pending`       | 微信权限/提示                         |
| 下载 JSON                            | `pass/fail/pending`       | 微信可能限制下载，记录实际行为        |
| 复制摘要                             | `pass/fail/pending`       |                                       |
| 控制台错误（如可取得）               | `0` / `TODO` / `不可取得` |                                       |

## 6. 模式矩阵

固定 Motion、粒子、DPR 和动态开关，只切换 Glass；每个组合建议完整运行 3 次。若浏览器不支持某指标，记录状态，不填 0。

| Glass Mode  | Motion | 粒子   | DPR    | Run 1 报告 | Run 2 报告 | Run 3 报告 | UI `completed`/未取消证据 | 前台完整 | 视觉异常/备注 |
| ----------- | ------ | ------ | ------ | ---------- | ---------- | ---------- | ------------------------- | -------- | ------------- |
| `real`      | `TODO` | `TODO` | `TODO` | `TODO`     | `TODO`     | `TODO`     | `TODO`                    | `TODO`   |               |
| `simulated` | `TODO` | `TODO` | `TODO` | `TODO`     | `TODO`     | `TODO`     | `TODO`                    | `TODO`   |               |
| `preblur`   | `TODO` | `TODO` | `TODO` | `TODO`     | `TODO`     | `TODO`     | `TODO`                    | `TODO`   |               |
| `off`       | `TODO` | `TODO` | `TODO` | `TODO`     | `TODO`     | `TODO`     | `TODO`                    | `TODO`   |               |

如需比较负载档位，复制下面的行并保持 Glass 与其他设置固定：

| 变量     | 值                            | 报告文件 | P95 frame | Max frame | >33 ms | >50 ms | Estimated dropped | 备注 |
| -------- | ----------------------------- | -------- | --------- | --------- | ------ | ------ | ----------------- | ---- |
| Motion   | `off/low/medium/high/maximum` | `TODO`   | `TODO`    | `TODO`    | `TODO` | `TODO` | `TODO`            |      |
| Particle | `0/20/50/100/maximum`         | `TODO`   | `TODO`    | `TODO`    | `TODO` | `TODO` | `TODO`            |      |
| DPR      | `native/cap-2/cap-1.5`        | `TODO`   | `TODO`    | `TODO`    | `TODO` | `TODO` | `TODO`            |      |

## 7. 视觉与交互验收

| 检查项                           | 结果                | 截图/录屏编号 | 备注 |
| -------------------------------- | ------------------- | ------------- | ---- |
| 人物上半身清晰、下半身被玻璃覆盖 | `pass/fail/pending` | `TODO`        |      |
| 四游戏栏细长且仅选中项显示图标   | `pass/fail/pending` | `TODO`        |      |
| 六个入口大小有变化、不是等大方块 | `pass/fail/pending` | `TODO`        |      |
| 普通玻璃无边缘发光               | `pass/fail/pending` | `TODO`        |      |
| 选中游戏/导航/选项有明确暖色焦点 | `pass/fail/pending` | `TODO`        |      |
| 控制抽屉遮挡人物时仍可读、可操作 | `pass/fail/pending` | `TODO`        |      |
| Reduced Motion 生效              | `pass/fail/pending` | `TODO`        |      |
| 服务占位层可关闭且状态恢复       | `pass/fail/pending` | `TODO`        |      |

## 8. 结果导出与结论

- JSON 文件清单：`TODO`
- 截图/录屏清单：`TODO`
- 无法测量的指标及状态：`TODO`
- 异常复现步骤：`TODO`
- 同环境三次运行的中位数/离散情况：`TODO`
- 结论：`TODO`
- 是否需要复测：`TODO`

公开或提交前复核：

- [ ] JSON 没有姓名、账号、Cookie、Token、IP、精确位置或私有 URL。
- [ ] `userAgent` 与截图状态栏已人工检查，不含不希望公开的标识。
- [ ] 报告、截图与本模板使用匿名设备代号。
- [ ] 每份纳入正式比较的报告都有 UI 终态 `completed` 的截图/录屏编号，并确认本轮未取消。
- [ ] 取消报告、缺少完成证据的报告以及 `completedInForeground !== true` 的结果均未用于正式横向比较。
