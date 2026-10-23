import React from 'react';
import { ui } from '../i18n.js';

function ResultSummary({ title, value }) {
  if (!value) return null;
  return <section className="loop-result"><h3>{ui(title)}</h3>
    <dl className="loop-result__numbers"><div><dt>{ui('已作答')}</dt><dd>{value.answered} / {value.delivered}</dd></div>
      <div><dt>{ui('未作答')}</dt><dd>{value.unanswered}</dd></div>
      <div><dt>{ui('首次答对')}</dt><dd>{value.firstAnswers.correct} / {value.firstAnswers.graded}</dd></div>
      <div><dt>{ui('同轮订正')}</dt><dd>{value.corrections.retry}</dd></div></dl>
    {value.pendingGrading > 0 && <p>{ui('已提交待评分')}：{value.pendingGrading}</p>}
    {value.corrections.updated > 0 && <p>{ui('题目更新后的作答')}：{value.corrections.updated}</p>}
    {value.ungradable > 0 && <p>{ui('不可评分')}：{value.ungradable}</p>}
    {value.unavailable > 0 && <p>{ui('当前已失效')}：{value.unavailable}</p>}
    <details><summary>{ui('作答与复习安排')}</summary><ul>{value.questions.map(q => <li key={`${q.deckId}-${q.cardId}`}>
      {q.snapshots[0]?.card.prompt || q.cardId} · {ui(q.answered ? '已作答' : '未作答')}
      {q.firstAnswer && ` · ${ui(q.firstAnswer.assessment === 'graded' ? q.firstAnswer.grade >= 3 ? '首答正确' : '首答错误' : '自主评价')}`}
      {q.dueAt && ` · ${ui('当前复习安排')} ${new Date(q.dueAt).toLocaleDateString()}`}
      {q.contentChanged && ` · ${ui('跨批题目版本有变化')}`}
    </li>)}</ul></details>
  </section>;
}
export default function SessionResults({ results }) {
  return <><ResultSummary title="本批结果" value={results.currentBatch} /><ResultSummary title="本次学习累计" value={results.sessionSummary} />
    <p className="loop-meta">{ui('结果来自实际作答。结束学习不会标记掌握；复习日期沿用题目的当前排程。')}</p></>;
}
