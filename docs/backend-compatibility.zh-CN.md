# 后端动作兼容基线（B0）

日期：2026-10-21。来自当前工作区实际 runtime.describe 与 hasAction 核查。B0 没有删除或改名任何公开动作。

## 课程范围契约

`lib/course-scope.js` 提供 `resolveLearningScope(state, scope)` 与 `resolveLegacyLearningScope(state, value)`；都是纯函数，不注册新公开动作。

- 新 scope：all、unassigned、course（稳定 courseId，includeDescendants 默认 true）。
- 返回 kind、courseId、path、includeDescendants、courseIds、activeCourseIds。完整成员与有效成员分别提供，显式查看停用课程不会被删掉。
- 旧值 `*` 是全部，空字符串是未分类，null/undefined 使用 currentCourse 默认策略。保存的全部选择仍解析为全部。
- 旧别名解析到稳定 ID；隐式父路径的 courseId 为 null，path 保留真实路径，成员使用真实课程 ID。
- 输入形状错误为 invalid-scope，未知课程为 course-unavailable；不创建课程或修改 focus。
- focus.set 省略 course 保留全部选择；显式 null 仍恢复自动默认。

已有 `lib/learning-scope.js` 继续负责题目范围与活动过滤，本阶段保持不变；规范化课程范围尚未替换其调用链。

## 当前动作及后续去向

“后续转发”和“待导出后退役”均为计划，不代表已实施。表中 public 列只列 hasAction 当前确认存在的名称；state.read 是内部领域读取，不列为公共动作。

| 当前领域 | 操作 | 已确认 public 名称 | 去向 | 阶段 |
| --- | --- | --- | --- | --- |
| knowledge.v1 | `knowledge.ask` | `knowledge.ask`, `knowledge.knowledge.ask` | 保留 | 持续 |
| knowledge.v1 | `knowledge.thread.get` | `knowledge.thread.get`, `knowledge.knowledge.thread.get` | 保留 | 持续 |
| knowledge.v1 | `knowledge.build` | `knowledge.build`, `knowledge.knowledge.build` | 保留 | 持续 |
| knowledge.v1 | `knowledge.query` | `knowledge.query`, `knowledge.knowledge.query` | 保留 | 持续 |
| knowledge.v1 | `knowledge.node.get` | `knowledge.node.get`, `knowledge.knowledge.node.get` | 保留 | 持续 |
| knowledge.v1 | `knowledge.edge.get` | `knowledge.edge.get`, `knowledge.knowledge.edge.get` | 保留 | 持续 |
| knowledge.v1 | `knowledge.node.update` | `knowledge.node.update`, `knowledge.knowledge.node.update` | 保留 | 持续 |
| knowledge.v1 | `knowledge.edge.update` | `knowledge.edge.update`, `knowledge.knowledge.edge.update` | 保留 | 持续 |
| knowledge.v1 | `knowledge.merge.accept` | `knowledge.merge.accept`, `knowledge.knowledge.merge.accept` | 保留 | 持续 |
| knowledge.v1 | `knowledge.merge.reject` | `knowledge.merge.reject`, `knowledge.knowledge.merge.reject` | 保留 | 持续 |
| knowledge.v1 | `knowledge.materials` | `knowledge.materials`, `knowledge.knowledge.materials` | 保留 | 持续 |
| knowledge.v1 | `knowledge.settings.get` | `knowledge.settings.get`, `knowledge.knowledge.settings.get` | 保留 | 持续 |
| knowledge.v1 | `knowledge.settings.set` | `knowledge.settings.set`, `knowledge.knowledge.settings.set` | 保留 | 持续 |
| system.v1 | `update.check` | `update.check`, `system.update.check` | 保留 | 持续 |
| system.v1 | `update.preferences` | `update.preferences`, `system.update.preferences` | 保留 | 持续 |
| system.v1 | `experimental.get` | `experimental.get`, `system.experimental.get` | 保留 | 持续 |
| system.v1 | `experimental.set` | `experimental.set`, `system.experimental.set` | 保留 | 持续 |
| system.v1 | `jev.settings.get` | `jev.settings.get`, `system.jev.settings.get` | 待消费者迁移及导出后退役 | B6 |
| system.v1 | `jev.settings.set` | `jev.settings.set`, `system.jev.settings.set` | 待消费者迁移及导出后退役 | B6 |
| system.v1 | `jev.test` | `jev.test`, `system.jev.test` | 待消费者迁移及导出后退役 | B6 |
| system.v1 | `jev.outline.classify` | `jev.outline.classify`, `system.jev.outline.classify` | 待消费者迁移及导出后退役 | B6 |
| system.v1 | `jev.usage` | `jev.usage`, `system.jev.usage` | 待消费者迁移及导出后退役 | B6 |
| system.v1 | `usage.frequency.status` | `usage.frequency.status`, `system.usage.frequency.status` | 保留 | 持续 |
| system.v1 | `usage.frequency.set` | `usage.frequency.set`, `system.usage.frequency.set` | 保留 | 持续 |
| system.v1 | `usage.frequency.record` | `usage.frequency.record`, `system.usage.frequency.record` | 保留 | 持续 |
| system.v1 | `usage.frequency.report` | `usage.frequency.report`, `system.usage.frequency.report` | 保留 | 持续 |
| system.v1 | `usage.frequency.export` | `usage.frequency.export`, `system.usage.frequency.export` | 保留 | 持续 |
| system.v1 | `usage.frequency.clear` | `usage.frequency.clear`, `system.usage.frequency.clear` | 保留 | 持续 |
| system.v1 | `settings` | `settings`, `system.settings` | 保留 | 持续 |
| system.v1 | `settings.examPrep.set` | `settings.examPrep.set`, `system.settings.examPrep.set` | 保留 | 持续 |
| system.v1 | `settings.examPrep.reset` | `settings.examPrep.reset`, `system.settings.examPrep.reset` | 保留 | 持续 |
| system.v1 | `settings.practice.set` | `settings.practice.set`, `system.settings.practice.set` | 保留 | 持续 |
| system.v1 | `settings.practice.reset` | `settings.practice.reset`, `system.settings.practice.reset` | 保留 | 持续 |
| system.v1 | `settings.book.set` | `settings.book.set`, `system.settings.book.set` | 保留 | 持续 |
| notifications.v1 | `inbox.raw` | `inbox.raw`, `notifications.inbox.raw` | 保留 | 持续 |
| notifications.v1 | `inbox.mark` | `inbox.mark`, `notifications.inbox.mark` | 保留 | 持续 |
| materials.v1 | `source.import` | `source.import`, `materials.source.import` | 保留 | 持续 |
| materials.v1 | `source.archive` | `source.archive`, `materials.source.archive` | 保留 | 持续 |
| materials.v1 | `source.courses.set` | `source.courses.set`, `materials.source.courses.set` | 保留 | 持续 |
| materials.v1 | `source.add` | `source.add`, `materials.source.add` | 保留 | 持续 |
| materials.v1 | `document.import` | `materials.document.import` | 保留 | 持续 |
| materials.v1 | `document.get` | `materials.document.get` | 保留 | 持续 |
| materials.v1 | `document.bytes` | `materials.document.bytes` | 保留 | 持续 |
| materials.v1 | `document.list` | `materials.document.list` | 保留 | 持续 |
| materials.v1 | `document.attach` | `materials.document.attach` | 保留 | 持续 |
| materials.v1 | `original.status` | `materials.original.status` | 保留 | 持续 |
| materials.v1 | `original.probe` | `materials.original.probe` | 保留 | 持续 |
| materials.v1 | `original.attach` | `materials.original.attach` | 保留 | 持续 |
| materials.v1 | `original.detach` | `materials.original.detach` | 保留 | 持续 |
| materials.v1 | `document.rename` | `materials.document.rename` | 保留 | 持续 |
| materials.v1 | `selection.resolve` | `materials.selection.resolve` | 保留 | 持续 |
| materials.v1 | `selection.ask` | `materials.selection.ask` | 保留 | 持续 |
| materials.v1 | `outline.suggest` | `materials.outline.suggest` | 保留 | 持续 |
| materials.v1 | `outline.save` | `materials.outline.save` | 保留 | 持续 |
| materials.v1 | `outline.segment` | `materials.outline.segment` | 保留 | 持续 |
| materials.v1 | `outline.clear` | `materials.outline.clear` | 保留 | 持续 |
| materials.v1 | `links.list` | `materials.links.list` | 保留 | 持续 |
| materials.v1 | `pages.cards` | `materials.pages.cards` | 保留 | 持续 |
| materials.v1 | `enrich` | `materials.enrich` | 保留 | 持续 |
| materials.v1 | `translation.list` | `materials.translation.list` | 保留 | 持续 |
| materials.v1 | `translation.plan` | `materials.translation.plan` | 保留 | 持续 |
| materials.v1 | `translation.translate` | `materials.translation.translate` | 保留 | 持续 |
| materials.v1 | `translation.cancel` | `materials.translation.cancel` | 保留 | 持续 |
| materials.v1 | `translation.save` | `materials.translation.save` | 保留 | 持续 |
| materials.v1 | `translation.delete` | `materials.translation.delete` | 保留 | 持续 |
| materials.v1 | `translation.glossary.get` | `materials.translation.glossary.get` | 保留 | 持续 |
| materials.v1 | `translation.glossary.set` | `materials.translation.glossary.set` | 保留 | 持续 |
| materials.v1 | `annotation.list` | `materials.annotation.list` | 保留 | 持续 |
| materials.v1 | `annotation.save` | `materials.annotation.save` | 保留 | 持续 |
| materials.v1 | `annotation.delete` | `materials.annotation.delete` | 保留 | 持续 |
| materials.v1 | `sources.ingest` | `materials.sources.ingest` | 保留 | 持续 |
| materials.v1 | `book.aiWrite` | `materials.book.aiWrite` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| materials.v1 | `attachments.export` | `materials.attachments.export` | 保留 | 持续 |
| materials.v1 | `attachments.import` | `materials.attachments.import` | 保留 | 持续 |
| bank.v1 | `deck.merge.suggest` | `deck.merge.suggest`, `bank.deck.merge.suggest` | 保留 | 持续 |
| bank.v1 | `draft.import.propose` | `draft.import.propose`, `bank.draft.import.propose` | 保留 | 持续 |
| bank.v1 | `draft.get` | `draft.get`, `bank.draft.get` | 保留 | 持续 |
| bank.v1 | `deck.get` | `deck.get`, `bank.deck.get` | 保留 | 持续 |
| bank.v1 | `card.link.batch` | `card.link.batch`, `bank.card.link.batch` | 保留 | 持续 |
| bank.v1 | `card.search` | `card.search`, `bank.card.search` | 保留 | 持续 |
| bank.v1 | `deck.course` | `deck.course`, `bank.deck.course` | 保留 | 持续 |
| bank.v1 | `deck.reorder` | `deck.reorder`, `bank.deck.reorder` | 保留 | 持续 |
| bank.v1 | `draft.import` | `draft.import`, `bank.draft.import` | 保留 | 持续 |
| bank.v1 | `deck.edit` | `deck.edit`, `bank.deck.edit` | 保留 | 持续 |
| bank.v1 | `card.followup.add` | `card.followup.add`, `bank.card.followup.add` | 保留 | 持续 |
| bank.v1 | `card.link` | `card.link`, `bank.card.link` | 保留 | 持续 |
| bank.v1 | `deck.move` | `deck.move`, `bank.deck.move` | 保留 | 持续 |
| bank.v1 | `draft.save` | `draft.save`, `bank.draft.save` | 保留 | 持续 |
| bank.v1 | `draft.delete` | `draft.delete`, `bank.draft.delete` | 保留 | 持续 |
| bank.v1 | `card.flag` | `card.flag`, `bank.card.flag` | 保留 | 持续 |
| bank.v1 | `card.suspend` | `card.suspend`, `bank.card.suspend` | 保留 | 持续 |
| bank.v1 | `list` | `bank.list` | 保留 | 持续 |
| bank.v1 | `get` | `bank.get` | 保留 | 持续 |
| bank.v1 | `cards` | `bank.cards` | 保留 | 持续 |
| bank.v1 | `append` | `bank.append` | 保留 | 持续 |
| bank.v1 | `deck.ensure` | `bank.deck.ensure` | 保留 | 持续 |
| bank.v1 | `card.answerCard.set` | `bank.card.answerCard.set` | 保留 | 持续 |
| bank.v1 | `schedule.update` | `bank.schedule.update` | 保留 | 持续 |
| bank.v1 | `material.links.list` | `bank.material.links.list` | 保留 | 持续 |
| courses.v1 | `course.list` | `course.list`, `courses.course.list` | 保留 | 持续 |
| courses.v1 | `course.get` | `course.get`, `courses.course.get` | 保留 | 持续 |
| courses.v1 | `course.profile` | `course.profile`, `courses.course.profile` | 保留 | 持续 |
| courses.v1 | `course.save` | `course.save`, `courses.course.save` | 保留 | 持续 |
| courses.v1 | `course.setActive` | `course.setActive`, `courses.course.setActive` | 保留 | 持续 |
| courses.v1 | `course.activate` | `course.activate`, `courses.course.activate` | 保留 | 持续 |
| courses.v1 | `course.deactivate` | `course.deactivate`, `courses.course.deactivate` | 保留 | 持续 |
| study.v1 | `card.update.batch` | `card.update.batch`, `study.card.update.batch` | 保留 | 持续 |
| study.v1 | `card.get` | `card.get`, `study.card.get` | 保留 | 持续 |
| study.v1 | `card.current` | `card.current`, `study.card.current` | 保留 | 持续 |
| study.v1 | `card.translate` | `card.translate`, `study.card.translate` | 保留 | 持续 |
| study.v1 | `card.locate` | `card.locate`, `study.card.locate` | 保留 | 持续 |
| study.v1 | `review.get` | `review.get`, `study.review.get` | 保留 | 持续 |
| study.v1 | `card.grade` | `card.grade`, `study.card.grade` | 保留 | 持续 |
| study.v1 | `exam.report` | `exam.report`, `study.exam.report` | 保留 | 持续 |
| study.v1 | `focus.suggest` | `focus.suggest`, `study.focus.suggest` | 保留 | 持续 |
| study.v1 | `teach.get` | `teach.get`, `study.teach.get` | 保留 | 持续 |
| study.v1 | `teach.start` | `teach.start`, `study.teach.start` | 保留 | 持续 |
| study.v1 | `teach.answer` | `teach.answer`, `study.teach.answer` | 保留 | 持续 |
| study.v1 | `daily.plan.get` | `daily.plan.get`, `study.daily.plan.get` | 每日时长保留；AI 协商动作待消费者迁移后退役 | B4/B6 |
| study.v1 | `daily.plan.profile` | `daily.plan.profile`, `study.daily.plan.profile` | 每日时长保留；AI 协商动作待消费者迁移后退役 | B4/B6 |
| study.v1 | `daily.plan.suggest` | `daily.plan.suggest`, `study.daily.plan.suggest` | 每日时长保留；AI 协商动作待消费者迁移后退役 | B4/B6 |
| study.v1 | `daily.plan.accept` | `daily.plan.accept`, `study.daily.plan.accept` | 每日时长保留；AI 协商动作待消费者迁移后退役 | B4/B6 |
| study.v1 | `daily.plan.start` | `daily.plan.start`, `study.daily.plan.start` | 每日时长保留；AI 协商动作待消费者迁移后退役 | B4/B6 |
| study.v1 | `daily.plan.complete` | `daily.plan.complete`, `study.daily.plan.complete` | 每日时长保留；AI 协商动作待消费者迁移后退役 | B4/B6 |
| study.v1 | `card.slay` | `card.slay`, `study.card.slay` | 保留 | 持续 |
| study.v1 | `card.restore` | `card.restore`, `study.card.restore` | 保留 | 持续 |
| study.v1 | `deck.remove` | `deck.remove`, `study.deck.remove` | 保留 | 持续 |
| study.v1 | `deck.archive` | `deck.archive`, `study.deck.archive` | 保留 | 持续 |
| study.v1 | `card.update` | `card.update`, `study.card.update` | 保留 | 持续 |
| study.v1 | `card.revert` | `card.revert`, `study.card.revert` | 保留 | 持续 |
| study.v1 | `review.weak.start` | `review.weak.start`, `study.review.weak.start` | 保留 | 持续 |
| study.v1 | `review.start` | `review.start`, `study.review.start` | 保留 | 持续 |
| study.v1 | `review.end` | `review.end`, `study.review.end` | 保留 | 持续 |
| study.v1 | `review.reveal` | `review.reveal`, `study.review.reveal` | 保留 | 持续 |
| study.v1 | `review.answer` | `review.answer`, `study.review.answer` | 保留 | 持续 |
| study.v1 | `review.move` | `review.move`, `study.review.move` | 保留 | 持续 |
| study.v1 | `review.skip` | `review.skip`, `study.review.skip` | 保留 | 持续 |
| study.v1 | `exam.submit` | `exam.submit`, `study.exam.submit` | 保留 | 持续 |
| study.v1 | `review.highlights` | `review.highlights`, `study.review.highlights` | 保留 | 持续 |
| study.v1 | `focus.set` | `focus.set`, `study.focus.set` | 保留 | 持续 |
| study.v1 | `oral.active` | `oral.active`, `study.oral.active` | 保留 | 持续 |
| study.v1 | `oral.start` | `oral.start`, `study.oral.start` | 保留 | 持续 |
| study.v1 | `oral.get` | `oral.get`, `study.oral.get` | 保留 | 持续 |
| study.v1 | `oral.report` | `oral.report`, `study.oral.report` | 保留 | 持续 |
| study.v1 | `oral.answer` | `oral.answer`, `study.oral.answer` | 保留 | 持续 |
| study.v1 | `oral.next` | `oral.next`, `study.oral.next` | 保留 | 持续 |
| study.v1 | `oral.followup` | `oral.followup`, `study.oral.followup` | 保留 | 持续 |
| study.v1 | `oral.submit` | `oral.submit`, `study.oral.submit` | 保留 | 持续 |
| study.v1 | `assist.commit` | `study.assist.commit` | 保留 | 持续 |
| study.v1 | `assist.job` | `study.assist.job` | 保留 | 持续 |
| generation.v1 | `draft.publish.start` | `draft.publish.start`, `generation.draft.publish.start` | 保留 | 持续 |
| generation.v1 | `generate.weakTopics` | `generate.weakTopics`, `generation.generate.weakTopics` | 保留 | 持续 |
| generation.v1 | `generate.suggest` | `generate.suggest`, `generation.generate.suggest` | 保留 | 持续 |
| generation.v1 | `generate.path.suggest` | `generate.path.suggest`, `generation.generate.path.suggest` | 保留 | 持续 |
| generation.v1 | `supplement` | `supplement`, `generation.supplement` | 保留 | 持续 |
| generation.v1 | `generate` | `generate`, `generation.generate` | 保留 | 持续 |
| generation.v1 | `case.drills` | `case.drills`, `generation.case.drills` | 保留 | 持续 |
| generation.v1 | `coverage.recover` | `coverage.recover`, `generation.coverage.recover` | 保留 | 持续 |
| generation.v1 | `draft.repair` | `draft.repair`, `generation.draft.repair` | 保留 | 持续 |
| generation.v1 | `retrieval.status` | `retrieval.status`, `generation.retrieval.status` | 保留 | 持续 |
| generation.v1 | `retrieval.set` | `retrieval.set`, `generation.retrieval.set` | 保留 | 持续 |
| generation.v1 | `retrieval.preview` | `retrieval.preview`, `generation.retrieval.preview` | 保留 | 持续 |
| generation.v1 | `retrieval.endpoint.set` | `retrieval.endpoint.set`, `generation.retrieval.endpoint.set` | 保留 | 持续 |
| generation.v1 | `retrieval.index.plan` | `retrieval.index.plan`, `generation.retrieval.index.plan` | 保留 | 持续 |
| generation.v1 | `retrieval.index.coverage` | `retrieval.index.coverage`, `generation.retrieval.index.coverage` | 保留 | 持续 |
| generation.v1 | `retrieval.index.start` | `retrieval.index.start`, `generation.retrieval.index.start` | 保留 | 持续 |
| generation.v1 | `retrieval.index.status` | `retrieval.index.status`, `generation.retrieval.index.status` | 保留 | 持续 |
| generation.v1 | `retrieval.index.cancel` | `retrieval.index.cancel`, `generation.retrieval.index.cancel` | 保留 | 持续 |
| generation.v1 | `retrieval.test` | `retrieval.test`, `generation.retrieval.test` | 保留 | 持续 |
| generation.v1 | `selection.supplement` | `generation.selection.supplement` | 保留 | 持续 |
| generation.v1 | `selection.get` | `generation.selection.get` | 保留 | 持续 |
| generation.v1 | `selection.commit` | `generation.selection.commit` | 保留 | 持续 |
| generation.v1 | `selection.review` | `generation.selection.review` | 保留 | 持续 |
| generation.v1 | `selection.start` | `generation.selection.start` | 保留 | 持续 |
| generation.v1 | `selection.status` | `generation.selection.status` | 保留 | 持续 |
| generation.v1 | `selection.jobs` | `generation.selection.jobs` | 保留 | 持续 |
| generation.v1 | `selection.saveAnswer` | `generation.selection.saveAnswer` | 保留 | 持续 |
| generation.v1 | `translation.start` | `generation.translation.start` | 保留 | 持续 |
| generation.v1 | `translation.status` | `generation.translation.status` | 保留 | 持续 |
| generation.v1 | `translation.jobs` | `generation.translation.jobs` | 保留 | 持续 |
| generation.v1 | `blueprint.build` | `generation.blueprint.build` | 保留 | 持续 |
| generation.v1 | `courseOutline.build` | `generation.courseOutline.build` | 保留 | 持续 |
| generation.v1 | `courseBook.build` | `generation.courseBook.build` | 保留 | 持续 |
| generation.v1 | `courseBook.explain` | `generation.courseBook.explain` | 保留 | 持续 |
| generation.v1 | `answerCard.build` | `generation.answerCard.build` | 保留 | 持续 |
| notes.v1 | `note.daily.status` | `note.daily.status`, `notes.note.daily.status` | 保留 | 持续 |
| notes.v1 | `note.daily.generate` | `note.daily.generate`, `notes.note.daily.generate` | 保留 | 持续 |
| notes.v1 | `note.daily.advance` | `note.daily.advance`, `notes.note.daily.advance` | 保留 | 持续 |
| notes.v1 | `note.daily.cancel` | `note.daily.cancel`, `notes.note.daily.cancel` | 保留 | 持续 |
| notes.v1 | `note.daily.reconcile` | `note.daily.reconcile`, `notes.note.daily.reconcile` | 保留 | 持续 |
| notes.v1 | `note.material.prepare` | `note.material.prepare`, `notes.note.material.prepare` | 保留 | 持续 |
| notes.v1 | `note.generate` | `note.generate`, `notes.note.generate` | 保留 | 持续 |
| notes.v1 | `note.list` | `note.list`, `notes.note.list` | 保留 | 持续 |
| notes.v1 | `note.get` | `note.get`, `notes.note.get` | 保留 | 持续 |
| notes.v1 | `note.lookup` | `note.lookup`, `notes.note.lookup` | 保留 | 持续 |
| notes.v1 | `note.preparePublish` | `note.preparePublish`, `notes.note.preparePublish` | 保留 | 持续 |
| notes.v1 | `note.home` | `note.home`, `notes.note.home` | 保留 | 持续 |
| notes.v1 | `note.create` | `note.create`, `notes.note.create` | 保留 | 持续 |
| notes.v1 | `note.save` | `note.save`, `notes.note.save` | 保留 | 持续 |
| notes.v1 | `note.link` | `note.link`, `notes.note.link` | 保留 | 持续 |
| notes.v1 | `note.delete` | `note.delete`, `notes.note.delete` | 保留 | 持续 |
| notes.v1 | `note.daily.letter` | `notes.note.daily.letter` | 保留 | 持续 |
| workflows.v1 | `workflow.list` | `workflow.list`, `workflows.workflow.list` | 后续转发或旧记录只读：四步会话；逐项映射 | B2/B6 |
| workflows.v1 | `workflow.context` | `workflow.context`, `workflows.workflow.context` | 后续转发或旧记录只读：四步会话；逐项映射 | B2/B6 |
| workflows.v1 | `workflow.session.get` | `workflow.session.get`, `workflows.workflow.session.get` | 后续转发或旧记录只读：四步会话；逐项映射 | B2/B6 |
| workflows.v1 | `workflow.save` | `workflow.save`, `workflows.workflow.save` | 待导出后退役：自定义编排/骨架 | B2/B6 |
| workflows.v1 | `workflow.delete` | `workflow.delete`, `workflows.workflow.delete` | 待导出后退役：自定义编排/骨架 | B2/B6 |
| workflows.v1 | `workflow.session.start` | `workflow.session.start`, `workflows.workflow.session.start` | 后续转发或旧记录只读：四步会话；逐项映射 | B2/B6 |
| workflows.v1 | `workflow.session.record` | `workflow.session.record`, `workflows.workflow.session.record` | 后续转发或旧记录只读：四步会话；逐项映射 | B2/B6 |
| workflows.v1 | `workflow.session.material` | `workflow.session.material`, `workflows.workflow.session.material` | 后续转发或旧记录只读：四步会话；逐项映射 | B2/B6 |
| workflows.v1 | `workflow.session.material.restore` | `workflow.session.material.restore`, `workflows.workflow.session.material.restore` | 后续转发或旧记录只读：四步会话；逐项映射 | B2/B6 |
| workflows.v1 | `workflow.session.advance` | `workflow.session.advance`, `workflows.workflow.session.advance` | 后续转发或旧记录只读：四步会话；逐项映射 | B2/B6 |
| workflows.v1 | `workflow.session.goto` | `workflow.session.goto`, `workflows.workflow.session.goto` | 后续转发或旧记录只读：四步会话；逐项映射 | B2/B6 |
| workflows.v1 | `workflow.session.status` | `workflow.session.status`, `workflows.workflow.session.status` | 后续转发或旧记录只读：四步会话；逐项映射 | B2/B6 |
| workflows.v1 | `workflow.session.delete` | `workflow.session.delete`, `workflows.workflow.session.delete` | 后续转发或旧记录只读：四步会话；逐项映射 | B2/B6 |
| workflows.v1 | `workflow.practice.start` | `workflow.practice.start`, `workflows.workflow.practice.start` | 后续转发或旧记录只读：四步会话；逐项映射 | B2/B6 |
| workflows.v1 | `workflow.skeleton.generate` | `workflow.skeleton.generate`, `workflows.workflow.skeleton.generate` | 待导出后退役：自定义编排/骨架 | B2/B6 |
| workflows.v1 | `workflow.teaching.start` | `workflow.teaching.start`, `workflows.workflow.teaching.start` | 后续转发或旧记录只读：四步会话；逐项映射 | B2/B6 |
| workflows.v1 | `workflow.teaching.estimate` | `workflow.teaching.estimate`, `workflows.workflow.teaching.estimate` | 后续转发或旧记录只读：四步会话；逐项映射 | B2/B6 |
| workflows.v1 | `workflow.teaching.undo` | `workflow.teaching.undo`, `workflows.workflow.teaching.undo` | 后续转发或旧记录只读：四步会话；逐项映射 | B2/B6 |
| workflows.v1 | `workflow.quickstart` | `workflow.quickstart`, `workflows.workflow.quickstart` | 待导出后退役：自定义编排/骨架 | B2/B6 |
| workflows.v1 | `workflow.rescope` | `workflow.rescope`, `workflows.workflow.rescope` | 待导出后退役：自定义编排/骨架 | B2/B6 |
| workflows.v1 | `workflow.feedback` | `workflow.feedback`, `workflows.workflow.feedback` | 后续转发或旧记录只读：四步会话；逐项映射 | B2/B6 |
| skeleton.v1 | `skeleton.topics` | `skeleton.topics`, `skeleton.skeleton.topics` | 待导出后退役：骨架 | B1/B6 |
| skeleton.v1 | `skeleton.lint` | `skeleton.lint`, `skeleton.skeleton.lint` | 迁入题库维护，旧数据保留 | B1/B6 |
| skeleton.v1 | `skeleton.context` | `skeleton.context`, `skeleton.skeleton.context` | 待导出后退役：骨架 | B1/B6 |
| skeleton.v1 | `skeleton.list` | `skeleton.list`, `skeleton.skeleton.list` | 待导出后退役：骨架 | B1/B6 |
| skeleton.v1 | `skeleton.get` | `skeleton.get`, `skeleton.skeleton.get` | 待导出后退役：骨架 | B1/B6 |
| skeleton.v1 | `skeleton.diagram.attach` | `skeleton.diagram.attach`, `skeleton.skeleton.diagram.attach` | 待导出后退役：骨架 | B1/B6 |
| skeleton.v1 | `skeleton.diagram.list` | `skeleton.diagram.list`, `skeleton.skeleton.diagram.list` | 待导出后退役：骨架 | B1/B6 |
| skeleton.v1 | `skeleton.diagram.get` | `skeleton.diagram.get`, `skeleton.skeleton.diagram.get` | 待导出后退役：骨架 | B1/B6 |
| skeleton.v1 | `skeleton.diagram.remove` | `skeleton.diagram.remove`, `skeleton.skeleton.diagram.remove` | 待导出后退役：骨架 | B1/B6 |
| skeleton.v1 | `skeleton.delete` | `skeleton.delete`, `skeleton.skeleton.delete` | 待导出后退役：骨架 | B1/B6 |
| skeleton.v1 | `skeleton.save` | `skeleton.save`, `skeleton.skeleton.save` | 待导出后退役：骨架 | B1/B6 |
| skeleton.v1 | `skeleton.patch` | `skeleton.patch`, `skeleton.skeleton.patch` | 待导出后退役：骨架 | B1/B6 |
| skeleton.v1 | `topic.groups.save` | `topic.groups.save`, `skeleton.topic.groups.save` | 迁入题库维护，旧数据保留 | B1/B6 |
| jobs.v1 | `job.cancel` | `job.cancel`, `jobs.job.cancel` | 保留 | 持续 |
| jobs.v1 | `job.dismiss` | `job.dismiss`, `jobs.job.dismiss` | 保留 | 持续 |
| jobs.v1 | `job.parallel` | `job.parallel`, `jobs.job.parallel` | 保留 | 持续 |
| jobs.v1 | `job.archive` | `job.archive`, `jobs.job.archive` | 保留 | 持续 |
| jobs.v1 | `job.unarchive` | `job.unarchive`, `jobs.job.unarchive` | 保留 | 持续 |
| jobs.v1 | `job.delete` | `job.delete`, `jobs.job.delete` | 保留 | 持续 |
| jobs.v1 | `job.control` | `job.control`, `jobs.job.control` | 保留 | 持续 |
| jobs.v1 | `job.output` | `job.output`, `jobs.job.output` | 保留 | 持续 |
| jobs.v1 | `job.message` | `job.message`, `jobs.job.message` | 保留 | 持续 |
| jobs.v1 | `job.status` | `job.status`, `jobs.job.status` | 保留 | 持续 |
| jobs.v1 | `job.wait` | `job.wait`, `jobs.job.wait` | 保留 | 持续 |
| library.v1 | `source.import` | `source.import`, `library.source.import` | 保留 | 持续 |
| library.v1 | `inbox` | `inbox`, `library.inbox` | 保留 | 持续 |
| library.v1 | `library.context` | `library.context`, `library.library.context` | 保留 | 持续 |
| library.v1 | `materials.pages.cards` | `materials.pages.cards`, `library.materials.pages.cards` | 保留 | 持续 |
| library.v1 | `coverage.get` | `coverage.get`, `library.coverage.get` | 保留 | 持续 |
| library.v1 | `snapshot` | `snapshot`, `library.snapshot` | 保留 | 持续 |
| library.v1 | `export` | `export`, `library.export` | 保留 | 持续 |
| library.v1 | `restore` | `restore`, `library.restore` | 保留 | 持续 |
| library.v1 | `legacy.import` | `legacy.import`, `library.legacy.import` | 保留 | 持续 |
| library.v1 | `usage.estimate` | `usage.estimate`, `library.usage.estimate` | 保留 | 持续 |
| library.v1 | `usage.summary` | `usage.summary`, `library.usage.summary` | 保留 | 持续 |
| library.v1 | `source.coverage` | `source.coverage`, `library.source.coverage` | 保留 | 持续 |
| library.v1 | `source.organize.suggest` | `source.organize.suggest`, `library.source.organize.suggest` | 保留 | 持续 |
| library.v1 | `source.organize.jev` | `source.organize.jev`, `library.source.organize.jev` | 保留 | 持续 |
| library.v1 | `jev.levels.check` | `jev.levels.check`, `library.jev.levels.check` | 待消费者迁移及导出后退役 | B6 |
| library.v1 | `source.get` | `source.get`, `library.source.get` | 保留 | 持续 |
| library.v1 | `source.search` | `source.search`, `library.source.search` | 保留 | 持续 |
| library.v1 | `source.list` | `source.list`, `library.source.list` | 保留 | 持续 |
| library.v1 | `course.route` | `course.route`, `library.course.route` | 保留 | 持续 |
| library.v1 | `course.outline` | `course.outline`, `library.course.outline` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `course.book.open` | `course.book.open`, `library.course.book.open` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `course.book.revision` | `course.book.revision`, `library.course.book.revision` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `course.book.save` | `course.book.save`, `library.course.book.save` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `book.qa.add` | `book.qa.add`, `library.book.qa.add` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `book.qa.remove` | `book.qa.remove`, `library.book.qa.remove` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `book.qa.list` | `book.qa.list`, `library.book.qa.list` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `course.book.block` | `course.book.block`, `library.course.book.block` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `course.book.suggestion` | `course.book.suggestion`, `library.course.book.suggestion` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `course.book.revert` | `course.book.revert`, `library.course.book.revert` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `course.book.export` | `course.book.export`, `library.course.book.export` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `book.toc` | `book.toc`, `library.book.toc` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `book.read` | `book.read`, `library.book.read` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `book.coverage` | `book.coverage`, `library.book.coverage` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `source.pages` | `source.pages`, `library.source.pages` | 保留 | 持续 |
| library.v1 | `book.write` | `book.write`, `library.book.write` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `book.crunch` | `book.crunch`, `library.book.crunch` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `book.crunch.mark` | `book.crunch.mark`, `library.book.crunch.mark` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `book.mock.plan` | `book.mock.plan`, `library.book.mock.plan` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `course.outline.qa` | `course.outline.qa`, `library.course.outline.qa` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `map` | `map`, `library.map` | 保留 | 持续 |
| library.v1 | `stats` | `stats`, `library.stats` | 保留 | 持续 |
| library.v1 | `wrongbook` | `wrongbook`, `library.wrongbook` | 保留 | 持续 |
| library.v1 | `wrongbook.recommend` | `wrongbook.recommend`, `library.wrongbook.recommend` | 保留 | 持续 |
| library.v1 | `wrongbook.detail` | `wrongbook.detail`, `library.wrongbook.detail` | 保留 | 持续 |
| library.v1 | `graph` | `graph`, `library.graph` | 保留 | 持续 |
| library.v1 | `source.courses.set` | `source.courses.set`, `library.source.courses.set` | 保留 | 持续 |
| library.v1 | `book.mock` | `book.mock`, `library.book.mock` | 后续转发：curriculum 门面；保留旧返回契约 | B1 |
| library.v1 | `source.pin` | `source.pin`, `library.source.pin` | 保留 | 持续 |
| library.v1 | `source.pin.move` | `source.pin.move`, `library.source.pin.move` | 保留 | 持续 |
| library.v1 | `course.rename` | `course.rename`, `library.course.rename` | 保留 | 持续 |
| library.v1 | `course.merge` | `course.merge`, `library.course.merge` | 保留 | 持续 |
| library.v1 | `inbox.read` | `inbox.read`, `library.inbox.read` | 保留 | 持续 |
| library.v1 | `source.remove` | `source.remove`, `library.source.remove` | 保留 | 持续 |
| library.v1 | `inbox.open` | `inbox.open`, `library.inbox.open` | 保留 | 持续 |
| authoring.v1 | `draft.publish.plan` | `draft.publish.plan`, `authoring.draft.publish.plan` | 保留 | 持续 |
| authoring.v1 | `deck.import` | `deck.import`, `authoring.deck.import` | 保留 | 持续 |
| authoring.v1 | `deck.merge` | `deck.merge`, `authoring.deck.merge` | 保留 | 持续 |
| authoring.v1 | `deck.split` | `deck.split`, `authoring.deck.split` | 保留 | 持续 |
| authoring.v1 | `draft.publish.quick` | `draft.publish.quick`, `authoring.draft.publish.quick` | 保留 | 持续 |
| authoring.v1 | `draft.publish` | `draft.publish`, `authoring.draft.publish` | 保留 | 持续 |
| authoring.v1 | `validate` | `authoring.validate` | 保留 | 持续 |

核查 308 个领域操作。运行时定义快照位于 output/qa/backend-b0/runtime-describe.json（本地验收证据）。

宿主专属 board/notebook 等动作不全部出现在 runtime.describe 中，不能据此认定不存在。lib/host.js 与 lib/index.js 的直接路由保留；它们的退役需 B6 单独核对消费者，B0 不改动。

## 数据兼容边界

没有新增集合、升级 Store、迁移资料或修改真实 DSH 配置。全局 board 和 notebooks 仍属于宿主数据。B1/B2 会分别制定内容融合与旧会话迁移计划，本表不替代对应迁移验收。
