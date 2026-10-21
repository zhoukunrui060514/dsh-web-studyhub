import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { StudyService } from '../../lib/service.js';
import { seedLibrary } from './perf-seed.mjs';

// Deterministic fixture, private homes only. Baseline contains an archived source tree, never a live library.
const baselineRoot=process.argv[2], out=resolve(process.argv[3]??'output/qa/backend-b7-perf');
if(!baselineRoot)throw new Error('Pass an archived baseline source directory');
const {StudyService:BaselineService}=await import(pathToFileURL(join(resolve(baselineRoot),'lib/service.js')));
const home=await mkdtemp(join(tmpdir(),'backend-perf-')), previous=process.env.DSH_HOME;
process.env.DSH_HOME=home;
const summary={fixture:{sources:160,decks:14,cardsPerDeck:30,runs:24,attempts:1200,courses:8,largeSources:4,largeSourceChars:30000},samples:15,results:{}};
const median=values=>values.toSorted((a,b)=>a-b)[Math.floor(values.length/2)];
try{
  for(const [name,Service] of [['baseline',BaselineService],['current',StudyService]]){
    const root=join(home,name);await seedLibrary(root,summary.fixture);const service=new Service(root);
    try{
      await service.call('snapshot',{compact:true});
      const before=JSON.stringify(await service.store.read()),times=[];let bytes;
      for(let i=0;i<summary.samples;i++){const start=performance.now();const value=await service.call('snapshot',{compact:true});times.push(performance.now()-start);bytes=Buffer.byteLength(JSON.stringify(value));}
      const result={snapshotMedianMs:median(times),snapshotBytes:bytes,domainWrites:before===JSON.stringify(await service.store.read())?0:'changed'};
      if(name==='current')for(const action of ['learning.records.query','learning.reinforcement.query','activity.query']){
        const args=action==='activity.query'?{}:{scope:{kind:'all'}}, samples=[];let value;
        for(let i=0;i<5;i++){const start=performance.now();value=await service.call(action,args);samples.push(performance.now()-start);}
        result[action]={medianMs:median(samples),items:value.items.length,total:value.total,bytes:Buffer.byteLength(JSON.stringify(value))};
      }
      summary.results[name]=result;
    }finally{await service.dispose();}
  }
  summary.delta={snapshotTimePercent:100*(summary.results.current.snapshotMedianMs/summary.results.baseline.snapshotMedianMs-1),snapshotBytesPercent:100*(summary.results.current.snapshotBytes/summary.results.baseline.snapshotBytes-1)};
  await mkdir(out,{recursive:true});await writeFile(join(out,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
}finally{if(previous===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=previous;await rm(home,{recursive:true,force:true});}
