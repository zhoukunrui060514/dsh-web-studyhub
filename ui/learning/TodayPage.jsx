import React from 'react';
import { useApp } from '../app/app-context.js';
import { Button, ProgressBar } from '../components/index.js';
import { ui, uiFormat } from '../i18n.js';
import { useAsyncAction } from '../use-async.js';
import { useLearning } from './LearningProvider.jsx';

const titles = { 'continue-session': '继续上次的学习', 'continue-practice': '接着完成练习', 'continue-course': '继续课程学习',
  'continue-learning': '继续今日学习', 'continue-legacy-session': '查看已有学习流程', 'next-course-batch': '学习下一批知识',
  'next-learning-round': '开始下一轮学习', 'due-review': '复习到期题目', 'read-material': '先读一份资料', 'prepare-materials': '准备学习资料' };
export default function TodayPage() {
  const { data, nav, core, dailyPlan } = useApp(), learning = useLearning();
  const { run, working, error } = useAsyncAction({ exclusive: true });
  const decision = data.learningToday;
  const budget = dailyPlan.state?.budgetMinutes, spent = dailyPlan.state?.spentMinutes;
  return <section className="page loop-page" data-testid="loop-today"><p className="loop-meta">{ui('今天')}</p>
    {Number.isFinite(budget) && Number.isFinite(spent) && <div className="loop-pace"><p className="loop-meta">{uiFormat('今天已投入约 {0} / {1} 分钟，剩余约 {2} 分钟', [spent, budget, Math.max(0, budget - spent)])}</p>{budget > 0 && <ProgressBar size="sm" value={Math.min(budget, spent)} max={budget} label={ui('今日学习进度')} />}</div>}
    <div className="loop-brief"><h1>{ui(titles[decision?.primary?.kind] || '从这里继续学习')}</h1>
      <p>{decision?.reason}</p>
      <p className="loop-meta">{decision?.primary?.courses.map(course => course.name || ui('未分类')).join(' · ')}</p>
      {decision?.primary && <div className="loop-actions"><Button variant="primary" disabled={!!working} onClick={() => run('launch', () => learning.openDecision(decision.primary))}>{ui('开始')}</Button><span className="loop-meta">{ui('本次用时未估算')}</span></div>}
      {!decision && <Button onClick={() => core.refresh()}>{ui('刷新学习建议')}</Button>}
    </div>
    {error && <p role="alert">{error}</p>}
    {!!decision?.secondary.length && <section><h2>{ui('也可以')}</h2>{decision.secondary.map((item, index) => <div className="loop-row" key={index}>
      <Button variant="quiet" disabled={!!working} onClick={() => run('launch', () => learning.openDecision(item))}>{ui(titles[item.kind] || item.reason)}</Button><p className="loop-meta">{item.reason}</p>
    </div>)}</section>}
    <div className="loop-actions"><Button variant="quiet" onClick={() => nav.navigate('book')}>{ui('浏览课程大纲')}</Button><Button variant="quiet" onClick={() => nav.navigate('records')}>{ui('查看学习记录')}</Button></div>
  </section>;
}
