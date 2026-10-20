import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkMaterial } from '../lib/contexts/knowledge/chunks.js';
import { citationCatalog, validateExtraction } from '../lib/contexts/knowledge/extraction.js';
import { mergeCandidates } from '../lib/contexts/knowledge/merge.js';
import { knowledgeDefaults } from '../lib/contexts/knowledge/model.js';

const material = text => ({ identity: 'source:s', revision: 'r', courses: ['A'], segments: [{ sourceId: 's', start: 0, end: text.length, text }] });
const evidence = (quote = '甲', start = 0) => ({ sourceId: 's', quote, start, end: start + quote.length, assertion: 'asserted' });
const raw = () => ({ nodes: [{ id: 'a', label: '甲', definition: '定义甲', evidence: [evidence()] }, { id: 'b', label: '乙', definition: '定义乙', evidence: [evidence('乙', 1)] }],
  edges: [{ id: 'ab', from: 'a', to: 'b', predicate: 'promotes', conditions: '条件一', evidence: [evidence('甲乙', 0)] }] });

test('chunks cover every source character with bounded overlap and never split a surrogate pair', () => {
  const m = material('中文😀\n'.repeat(4000)), chunks = chunkMaterial(m), covered = new Set();
  for (const c of chunks) {
    assert.ok(c.segments.reduce((n, s) => n + s.text.length, 0) <= 8000);
    for (const s of c.segments) {
      assert.equal(s.text, m.segments[0].text.slice(s.start, s.end));
      assert.ok(!/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(s.text));
      for (let n = s.start; n < s.end; n++) covered.add(n);
    }
  }
  assert.equal(covered.size, m.segments[0].text.length);
  for (let i = 1; i < chunks.length; i++) assert.ok(chunks[i - 1].segments.at(-1).end - chunks[i].segments[0].start <= 400);
});

test('extraction rejects malformed structure, dangling edges, unverified and ambiguous quotes, overflow', () => {
  const c = chunkMaterial(material('甲乙甲'))[0];
  assert.throws(() => validateExtraction('{bad', c), { code: 'invalid-extraction' });
  const bad = raw(); bad.edges[0].to = 'external-library-node';
  assert.throws(() => validateExtraction(bad, c), { code: 'invalid-extraction' });
  const wrong = raw(); wrong.nodes[0].evidence[0].quote = '不存在';
  assert.throws(() => validateExtraction(wrong, c), { code: 'invalid-evidence' });
  const ambiguous = raw(); delete ambiguous.nodes[0].evidence[0].start; delete ambiguous.nodes[0].evidence[0].end;
  assert.throws(() => validateExtraction(ambiguous, c), { code: 'invalid-evidence' });
  assert.throws(() => validateExtraction({ nodes: Array(61).fill(raw().nodes[0]), edges: [] }, c), { code: 'extraction-overflow' });
  assert.throws(() => validateExtraction({ nodes: [], edges: Array(121).fill({}) }, c), { code: 'extraction-overflow' });
  const unsupported = raw(); unsupported.nodes[0].evidence = []; unsupported.edges = [];
  assert.equal(validateExtraction(unsupported, c).nodes.length, 1);
});

test('validated contributions preserve inference, isolated nodes, semantic matches, homonyms and conflicting conditions', () => {
  let seq = 0; const opts = { createId: () => `id-${++seq}` }, state = knowledgeDefaults();
  const input = raw(); input.nodes[0].evidence[0].assertion = 'inferred';
  const b = validateExtraction(input, chunkMaterial(material('甲乙'))[0]);
  const first = mergeCandidates(state, b, opts);
  assert.equal(first.evidence[0].assertion, 'inferred');
  state.knowledgeNodes.push(...first.nodes); state.knowledgeEdges.push(...first.edges); state.knowledgeEvidence.push(...first.evidence);
  const same = mergeCandidates(state, b, opts);
  assert.equal(same.nodes[0].id, first.nodes[0].id);
  const other = structuredClone(b); other.nodes[0].definition = '另一种含义';
  const homonym = mergeCandidates(state, other, opts);
  assert.notEqual(homonym.nodes[0].id, first.nodes[0].id);
  assert.equal(homonym.mergeProposals.length, 1);
  const conflict = structuredClone(b); conflict.edges[0].conditions = '相反条件';
  assert.notEqual(mergeCandidates(state, conflict, opts).edges[0].id, first.edges[0].id);
  const exact = { nodes: Array.from({ length: 60 }, (_, i) => ({ ...raw().nodes[0], id: `n${i}` })), edges: Array.from({ length: 120 }, (_, i) => ({ ...raw().edges[0], id: `e${i}`, from: 'n0', to: 'n1' })) };
  assert.equal(validateExtraction(exact, chunkMaterial(material('甲乙'))[0]).edges.length, 120);
});

test('model null optional relationship text means absent, without accepting wrong field types', () => {
  const input = raw(), chunk = chunkMaterial(material('甲乙'))[0];
  input.edges[0].conditions = null; input.edges[0].note = null;
  const result = validateExtraction(input, chunk);
  assert.equal(result.edges[0].conditions, ''); assert.equal(result.edges[0].note, '');
  input.edges[0].conditions = { instruction: 'not text' };
  assert.throws(() => validateExtraction(input, chunk), { code: 'invalid-extraction' });
});

test('unique verbatim quotes get deterministic source-local offsets when the model omits them', () => {
  const c = chunkMaterial(material('前言。甲乙。末尾'))[0], input = raw();
  for (const n of input.nodes) for (const e of n.evidence) { delete e.start; delete e.end; }
  for (const e of input.edges[0].evidence) { delete e.start; delete e.end; }
  const result = validateExtraction(input, c);
  for (const e of result.evidence) assert.equal(c.segments[0].text.slice(e.start, e.end), e.quote);
  assert.equal(result.evidence[0].start, 3);
});

test('model selects exact prebound passages by ID, including repeated text at a specific occurrence', () => {
  const c = chunkMaterial(material('前文。\n相同引文\n后文。\n相同引文\n末尾。'))[0];
  const catalog = citationCatalog(c), repeated = catalog.filter(e => e.quote === '相同引文');
  assert.equal(repeated.length, 2);
  const input = { nodes: [{ id: 'n', label: '概念', definition: '定义', evidence: [{ citationId: repeated[1].id, assertion: 'asserted' }] }], edges: [] };
  const result = validateExtraction(input, c);
  assert.equal(result.evidence[0].start, c.segments[0].text.lastIndexOf('相同引文'));
  assert.equal(result.evidence[0].quote, '相同引文');
  input.nodes[0].evidence[0].citationId = 'invented-id';
  assert.throws(() => validateExtraction(input, c), { code: 'invalid-evidence' });
});
