const object = properties => ({ type: 'object', properties, additionalProperties: true });
const output = object({});
const text = { type: 'string' }, strings = { type: 'array', items: text };
const filter = object({ courseIds: strings, materialIds: strings, includeCrossCourse: { type: 'boolean' } });
const target = object({ kind: { type: 'string', enum: ['node', 'edge', 'path'] }, id: text, startNodeId: text, edgeIds: strings });
const schema = (properties, description) => ({ input: object(properties), output, description });
export const knowledgeSchemas = {
  'knowledge.query': schema({ ...filter.properties, query: text, focusId: text, depth: { type: 'integer' }, nodeLimit: { type: 'integer' }, edgeLimit: { type: 'integer' } }, 'Read a bounded material graph; totals describe all matching supported records.'),
  'knowledge.node.get': schema({ id: text, filter }, 'Read a concept, neighboring relations and verified source contributions.'),
  'knowledge.edge.get': schema({ id: text, filter }, 'Read a relationship with its real direction, conditions and material evidence.'),
  'knowledge.materials': schema({}, 'List eligible material identities, versions, courses and per-material processing status; no full text.'),
  'knowledge.build': schema({ materials: { type: 'array', items: object({ identity: text, revision: text }) }, origin: { type: 'string', enum: ['manual', 'backfill'] } }, 'Build selected materials or explicitly backfill existing eligible materials. Waiting is not job acceptance.'),
  'knowledge.ask': schema({ target, filter, question: text, threadId: text, requestId: text }, 'Ask a cited concept, relationship or connected path question without modifying graph or question bank.'),
  'knowledge.thread.get': schema({ threadId: text, target, filter }, 'Read persistent question history and citation availability for this library.'),
  'knowledge.node.update': schema({ id: text, label: text, aliases: strings, definition: text }, 'Save independent manual concept corrections.'),
  'knowledge.edge.update': schema({ id: text, conditions: text, note: text }, 'Save independent manual relationship corrections without changing its direction.'),
  'knowledge.merge.accept': schema({ id: text }, 'Accept one explicit merge proposal, migrate references and retain an old-ID redirect.'),
  'knowledge.merge.reject': schema({ id: text }, 'Keep the concepts of one merge proposal separate.'),
  'knowledge.settings.get': { input: object({}), output, description: 'Read optional material knowledge graph settings.' },
  'knowledge.settings.set': { input: object({ autoBuild: { type: 'boolean' } }), output, description: 'Enable or disable future automatic material extraction.' },
};
