# Reading, Practice and Image Explanations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地阅读、真实练习、结果三位置学习会话，以及本地 gpt-image 图像讲解。

**Architecture:** session 只保存引用与位置。curriculum 唯一解析阅读，learning-records 唯一投影结果，study 唯一选题与评分。materials 保存不可变图片与块引用，generation 在服务端交接文字/图片，jobs 保存付费请求回执。

**Tech Stack:** 现有 Node ESM、React、StudyRuntime、Store、统一 Jobs；Node D:/DSH/node/node.exe。

**Spec:** docs/superpowers/specs/2026-10-23-reading-practice-learning-design.md（2026-10-24 修订）。

## Global Constraints

- 当前会话 inline 实现，按用户既有授权连续推进，重大产品选择才提问。
- 保留其他改动和四个已暂存测试删除，提交使用精确路径 `git commit --only`。
- 私有测试库/DSH_HOME；真实 DSH、真实学习库与已有用户预览资料不可写入验收数据。
- 每批至多 5 题，phase=reading/practice/results，status=active/paused/completed。
- 单图 2 MiB；普通正文限制 400,000 字保持；单分包编码后至多 8 MiB。
- 文本 gemini-3.8-flash-high；图像 gpt-image-2；本地后端运行时配置，认证不入库。
- 原生 HTTP 图像请求预算 300000 ms，不自动重试已发送/未知请求。
- 独立审查最终变更；定向测试、浏览器、真实模型与隔离 DSH 验收；提交并推送现有个人分支。

## Review Focus

- 旧会话第一次失败写入不能留下半迁移（任务 1 事务回滚测试）。
- next 与 finish 并发不能关闭别人的 run 或建立两批（任务 1 版本/请求重放测试）。
- 多图及历史/建议资源必须完整可恢复（任务 4、5 的编辑与分包测试）。
- 上游结果未知或正文保存响应丢失不得再次付费/追加块（任务 6、7 重启与提交收据测试）。
- 跨库/跨课程晚响应不得显示或写入新目标（任务 3、7、8 浏览器与事务测试）。

## File Structure

- session 核心：lib/learning-session.js、lib/learning-session-v2.js、lib/contexts/learning-session/{contracts,operations}.js。
- study 批次：lib/contexts/study/operations.js；结果：lib/learning-session-results.js、lib/contexts/learning-records/{contracts,operations}.js。
- 阅读：lib/curriculum-reading.js、lib/curriculum.js、lib/learning-session-target.js；UI ui/learning/{SessionPanel,LearningReader,SessionResults}.jsx。
- 资源：lib/book-assets.js、lib/course-book-ai-text.js、lib/course-book-ai.js、ui/StudyImage.jsx、ui/study-media.js。
- 备份：lib/book-assets-backup.js、lib/portable-parts.js、lib/contexts/library/operations.js 与对应 contracts、备份 UI。
- 图像：lib/jobs/image-receipts.js、lib/image-model.js、lib/contexts/generation/book-ai/illustrate.js、jobs/course-book-image.js；host/runtime 与 preview 的注入。
- 交接：book-ai 的 plan/read/start/jobs、materials 的受控块写入；现有全书生成/解释提示。
- 验收：tests/learning-*.test.mjs、tests/book-assets*.test.mjs、tests/course-book-image*.test.mjs、隔离 browser/DSH 脚本。

### Task 1: v2 会话与真实练习批次

**Interfaces:** sessionStart 新建 v2；sessionGet 只读兼容 v1。新增 sessionMove/Finish 与 sessionPracticeV2(state,args,mutate,action)。operation 名称 learning.session.move/finish/practice.next/practice.close；next/close 必带 expectedRunId。study review.start 仅 learningSessionId 场景按现有排序排除已答/不可评分题并限 5；无候选由 session 返回 exhausted。

- [ ] RED：tests/learning-session-v2.test.mjs 覆盖无需文字推进、v1 保留/升级、start 复用、practice.start 复用已完成批、next/close/finish、不同请求并发、无题、过期资料与历史。
- [ ] Run: `D:/DSH/node/node.exe --test tests/learning-session-v2.test.mjs`。Expected: 新接口不存在或 v1 行为断言失败。
- [ ] 实现上述接口、严格 DTO、study grants/writesFor；旧 record/advance 对 v2 返回 learning-schema-incompatible；升级只发生于成功写事务。
- [ ] GREEN：同命令全通过，并运行既有 learning-session 定向测试；已有 v1 专用测试显式构造 v1，而不是要求新 start 继续产生 v1。
- [ ] Commit: feat: introduce reading practice learning sessions。

### Task 2: 唯一结果投影

**Interfaces:** sessionResults(state,{id}) -> {currentBatch,sessionSummary}；operation learning.records.sessionResults。固定题目身份 deckId/cardId，attempt 经 runId 关联；首答、订正、待评分、去重覆盖与 due_at 按 spec 5.2。

- [ ] RED：tests/learning-session-results.test.mjs 断言 A 首答错+订正+跨批答对仍覆盖 1；B 未答关闭后重答不重复未完成；无排程不造日期。
- [ ] Run: `D:/DSH/node/node.exe --test tests/learning-session-results.test.mjs`。Expected: 缺投影。
- [ ] 实现纯投影与 records query/get 的 phase 兼容；today 归并相同目标的未完成入口。
- [ ] GREEN：上述命令及 learning-records/today 相关测试通过；Commit: feat: project real learning session results。

### Task 3: 唯一阅读解析与三位置 UI

**Interfaces:** resolveLearningReading(state,{scope,target}) -> {nodes,references,needsPrepare,status}，复用 curriculum reading 数据；LearningReader 接收引用不复制持久正文；SessionPanel 消费 phase/displayPhase，review run 继续使用现有 session.enterRun。

- [ ] RED：tests/learning-reading.test.mjs 验证读取不写库、不调用模型、topic 明确映射/无映射、旧完成历史；browser 测试无复述/跳过原因/学习依据，直接做题及返回结果。
- [ ] Run: `D:/DSH/node/node.exe --test tests/learning-reading.test.mjs`。Expected: 缺解析器。
- [ ] 实现共享解析器与阅读 UI；现有局部解释/BookAsk 入口按相同节点消费；保留阅读位置与晚响应身份检查。
- [ ] GREEN：纯逻辑与浏览器测试、build；Commit: feat: connect reading practice and results UI。

### Task 4: 不可变图片资源与块元数据

**Interfaces:** book-assets put/read/export/verify 使用库根和 sha256 ID，不接受任意路径；materials.book.asset.get 返回已授权资源 base64/MIME。生成元数据与 AI block 序列化一起进历史，资源索引只存固有信息。StudyImage 按引用加载受控 Blob URL。

- [ ] RED：tests/book-assets.test.mjs 验证真实 PNG/WebP 识别、2 MiB/损坏拒绝、同内容去重、跨库隔离、多个引用历史回退、正文编辑长度不包含图片字节。
- [ ] Run: `D:/DSH/node/node.exe --test tests/book-assets.test.mjs`。Expected: 缺资源模块。
- [ ] 实现文件先落盘再事务引用，删除不立即清文件；原嵌入图仍可读；更新工具/contract 与导出相对引用。
- [ ] GREEN：上述测试及现有图片/AI block 测试；Commit: feat: store explanation images as library assets。

### Task 5: 完整资源备份与分包恢复

**Interfaces:** portableBookAssets={format:'study-book-assets/v1',files}，JSON small mode；prepare/upload/commit 只在全包验证后调用现有 restore；分包带 SHA256/类型/长度，编码后 <=8 MiB，主清单不含大对象。

- [ ] RED：tests/book-assets-backup.test.mjs 和 tests/portable-parts.test.mjs 验证当前/历史/建议资源去重携带、超过 64 MiB 分包、缺包/错哈希不改库、幂等上传与恢复。
- [ ] Run: `D:/DSH/node/node.exe --test tests/book-assets-backup.test.mjs tests/portable-parts.test.mjs`。Expected: 缺实现。
- [ ] 扩展现有 export/restore 与备份 UI，不新建并行备份服务；Markdown folder images/；single export 限额可见。
- [ ] GREEN：上述与既有 restore/history 测试；Commit: feat: include image resources in portable backups。

### Task 6: 付费图像适配器与持久回执

**Interfaces:** imageModel.generate({prompt,model,size,quality},signal) -> {bytes,mime,route,usage}；jobs image receipts 原子准入与发送意图，同请求冲突、活动 fingerprint 合并、新 regenerate 绕过终态复用。未知发送结果重启后不重发。

- [ ] RED：tests/image-model.test.mjs、tests/image-receipts.test.mjs 验证实际 PNG 不按 WebP 误判、signal/300000ms、无自动上游重试、重启/别名回执/payload 冲突/新生成。
- [ ] Run: `D:/DSH/node/node.exe --test tests/image-model.test.mjs tests/image-receipts.test.mjs`。Expected: 缺模块。
- [ ] 扩展现有 jobs 持久设施与 host/runtime/preview 注入；认证仅服务端，配置为 STUDY_IMAGE_MODEL 及可选图片地址/认证覆盖，默认继承文本后端；未配置时不可用。
- [ ] GREEN：上述与 jobs persistence 相关测试；Commit: feat: add durable image generation capability。

### Task 7: 图像 Job 与文字交接

**Interfaces:** generation.courseBook.illustrate，输入参见 spec；sourceRevision/targetAnchor/expectedBlockRevision 在同事务验证；explain 可选 figurePlan，服务端派生子请求。图片独立取消/重试，已保存结果只重试提交正文。

- [ ] RED：tests/course-book-image.test.mjs 验证手动/自动、文字成功图片失败、页面离开不丢任务、父块删除、替换丢失冲突、无关编辑不误过期、上游/写入成功响应丢失不重复副作用。
- [ ] Run: `D:/DSH/node/node.exe --test tests/course-book-image.test.mjs`。Expected: 缺 operation。
- [ ] 注册 Job 和 API，复用 gateway step/observe 与 materials 写入队列；加强文字 explain 相同版本校验；完善教材式讲解提示，已有内容不重写。
- [ ] GREEN：上述及现有 book-ai 测试；Commit: feat: generate source grounded explanation figures。

### Task 8: 阅读配图入口与联动

**Interfaces:** BookAsk/学习阅读共用“画图解释”和本次配图开关；块显示来源、局部状态与放大，模型失败仍能阅读/做题；继续/记录消费同投影。

- [ ] RED：tests/learning-reading-browser.test.mjs 与 tests/course-book-image-browser.test.mjs 覆盖已选节点动作、两种入口、不重复生成、切换/滚动稳定、无模型与重试。
- [ ] Run: `D:/DSH/node/node.exe --test tests/learning-reading-browser.test.mjs tests/course-book-image-browser.test.mjs`。Expected: 缺入口。
- [ ] 接入三位置页面、主会话能力条件、刷新恢复与结果导航；图像入口仅配置和持久回执就绪后开放。
- [ ] GREEN：上述与 build/changed ESLint；Commit: feat: expose image assisted learning controls。

### Task 9: 真实资料、隔离 DSH 和整体审查

**Interfaces:** scripts/qa/reading-images.mjs 使用用户资料独立副本和私有 DSH_HOME；输出 docs/validation/2026-10-24-reading-practice-images.md。

- [ ] 检查指定后端和原资料，只向 output/qa 新隔离库写验收数据；实际文字/生图一次完整链路，编辑/刷新/备份/恢复以及旧数据回归。
- [ ] Run: 定向 node test 集合、build、changed ESLint、真实 Edge、隔离 DSH。Expected: 所有本轮要求通过；全量已知基线失败单独归因，不能声称全绿。
- [ ] 按 requesting-code-review 对本计划完整提交区间独立审查；重要问题 RED→GREEN 修复并验证。
- [ ] 按用户已授权身份提交精确路径，推送 github/redesign/five-spaces 并核对远端 SHA；保留可验收预览与文档。

## Execution Ledger

- 2026-10-24: plan created from approved revision 4083543e; current checkout redesign/five-spaces reused, unrelated edits preserved. Inline method already selected by user; no redundant plan approval requested.
