# B2 四步学习会话

固定 explain → retell → practice → summary。会话进度属于 learning-session.v1 的 learningSessions 集合，schemaVersion:1；练习和评分仍属于 study，流程完成不宣称掌握。

## 接口

```js
let session = await service.call('learning.session.start', {
  scope: { kind: 'course', courseId },
  target: { kind: 'topic', deckId, topic }, // 或 {kind:'outline', nodeId, outlineRevision}
  origin: 'knowledge', // today / knowledge / reinforcement
  requestId: 'start-1',
});
session = await service.call('learning.session.record', {
  id: session.id, version: session.version, requestId: 'explain-1',
  step: 'explain', content: '已保存的讲解',
});
session = await service.call('learning.session.advance', {
  id: session.id, version: session.version, requestId: 'advance-1',
});
```

- start 固定单课程和目标，记录资料 ID/摘要；不会跟随 focus。题库主题仍在启动练习时读取当前有效题目，run 固定实际题目快照。
- get({id,step?}) 只读，basisStatus 为 current/stale/unavailable；回看不清空内容，不改变当前步骤。
- record 保存当前或已经过步骤的讲解、复述和总结，不自动推进。不会把全书占位链接当作现成讲解。
- pause({id,version,requestId,paused?}) 默认暂停，paused:false 恢复；不触发模型或练习。
- advance 正常推进要求有内容；practice 要求真实 run 中剩余题目全部已回答。skip:true 必须附 reason，保存 skipped。
- practice.start({id,version,requestId}) 在一个事务中调用 review.start 并保存 runId。会话间 key 隔离，不互相关闭。同一请求无题时也保存 empty 回执，不会在重试时突然创建练习；新尝试使用新的 requestId 和最新 version。
- 所有写操作支持 requestId 重放，重放先于 version 核对；相同键不同参数返回 learning-request-conflict。普通并发修改返回 learning-version-conflict。
- 完成状态为 completed；outcome 是 complete 或 with-skips。现有 review.skip 的不能评分题目保存 skippedQuestions；该步骤为 completed-with-skips，最终为 with-skips。
- legacy.export({id,format:'json'|'markdown'}) 完整导出旧流程的模板副本、记录和历史。此阶段不截断复杂旧流程或静默迁移。

## 数据与限制

资料/总纲变化后，旧内容保留但显示依据过期；不按旧依据启动新的练习。已保存的作答、attempt 和排程不回滚。课程改名/合并同步会话课程 ID 与名称。

学习会话没有独立题库、掌握度或模型生成器；讲解默认复用已有全书，缺少时可以保存内容或显式跳过。总结生成与统一记录在后续 B3 收拢。新集合纳入既有备份，不涉及宿主全局笔记本或待办。

常用错误：learning-session-unavailable、learning-target-unavailable、learning-target-stale、learning-version-conflict、learning-request-conflict、learning-session-paused、learning-practice-incomplete、learning-content-required。保留旧 workflow/review 接口。
