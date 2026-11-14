"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {flushSync} from 'react-dom';
import {CircleHelp,BookOpen,Info} from 'lucide-react';
import {Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {defaultFilters,subjects,discover,buildQuery,dayKey,hash,type Filters,type Paper} from '@/lib/science';
import seedData from '@/lib/data/seeds.json';
import editorialData from '@/lib/data/editorial-20261019.json';
import {formatArticleSummary,ARTICLE_SECTION_LABELS} from '@/lib/article-summary-20261019';
import {MyDeck,DeckCard,cards as deckCards} from '@/components/my-deck-20261114';
import {GoldSurface} from '@/components/gold-surface-20261114';
// The page's accent is always gold, whatever card is drawn (Astra, 2026-11-14), so the line beside "Why it matters"
// and the other accents stay gold.
/**
 * "Papermon" as a chunky trading-card-game word (Astra, 2026-11-14: like a monster-card game's logo, kept gold, with
 * no black outline): a big first letter, the rest riding a gentle arch, in the gold cards' own shining gold, with a
 * deep gold edge and a trademark sign.
 */
const WORD='Papermon';
function PapermonWord(){
 return <strong className="pm-word" aria-label="Papermon">{[...WORD].map((ch,i)=>{const t=(i-1)/(WORD.length-2),lift=i===0?0:Math.sin(Math.PI*t)*.12;
  return <b key={i} aria-hidden="true" style={{verticalAlign:`${lift.toFixed(3)}em`}} className={i===0?'big':''}>{ch}</b>})}<sup className="pm-tm" aria-label="trademark">™</sup></strong>;
}
/** "Read the write-up" (Astra, 2026-11-14): scroll so the page starts just below Papermon and its tagline, with the
 *  panel's whole gold edge showing above the paper and its card. */
function toPaper(){const t=document.querySelector('.pm-tagline')||document.querySelector('header');const y=t?t.getBoundingClientRect().bottom+window.scrollY+2:0;window.scrollTo({top:Math.max(0,y),behavior:'smooth'})}
const PAGE_GOLD={['--accent' as string]:'#d9a53f',['--sub' as string]:'#c9952e'};
import {AstraFooter} from '@/components/astra-footer-20261114';
import {DrawPicker,TYPE_ITEMS,LEVEL_ITEMS,allowedGroups,groupOfYear,groupRange,weightedPick} from '@/components/draw-bar-20261114';
import {HowToPlay} from '@/components/how-to-play-20261114';
import {MethodsCredits} from '@/components/methods-credits-20261114';
import {base,staticEdition} from '@/lib/edition';
const seeds=seedData as Paper[];
const editorials=editorialData as Record<string,Partial<Paper>>;
const initial:Paper={...(seeds.find(p=>p.pmcid==='PMC13553068')||seeds[0]),discipline:'Biology',headline:'A yak’s best friend might be a tiny gardener.',hook:'Pika are often treated as pests. But in this grassland study, having some around helped yaks gain more weight.',explanation:'Think of pika as tiny gardeners with a very particular weeding habit. They clip a poisonous plant, leaving more room for grasses that yaks can eat. In summer field experiments on the Qinghai–Tibetan Plateau, yaks gained up to 42% more weight where pika were present. The benefit was strongest at moderate pika numbers. Too many pika became competitors for the same food.',importance:'Removing every small herbivore could backfire. Managing the balance between species may sometimes help livestock more than eliminating an apparent pest.',caveat:'This was one grassland system studied in summer. It does not show the same benefit in every season, landscape, or herd.'};
// Bibliography entry in MLA 9th edition (EasyBib's default style). Starter cards carry an exact entry from Crossref
// (`cite` in the card data); other papers get one built from what Europe PMC gives (author initials only).
function mla(p:Paper){
 const names=(p.authors||'').replace(/\.$/,'').split(/,\s*/).filter(Boolean).map(n=>{const m=n.trim().match(/^(.*\S)\s+([A-Z]+)$/);return m?{last:m[1],init:m[2].split('').join('. ')+'.'}:{last:n.trim(),init:''}});
 const who=!names.length?'':names.length===1?`${names[0].last}, ${names[0].init}`:names.length===2?`${names[0].last}, ${names[0].init}, and ${names[1].init} ${names[1].last}`:`${names[0].last}, ${names[0].init}, et al`;
 const title=p.title.replace(/\.$/,'');
 return `${who?who.replace(/\.?$/,'. '):''}“${title}.” *${p.journal}*, ${p.year}, ${p.doi?`https://doi.org/${p.doi}`:p.articleUrl}.`;
}
// *...* is italic; the web address is a link.
function citation(t:string){return t.split(/(\*[^*]+\*|https?:\/\/\S+?(?=\.?$))/).map((s,i)=>s.startsWith('*')?<i key={i}>{s.slice(1,-1)}</i>:/^https?:/.test(s)?<a key={i} href={s} target="_blank" rel="noreferrer">{s}</a>:s)}
function dailyPick(day:string):Paper{const chosen=seeds[hash(day)%seeds.length];return {...chosen,...editorials[chosen.pmcid]}}
// Card of the day (Astra, 2026-11-14): today's paper is one that has a card, so the card can sit beside its full
// write-up. Until Paper Patty makes cards for every paper, it rotates through the cards that exist.
function todaysPaper(day:string):Paper{const c=deckCards[hash('card:'+day)%deckCards.length],s=seeds.find(x=>x.pmcid===c.pmcid);return s?{...s,...editorials[s.pmcid]}:dailyPick(day)}
export default function Home(){
 // The static edition renders only in the browser, so it shows today's card before the first paint.
 const [filters,setFilters]=useState<Filters>(defaultFilters),[paper,setPaper]=useState<Paper>(()=>staticEdition?todaysPaper(dayKey()):initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [drawType,setDrawType]=useState(0),[drawLevel,setDrawLevel]=useState(0),[drawYear,setDrawYear]=useState(0),[spinning,setSpinning]=useState(false),[drawStatus,setDrawStatus]=useState('');
 const seen=useRef(new Set<string>([initial.pmcid])),working=useRef(false),controller=useRef<AbortController|null>(null),editorial=useRef(editorials);
 useEffect(()=>{const pick=todaysPaper(dayKey());setPaper(pick);seen.current.add(pick.pmcid);return()=>controller.current?.abort()},[]);
 async function shuffle(override?:Filters){if(working.current)throw new Error('Already finding a paper.');const selected=override||filters;try{buildQuery(selected)}catch(e){setError((e as Error).message);throw e}working.current=true;setBusy(true);setError('');const ctl=new AbortController();controller.current=ctl;try{const result=await discover(selected,seen.current,ctl.signal,paper.pmcid);const next={...result.paper,...editorial.current[result.paper.pmcid]};seen.current.add(next.pmcid);flushSync(()=>{setPaper(next);setFilters(selected)});return {pmcid:next.pmcid,title:next.title,source:next.articleUrl}}catch(e){const message=e instanceof Error?e.message:'Please try again.';setError(/timeout/i.test(message)?'The journal library is taking a little too long. Try again in a moment.':message);throw e}finally{working.current=false;setBusy(false)}}
 const actions=useRef({shuffle,filters});actions.current={shuffle,filters};
 useEffect(()=>{const context=(document as any).modelContext;if(!context?.registerTool)return;const life=new AbortController();try{Promise.resolve(context.registerTool({name:'discover_scientific_paper',title:'Discover a scientific paper',description:'Shuffle an unread scientific article and display its publisher explanation on Papermon.',inputSchema:{type:'object',properties:{subject:{type:'string',enum:Object.keys(subjects)},period:{type:'string',enum:['any','recent','older','custom']},from:{type:'string'},to:{type:'string'}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},async execute(input:any){if(!input||typeof input!=='object'||Array.isArray(input)||Object.entries(input).some(([k,v])=>!['subject','period','from','to'].includes(k)||typeof v!=='string'))throw new Error('Invalid filters.');const f={...actions.current.filters,...(input.subject?{topic:input.subject}:{}),...(input.period?{period:input.period}:{}),...(input.from?{from:input.from}:{}),...(input.to?{to:input.to}:{})};buildQuery(f);return actions.current.shuffle(f)}},{signal:life.signal})).catch(()=>{})}catch{}return()=>life.abort()},[]);
 const summary=formatArticleSummary(paper);const p=paper.summaryParagraphs;
 const paperCard=deckCards.find(c=>c.pmcid===paper.pmcid);
 // Draw a card (Astra, 2026-11-14): pick a card of that type and difficulty from the library; when none exists yet,
 // look up a real paper of that type instead (Paper Patty will make its card later).
 function drawFromReels(){setSpinning(true);setTimeout(()=>setSpinning(false),650);
  drawCard(TYPE_ITEMS[drawType].key,Number(LEVEL_ITEMS[drawLevel].key),drawYear)}
 // Age odds (Astra, 2026-11-14): pick an age group by its odds among the groups that have a matching card, then a
 // card in it. With no matching card, a real paper from an age group picked by the same odds.
 function drawCard(type:string,level:number,yearChoice:number){
  const groups=allowedGroups(yearChoice);
  const pool=deckCards.filter(c=>(!type||c.subject===type)&&(!level||c.lv===level)&&c.pmcid!==paper.pmcid);
  const filled=groups.map(g=>({g,cards:pool.filter(c=>!!c.published&&groupOfYear(+c.published.slice(0,4))===g)})).filter(x=>x.cards.length);
  if(filled.length){const {cards}=weightedPick(filled,x=>x.g.odds),c=cards[Math.floor(Math.random()*cards.length)],s=seeds.find(x=>x.pmcid===c.pmcid);
   if(s){setPaper({...s,...editorials[s.pmcid]});setError('');setDrawStatus(`You drew ${c.name}.`);return}}
  const g=weightedPick(groups,x=>x.odds),years=groupRange(g);
  setDrawStatus(`No ${type||''} card${level?` at reading difficulty ${level}`:''}${yearChoice?` from ${yearChoice===1?'this year':'past years'}`:''} in the library yet, so here is a real paper from ${g.label} to read. Paper Patty will make its card.`.replace('No  card','No card'));
  shuffle({...filters,topic:type||'Everything',period:'custom',from:String(years.from),to:String(years.to)}).catch(()=>{});
 }
 // The paper's sections can hold several paragraphs, split on a blank line.
 const paras=(t:string)=>t.split(/\n\s*\n/).map((x,i)=><p key={i}>{x}</p>);
 // The "More information" pop-up: where the write-up comes from and the paper's full source details.
 const moreInfo=<div className="source-dialog-copy more-info"><p>{summary.attribution}</p><p>{summary.sourceNote}</p>{paper.caveat&&<p><b>The small print:</b> {paper.caveat}</p>}<h3>{paper.title}</h3><p>{paper.authors}</p><p>Published {paper.publicationDate} · DOI {paper.doi||'not supplied'}</p><p>{paper.copyright||paper.authors} · <a href={paper.licenseUrl} target="_blank" rel="noreferrer">Creative Commons attribution license</a></p><details><summary>Full publisher explanation</summary>{p.map((t,i)=><p key={i}>{t}</p>)}</details><p><a href={paper.fullTextUrl} target="_blank" rel="noreferrer">Full text at Europe PMC</a> · <a href={paper.articleUrl} target="_blank" rel="noreferrer">Original article</a></p></div>;
 const popup=(label:ReactNode,title:string,body:ReactNode,description?:string)=><Dialog><DialogTrigger asChild><button type="button" className="pick-more">{label}</button></DialogTrigger><DialogContent className="source-dialog"><DialogTitle>{title}</DialogTitle>{description&&<DialogDescription>{description}</DialogDescription>}{body}</DialogContent></Dialog>;
 return <div className="site deck-mode"><header><a className="brand" href={base}><PapermonWord/></a><p className="pm-tagline"><span>Each trading card represents a different scientific article.</span><span>The more you collect, the smarter you get!</span></p></header>
 <main><div className="cotd-box" style={PAGE_GOLD}><article className="paper-card" aria-busy={busy}><div className="paper-copy" key={paper.pmcid}><div className="paper-sheet-wrap"><div className="paper-sheet"><span className="section-label paper-kicker"><span>00</span> SCIENTIFIC ARTICLE WRITE-UP</span><h1 className={((paper.headline||paper.title).length>95)?'long-title':''}>{paper.headline||paper.title.replace(/\.$/,'')}</h1>
 <div className="story-section hook"><span className="section-label"><span>01</span> {ARTICLE_SECTION_LABELS[0]}</span>{paperCard?.paper?.hook?paras(paperCard.paper.hook):<p>{summary.hook}</p>}</div><div className="story-section"><span className="section-label"><span>02</span> {paperCard?'WHAT THEY FOUND':ARTICLE_SECTION_LABELS[1]}</span>{paperCard?.paper?.found?paras(paperCard.paper.found):<p>{summary.explanation}</p>}</div><div className="story-section significance"><span className="section-label"><span>03</span> {ARTICLE_SECTION_LABELS[2]}</span>{/* The side line runs only beside the body (Astra, 2026-11-14) */}<div className="matters-body">{paperCard?.paper?.matters?paras(paperCard.paper.matters):<p>{summary.importance}</p>}</div></div>
 {/* 04 Bibliography (Astra, 2026-11-14): only the paper cited exactly as you would cite it (MLA 9th edition,
     EasyBib's default style). Nothing after it on the paper; the study's small print is in More information. */}
 <div className="story-section paper-bib"><span className="section-label"><span>04</span> BIBLIOGRAPHY</span>
  <p className="bib-entry">{citation(paperCard?.cite||mla(paper))}</p></div>
</div></div></div>
 <aside className="cotd-card" aria-label="Today's card">{paperCard?<DeckCard card={paperCard} onPick={()=>{(document.activeElement as HTMLElement|null)?.blur?.();toPaper()}}/>:<div className="cotd-nocard"><p>Paper Patty hasn’t made a card for this paper yet.</p></div>}
  {/* The little motto under the card, like the old "Stay curious, sweet thing" note: every card makes you a bit smarter. */}
  <div className="cotd-below">
  <DrawPicker busy={busy} type={drawType} level={drawLevel} year={drawYear} onType={setDrawType} onLevel={setDrawLevel} onYear={setDrawYear} onDraw={drawFromReels} status={error||drawStatus}>
   {/* Every link is a button here, under the draw buttons, not on the paper (Astra, 2026-11-14) */}
   {popup(<><CircleHelp size={16} aria-hidden="true"/>Rules</>,'Rules',<HowToPlay/>,'Collect real science, one card at a time.')}
   {/* Was "Where the science comes from" (Astra, 2026-11-14: "game design methodology and credits or something") */}
   {popup(<><BookOpen size={16} aria-hidden="true"/>Methods & Credits</>,'Methods & Credits',<MethodsCredits/>,'How Papermon turns real research into cards.')}
   {popup(<><Info size={16} aria-hidden="true"/>More Information</>,'More about this paper',moreInfo)}
  </DrawPicker></div></aside></article>
 </div>
 <GoldSurface/><MyDeck onPick={c=>{const s=seeds.find(x=>x.pmcid===c.pmcid);if(!s)return;setPaper({...s,...editorials[s.pmcid]});setError('');setDrawStatus('');(document.activeElement as HTMLElement|null)?.blur?.();setTimeout(()=>requestAnimationFrame(toPaper),60)}}/>
 <AstraFooter/>
 </main></div>
}
