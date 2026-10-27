import test from 'node:test';
import assert from 'node:assert/strict';
import { coverageOf, coverageDigest, coverageFromDigest } from '../lib/coverage.js';
import { documentTopUp, leafSectionsFor } from '../lib/coverage-state.js';
import { planRound } from '../lib/coverage-round.js';
import { wantedUncovered, draftRunFacts } from '../lib/coverage-run.js';
import { shortfallOf } from '../lib/shortfall.js';
import { planAssigned } from '../lib/assigned-plan.js';
import { StudyService } from '../lib/service.js';
import { privateRoot } from './helpers/model-family-baseline.mjs';
import { loadUi } from './helpers/ui-module.mjs';

const page = (n, text, sparseText = true) => ({ id: `p${n}`, title: `生理.pdf · p.${n}`, format: 'pdf', text,
  document: { id: 'physiology', filename: '生理.pdf', page: n, totalPages: 9, sparseText } });
const sources = [
  page(1, '第二章 麻醉与神经系统\n\n重庆医科大学生理教研室 冯敏'),
  page(2, '教学大纲\n 学时：理论课 2 学时，自主学习 2 学时，实验课 6 学时。\n 1. 重点：脑电活动记录与麻醉监测。\n 2. 难点：脑电活动与麻醉监测。\n 3. 自学：神经细胞生物电现象；神经突触、递质受体；神经电生理细胞外记录技术和麻醉监测；\n脑电记录与麻醉监测；麻醉与手术对神经生物电的影响和神经电生理监测。（自主学习）。\n 4. 其它：无。', false),
  page(3, '第一节 麻醉与神经系统的生物电现象'),
  page(4, '基础生理学部分知识点（自主学习）\n静息电位\n动作电位\n神经元兴奋性'),
  page(5, '基础生理学部分知识点（逻辑框架）'),
  page(6, '拓展学习\n5. 嗅觉和味觉诱发电位'),
  page(7, '临床知识点\n脑电图常见的基本波形'),
  page(8, '静息电位是细胞未受刺激时膜内外存在的电位差。'),
  page(9, 'CO = HR × SV\n心输出量 = 心率 × 每搏输出量'),
];

test('PDF top-up skips administrative/title pages and holds unreadable diagrams without claiming coverage', () => {
  const coverage = coverageOf({ sources });
  assert.deepEqual(coverage.sections.slice(0, 3).map(s => s.evidenceIssue), ['non-content', 'non-content', 'non-content']);
  assert.ok(coverage.sections.slice(3, 7).every(s => s.evidenceIssue === 'insufficient-text'));
  assert.deepEqual(planRound(coverage).picks.map(s => s.sourceId), ['p8', 'p9']);
  assert.equal(coverage.covered, 0);
  assert.equal(coverage.leaves, 9, 'held pages remain visible and are not silently marked covered');
  assert.equal(coverage.percentLeaves, 0);
  assert.deepEqual(coverageFromDigest(coverageDigest(coverage)).evidenceIssues, { nonContent: 3, insufficientText: 4 });
});

test('document topup, initial planning and saved rounds use the same evidence boundary', () => {
  const state = { sources, decks: [], drafts: [], documents: [] };
  const found = documentTopUp(state, { sourceId: 'p1' });
  assert.deepEqual(found.round.picks.map(p => p.sourceId), ['p8', 'p9']);
  assert.deepEqual(leafSectionsFor(state, sources).map(s => s.sourceId), ['p8', 'p9']);
  const spec = { quotas: found.coverage.sections.map(s => ({ sectionId: s.key, quota: 1 })) };
  assert.deepEqual([...wantedUncovered(spec, found.coverage)], found.round.picks.map(p => p.key));
  assert.equal(planRound(found.coverage, { keys: [found.coverage.sections[0].key] }).error, 'evidence');
});

test('evidence is re-evaluated after text is restored; short factual text and formulas are eligible', () => {
  const fixed = sources.map(s => s.id === 'p5' ? { ...s, text: '化学性突触通过神经递质传递信号，完成电信号到化学信号的转换。' } : s);
  assert.ok(planRound(coverageOf({ sources: fixed })).picks.some(p => p.sourceId === 'p5'));
  const plain = { id: 'md', text: '# 学习目标\n静息电位', format: 'md' };
  assert.equal(planRound(coverageOf({ sources: [plain] })).sections, 1, 'PDF-specific policy does not discard notes');
  const mixed = page(1, '麻醉生理学 第一章 绪论\n重庆医科大学麻醉生理学课程组\n复习提纲\n定义：研究生理学在临床麻醉中的应用。\n细胞内液占总体液量60%，细胞外液占40%。', false);
  assert.equal(planRound(coverageOf({ sources: [mixed] })).sections, 1, 'a cover heading above real evidence does not discard the page');
  const definition = page(1, '静息电位：细胞未受刺激时膜内外的电位差');
  assert.equal(planRound(coverageOf({ sources: [definition] })).sections, 1, 'colon definitions are evidence even without punctuation or a copula');
});

test('a single assignment explicitly refused for insufficient evidence is not asked twice', async () => {
  const source = page(1, '只有一个图表标题'); let calls = 0;
  const result = await planAssigned(async () => { calls++; return { error: 'insufficient evidence' }; }, { sources: [source], kind: 'quiz' }, {
    assignments: [{ key: 'a', sectionId: 'a', sourceId: source.id, start: 0, end: source.text.length, quota: 1 }],
  });
  assert.equal(calls, 1); assert.equal(result.reasked, 0);
  assert.equal(result.short[0].why, 'refused');
});

test('one-click and direct document top-up report held pages without spending a model call', async t => {
  const service = new StudyService(await privateRoot(t, 'topup-evidence-'));
  t.after(() => service.dispose()); let calls = 0;
  service.complete = async () => { calls++; throw new Error('must not invoke a model'); };
  await service.store.update(s => { s.sources.push(...sources.slice(0, 7)); });
  const { key } = await service.call('coverage.get', { sourceId: 'p1' });
  const result = await service.call('generate.uncovered', { documentIds: [key] });
  assert.equal(result.started.length, 0); assert.equal(result.failed.length, 0);
  assert.equal(result.skipped[0].reason, 'no-evidence');
  assert.equal(result.skipped[0].held.length, 7);
  assert.equal(result.skipped[0].held[0].page, 1);
  await assert.rejects(service.call('generate', { documentId: key, coverage: { autoComplete: true } }), /原文|evidence/i);
  assert.equal(calls, 0);
  const state = await service.call('export'); assert.equal(state.drafts.length, 0);
});

test('coverage copy explains held pages without saying they have questions', async () => {
  const { coverageLine, coveragePathText, runPathText, evidenceIssueText, noTopUpText, describeFailure, setUiLanguage } = await loadUi("export * from './ui/coverage/copy.js'; export { describeFailure } from './ui/generation-status.js'; export { setUiLanguage } from './ui/i18n.js';");
  const coverage = coverageOf({ sources: sources.slice(0, 7) });
  assert.match(coverageLine(coverage), /非考核/);
  assert.match(evidenceIssueText('insufficient-text'), /原文/);
  assert.match(noTopUpText(coverage), /原文/);
  assert.doesNotMatch(noTopUpText(coverage), /都有题/);
  const mixed = coverageOf({ sources });
  const path = coveragePathText(shortfallOf({ coverage: mixed, round: planRound(mixed) }));
  assert.match(path, /可出题/); assert.doesNotMatch(path, /100%/);
  const draft = { cards: [], editorial: { coverageSpec: { rounds: [{ round: 1, status: 'pending', questions: 2 }] }, coverageRun: { state: 'waiting' } } };
  const run = draftRunFacts(draft, { coverage: mixed, percent: 0 });
  assert.match(runPathText(run), /可出题/); assert.doesNotMatch(runPathText(run), /100%/);
  const error = 'The plan came back short (plan-short): 0 of 1; insufficient evidence for additional targets: 生理.pdf · p.1';
  assert.match(describeFailure(error).title, /未找到/);
  assert.doesNotMatch(describeFailure(error).hint, /再试一次可能/);
  setUiLanguage('en');
  try {
    for (const copy of [coverageLine(coverage), evidenceIssueText('insufficient-text'), noTopUpText(coverage), describeFailure(error).hint]) assert.doesNotMatch(copy, /[\u3400-\u9fff]/u);
  } finally { setUiLanguage('zh'); }
});
