import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { StudyService } from '../lib/service.js';
import { courseOutlineMaterial } from '../lib/course-outline-book.js';
import { groupSourcesByDocument } from '../lib/source-groups.js';

test('five-space API journey retains real answers and originals through backup/restore and library switch',async t=>{
  const home=await mkdtemp(join(tmpdir(),'backend-journey-'));
  const previous=process.env.DSH_HOME; process.env.DSH_HOME=home;
  const service=new StudyService(join(home,'library-a')), restored=new StudyService(join(home,'restored')), other=new StudyService(join(home,'library-b'));
  t.after(async()=>{await Promise.all([service.dispose(),restored.dispose(),other.dispose()]);if(previous===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=previous;await rm(home,{recursive:true,force:true});});
  const bytes=Buffer.from('# 循环\n\n心输出量等于每搏输出量乘以心率。\n');
  const imported=await service.call('materials.document.import',{filename:'循环.md',dataBase64:bytes.toString('base64')});
  const state=await service.store.read();
  const originals=state.sources.filter(s=>!s.generated);
  assert.ok(originals.length);
  await service.store.update(s=>{
    for(const source of s.sources)source.courses=['生理'];
    const anchors=groupSourcesByDocument(s.sources).map(d=>d.key);
    s.sources.push(courseOutlineMaterial({title:'生理大纲',course:'生理',fingerprint:'12345678',orderBasis:{codes:['numbering']},nodes:[{id:'circulation',title:'循环',anchors}],other:{anchors:[]},counts:{units:1,leftover:0,invalid:0,repeated:0}}));
    // Accepted bank fixture: generation quality is tested separately from the deterministic journey.
    s.decks.push({id:'deck',title:'循环题组',course:'生理',sourceIds:originals.map(x=>x.id),cards:[{id:'q',kind:'quiz',topic:'循环',prompt:'心输出量等于？',sourceIds:originals.map(x=>x.id),options:[{id:'A',text:'每搏量乘心率',correct:true},{id:'B',text:'每搏量除心率'}]}]});
    s.workflowSessions.push({id:'old',template:{title:'旧流程',steps:[{id:'a',next:'a'}]},history:[{text:'保留分支'}]});
  });
  const scope={kind:'course',courseId:(await service.call('course.list')).courses.find(c=>c.name==='生理').id};
  const curriculum=await service.call('curriculum.get',{scope});
  assert.equal(curriculum.nodes[0].id,'circulation');
  await service.call('curriculum.prepare',{scope,expectedRevision:curriculum.outlineRevision});
  let session=await service.call('learning.session.start',{scope,target:{kind:'topic',deckId:'deck',topic:'循环'},origin:'knowledge',requestId:'journey'});
  const change=(operation,extra={})=>service.call(`learning.session.${operation}`,{id:session.id,version:session.version,requestId:`${operation}-${session.version}`,...extra});
  for(const step of ['explain','retell']){
    session=await change('record',{step,content:step==='explain'?'以原文解释心输出量':'我能复述这个关系'});
    session=await change('advance');
  }
  const started=await change('practice.start');session=started.session;
  assert.equal((await service.call('learning.today.get',{scope})).primary.target.sessionId,session.id);
  await service.call('review.answer',{runId:started.run.id,cardId:'q',selected:['B']});
  assert.equal((await service.call('learning.reinforcement.query',{scope})).total,1);
  await service.call('review.move',{runId:started.run.id,direction:1});
  await service.call('review.answer',{runId:started.run.id,cardId:'q',selected:['A']});
  assert.equal((await service.call('learning.reinforcement.query',{scope})).total,1,'same-run recall does not award a second schedule');
  session=await change('advance');
  session=await change('record',{step:'summary',content:'下次检查乘除关系'});
  session=await change('advance');
  assert.equal(session.status,'completed');
  const records=await service.call('learning.records.query',{scope,type:'attempt'});
  assert.equal(records.total,2);assert.equal(records.items[0].links.sessionId,session.id);
  assert.notEqual((await service.call('learning.today.get',{scope})).primary.target?.runId,started.run.id);
  const backup=await service.call('export');
  await restored.call('restore',{state:JSON.parse(JSON.stringify(backup))});
  assert.equal((await restored.call('learning.session.get',{id:session.id})).status,'completed');
  assert.equal((await restored.call('learning.records.query',{scope,type:'attempt'})).total,2);
  const document=await restored.call('materials.document.get',{documentId:imported.documentId});
  assert.deepEqual(await readFile(document.preview.path),bytes);
  assert.match((await restored.call('legacy.export',{type:'workflow',id:'old'})).content,/保留分支/);
  assert.equal((await other.call('learning.records.query',{scope:{kind:'all'}})).total,0);
  assert.equal((await other.call('legacy.inventory')).total,0);
  await assert.rejects(other.call('learning.session.get',{id:session.id}));
});
