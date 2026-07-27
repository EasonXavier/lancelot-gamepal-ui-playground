本文件只属于 lancelot-gamepal-ui-playground，不代表、不替代也不修改 lancelot-gamepal 主项目的规划和进度。

# Task Plan: 朗世乐移动 UI 性能试验场

## Goal

从零建立、验证并公开部署独立的 `EasonXavier/lancelot-gamepal-ui-playground`，用于真实手机微信 WebView 中比较动态 UI、毛玻璃实现、触摸交互与性能指标。

## Next Step

从 Task 6 的 RED 阶段继续：先为控制面板、HUD 和动效/生命周期写失败测试。Task 5 的首页、共享单一 DOM Glass Surface、服务入口和底栏已完成本地检查点；全量门禁通过 typecheck、lint、format、46 项测试和生产构建。

## Current Phase

Phase 4

## Phases

### Phase 1: 仓库隔离、需求与视觉规格

- [x] 创建独立公开 GitHub 仓库
- [x] 确认工作目录、`main` 和唯一 `origin`
- [x] 锁定品牌、布局、人物素材、字体和视觉概念
- [x] 记录微信 WebView、隐私和主项目隔离边界
- **Status:** complete

### Phase 2: 实施计划与工程基础

- [x] 建立详细实施计划和目录结构
- [x] 配置 Vite、React、TypeScript、ESLint、Prettier、Vitest、RTL 和 Pages 基础
- [x] 导入、去除元数据并记录用户授权人物素材与 Demo 字体
- [x] 建立设计令牌、基础样式和构建版本追踪
- [x] 修复当前 lint 错误并完成现有代码的 typecheck、lint 与测试门禁
- **Status:** complete

### Phase 3: 性能核心（TDD）

- [x] 先写失败测试，再实现帧采样、刷新间隔、P95 与 Estimated Dropped Frames
- [x] 实现 Web Vitals、Long Task/LoAF、资源、环境和可见性采集
- [x] 实现固定容量缓冲、暂停/恢复与隐私白名单报告序列化
- [x] 实现 30 秒 Benchmark 状态机、后台样本排除和恢复语义
- **Status:** complete

### Phase 4: 移动 UI、动态与实验控制

- [ ] 将报告序列化接入 Copy JSON、Download JSON 和 Copy Summary
- [ ] 复刻已确认的主界面与展开控制面板
- [ ] 实现四种互斥 Glass Mode、五档 Motion、粒子和 DPR 策略
- [ ] 实现触摸光、卡片倾斜/按压、背景视差、页面转场和 Reduced Motion
- [ ] 实现 HUD、六个 Experimental/Mock 入口和五项底栏导航
- **Status:** in_progress

### Phase 5: 验证、文档与公开安全

- [x] 通过 typecheck、lint、test、build 和 preview
- [ ] 验证五个指定视口、横屏、Safe Area、旋转、微信 UA 和无横向溢出
- [ ] 对照视觉概念完成截图、fidelity ledger 和性能功能检查
- [ ] 完成 README、指标说明、设备模板、SECURITY 与素材来源
- [x] 执行敏感信息、绝对路径、未授权素材与 staged diff 检查
- **Status:** in_progress

### Phase 6: 提交、部署与交付证据

- [x] 提交并推送 `main`
- [x] 启用 GitHub Actions Pages 发布源并运行 CI/部署
- [ ] 验证线上 HTML、CSS、JS、图片、路由、HUD 与报告导出
- [ ] 提供完整的仓库、构建、测试、截图、部署和限制证据
- **Status:** in_progress

## Key Questions

1. 四种 Blur 实现是否在完全相同的内容、布局、图片和动画树下互斥切换？必须是。
2. 浏览器无法测量的系统级指标是否始终显示不可用而非伪造为 0？必须是。
3. 人物素材和 Demo 字体是否可独立替换并记录来源？必须是。

## Decisions Made

| Decision                                    | Rationale                                                       |
| ------------------------------------------- | --------------------------------------------------------------- |
| 品牌固定为“朗世乐”                          | 用户明确覆盖最初的占位品牌名                                    |
| 使用已确认的两张概念图作为实现规格          | 主界面与控制面板均已由用户确认进入工程实现                      |
| 人物上半身保持清晰，下半身允许被玻璃覆盖    | 既符合构图，也形成真实复杂 Blur 压力场景                        |
| 基础玻璃不发光，仅选中选项卡发光            | 保持极简并建立明确焦点                                          |
| 六个入口使用不同宽高的非正方形网格          | 避免僵硬，同时保持移动触摸可用性                                |
| 四种 Glass Mode 使用同一 React 结构互斥切换 | 保证性能对比公平且不隐藏渲染四套页面                            |
| 使用 `LSVIS TD.woff2` 作为 Demo 字体        | 用户明确要求用加载更快的 WOFF2 替换 OTF；仍通过字体令牌集中管理 |
| 不创建正式 Release 或版本标签               | 原始任务明确禁止本次创建标签和正式发布                          |

## Errors Encountered

| Error                                         | Attempt | Resolution                                                                                            |
| --------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| 空目录执行 Git 检查返回“not a git repository” | 1       | 先创建远程，再在正确空目录执行 `git init -b main`                                                     |
| 沙箱 Git 报 `dubious ownership`               | 1       | 不改系统配置；所有沙箱 Git 命令显式使用 `-c safe.directory=C:/Project/lancelot-gamepal-ui-playground` |
| 帧基准首次 GREEN 被长帧拉高为 12ms            | 1       | 使用低四分位建立稳定窗口后再取中位数；10 个帧测试通过                                                 |
| ESLint 报测试 fake cancel 的 `_id` 未使用     | 1       | 提交前将 fake cancel 改为无参数实现；lint 通过且未降低规则                                            |

## Notes

- 不读取、不修改、不添加 `EasonXavier/lancelot-gamepal` 为远程。
- 规划、素材、报告、CI 与 Pages 只属于本仓库。
- 高频采样不得每帧更新 React state；HUD 最多每秒更新四次。
- 每次重大决策前重读本文件；每个阶段结束后更新状态与进度。
- **可部署检查点（2026-07-27）：** 基础提交为 `9f26f73`，Pages/入口提交为 `d20b849`，工作构建号为 `0.1.0+20260727.1309.d20b849`；现有 typecheck、lint、10 个测试与生产 build 通过。完整 UI 与性能实验仍未完成，不要把检查点页面描述为完整交付。
