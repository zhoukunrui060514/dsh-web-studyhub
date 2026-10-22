# 四项代码审查问题修复验收

日期：2026-10-23（Asia/Shanghai）。工作区：studyhub-redesign；分支：redesign/five-spaces；起点：2406596ce90ad74c9cef1bc9b9019e809dcef1bf。

用户在全库代码审查后明确要求修复。实施范围为四项确认问题及同源的记录详情刷新问题，原有其他修改、四项已暂存测试删除及用户资料均保留。

## 修复行为

1. **关闭后的未完成练习可以重新作答。** 再次启动会创建新完整轮次，旧 run、答案与 attempts 保留；同一请求重放只创建一轮，已经完成的旧轮次继续复用。新轮次仍先检查当前学习目标和资料版本。这里提供的是重新开始，不是恢复旧队列的中途位置。
2. **题目 citations 纳入学习依据。** 只有 citations、没有 sourceIds 的题目也会记录原文及版本；原文修改、归档后分别显示 stale、unavailable，不能绕过新练习的版本校验。
3. **记录和待巩固随数据变化更新。** 查询订阅 data.revision；记录列表和已经展开的记录详情会更新，沿用 useQuery 在同范围刷新时保留已有内容的行为。暂停后关闭会话也已验收，不额外添加重复刷新机制。
4. **活动中心移除录音重启操作。** 活动中心与高级任务面板共用音频动作策略。六类音频任务只保留 cancel 控制和历史结果；PDF 等任务重试仍可用。后端兼容接口继续保留。

## 验证证据

| 检查 | 结果 |
| --- | --- |
| 后端新增失败回归 | 修改前 3/3 失败，原因分别为复用已关闭 run、归档恢复后复用已关闭 run、citations 学习依据为空 |
| 前端新增失败回归 | 修改前 3/3 失败，涵盖记录、待巩固和活动中心音频重试；记录详情另有失败后通过的证据 |
| 最终相关验收 | **46/46 通过**，包括 3 项真实浏览器测试、会话/课程/学习闭环、任务控制、录音退役与活动投影 |
| 全项目 ESLint | **退出码 0**，范围 lib/scripts/tests/ui/packages/eslint.config.js |
| 正式构建 | **退出码 0**，生成 DSH 客户端与独立预览 |
| 独立源码审查 | **通过**，未发现 Critical 或 Important 级别可执行问题 |
| 独立后端检查 | **12/12 通过**；另验 stale-source 拒绝、失败回滚、旧请求返回原 run、六类音频与 PDF 动作策略 |
| 独立浏览器复跑 | Edge 在启动阶段因 crashpad TransactNamedPipe 0x6D 失败，未进入产品断言；浏览器通过证据来自主 Agent |
| 广泛快速层 | **7607 项：7527 通过、78 失败、1 取消、1 跳过**，退出码 1；未通过 |

独立审查最初汇总时遇到模型额度中断，恢复后已补齐最终结论。没有把独立浏览器环境失败计为产品通过。

最终定向命令：

```powershell
$env:TEMP=Join-Path (Get-Location) '.tmp'
$env:TMP=$env:TEMP
$env:PLAYWRIGHT_CHROMIUM='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
& D:\DSH\node\node.exe scripts/test.mjs tests/learning-review-fixes-browser.test.mjs tests/task-control-ui.test.mjs tests/retired-audio-ui.test.mjs tests/learning-session.runtime.test.mjs tests/frontend-learning-loop.test.mjs tests/activity-legacy.runtime.test.mjs tests/curriculum.runtime.test.mjs tests/backend-learning-loop.journey.test.mjs
& D:\DSH\node\node.exe node_modules/eslint/bin/eslint.js lib scripts tests ui packages eslint.config.js
& D:\DSH\node\node.exe scripts/build.mjs
```

## 广泛回归仍未通过

快速层按 `scripts/test.mjs --fast --test-concurrency=6` 与修复前同样方式运行。修复前为 7604 项：7525 通过、77 失败、1 取消、1 跳过。本次多了 3 项后端回归；原有失败没有减少，另一次性出现 `workflow-guide.test.mjs` 的 `background skeleton failures are recorded and can be retried; it is off unless asked` 失败，表现为 settle 读取不到 session。该文件随后单独重跑 **8/8 通过**，没有据此改动工作流实现，也没有把广泛回归改写成通过。

失败明细按名称列在 [回归失败附录](2026-10-23-review-fixes-failures.md)。已有旧页面/录音退役断言、未适配 AppContext 的渲染夹具、样式与组件规范、翻译、注册清单、快照大小等问题；本轮没有通过放宽测试或提高基线来消除失败。快速层不是全部浏览器、ffmpeg 和 CLI 验收全集。

原始日志在项目的 `output/qa/review-fixes/`：`backend-red.log`、`frontend-red.log`、`detail-red.log`、`final-acceptance.log`、`fast-tests.log`、`regression-diff.json`、`workflow-rerun.log`、`final-lint.log`、`build-final.log`。

## 预览与数据边界

原预览进程已停止，现重新启动 http://127.0.0.1:3200/，继续使用原库 `output/qa/frontend-loop/run-1792633621677/library` 和私有 `preview-home`。HTTP 200，服务中的 app.js 与最终 dist/app.js 哈希一致；库内 43 份资料、2 个题组，revision 73，无活动任务；启动前后现有 JSON 元数据文件哈希变化数为 0。

预览沿用用户指定的本地兼容接口和 gemini-3.8-flash-high 配置；本轮修复不需要真实模型调用，没有把 modelReady 状态当作真实生成验收。凭据仅经环境变量提供，未写入文档或提交。

测试全部使用独立库和私有 DSH home；未安装到真实 DSH，也未对真实学习库执行写入。交付仅提交本轮源代码、测试及文档到个人 GitHub 仓库的 redesign/five-spaces 分支。
