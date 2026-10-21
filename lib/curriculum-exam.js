import { curriculumTarget, flatten, digest, fail, pageOf, checkRevision } from './curriculum.js';
import { buildOutlineIndex } from './course-outline-index.js';
import { documentIndex, leafSegments } from './course-book-inputs.js';
import { isExamPointListSource, isLibraryListSource, examPointListStale } from './exam-point-list.js';

function basis(state, args) {
  const target = curriculumTarget(state, args);
  const list = state.sources.find(source => source.id === args.listId && !source.archived && isExamPointListSource(source)
    && (target.course === '' ? !(source.courses || []).length : source.courses?.includes(target.course)));
  if (!list) fail('curriculum-list-unavailable');
  const byId = new Map(state.sources.map(source => [source.id, source]));
  const sourceIds = [...new Set([...(list.blueprint.inputs || []).flatMap(input => input.sourceIds || []),
    ...(list.blueprint.points || []).flatMap(point => (point.evidence || []).map(evidence => evidence.sourceId))])].sort();
  const listRevision = digest([list.id, list.blueprint, sourceIds.map(id => {
    const source = byId.get(id);
    return [id, source?.text ?? null, source?.archived ?? false, source?.provenance ?? null];
  })]);
  const textOf = id => { const source = byId.get(id); return source && !source.archived && !isLibraryListSource(source) ? source.text : undefined; };
  const stale = examPointListStale(list, textOf);
  return { ...target, list, byId, listRevision, stale };
}

/** Membership, not evidence approval: invalid selections never auto-confirm a point. */
function mappedPoints(state, target) {
  const { course, outline, list, listRevision, outlineRevision, byId, stale } = target;
  const leaves = flatten(outline?.courseOutline.nodes).filter(node => !node.children?.length);
  const docs = documentIndex(buildOutlineIndex(state, { course }).allDocuments);
  const segments = new Map(leaves.map(node => [node.id, leafSegments(byId, docs, node.anchors)]));
  const saved = outline?.curriculumExamPoints?.find(mark => mark.listId === list.id);
  const current = saved?.listRevision === listRevision && saved?.outlineRevision === outlineRevision;
  return (list.blueprint.points || []).map(point => {
    const candidates = new Set();
    const evidence = point.evidence || [];
    let exact = evidence.length > 0 && !stale;
    for (const cite of evidence) {
      const source = byId.get(cite.sourceId);
      const valid = source && !source.archived && !isLibraryListSource(source) && typeof cite.quote === 'string' && cite.quote.length > 0
        && Number.isInteger(cite.start) && Number.isInteger(cite.end) && cite.start >= 0 && cite.end > cite.start
        && source.text?.slice(cite.start, cite.end).replace(/\s+/g, ' ').trim() === cite.quote.replace(/\s+/g, ' ').trim();
      const matched = valid ? leaves.filter(node => segments.get(node.id).some(segment => segment.sourceId === cite.sourceId
        && cite.start >= segment.start && cite.end <= segment.end)) : [];
      matched.forEach(node => candidates.add(node.id));
      if (matched.length !== 1) exact = false;
    }
    const confirmed = current ? saved.mappings.find(mapping => mapping.pointId === point.id) : null;
    let nodeId = exact && candidates.size === 1 ? [...candidates][0] : null;
    let status = nodeId ? 'mapped' : candidates.size > 1 ? 'ambiguous' : 'unplaced';
    if (confirmed) { nodeId = confirmed.nodeId; status = nodeId ? 'mapped' : 'unplaced'; }
    return { ...point, nodeId, status, candidates: [...candidates], mappingBasis: confirmed ? 'manual' : nodeId ? 'anchor' : null,
      evidenceCurrent: exact && !stale, confirmationStale: !!saved && !current };
  });
}

export function examPreview(state, args) {
  const target = basis(state, args), all = mappedPoints(state, target);
  if (args.nodeId && !flatten(target.outline?.courseOutline.nodes).some(node => node.id === args.nodeId)) fail('curriculum-node-unavailable');
  const selected = args.nodeId ? all.filter(point => point.nodeId === args.nodeId) : all;
  const page = pageOf(selected, args, digest([target.course, target.outlineRevision, target.listRevision, args.nodeId ?? null, all])), { items, ...pagination } = page;
  return { status: target.outline ? 'ok' : 'empty', course: target.course, courseId: target.scope.courseId,
    outlineId: target.outline?.id ?? null, outlineRevision: target.outlineRevision, listId: target.list.id, listRevision: target.listRevision,
    stale: target.stale, ...pagination, points: items,
    totals: { mapped: all.filter(point => point.status === 'mapped').length, ambiguous: all.filter(point => point.status === 'ambiguous').length,
      unplaced: all.filter(point => point.status === 'unplaced').length, total: all.length } };
}

export function applyExamMappings(state, args) {
  const target = basis(state, args);
  checkRevision(target, args);
  if (!target.outline) fail('curriculum-outline-unavailable');
  if (target.listRevision !== args.listRevision) fail('curriculum-list-stale');
  if (typeof args.requestId !== 'string' || !args.requestId.trim() || args.requestId.length > 200
    || !Array.isArray(args.mappings) || args.mappings.length > 300) fail('invalid-curriculum-mapping');
  const pointIds = new Set(target.list.blueprint.points.map(point => point.id));
  const nodeIds = new Set(flatten(target.outline.courseOutline.nodes).filter(node => !node.children?.length).map(node => node.id));
  const seen = new Set();
  const mappings = args.mappings.map(mapping => {
    if (!mapping || !pointIds.has(mapping.pointId) || seen.has(mapping.pointId)) fail('invalid-curriculum-mapping');
    seen.add(mapping.pointId);
    if (mapping.nodeId !== null && !nodeIds.has(mapping.nodeId)) fail('curriculum-node-unavailable');
    return { pointId: mapping.pointId, nodeId: mapping.nodeId };
  }).sort((a, b) => a.pointId.localeCompare(b.pointId));
  const marks = target.outline.curriculumExamPoints || [];
  const previous = marks.find(mark => mark.listId === target.list.id);
  const payload = digest([target.listRevision, target.outlineRevision, mappings]);
  const request = previous?.requests.find(item => item.id === args.requestId);
  if (request) {
    if (request.payload !== payload) fail('curriculum-request-conflict');
    return examPreview(state, args);
  }
  const current = previous?.listRevision === target.listRevision && previous?.outlineRevision === target.outlineRevision;
  const merged = new Map((current ? previous.mappings : []).map(mapping => [mapping.pointId, mapping]));
  mappings.forEach(mapping => merged.set(mapping.pointId, mapping));
  const mark = { listId: target.list.id, listRevision: target.listRevision, outlineRevision: target.outlineRevision,
    mappings: [...merged.values()], requests: [...(previous?.requests || []), { id: args.requestId, payload }] };
  target.outline.curriculumExamPoints = [...marks.filter(item => item.listId !== target.list.id), mark];
  return examPreview(state, args);
}

export function examAnnotations(state, args) {
  const target = curriculumTarget(state, args);
  const lists = state.sources.filter(source => !source.archived && isExamPointListSource(source)
    && (target.course === '' ? !(source.courses || []).length : source.courses?.includes(target.course)));
  return lists.flatMap(list => {
    const data = basis(state, { ...args, listId: list.id });
    return mappedPoints(state, data).map(point => ({ ...point, listId: list.id, listRevision: data.listRevision, stale: data.stale }));
  });
}
