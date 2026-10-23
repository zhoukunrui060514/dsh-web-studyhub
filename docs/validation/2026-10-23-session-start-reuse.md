# 连续点击重复学习会话修复

日期：2026-10-23。问题：同一知识点数秒内多次点击，成功请求后的新 requestId 会产生多个进行中的学习会话。

现在 learning.session.start 在原有原子 Store.update 中，按已解析课程 ID、规范化学习目标、资料 basisRevision 查找最近创建的 active/paused 会话；匹配则继续原会话，保留步骤、笔记和暂停状态。不同入口 origin 不再造成重复。已完成会话和资料版本变化允许新一轮。不同知识点仍能独立学习。

复用时记录新的开始请求回执，重试始终返回原会话；同一请求 ID 被其他动作使用时拒绝冲突，拒绝不会改动历史。已有重复记录保留，不执行自动合并、删除或资料库迁移。本次不添加强制重新开始按钮或额外时间窗机制。

验证：修复前四个不同 requestId 并发开始得到 4 个会话，新增断言失败；修复后只得到 1 个。独立审查发现复用分支缺少回执冲突检查，补充失败回归后修复，最终独立源码审查通过。

最终隔离回归 25/25 通过，包括 learning-session.runtime、frontend-learning-loop、backend-learning-loop.journey 和 learning-review-fixes-browser（3 项真实 Edge 浏览器测试）。修改文件 ESLint 和 git diff --check 通过。本轮未重跑全项目广泛回归，不改变上一份验收报告的全库红灯结论。

测试通过沙箱外授权执行，仅使用临时学习库和私有 home；沙箱内曾发生临时目录 EPERM 和 Edge crashpad 启动失败。没有修改测试来绕开产品断言。

验收服务沿用 http://127.0.0.1:3200/ 和原预览资料库 output/qa/frontend-loop/run-1792633621677/library，确认无 queued/running/cancelling 任务后重启以加载修复。未安装到真实 DSH，未清理用户导入资料。
