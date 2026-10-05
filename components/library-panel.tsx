"use client";
import {useEffect,useState} from 'react';
import {BookOpen,History,LoaderCircle,Search} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import type {Filters} from '@/lib/science';
import {staticEdition} from '@/lib/edition';
type Progress={indexed:number;ready:number;total:number;scanned:number;complete:boolean;updatedAt:number|null;searches:number};
type Entry={pmcid:string;title:string;journal:string;year?:number;state?:string;url?:string;id?:string;filters?:Filters;created_at?:number;outcome?:string;message?:string};
export function LibraryPanel({revision}:{revision:number}){
 const [progress,setProgress]=useState<Progress|null>(null),[indexError,setIndexError]=useState(''),[retry,setRetry]=useState(0);
 const [view,setView]=useState<'catalog'|'history'|null>(null),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[offset,setOffset]=useState(0),[ready,setReady]=useState(false),[data,setData]=useState<{items:Entry[];total:number}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();let disposed=false;
  async function update(){try{
   let response=await fetch('/api/index',{signal:controller.signal});let result=await response.json() as Progress & {error?:string;busy?:boolean};
   if(!response.ok)throw new Error(result.error);
   if(!disposed)setProgress(result);
   while(!result.complete&&!disposed){
    response=await fetch('/api/index',{method:'POST',signal:controller.signal});result=await response.json() as typeof result;
    if(!response.ok)throw new Error(result.error);
    if(!disposed)setProgress(result);
    await new Promise(resolve=>setTimeout(resolve,result.busy?2500:250));
   }
  }catch(e){if(!disposed)setIndexError(e instanceof Error?e.message:'Indexing paused. Please retry.')}}
  setIndexError('');update();return()=>{disposed=true;controller.abort()};
 },[retry]);
 useEffect(()=>{if(revision)fetch('/api/index').then(r=>r.json() as Promise<Progress & {error?:string}>).then(d=>{if(!d.error)setProgress(d)}).catch(()=>{})},[revision]);
 useEffect(()=>{
  if(!view)return;const controller=new AbortController();setLoading(true);setError('');
  fetch(`/api/${view}?q=${encodeURIComponent(search)}&offset=${offset}&ready=${ready?1:0}`,{signal:controller.signal}).then(async r=>{const d=await r.json() as {items:Entry[];total:number;error?:string};if(!r.ok)throw new Error(d.error);setData(d)}).catch(e=>{if(!controller.signal.aborted)setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[view,search,offset,ready,revision]);
 function open(next:'catalog'|'history'){setData(null);setQuery('');setSearch('');setOffset(0);setReady(false);setView(next)}
 return <section className="library" aria-label="Article index and shared history">
  <div className="library-links"><button onClick={()=>open('catalog')}><BookOpen size={18}/> Article index <span>{progress?.indexed?.toLocaleString() || '…'}</span></button><button onClick={()=>open('history')}><History size={18}/> {staticEdition?'Your search history':'Shared search history'} <span>{progress?.searches?.toLocaleString() || '0'}</span></button></div>
  <p className="library-note">{staticEdition?'Your searches stay in this browser: filters, time and results. Nothing about you is collected.':'Searches are shared anonymously: filters, time and results. No names or account details.'}</p>
  <p className="index-status" role="status">{progress?.complete?(staticEdition?`${progress.indexed.toLocaleString()} open-access articles across our six journals, searched live from Europe PMC`:`${progress.indexed.toLocaleString()} articles indexed across our six journals · ${progress.ready.toLocaleString()} summaries verified`):progress?`Indexing our journal collection: ${progress.scanned.toLocaleString()} of ${progress.total.toLocaleString()} records checked…`:'Connecting to the article library…'} {indexError&&<><span>{indexError}</span> <button onClick={()=>setRetry(n=>n+1)}>Resume indexing</button></>}</p>
  <Dialog open={view!==null} onOpenChange={v=>{if(!v)setView(null)}}><DialogContent className="library-dialog"><DialogTitle>{view==='catalog'?'The article index':staticEdition?'Your rabbit holes':'Everyone’s rabbit holes'}</DialogTitle><DialogDescription>{view==='catalog'?(staticEdition?'Paper Girl’s supported open-access journal collection, searched live from Europe PMC, newest first. Publisher summaries are verified as papers are discovered.':'The complete metadata index for Paper Girl’s supported open-access journal collection. Publisher summaries are verified as papers are discovered.'):(staticEdition?'Every search you make in this browser, with its filters, time and result. It stays on this device.':'Every search from now on, shared anonymously. Filter choices, results and searches with no match stay here across visits.')}</DialogDescription>
   <form className="library-search" onSubmit={e=>{e.preventDefault();setSearch(query);setOffset(0)}}><Input aria-label={view==='catalog'?'Search article index':'Search shared history'} placeholder={view==='catalog'?'Find a title, journal or PMCID…':'Find an article or subject…'} value={query} onChange={e=>setQuery(e.target.value)}/><button type="submit" aria-label="Search index"><Search size={19}/></button></form>
   {view==='catalog'&&!staticEdition&&<label className="ready-filter"><input type="checkbox" checked={ready} onChange={e=>{setReady(e.target.checked);setOffset(0)}}/> Verified summaries only</label>}
   <div className="library-results" aria-busy={loading}>{loading?<p className="library-empty"><LoaderCircle className="spin" size={20}/> Loading…</p>:error?<p role="alert">{error}</p>:!data?.items.length?<p className="library-empty">{search?'No matches. Try another title or subject.':view==='history'?(staticEdition?'Your first search will start your story.':'Your first search will start the shared story.'):'The index is being prepared. Close and reopen this view shortly.'}</p>:data.items.map(item=><article className="library-entry" key={item.id || item.pmcid}>
    {view==='history'&&<div className="entry-meta"><time dateTime={new Date(item.created_at!).toISOString()}>{new Date(item.created_at!).toLocaleString()}</time><span>{item.filters?.topic} · {item.filters?.period==='custom'?`${item.filters.from}–${item.filters.to}`:item.filters?.period==='recent'?'Past year':item.filters?.period==='older'?'5+ years ago':'Any year'}</span></div>}
    <h3>{item.title?<a href={item.url || `https://europepmc.org/articles/${item.pmcid}`} target="_blank" rel="noreferrer">{item.title}</a>:item.outcome==='no_match'?'No unread match':'Search interrupted'}</h3>
    <p>{item.journal}{item.year?` · ${item.year}`:''}{item.pmcid?` · ${item.pmcid}`:''}</p>
    {view==='catalog'?<span className="validation-state">{item.state==='ready'?'Publisher summary verified':item.state==='unavailable'?'Summary unavailable':'Summary not checked yet'}</span>:item.message?<p>{item.message}</p>:<span className="validation-state">New article discovered</span>}
   </article>)}</div>
   <div className="library-pagination"><button disabled={loading||offset===0} onClick={()=>setOffset(n=>Math.max(0,n-30))}>Previous</button><span>{data?.total?`${offset+1}–${Math.min(offset+30,data.total)} of ${data.total.toLocaleString()}`:'0 results'}</span><button disabled={loading||!data||offset+30>=data.total} onClick={()=>setOffset(n=>n+30)}>Next</button></div>
  </DialogContent></Dialog>
 </section>
}
