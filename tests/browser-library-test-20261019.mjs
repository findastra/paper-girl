import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';

// The app's bundler resolves extensionless TypeScript imports; mirror that resolution in Node.
registerHooks({resolve(specifier, context, nextResolve) {
  if (context.parentURL?.includes('/lib/browser-library.ts') && ['./publisher','./science'].includes(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}});

const filters = {topic:'Everything',period:'any',from:'2012',to:'2026',journal:'all',humans:false};
const record = n => ({pmcid:`PMC${1000+n}`,id:String(n),source:'MED',title:`Paper <i>${n}</i>`,pubYear:'2025',firstPublicationDate:'2025-04-10',journalTitle:'PLOS Biology'});
const summaryXml = `<article xmlns:xlink="http://www.w3.org/1999/xlink"><front><journal-meta><journal-title>PLOS Biology</journal-title></journal-meta><article-meta><permissions><license xlink:href="https://creativecommons.org/licenses/by/4.0/"/></permissions><abstract abstract-type="summary"><title>Author summary</title><p>Researchers compared plants under controlled conditions and found differences in leaf growth. The findings describe the tested conditions, but further research is needed to establish whether the results also apply to other environments.</p></abstract></article-meta></front></article>`;
const json = data => new Response(JSON.stringify(data), {headers:{'Content-Type':'application/json'}});
let moduleId = 0;

async function withLibrary(network, run, saved = {}) {
  const originals = Object.fromEntries(['fetch','window','location','localStorage'].map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const random = Math.random;
  const storage = new Map([['paper-girl:library:v1',JSON.stringify(saved)]]);
  try {
    globalThis.fetch = network;
    globalThis.window = globalThis;
    globalThis.location = {origin:'https://findastra.github.io'};
    globalThis.localStorage = {getItem:key=>storage.get(key) ?? null,setItem:(key,value)=>storage.set(key,value)};
    Math.random = () => 0.999;
    const {installBrowserLibrary} = await import(`../lib/browser-library.ts?test=${++moduleId}`);
    installBrowserLibrary();
    await run(() => JSON.parse(storage.get('paper-girl:library:v1')));
  } finally {
    Math.random = random;
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor);
      else delete globalThis[key];
    }
  }
}

const draw = (extra = {}) => fetch('/api/discover',{method:'POST',body:JSON.stringify({filters,...extra})});

test('small searches continue past nine and ninety candidates to a valid summary', async () => {
  const records = Array.from({length:100},(_,n)=>record(n));
  let checked = 0;
  await withLibrary(async input => {
    const url = new URL(input);
    if (url.pathname.endsWith('/search')) return json({hitCount:100,resultList:{result:url.searchParams.get('pageSize') === '1' ? [records[0]] : records}});
    checked++;
    return new Response(url.pathname.includes('/PMC1099/') ? summaryXml : '',{status:url.pathname.includes('/PMC1099/') ? 200 : 404});
  }, async () => {
    const response = await draw();
    assert.equal(response.status,200);
    assert.equal((await response.json()).paper.pmcid,'PMC1099');
    assert.equal(checked,100);
  });
});

test('large searches sample within actual publication dates, not the 1900 default', async () => {
  const windows = [];
  await withLibrary(async input => {
    const url = new URL(input);
    if (!url.pathname.endsWith('/search')) return new Response(summaryXml);
    if (url.searchParams.get('pageSize') === '1') return json({hitCount:1000,resultList:{result:[{...record(1),firstPublicationDate:url.searchParams.get('sort').endsWith('asc') ? '2012-10-15' : '2025-04-10'}]}});
    windows.push(url.searchParams.get('query').match(/FIRST_PDATE:\[([^ ]+) TO ([^\]]+)\]/).slice(1));
    return json({hitCount:1000,resultList:{result:[record(2)]}});
  }, async () => {
    assert.equal((await draw()).status,200);
    assert.equal(windows.length,1);
    assert.ok(windows[0][0] >= '2012-10-15' && windows[0][0] <= '2025-04-10');
  });
});

test('repeated date samples fall back to cursor pages and find an unread paper', async () => {
  const cursors = [];
  let samples = 0;
  await withLibrary(async input => {
    const url = new URL(input);
    if (!url.pathname.endsWith('/search')) return new Response(summaryXml);
    const size = url.searchParams.get('pageSize');
    if (size === '1') return json({hitCount:1000,resultList:{result:[record(1)]}});
    if (size === '25') {samples++;return json({hitCount:1000,resultList:{result:[record(1)]}});}
    const cursor = url.searchParams.get('cursorMark');
    cursors.push(cursor);
    assert.equal(url.searchParams.has('pageNumber'),false);
    return json({hitCount:1000,nextCursorMark:cursor === '*' ? 'second-page' : 'third-page',resultList:{result:[record(cursor === '*' ? 1 : 2)]}});
  }, async () => {
    const response = await draw();
    assert.equal(response.status,200);
    assert.equal((await response.json()).paper.pmcid,'PMC1002');
    assert.equal(samples,4);
    assert.deepEqual(cursors,['*','second-page']);
  }, {visits:['PMC1001']});
});

test('successive draws exclude previously shown, current, and explicitly excluded papers', async () => {
  const records = [record(1),record(2),record(3),record(4)];
  await withLibrary(async input => {
    const url = new URL(input);
    return url.pathname.endsWith('/search') ? json({hitCount:4,resultList:{result:records}}) : new Response(summaryXml);
  }, async readStore => {
    const first = await (await draw({current:'PMC1001',exclude:['PMC1002']})).json();
    assert.equal(first.paper.pmcid,'PMC1003');
    assert.equal(first.paper.title,'Paper 3');
    const second = await (await draw({current:'PMC1001',exclude:['PMC1002']})).json();
    assert.equal(second.paper.pmcid,'PMC1004');
    assert.deepEqual(readStore().visits,['PMC1003','PMC1004']);
    assert.equal(readStore().history.filter(item=>item.outcome === 'success').length,2);
  });
});

test('rate-limited summary fetch stays retryable and is not recorded as an unavailable paper', async () => {
  await withLibrary(async input => new URL(input).pathname.endsWith('/search')
    ? json({hitCount:1,resultList:{result:[record(1)]}})
    : new Response('',{status:429}), async readStore => {
      const response = await draw();
      assert.equal(response.status,429);
      assert.match((await response.json()).error,/busy.*try again/i);
      assert.equal(readStore().checked.PMC1001,undefined);
      assert.equal(readStore().history[0].outcome,'error');
    });
});

test('an empty unread sample does not claim the whole collection is exhausted', async () => {
  await withLibrary(async () => json({hitCount:1,resultList:{result:[record(1)]}}), async () => {
    const response = await draw();
    assert.equal(response.status,404);
    const {error} = await response.json();
    assert.match(error,/did not find an unread paper/i);
    assert.doesNotMatch(error,/seen all available/i);
  }, {visits:['PMC1001']});
});
