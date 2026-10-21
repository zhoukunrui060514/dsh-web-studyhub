# B2 四步学习会话设计

依据已批准的五空间后端闭环。用户授权连续推进阶段，普通实现细节不再等待审批；前端保持暂停。

会话独占 learningSessions 扩展集合，每条 schemaVersion:1。固定步骤 explain/retell/practice/summary，状态 active/paused/completed，version 乐观并发。启动要求单课程 scope、明确 outline 节点或 deck/topic 目标及 requestId，记录目标版本、原文摘要和入口 today/knowledge/reinforcement；不跟随全局 focus 漂移。

讲解默认复用该节点现有全书投影，允许通过 record 保存补充讲解、学习者复述和总结；不在本阶段新增模型生成器。每步保存内容并显式 advance。步骤完成是流程事实，不等于掌握；skip 保存原因和 skipped 状态，最终 outcome 区分 complete/with-skips。get 可以回看任一步且不清除记录。暂停恢复不触发生成或练习。

practice.start 在同一库事务中调用 study 的 review.start 并保存 runId。review.start 增加可选 learningSessionId 以隔离会话练习的 key，旧调用语义不变；现有作答、评分、attempt 和排程继续权威。重复启动返回同一 run；未答完不得正常推进，主动跳过保留原 run 与真实答案。无题返回明确 empty，不写伪 run，可显式跳过。

同一请求键在会话内按操作、参数摘要重放；启动键在库内唯一，相同键不同目标报冲突。更新重放先于 version 校验，支持网络重试。所有新写操作必须携带 version；目标/依据变化在 get 中提示，新增练习前核对；已完成的真实作答不回滚。原文引用只保存标识和摘要，不复制原文作为新资料。

旧学习流继续由原接口读取；新增 legacy.export 提供 JSON/Markdown，只读保留完整模板、记录和历史，复杂流程不自动截断。线性四步的迁移入口在后续退役阶段与显式继续动作一起收拢，本阶段先保证旧数据可读可导出。

新增集合纳入既有 Store 注册与备份机制。课程改名/合并事务同步会话的稳定 courseId 和显示名称，保持运行中目标身份。模块读取 materials/system/courses/bank/study/workflow-data；写 learningSessions，通过声明的 study 参与者写 runs，课程事务额外声明本集合。

验收：启动/推进幂等、版本冲突、暂停恢复、内容回看、无题跳过、同事务 run 关联、两会话互不关闭、真实评分更新既有事实、重开与两库隔离、旧流程完整导出，独立审查及相关回归。B2 通过后进入 B3，不再等待用户确认。
