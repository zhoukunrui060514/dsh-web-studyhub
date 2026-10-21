import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudyService } from '../lib/service.js';
import { activityQuery } from '../lib/activity.js';
import { domainTool } from '../lib/runtime/tools.js';

async function fixture(t) {
  const root=await mkdtemp(join(tmpdir(),'activity-')); const service=new StudyService(root);
  t.after(async()=>{await service.dispose(); await rm(root,{recursive:true,force:true});});
  return {root,service};
}
test('activity folds a logical job and its notifications, leaves owners in control and is a readonly bounded query',async t=>{
  const {root,service}=await fixture(t);
  service.runtime.work.jobs.set('attempt', {id:'attempt',root,type:'generation',status:'complete',title:'任务',draftId:'draft',startedAt:'2026-10-22T01:00:00Z',finishedAt:'2026-10-22T01:01:00Z',contract:{contractVersion:2,jobId:'logical',attemptId:'attempt',kind:'generation',status:'complete',actions:{},result:{refs:[{kind:'draft',id:'draft'}]}}});
  await service.store.update(s=>{
    s.drafts.push({id:'draft',title:'草稿',cards:[]});
    s.inbox.push({id:'letter',kind:'generate-complete',jobId:'logical',at:'2026-10-22T01:01:00Z',detail:'完成',read:false});
  });
  const before=await service.store.read(); const result=await service.call('activity.query',{});
  assert.equal(result.total,1);
  assert.equal(result.items[0].type,'job');
  assert.equal(result.items[0].notifications[0].id,'letter');
  assert.equal(result.items[0].drafts[0],'draft');
  assert.ok(result.items[0].actions.some(a=>a.operation==='draft.publish.plan'&&a.args.id==='draft'));
  assert.ok(result.items[0].actions.some(a=>a.operation==='inbox.mark'));
  assert.deepEqual(await service.store.read(),before);
  const mark = result.items[0].actions.find(a=>a.operation==='inbox.mark');
  await service.call(mark.operation,mark.args);
  assert.equal((await service.store.read()).inbox[0].read,true);
  await service.store.update(s=>{s.inbox.push({id:'orphan',jobId:'lost',kind:'audio-failed',detail:'失败',at:'2026-10-22T02:00:00Z',read:false});});
  const page=await service.call('activity.query',{limit:1});assert.ok(page.nextCursor);
  await assert.rejects(service.call('activity.query',{type:'notification',cursor:page.nextCursor}),{code:'activity-cursor-stale'});
});

test('activity draft actions use the existing authoring contract',async t=>{
  const {service}=await fixture(t);
  await service.store.update(s=>s.drafts.push({id:'draft',title:'草稿',cards:[]}));
  const result=await service.call('activity.query',{type:'draft'});
  assert.deepEqual(result.items[0].actions[0],{operation:'draft.publish.plan',args:{id:'draft'}});
});

test('legacy inventory/export preserves original branches, notes metadata and source text without migration',async t=>{
  const {service}=await fixture(t);
  await service.store.update(s=>{
    s.workflowSessions.push({id:'legacy',template:{title:'复杂流程',steps:[{id:'a',kind:'reading',next:'a'}]},history:[{text:'原始历史'}],records:{a:{content:'人工文字'}}});
    s.skeletons.push({id:'sk',title:'骨架',nodes:[{id:'n',text:'原始节点'}],scope:[]});
    s.notes.push({id:'note',title:'文章',cards:[],markdown:'完整正文',csdn:{url:'https://blog.csdn.net/example/article/details/123'}});
  });
  const before=await service.store.read();
  const inventory=await service.call('legacy.inventory');
  assert.equal(inventory.counts.workflow,1);assert.equal(inventory.counts.skeleton,1);
  const first=await service.call('legacy.inventory',{limit:1});
  assert.equal(first.items.length,1);assert.ok(first.nextCursor);
  const second=await service.call('legacy.inventory',{limit:1,cursor:first.nextCursor});
  assert.notEqual(second.items[0].id,first.items[0].id);
  const json=await service.call('legacy.export',{type:'workflow',id:'legacy',format:'json'});
  assert.deepEqual(JSON.parse(json.content),before.workflowSessions[0]);
  const md=await service.call('legacy.export',{type:'note',id:'note',format:'markdown'});
  assert.match(md.content,/完整正文/);assert.match(md.content,/blog.csdn.net/);
  assert.deepEqual(await service.store.read(),before);
});

test('activity only projects tasks and jobs bound to the current library',()=>{
  const state={inbox:[],drafts:[]}, root='D:\\private\\library-a';
  const board={columns:[{done:true,cardIds:['a']}],cards:{a:{id:'a',title:'当前库',studyRef:{root}},b:{id:'b',title:'其他库',studyRef:{root:'D:\\private\\library-b'}}}};
  const before=structuredClone(board);
  const result=activityQuery(state,[{id:'foreign',root:'D:\\private\\library-b'}],{includeTasks:true},{root,board});
  assert.deepEqual(result.items.map(x=>x.id),['a']);
  assert.equal(result.items[0].status,'done');
  assert.deepEqual(board,before);
});

test('new chat tools execute the declared domain operations',async t=>{
  const {root,service}=await fixture(t);
  await service.store.update(s=>s.sources.push({id:'source',title:'资料',text:'正文',courses:['课程']}));
  const courseId=(await service.call('course.list')).courses.find(c=>c.name==='课程').id;
  const core={resolveWorkspace:async()=>root,requestServices:async()=>({}),forLibrary:()=>service.runtime};
  for(const [id,operation,args] of [
    ['library','activity.query',{}],['library','legacy.inventory',{}],['library','learning.today.get',{}],
    ['learning-records','learning.records.query',{scope:{kind:'all'}}],
    ['curriculum','curriculum.get',{scope:{kind:'course',courseId}}],
    ['conversion','mineru.history.list',{}],
  ]) {
    const tool=domainTool(id,core); assert.ok(tool,id);
    assert.ok(tool.parameters.properties.operation.enum.includes(operation));
    assert.ok(await tool.execute({operation,...args},{}));
  }
  assert.ok(domainTool('learning-session',core).parameters.properties.operation.enum.includes('learning.session.start'));
});
