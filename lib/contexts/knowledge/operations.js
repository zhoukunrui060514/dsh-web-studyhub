import { knowledgeDefaults, knowledgeError } from './model.js';
import { inputsFromState } from './materials.js';
import { acceptMerge, rejectMerge } from './merge.js';
import { queryKnowledge, knowledgeDetail } from './query.js';
import { submitKnowledgeBuild } from './jobs/submit.js';
import { reconcileKnowledge } from './scheduler.js';
import { askKnowledge, readKnowledgeThread } from './qa.js';
import { prepareKnowledgeQuestion } from './qa-context.js';

export function createOperations(ports) {
  const { state, now = () => new Date().toISOString() } = ports;
  const handlers = {
    'knowledge.ask': args => askKnowledge(ports, args),
    'knowledge.thread.get': async args => {
      const s = await state.read(), materials = inputsFromState(s);
      if (args.threadId) return readKnowledgeThread(s, materials, { threadId: args.threadId, libraryId: ports.libraryId });
      const prepared = prepareKnowledgeQuestion(s, materials, { ...args, question: 'history', libraryId: ports.libraryId });
      return prepared.threadId ? readKnowledgeThread(s, materials, { threadId: prepared.threadId, libraryId: ports.libraryId }) : { threadId: null, messages: [] };
    },
    'knowledge.build': async args => {
      const background = ports.background?.() || ports;
      const materials = args.origin === 'backfill' && !args.materials?.length
        ? inputsFromState(await state.read()).filter(m => !m.archived).map(({ identity, revision }) => ({ identity, revision })) : args.materials;
      if (!materials?.length) return { accepted: false, status: 'complete', materialIds: [] };
      return submitKnowledgeBuild(background, { ...args, materials });
    },
    'knowledge.query': async args => { const s = await state.read(); return queryKnowledge(s, inputsFromState(s), args); },
    ...Object.fromEntries(['node', 'edge'].map(kind => [`knowledge.${kind}.get`, async args => {
      const s = await state.read(); return knowledgeDetail(s, inputsFromState(s), { kind, id: args.id, filter: args.filter });
    }])),
    ...Object.fromEntries(['node', 'edge'].map(kind => [`knowledge.${kind}.update`, args => state.update(s => {
      const item = s[kind === 'node' ? 'knowledgeNodes' : 'knowledgeEdges'].find(n => n.id === args.id);
      if (!item) throw knowledgeError(`${kind}-unavailable`);
      const allowed = kind === 'node' ? ['label', 'definition', 'aliases'] : ['conditions', 'note'];
      item.manualOverrides ||= {};
      for (const field of allowed) if (Object.hasOwn(args, field)) {
        if (field === 'aliases' ? !Array.isArray(args[field]) || args[field].some(x => typeof x !== 'string') : typeof args[field] !== 'string') throw knowledgeError('invalid-update');
        if (field === 'label' && !args[field].trim()) throw knowledgeError('invalid-update');
        item.manualOverrides[field] = args[field];
      }
      return item;
    })])),
    'knowledge.merge.accept': args => state.update(s => acceptMerge(s, args.id)),
    'knowledge.merge.reject': args => state.update(s => { rejectMerge(s, args.id); return { rejected: true }; }),
    'knowledge.materials': async () => {
      const s = await state.read();
      return { materials: inputsFromState(s).map(({ segments: _segments, ...m }) => ({ ...m, processing: s.knowledgeMaterials.find(p => p.identity === m.identity) || { status: 'pending' } })), courses: s.courses || [] };
    },
    'knowledge.settings.get': async () => (await state.read()).knowledgeConfig || knowledgeDefaults().knowledgeConfig,
    'knowledge.settings.set': async args => {
      const config = await state.update(s => {
      s.knowledgeConfig ||= knowledgeDefaults().knowledgeConfig;
      if (typeof args.autoBuild === 'boolean') {
        if (args.autoBuild && !s.knowledgeConfig.autoBuild) { s.knowledgeConfig.lastEnabledAt = now(); s.knowledgeConfig.lastEnabledRevision = s.revision + 1; }
        s.knowledgeConfig.autoBuild = args.autoBuild;
      }
      return s.knowledgeConfig;
      });
      await reconcileKnowledge(ports.background?.() || ports, { reason: 'settings-changed' });
      return config;
    },
  };
  return { handlers, mutations: {} };
}
