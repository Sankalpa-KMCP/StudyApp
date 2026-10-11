# Portable capacity and mutation cost

Capacity is defined over portable records: 64 settings and 25,000 total records.
Only `databaseGeneration` and `legacy-localstorage-migrated-v1` are excluded.
Unknown keys and `activeFocusSession` consume capacity. A maximum-size import
therefore may have 66 physical settings without being oversized. Input uniqueness,
known-value validation, file/text/byte limits, and transaction guarantees still apply.
Legacy imports supplying internal metadata use the same portable count definition;
their generation is replaced with the locally advanced generation, never trusted.

Ordinary guarded writes snapshot all seven tables inside their write transaction.
Within-limit writes execute their mutation callback once. Genuinely oversized
prospective states roll back and retry with before/after snapshots to enforce
non-worsening grandfathering. Callbacks on that path must remain retry-safe.

## Local browser measurements (2026-10-11)

Windows, Node 24.12.0/npm 11.6.2, headless Chromium 153.0.8010.12 (Playwright
revision 1243, noncanonical). These are diagnostics, not supported-toolchain or
cross-browser certification. A fresh isolated browser context navigated to a blank
document served from the local Vite origin; no application UI or real data mounted.
Domain modules were imported from Vite. Synthetic V4 imports used native IndexedDB
and Web Locks. One warm-up plus five sequential samples per operation; no throttling.

Workloads:

- Small: 20 short notes, one existing quickNotes setting (4,504 canonical bytes).
- Notes: 5,000 notes with 80-character bodies, 63 portable settings including
  quickNotes (1,447,771 bytes).
- Record boundary: 5,000 notes, 5,000 tasks, 5,000 events, 9,999 history rows,
  one quickNotes setting: 25,000 portable records (5,685,673 bytes).
- Byte boundary: one note with a 61 MiB ASCII body and one quickNotes setting
  (63,963,636 bytes). Updating it includes its large input write cost.

Each workload measured `getStudyData`, `serializeCanonicalBackup` on an already
read snapshot, `saveQuickNotes`, and `updateNote`. Repeated writes changed the note
title and quick-note text with stable sizes. Before/after canonical sizes matched.

Milliseconds, median (minimum–maximum), original versus final:

| Workload | Quick-note save before | After | Note update before | After |
|---|---:|---:|---:|---:|
| Small | 1.2 (1.1–2.1) | 1.3 (1.0–1.5) | 1.6 (1.2–2.6) | 1.4 (1.2–2.5) |
| 5,000 notes | 93.4 (91.7–101.3) | 33.1 (32.6–35.0) | 97.0 (95.7–104.2) | 32.8 (31.4–33.6) |
| 25,000 records | 384.4 (324.6–408.9) | 117.2 (112.1–132.3) | 773.0 (349.0–845.0) | 117.8 (114.2–122.2) |
| Near byte limit | 462.2 (424.3–519.1) | 160.8 (149.2–217.3) | 789.0 (712.7–846.7) | 379.7 (326.2–421.8) |

Final snapshot/serialization medians respectively: small 0.6/0.1 ms;
5,000 notes 29.0/2.9 ms; record boundary 99.4/11.3 ms;
byte boundary 75.1/86.3 ms. Original serialization medians were 0.0, 4.7,
28.1, and 288.4 ms. Timing and garbage collection varied across runs; these
samples support direction and local magnitude, not universal speedup ratios.

Count correction alone reduced the notes workload quick-save median to 36.7 ms
(35.8–39.0), by removing false rollback/retry. Other count-only samples were
variable. The remaining bounded optimization measures exact UTF-8 size using
32,768-code-unit chunks and a 96 KiB scratch buffer, preserving surrogate pairs.
An isolated 61 MiB encoding comparison (one warm-up, three samples) measured
full-buffer encoding 123.8–131.3 ms versus bounded encoding 39.5–40.0 ms.
An initial unbounded-slice encoding experiment was stopped for excessive runtime
and was not adopted.

The explicit output-buffer allocation falls from the full encoded byte size to
96 KiB for large strings. This is an implementation bound, **not measured peak
heap usage**: the database snapshot, full canonical JSON string, slice/engine
temporaries, and IndexedDB copies still exist. Small strings retain direct encoding.
No cache crosses transaction boundaries. Exact equivalence, Unicode boundaries,
canonical formatting, inclusive byte limits, and real oversized rollback are tested.

Full-database snapshot/serialization remains O(database size). Further removal
would require a separately reviewed design for exact accounting; persistent
counters, indexes, approximate sizes, or cross-transaction caches were not added.
## Reproducing the browser workload

Start `npm run dev -- --host 127.0.0.1 --port 5174` from the repository root.
Run the following as stdin to `node --input-type=module` (PowerShell here-string).
It uses installed local Playwright and a disposable context, not existing browser data.
Restart Vite between source revisions to avoid mixing modules from HMR epochs in
direct dynamic-import diagnostics. The executable path reflects this machine;
use an already installed suitable browser when reproducing elsewhere.

```js
import { chromium } from '@playwright/test';
const browser=await chromium.launch({executablePath:process.env.LOCALAPPDATA+'/ms-playwright/chromium-1243/chrome-win64/chrome.exe',headless:true});
const context=await browser.newContext(); const page=await context.newPage();
await page.route('**/capacity-benchmark',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Disposable capacity benchmark</title>'}));
await page.goto('http://127.0.0.1:5174/capacity-benchmark');
console.log('Browser',await browser.version());
console.log(JSON.stringify(await page.evaluate(async()=>{
globalThis.__APP_VERSION__='1.4.0'; const db=await import('/src/db/studyDb.ts'), guard=await import('/src/db/backupabilityGuard.ts'), quick=await import('/src/db/quickNotesService.ts'), notes=await import('/src/db/notesService.ts');
const stamp='2026-10-11T00:00:00.000Z', empty=()=>({subjects:[],tasks:[],notes:[],events:[],studySessions:[],goals:[],settings:[]});
const note=(i,body='text')=>({id:'n'+i,title:'Note',body,subjectId:'',tags:[],createdAt:stamp,updatedAt:stamp});
const stats=a=>{a.sort((a,b)=>a-b);return {median:a[Math.floor(a.length/2)],min:a[0],max:a.at(-1)}};
const out=[];
for(const [name,count,body,settings] of [['small',20,'text',1],['5000-notes',5000,'text'.repeat(20),63],['near-record-limit',5000,'text',1],['near-byte-limit',1,'x'.repeat(61*1024*1024),1]]){
const data=empty();data.notes=Array.from({length:count},(_,i)=>note(i,body));data.settings=Array.from({length:settings},(_,i)=>({key:i===0?'quickNotes':'setting'+i,value:i===0?['initial']:'v'}));
if(name==='near-record-limit'){
data.tasks=Array.from({length:5000},(_,i)=>({id:'t'+i,title:'Task',subjectId:'',dueDate:'',priority:'normal',status:'open',minutes:10,createdAt:stamp,updatedAt:stamp}));
data.events=Array.from({length:5000},(_,i)=>({id:'e'+i,title:'Event',subjectId:'',startAt:stamp,endAt:stamp,location:'',createdAt:stamp,updatedAt:stamp}));
data.studySessions=Array.from({length:9999},(_,i)=>({id:'s'+i,subjectId:'',minutes:10,note:'',startedAt:stamp,endedAt:stamp}));
}
await db.importStudyData(db.createStudyExportPayload(data));
const generation=(await db.studyDb.settings.get('databaseGeneration')).value, context={expectedGeneration:generation};
const results={name};
for(const kind of ['snapshot','serialization','quick','note']){
const times=[];for(let i=0;i<6;i++){
let snapshot;if(kind==='serialization')snapshot=await db.getStudyData();
const start=performance.now();
if(kind==='snapshot')await db.getStudyData();
if(kind==='serialization')guard.serializeCanonicalBackup(snapshot);
if(kind==='quick')await quick.saveQuickNotes('saved'+i,context);
if(kind==='note')await notes.updateNote('n0',{title:'Note'+i,body,subjectId:'',tags:[]},context);
if(i>0)times.push(performance.now()-start);
}results[kind]=stats(times);
}
const snapshot=await db.getStudyData();results.bytes=guard.serializeCanonicalBackup(snapshot).byteLength;results.physicalSettings=snapshot.settings.length;
out.push(results);
} return out;
}),null,2));await browser.close();
```
