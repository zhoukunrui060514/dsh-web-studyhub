# B1 课程内容接口

课程内容门面 `curriculum.v1` 提供同一课程的大纲、阅读和考点视图。此阶段仅实现后端；现有页面继续使用旧接口。

## 数据与兼容

- 原文、总纲、全书仍保存在 materials 的 sources；不新增内容副本或独立课程树。
- `lib/course-content-operations.js` 是旧 library 路由与新 prepare 共同使用的全书操作工厂。现有 `course.outline`、`course.book.*`、`book.*` 和 `source.pages` 的行为保留。
- curriculum 通过声明的只读快照访问 materials/system/courses/bank/study；prepare/apply 的唯一库写字段为 sources，materials 是明确事务参与者。
- 人工笔记、编辑过的生成文本、版本历史及未归位文本沿用原全书机制。

## 课程和版本

请求显式携带 `scope: {kind:'course', courseId}` 或 `{kind:'unassigned'}`。courseId 来自 `course.list` 的稳定 ID。不会从全局 focus 猜测课程；`all` 返回 `single-course-required`。即使 scope 含后代成员，本接口也只选择目标课程自身的一份总纲。

`outlineRevision` 为总纲 ID 和结构的 SHA-256 摘要；无总纲时为 null。它不因添加考点标注而改变。所有节点引用都使用该总纲原有 node.id，平铺结果带 parentId，保留树关系。

## 查询与同步

```js
await service.call('curriculum.get', { scope, view: 'structure' });
await service.call('curriculum.get', { scope, view: 'reading', nodeId: 'a' });
await service.call('curriculum.get', { scope, view: 'exam' });
await service.call('curriculum.prepare', { scope, expectedRevision: outlineRevision });
```

get 默认 structure，返回 status、course/courseId、outlineId/outlineRevision、nodes、total 和分页信息。nodeId 选择该节点及后代；parentId 仍指向原父节点。reading 使用 `write:false` 投影，返回每节点的 reading、bookRevision、needsPrepare 和未归位内容，不初始化全书。父节点的 reading 不携带子树正文。

prepare 才会初始化或同步全书。在全书写队列和库事务内检查 expectedRevision，使用原有历史保存逻辑；结果中的 book 对应本次同步的总纲版本。没有总纲时返回 empty，不生成内容。

查询 limit 默认 50、最高 200；cursor 绑定课程、视图、节点范围及数据版本。结构变化、阅读投影正文/实时题目变化、考点依据或确认变化都会使对应旧 cursor 返回 `curriculum-cursor-stale`。offset 可用于明确的位置读取。exam 节点附带的考点总量同样限制在当前 limit，`examPointsTruncated` 指示截断；完整考点按单个清单调用 preview 分页。

## 旧考点归入

```js
const preview = await service.call('curriculum.examPoints.preview', { scope, listId });
await service.call('curriculum.examPoints.apply', {
  scope, listId,
  expectedRevision: preview.outlineRevision,
  listRevision: preview.listRevision,
  requestId: 'confirmation-1',
  mappings: [{ pointId: 'p1', nodeId: 'a' }, { pointId: 'p2', nodeId: null }],
});
```

preview 对清单每条原考点保留 ID、证据等字段，增加 nodeId、status、candidates、mappingBasis、evidenceCurrent、confirmationStale。完整 totals 的 mapped/ambiguous/unplaced 总数等于原清单条数；分页和节点筛选不改变 totals 的对账范围。

自动归入使用现有 documentIndex/leafSegments 的锚点片段：证据原文、偏移和 quote 必须一致，全部证据只落入一个知识点。跨多个节点为 ambiguous；缺证据、旧证据、无匹配为 unplaced。标题相同不会自动确认。清单 input fingerprint 过期时不自动确认。

apply 只接受清单内的 pointId 和目标总纲的叶节点，null 表示明确暂不归入。只修改目标总纲 source 上的 curriculumExamPoints 元数据，原清单和题库保持原样。每个 listId 只保存一份当前标注；人工归属不等于证据审核通过。

事务内重新核对总纲版本、清单及其当前原文依据的摘要；同一 requestId 和相同确认内容不重复添加标注，请求内容不同返回 `curriculum-request-conflict`。新的原文或清单版本使旧人工确认显示 confirmationStale，需重新确认；不会把旧确认自动套到重建后的总纲。旧总纲上的标注仍保留。

## 错误

| code | 含义 |
| --- | --- |
| single-course-required | 聚合范围不适用于单课程内容 |
| curriculum-stale | 同步或确认时总纲已变化，或缺少 expectedRevision |
| curriculum-list-stale | 清单或其原文依据已变化 |
| curriculum-list-unavailable | 清单不存在、归档或不属于目标课程 |
| curriculum-node-unavailable | 节点不存在，或确认目标不是叶节点 |
| curriculum-outline-unavailable | 没有可保存考点标注的总纲 |
| curriculum-request-conflict | 幂等键对应的确认内容不同 |
| invalid-curriculum-mapping | 未知/重复考点或不合法请求 |
| curriculum-cursor-stale | 分页范围或依据已变化，需要重新查询 |

这些接口无需模型服务。B2 的固定四步学习会话以及 B3–B7 仍为后续工作。
