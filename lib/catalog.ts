import { database } from '../db';
import { buildQuery, defaultFilters, journals, subjects, type Filters, type Paper } from './science';
import { API, libraryGet, eligible, fetchPublisherPaper, LibraryError, type RecordData } from './publisher';

type ArticleRow = {pmcid:string;title:string;journal:string;published:string;year:number;metadata:string;paper:string|null;state:string;checked_at:number|null};
type IndexRow = {query:string;cursor:string;total:number;scanned:number;complete:number;updated_at:number;lease_until:number};
export async function indexStatus() {
  const db=database();
  const [counts,state,events] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS indexed, SUM(state = 'ready') AS ready, SUM(state = 'unavailable') AS unavailable FROM articles").first<{indexed:number;ready:number;unavailable:number}>(),
    db.prepare('SELECT total, scanned, complete, updated_at FROM index_state WHERE id=1').first<IndexRow>(),
    db.prepare('SELECT COUNT(*) AS total FROM searches').first<{total:number}>(),
  ]);
  return {...counts,ready:counts?.ready || 0,total:state?.total || 0,scanned:state?.scanned || 0,complete:!!state?.complete,updatedAt:state?.updated_at || null,searches:events?.total || 0};
}
export async function syncIndex() {
  const db=database(),now=Date.now(),token=crypto.randomUUID();
  await db.prepare('INSERT OR IGNORE INTO index_state (id, query, cursor, total, scanned, complete, updated_at, lease_until) VALUES (1, ?, ?, 0, 0, 0, ?, 0)').bind(buildQuery(defaultFilters)+' sort_date:y','*',now).run();
  const state=await db.prepare('SELECT * FROM index_state WHERE id=1').first<IndexRow>();
  if(state?.complete) return indexStatus();
  const lock=await db.prepare('UPDATE index_state SET lease_until=?, lease_token=? WHERE id=1 AND lease_until < ?').bind(now+60000,token,now).run();
  if(!lock.meta.changes) return {...await indexStatus(),busy:true};
  try {
    const response=await libraryGet(`${API}/search?format=json&resultType=core&pageSize=1000&cursorMark=${encodeURIComponent(state!.cursor)}&query=${encodeURIComponent(state!.query)}`);
    if(!response) throw new LibraryError('The article index could not be reached.');
    const data=await response.json() as {hitCount:number;nextCursorMark?:string;resultList?:{result?:RecordData[]}};
    const raw=data.resultList?.result || [];
    const rows=raw.filter(eligible).map(r=>({pmcid:r.pmcid,title:(r.title || '').replace(/<[^>]*>/g,''),journal:r.journalInfo?.journal?.title || r.journalTitle || '',published:r.firstPublicationDate || `${r.pubYear}-01-01`,year:Number(r.pubYear),search_text:((r.title || '')+' '+(r.abstractText || '')).replace(/<[^>]*>/g,'').toLowerCase(),metadata:JSON.stringify({pmcid:r.pmcid,doi:r.doi || '',pmid:r.id,authors:r.authorString}),indexed_at:now}));
    for(let i=0;i<rows.length;i+=50){
      // A single JSON parameter avoids SQLite's bind limit, and keeps each D1 request bounded.
      await db.prepare(`INSERT INTO articles (pmcid,title,journal,published,year,search_text,metadata,indexed_at)
        SELECT json_extract(value,'$.pmcid'),json_extract(value,'$.title'),json_extract(value,'$.journal'),json_extract(value,'$.published'),json_extract(value,'$.year'),json_extract(value,'$.search_text'),json_extract(value,'$.metadata'),json_extract(value,'$.indexed_at') FROM json_each(?) WHERE true
        ON CONFLICT(pmcid) DO UPDATE SET title=excluded.title,journal=excluded.journal,published=excluded.published,year=excluded.year,search_text=excluded.search_text,metadata=excluded.metadata,indexed_at=excluded.indexed_at`).bind(JSON.stringify(rows.slice(i,i+50))).run();
    }
    const complete=!raw.length || !data.nextCursorMark || data.nextCursorMark===state!.cursor;
    await db.prepare('UPDATE index_state SET cursor=?, total=?, scanned=scanned+?, complete=?, updated_at=?, lease_until=0, lease_token=NULL WHERE id=1 AND lease_token=?').bind(data.nextCursorMark || state!.cursor,data.hitCount,raw.length,complete?1:0,Date.now(),token).run();
    return indexStatus();
  } finally {await db.prepare('UPDATE index_state SET lease_until=0, lease_token=NULL WHERE id=1 AND lease_token=?').bind(token).run()}
}
export function filterSql(filters: Filters) {
  const query=buildQuery(filters), dates=query.match(/FIRST_PDATE:\[([^ ]+) TO ([^\]]+)\]/)!;
  const clauses=['published >= ?','published <= ?'],values:(string|number)[]=[dates[1],dates[2]];
  if(filters.topic!=='Everything') {
    const terms=subjects[filters.topic].split(' OR ');
    clauses.push('('+terms.map(()=>"search_text LIKE ? ESCAPE '\\'").join(' OR ')+')');
    values.push(...terms.map(t=>`%${t.replace(/[_%\\]/g,'\\$&').toLowerCase()}%`));
  }
  if(filters.journal!=='all'){clauses.push('lower(journal)=?');values.push(journals[filters.journal].name.toLowerCase())}
  if(filters.humans)throw new Error('The human-only filter is not available in the shared index.');
  return {sql:clauses.join(' AND '),values};
}
export async function selectPaper(filters: Filters, reader: string, current: string, requestId: string, exclude: string[]) {
  const db=database();
  const previous=await db.prepare('SELECT pmcid,outcome,filters FROM searches WHERE id=? AND reader=?').bind(requestId,reader).first<{pmcid:string;outcome:string;filters:string}>();
  if(previous){
    if(previous.outcome==='success') {const found=await db.prepare('SELECT paper FROM articles WHERE pmcid=?').bind(previous.pmcid).first<{paper:string}>();return {paper:JSON.parse(found!.paper) as Paper,replayed:true}}
    throw new LibraryError('That search has already finished. Please start a new search.',409);
  }
  const {sql,values}=filterSql(filters);
  const deadline=AbortSignal.timeout(35000);
  const attempted:string[]=[];
  for(let round=0;round<5;round++) {
    deadline.throwIfAborted();
    const result=await db.prepare(`SELECT * FROM articles a WHERE ${sql} AND pmcid != ?
      AND pmcid NOT IN (SELECT value FROM json_each(?)) AND pmcid NOT IN (SELECT value FROM json_each(?))
      AND NOT EXISTS (SELECT 1 FROM visits v WHERE v.reader=? AND v.pmcid=a.pmcid)
      AND (state != 'unavailable' OR checked_at < ?)
      ORDER BY RANDOM() LIMIT 3`).bind(...values,current,JSON.stringify(exclude),JSON.stringify(attempted),reader,Date.now()-7*86400000).all<ArticleRow>();
    if(!result.results.length) {
      const progress=await indexStatus();
      if(!progress.complete && round<2){await syncIndex();continue}
      throw new LibraryError(progress.complete ? 'You have seen all available matches for these filters. Try another subject or a wider date range.' : 'This part of the library is still being indexed. Try again shortly or widen your filters.',404);
    }
    const candidates=await Promise.all(result.results.map(async row=>{
      attempted.push(row.pmcid);
      const paper=row.paper && row.checked_at && row.checked_at>Date.now()-86400000 ? JSON.parse(row.paper) as Paper : await fetchPublisherPaper(row.pmcid,deadline);
      await db.prepare('UPDATE articles SET paper=?, state=?, checked_at=? WHERE pmcid=?').bind(paper?JSON.stringify(paper):null,paper?'ready':'unavailable',Date.now(),row.pmcid).run();
      return paper;
    }));
    for(const paper of candidates.filter((p):p is Paper=>!!p)) {
      // The unique visit and event are one transaction. Parallel tabs cannot claim the same paper.
      try {await db.batch([
        db.prepare('INSERT INTO visits (reader,pmcid,created_at) VALUES (?,?,?)').bind(reader,paper.pmcid,Date.now()),
        db.prepare('INSERT INTO searches (id,reader,filters,pmcid,outcome,created_at) VALUES (?,?,?,?,?,?)').bind(requestId,reader,JSON.stringify(filters),paper.pmcid,'success',Date.now()),
      ]);return {paper,replayed:false}} catch(error){if(!String(error).includes('UNIQUE constraint'))throw error}
    }
  }
  throw new LibraryError('Those candidates did not have a usable publisher summary. Try another search; your current paper is safe.',404);
}
export async function logFailure(id:string,reader:string,filters:Filters,message:string,outcome='unavailable') {
  await database().prepare('INSERT OR IGNORE INTO searches (id,reader,filters,outcome,message,created_at) VALUES (?,?,?,?,?,?)').bind(id,reader,JSON.stringify(filters),outcome,message,Date.now()).run();
}
export async function catalogPage(query:string,offset:number,readyOnly:boolean) {
  const db=database(),pattern=`%${query.replace(/[_%\\]/g,'\\$&')}%`;
  const where=`(title LIKE ? ESCAPE '\\' OR journal LIKE ? ESCAPE '\\' OR pmcid LIKE ? ESCAPE '\\')${readyOnly?" AND state='ready'":''}`;
  const [records,count]=await Promise.all([db.prepare(`SELECT pmcid,title,journal,year,published,state,metadata FROM articles WHERE ${where} ORDER BY published DESC,pmcid DESC LIMIT 30 OFFSET ?`).bind(pattern,pattern,pattern,offset).all<ArticleRow>(),db.prepare(`SELECT COUNT(*) AS count FROM articles WHERE ${where}`).bind(pattern,pattern,pattern).first<{count:number}>()]);
  return {items:records.results.map(r=>({pmcid:r.pmcid,title:r.title,journal:r.journal,year:r.year,state:r.state,url:JSON.parse(r.metadata).doi?`https://doi.org/${encodeURI(JSON.parse(r.metadata).doi)}`:`https://europepmc.org/articles/${r.pmcid}`})),total:count?.count || 0,offset};
}
export async function historyPage(query:string,offset:number) {
  const pattern=`%${query.replace(/[_%\\]/g,'\\$&')}%`,db=database();
  const where="s.outcome != 'pending' AND (COALESCE(a.title,'') LIKE ? ESCAPE '\\' OR s.filters LIKE ? ESCAPE '\\')";
  const [rows,count]=await Promise.all([db.prepare(`SELECT s.id,s.filters,s.pmcid,s.outcome,s.message,s.created_at,a.title,a.journal FROM searches s LEFT JOIN articles a ON a.pmcid=s.pmcid WHERE ${where} ORDER BY s.created_at DESC,s.id DESC LIMIT 30 OFFSET ?`).bind(pattern,pattern,offset).all(),db.prepare(`SELECT COUNT(*) AS count FROM searches s LEFT JOIN articles a ON a.pmcid=s.pmcid WHERE ${where}`).bind(pattern,pattern).first<{count:number}>()]);
  return {items:rows.results.map(r=>({...r,filters:JSON.parse(r.filters as string)})),total:count?.count || 0,offset};
}
