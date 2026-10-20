/** @typedef {{identity:string, revision:string}} MaterialRef */
/** @typedef {{sourceId:string,text:string,start:number,end:number,page?:number}} Segment */
/** @typedef {MaterialRef & {documentId?:string,documentRevision?:string,sourceIds:string[],title:string,courses:string[],importedAt:string|null,eligibleAuto:boolean,archived:boolean,segments:Segment[]}} MaterialInput */
/** @typedef {{courseIds?:string[],materialIds?:string[],includeCrossCourse?:boolean}} GraphFilter */
/** @typedef {{id:string,label:string,aliases:string[],definition:string,createdAt:string,manualOverrides:object}} Node */
/** @typedef {{id:string,from:string,to:string,predicate:string,direction:'directed'|'undirected',conditions:string,note:string,manualOverrides:object}} Edge */
/** @typedef {{id:string,targetKind:'node'|'edge',targetId:string,materialIdentity:string,revision:string,sourceId:string,quote:string,start:number,end:number,page?:number,courses:string[],assertion:'asserted'|'inferred',contribution:object}} Evidence */
/** @typedef {{knowledgeNodes:Node[],knowledgeEdges:Edge[],knowledgeEvidence:Evidence[],knowledgeMaterials:object[],knowledgeMerges:object[],knowledgeThreads:object[],knowledgeConfig:object}} KnowledgeState */
/** @typedef {{id:string,materialIdentity:string,revision:string,segments:Segment[]}} Chunk */
/** @typedef {{nodes:Node[],edges:Edge[],evidence:Evidence[],mergeProposals:object[]}} CandidateBatch */
/** @typedef {{state:{read:Function,update:Function},materials:{list:Function,get:Function},courses:{list:Function},jobs:object,complete:Function,signal:AbortSignal,libraryId:string,now:Function}} KnowledgePorts */
/** @typedef {{accepted:boolean,jobId?:string,status:string,materialIds:string[]}} BuildReceipt */
/** @typedef {{kind:'node'|'edge',id:string}|{kind:'path',startNodeId:string,edgeIds:string[]}} QaTarget */
export const KNOWLEDGE_FIELDS = Object.freeze(['knowledgeNodes', 'knowledgeEdges', 'knowledgeEvidence', 'knowledgeMaterials', 'knowledgeMerges', 'knowledgeThreads', 'knowledgeConfig']);
export const KNOWLEDGE_COLLECTIONS = Object.freeze(KNOWLEDGE_FIELDS.map(name => ({ name, mode: name === 'knowledgeConfig' ? 'whole' : 'item' })));
export const PREDICATES = Object.freeze(['causes', 'promotes', 'inhibits', 'part-of', 'prerequisite', 'contrasts', 'related']);
export const UNDIRECTED = Object.freeze(['contrasts', 'related']);
export const EXTRACTOR_VERSION = '1';
export function knowledgeDefaults() {
  return Object.fromEntries(KNOWLEDGE_FIELDS.map(field => [field, field === 'knowledgeConfig'
    ? { schemaVersion: 1, autoBuild: false, lastEnabledAt: null } : []]));
}
export function knowledgeError(code, message = code) { return Object.assign(new Error(message), { code }); }
export const normalizeFilter = (filter = {}) => ({ courseIds: [...new Set(filter.courseIds || [])].sort(), materialIds: [...new Set(filter.materialIds || [])].sort(), includeCrossCourse: filter.includeCrossCourse === true });
