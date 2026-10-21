# 学习记录与今日决策 API

学习事实保留在原所有者；记录和今日决定均为只读投影。

| 操作 | 输入 | 返回 |
| --- | --- | --- |
| learning.records.query | scope、type?（session/run/attempt/note）、limit?、cursor? | items/total/nextCursor，身份、课程、时间、结果与链接 |
| learning.records.get | type、id | 单个原始 record 与链接 |
| learning.reinforcement.query | scope、limit?、cursor? | 当前弱题；复用既有掌握度，不新增评分 |
| learning.today.get | scope?、now?（毫秒） | primary、secondary（最多 3）、reason、scope |
| coach.today | 同上 | 同一个今日决策 |

scope 是 {kind:'all'}、{kind:'unassigned'} 或 {kind:'course',courseId,includeDescendants?}。记录必须显式 scope；今日省略时兼容 focus。历史查询包含未激活课程；今日不主动推送未激活目标。

记录默认 50/最多 200。records-cursor-stale 表示范围、过滤或投影内容已变化，应从第一页重新读取。未知记录 record-unavailable。course=null/courses=[] 代表历史归属未知；不会被当成未分类。

links 提供 runId、sessionId、知识 target、题目和原文材料引用。材料 status 为 current/stale/unavailable/unversioned；unversioned 表示旧记录没有保存可比对 revision，不能据此确认原文当前有效。get 保留原记录供历史查看，不自动迁移、不生成内容。

snapshot.learningToday 和 daily.plan.get.learningToday 与 learning.today.get 共享实现。daily.plan 原有预算/任务仍由宿主所有。每个建议给出 action.operation/args，可沿现有 API 执行；查询本身不会开始练习或调用模型。
