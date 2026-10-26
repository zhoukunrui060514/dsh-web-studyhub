# 资料补题与信箱阅读 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans，沿用用户当前会话逐项实施与最终独立审查授权。

基线 9c3da1b4。规格：`docs/superpowers/specs/2026-10-26-material-topup-inbox-design.md`。执行方法和常规设计选择已由用户授权，无新增审批门槛。

### Task 1：文档覆盖补题

**Interfaces:** `generate.uncovered {documentIds:string[]}` -> `{started,skipped,failed}`；串行复用 generate。generate 的 documentId 分支允许无目标题组，草稿持有 coverageDocument 引用以计算全局已有题覆盖。已有 partOf 语义保持。

- [x] tests/material-topup.test.mjs：先验证入口缺失；覆盖零题、部分覆盖、已覆盖、任务占用、重复并发、混合错误与原题不变。
- [x] 扩展现有生成分支、同文档任务准入和覆盖投影；资料页按钮读取当前 filtered 文档、单次点击锁、状态与任务入口。
- [x] 运行新测试及既有 document-topup/coverage 相关回归，提交精确路径。

### Task 2：信箱独立讲解投影

**Interfaces:** `inbox.explanation {id}` 只读返回引用、题目上下文、完整讲解与 citations；讲解类 inbox.open 只标已读并返回同投影。通知可携带 followupId，兼容既有条目。

- [x] tests/inbox-explanation.test.mjs：新旧通知解析、长回答、题目修改/删除、query 不写、open 无 run/attempt/排程副作用。
- [x] 通知元数据、纯投影、读写 handler 与前端目的地分流。非讲解类维持原路由。
- [x] 新/旧 inbox 与 followup 测试通过，提交精确路径。

### Task 3：侧栏信箱与阅读页

**Interfaces:** shell page `inbox`；侧栏常驻未读角标；useInbox 维护当前库的阅读消息身份，跨库晚响应不可落入新库；独立阅读组件用只读 projection。

- [x] Edge 测试先失败：侧栏入口、长讲解阅读、返回列表、无刷题跳转、资料按钮一次派发与任务状态。
- [x] 实现页面与路由、移除顶栏原入口、补齐英文文案，复用既有组件样式。
- [x] build、changed ESLint、Edge 与定向回归通过。

### Task 4：审查与示例交付

- [x] 一个 fresh-context reviewer 审查本次差异；重要问题 RED→GREEN。
- [x] 升级私有示例 DSH 插件，保留体验库；实际 RPC/页面确认入口与副本绑定，不在用户体验库自动执行付费补题。
- [x] 更新验证文档、精确提交并推送已授权个人 GitHub 分支，校验远端 SHA。

Review Focus：跨文档覆盖不会重出已有题；无题组文档的后续轮次仍计算其他草稿/发布题；并发只入队一次；旧信箱回答准确绑定；打开讲解无学习副作用；切库晚响应隔离。
