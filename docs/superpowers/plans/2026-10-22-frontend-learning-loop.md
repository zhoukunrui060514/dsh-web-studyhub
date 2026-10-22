# 五空间前端接入实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将现有五空间接到 B0–B7 后端，形成可操作、可恢复的学习闭环。
**Architecture:** 复用 S1 外壳、全局课程、设计变量和组件。前端只呈现后端决策与原所有者动作，不重新计算掌握度、不新增学习事实。固定会话在外壳内的独立运行面板中打开；练习仍使用原 Review。
**Tech Stack:** React、既有 CSS tokens、node:test、Playwright、实际 preview host。
**Spec:** `../specs/2026-10-20-studyhub-ia-ui-restructure.md` §2–3 与 `../specs/2026-10-21-backend-learning-loop-design.md`。用户恢复前端开发并要求匹配当前后端，沿用已批准布局和闭环，不再探索新视觉方向。

## Global Constraints

- 当前 `redesign/five-spaces` worktree，保留已有 S1 修改与四项 staged 删除。仅隔离库 / 私有 DSH_HOME，原 PDF 只读。
- 概念网络仍在实验开关后。旧数据不删；兼容阅读、编辑等既有功能保留在明确的次级入口。
- 每屏一个主动作，优先宽松排版、可读中文。异步刷新保留同范围内容；换库、换课程丢弃旧响应；失败保留文字。
- 动效仅用于面板进入、步骤切换、加载提示，尊重 reduced-motion，不重复挂载造成闪烁。

## Review Focus

跨课程晚响应不覆盖新页；会话保存失败不丢输入；不完整练习不伪完成；分页游标失效可刷新；旧对象与缺失原文仍可查看状态。

## Task 1 — 统一前端接口与四步会话

Files: `ui/learning/model.js`, `use-query.js`, `LearningProvider.jsx`, `SessionPanel.jsx`, `loop.css`, `ui/App.jsx`; tests `tests/frontend-learning-loop.test.mjs`。

- [x] 先测全局课程→显式 scope、动作路由和幂等重试的错误保留，再实现适配层。
- [x] 会话固定 explain/retell/practice/summary；保存与推进独立，版本由后端返回；跳过需原因；暂停可恢复；实际练习调用 `learning.session.practice.start` 并进入原 Review。
- [x] 从原文入口查看证据；刷新后从 today/records 继续会话；失败显示错误且保留输入，不自动跳步。

## Task 2 — 今天与知识

Files: `TodayPage.jsx`, `CurriculumPage.jsx`, `ui/app/page-views.jsx`。

- [x] 今天展示 snapshot.learningToday，一个主动作、最多三条次要动作，按 operation 调用现有 API。
- [x] 大纲 structure/reading/exam 使用 curriculum.get；全课程时要求选择单课；分页、空状态、准备阅读显式执行；知识点启动固定会话。
- [x] 保留现有大纲生成和全书编辑入口，不自动初始化阅读或调用模型。

## Task 3 — 记录、待巩固、活动与资料处理

Files: `RecordsPage.jsx`, `ReinforcementPage.jsx`, `ActivityPage.jsx`, `ProcessingPlan.jsx`, `ui/spaces.js`, `ui/pages.js`, `ui/app/page-views.jsx`。

- [x] 记录按 session/run/attempt/note 分页，详情可打开原会话、练习、笔记和原文；待巩固复用现有弱题接口。
- [x] 活动按原所有者控制任务、通知已读、草稿预览；原任务控制台留次级入口。
- [x] 资料处理计划展示导入与生成分离；旧对象完整导出提供用户主动操作，不能只隐藏数据。

## Task 4 — 隔离验收与交付

- [x] 主 Agent 跑接口单元与浏览器真实闭环；异步交互三次，含刷新读回、保存失败、切范围晚响应。
- [x] 1440/390px、200% CSS 放大、reduced-motion 截图，独立视觉与代码审查，修具体问题。
- [x] 记录未完成项和证据；提交前端及所依赖的 S1 源码，不夹带原 S1 暂存删除与其他脚本；按既有授权推送个人 GitHub 分支。功能提交 `6e02ba00`，远端同 SHA 已核对。

## 执行记录与裁决

- 依赖裁决：既有 S1 外壳仍未提交，而新页面依赖其全局课程、五空间和主题。GitHub 可运行交付必须一并包含这些源码及对应基础检查；不覆盖、撤销或丢弃原工作。不提交四项先前暂存的测试删除，也不把其他 QA 脚本迁移纳入本批次。
- 完成接口与页面接入后，独立代码审查发现保存/推进复合重试、旧 GET 回退版本、草稿保留、晚响应跨课程打开和 viewed 步骤问题，已修复。最终复核没有新的重要正确性阻塞。
- 独立视觉审查指出 200% 顶栏截字、筛选强调层级和今日预算信息。修正后主 Agent 查看稳定截图核对；活动页淡色来自截图抓到切换中间帧，等待有限动画结束后对比度正常。
- 录屏不可用：当前 Playwright 缺少 FFmpeg，未为本批次安装新依赖。截图与交互验收不能冒充动效录屏验收。
- 验收与后续边界见 `../../validation/2026-10-22-frontend-learning-loop.md`。
