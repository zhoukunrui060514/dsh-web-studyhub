# 资料处理、活动与兼容入口

后端 B5/B6 在五空间闭环基础上继续收敛职责。本页记录后端阶段；2026-10-22 已恢复前端接入，当前界面与验证范围见 [前端验收记录](validation/2026-10-22-frontend-learning-loop.md)。

## 资料处理

`conversion.v1` 独立承载 MinerU/Marker 的 PDF 转换、安装任务和恢复逻辑，无新增集合。audio 只负责音频转写、字幕与修订。两者经 materials 保存原文，沿用原 Job kind、checkpoint、取消和发布约束。materials/audio 插件各自引用 conversion，卸载音频不应取消仍由资料插件持有的 PDF 任务。

`materials.processing.plan({kind,sourceIds?,course?,generation?})` 只返回计划，不启动任务。kind 为 existing/document/pdf/audio/subtitles；generation 为 questions/outline/reading。导入步骤返回资料或任务回执；生成步骤单独要求模型及输入资料。先完成导入再请求生成，生成失败仍可读取已导入的资料。重试使用原任务，不重新导入。

旧 `mineru.*`、`marker.*` 公共动作保留，内部模块从 audio 移至 conversion；旧内部源码路径不属于公共兼容契约。旧 PDF 任务取消归档后，先恢复 conversion checkpoint，再恢复历史展示。

## 活动与旧对象

`activity.query({type?,status?,limit?,cursor?,includeTasks?})` 聚合当前库 Job、通知、未发布草稿，按逻辑任务身份折叠。只读查询不新建活动集合。操作仍回到 `job.control`、`inbox.mark`、`draft.publish.plan`。includeTasks 显式读取宿主 board，限定 studyRef.root，不复制待办。

`legacy.inventory({limit?,cursor?})` 返回总量与分页引用；`legacy.export({type,id,format})` 导出单个完整原始对象，format 为 json/markdown。type 支持 skeleton/template/workflow/exam-points/note。分支、历史、人工文字和 CSDN 元数据随对象保留。导出不是附件备份，也不包含宿主配置、凭据、全局 board 或实录文件。

新查询默认 50 条、最多 200 条，游标绑定投影；源数据改变后应重新查询。

## 动作去向与退役条件

| 既有能力 | 当前去向 | 兼容状态 |
| --- | --- | --- |
| 大纲、全书、旧考点 | curriculum 统一视图与显式考点映射 | 原动作保留；清单不删除 |
| 任意学习流/模板 | 固定 learning.session；复杂旧流程完整导出 | 不静默迁移；原动作保留 |
| 骨架维护 | legacy 导出；题库维护继续由 bank/authoring | 前端迁走后才退役写动作 |
| PDF 转换/工具安装 | conversion，原 mineru/marker 动作名 | 保持原任务持久化和重试 |
| 音频/字幕 | audio → materials | 原音频动作保留 |
| 今日、coach、daily plan | 同一个 learningToday 决策 | 旧返回字段保留 |
| 练习历史、笔记 | learning.records，只读投影 | 笔记不复制，不直接增加掌握度 |
| 任务与提醒 | activity 查询，原所有者执行控制 | jobs/inbox 原动作保留 |
| CSDN 发布/外链管理 | 保留元数据并可导出 | 退役准备，当前 handler 保留 |
| 全局笔记本注册、实时实录 | 宿主原存储 | 退役准备，当前 handler 保留 |

新增聊天工具 study_curriculum、study_learning_session、study_learning_records、study_learning_loop、study_conversion；study_audio 明确音频职责。能力发现提供各领域精确 schema。最终移除旧发现项、工具/preset/skill 中的旧动作说明，应与前端迁移一起执行；本阶段不提前删除正在使用的兼容入口。
