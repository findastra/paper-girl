"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {flushSync} from 'react-dom';
import {Sparkles,Shuffle,Sun,BookOpen,Leaf,FlaskConical,Sigma,Atom,Brain,Globe2,LoaderCircle,SlidersHorizontal,X,Info,RotateCcw,Plus,Minus,Check} from 'lucide-react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {defaultFilters,subjects,discover,buildQuery,dayKey,hash,type Filters,type Paper} from '@/lib/science';
import seedData from '@/lib/data/seeds.json';
import editorialData from '@/lib/data/editorial-20261019.json';
import {formatArticleSummary,ARTICLE_SECTION_LABELS} from '@/lib/article-summary-20261019';
import {LibraryPanel} from '@/components/library-panel';
import {MyDeck,DeckCard,cards as deckCards} from '@/components/my-deck-20261114';
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
const PAGE_GOLD={['--accent' as string]:'#d9a53f',['--sub' as string]:'#c9952e'};
import {AstraFooter} from '@/components/astra-footer-20261114';
import {DrawPicker,TYPE_ITEMS,LEVEL_ITEMS,allowedGroups,groupOfYear,groupRange,weightedPick} from '@/components/draw-bar-20261114';
import {HowToPlay} from '@/components/how-to-play-20261114';
import {base,staticEdition} from '@/lib/edition';
const seeds=seedData as Paper[];
const editorials=editorialData as Record<string,Partial<Paper>>;
const subjectsUI=[{name:'Everything',icon:Sparkles},{name:'Biology',icon:Leaf},{name:'Chemistry',icon:FlaskConical},{name:'Math',icon:Sigma},{name:'Physics',icon:Atom},{name:'Psychology',icon:Brain},{name:'Earth science',icon:Globe2}];
// WebP copies at 720 px (about 90 KB each) instead of the 2-2.7 MB PNG originals, so phones load the page quickly.
const artworks=[{file:'ecology-friends-20261113.webp',alt:'A cheerful plant and planet Earth sharing a microscope'},{file:'curious-brain-20261113.webp',alt:'A curious cartoon brain wearing star glasses and holding a magnifying glass'},{file:'cosmic-curiosity-20261113.webp',alt:'A smiling pink planet beside a little robot astronaut'}];
const captions=['Small things. Big ideas.','A little food for thought.','Wonder looks good on you.','Follow the rabbit hole.'];
const initial:Paper={...(seeds.find(p=>p.pmcid==='PMC13553068')||seeds[0]),discipline:'Biology',headline:'A yak’s best friend might be a tiny gardener.',hook:'Pika are often treated as pests. But in this grassland study, having some around helped yaks gain more weight.',explanation:'Think of pika as tiny gardeners with a very particular weeding habit. They clip a poisonous plant, leaving more room for grasses that yaks can eat. In summer field experiments on the Qinghai–Tibetan Plateau, yaks gained up to 42% more weight where pika were present. The benefit was strongest at moderate pika numbers. Too many pika became competitors for the same food.',importance:'Removing every small herbivore could backfire. Managing the balance between species may sometimes help livestock more than eliminating an apparent pest.',caveat:'This was one grassland system studied in summer. It does not show the same benefit in every season, landscape, or herd.'};
// The static edition renders only in the browser, so it can pick today's paper before the first paint. Without this,
// the pika card flashed for a moment and the date was blank before today's paper replaced it.
const longDate=(d:string)=>new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
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
export default function Home(){
 const [filters,setFilters]=useState<Filters>(defaultFilters),[paper,setPaper]=useState<Paper>(()=>staticEdition?dailyPick(dayKey()):initial),[daily,setDaily]=useState(true),[advanced,setAdvanced]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[art,setArt]=useState(0),[caption,setCaption]=useState(0),[date,setDate]=useState(()=>staticEdition?dayKey():''),[reads,setReads]=useState(0),[sourceOpen,setSourceOpen]=useState(false);
 // The card site is the normal page; ?classic shows the old one.
 const [showDeck,setShowDeck]=useState(false),[drawType,setDrawType]=useState(0),[drawLevel,setDrawLevel]=useState(0),[drawYear,setDrawYear]=useState(0),[spinning,setSpinning]=useState(false),[drawStatus,setDrawStatus]=useState('');
 // Card of the day (Astra, 2026-11-14): in deck mode today's paper is one that has a card, so the card can sit beside
 // its full write-up. Until Paper Patty makes cards for every paper, it rotates through the cards that exist.
 function cardOfTheDay(day:string):Paper|null{const c=deckCards[hash('card:'+day)%deckCards.length],s=seeds.find(x=>x.pmcid===c.pmcid);return s?{...s,...editorials[s.pmcid]}:null}
 useEffect(()=>{setShowDeck(!new URLSearchParams(window.location.search).has('classic'))},[]);
 const seen=useRef(new Set<string>([initial.pmcid])),working=useRef(false),controller=useRef<AbortController|null>(null),dailyPaper=useRef(initial),editorial=useRef(editorials);
 useEffect(()=>{const day=dayKey();setDate(day);const pick=(!new URLSearchParams(window.location.search).has('classic')&&cardOfTheDay(day))||dailyPick(day);dailyPaper.current=pick;setPaper(pick);seen.current.add(pick.pmcid);return()=>controller.current?.abort()},[]);
 function change(values:Partial<Filters>){setFilters(f=>({...f,...values}));setError('')}
 function remix(){setArt(i=>(i+1+Math.floor(Math.random()*2))%artworks.length);setCaption(i=>(i+1)%captions.length)}
 async function shuffle(override?:Filters){if(working.current)throw new Error('Already finding a paper.');const selected=override||filters;try{buildQuery(selected)}catch(e){setError((e as Error).message);throw e}working.current=true;setBusy(true);setError('');setStatus('Looking for your next rabbit hole…');const ctl=new AbortController();controller.current=ctl;try{const result=await discover(selected,seen.current,ctl.signal,paper.pmcid);const next={...result.paper,...editorial.current[result.paper.pmcid]};seen.current.add(next.pmcid);flushSync(()=>{setPaper(next);setFilters(selected);setDaily(false);setReads(n=>n+1);setStatus('New paper, new perspective.');setSourceOpen(false);remix()});return {pmcid:next.pmcid,title:next.title,source:next.articleUrl}}catch(e){const message=e instanceof Error?e.message:'Please try again.';setError(/timeout/i.test(message)?'The journal library is taking a little too long. Try again in a moment.':message);setStatus('');throw e}finally{working.current=false;setBusy(false)}}
 function showDaily(){if(busy)return;setPaper(dailyPaper.current);setDaily(true);setError('');setStatus('Today’s pick is back.');setSourceOpen(false)}
 const actions=useRef({shuffle,filters});actions.current={shuffle,filters};
 useEffect(()=>{const context=(document as any).modelContext;if(!context?.registerTool)return;const life=new AbortController();try{Promise.resolve(context.registerTool({name:'discover_scientific_paper',title:'Discover a scientific paper',description:'Shuffle an unread scientific article and display its publisher explanation on Paper Girl.',inputSchema:{type:'object',properties:{subject:{type:'string',enum:Object.keys(subjects)},period:{type:'string',enum:['any','recent','older','custom']},from:{type:'string'},to:{type:'string'}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},async execute(input:any){if(!input||typeof input!=='object'||Array.isArray(input)||Object.entries(input).some(([k,v])=>!['subject','period','from','to'].includes(k)||typeof v!=='string'))throw new Error('Invalid filters.');const f={...actions.current.filters,...(input.subject?{topic:input.subject}:{}),...(input.period?{period:input.period}:{}),...(input.from?{from:input.from}:{}),...(input.to?{to:input.to}:{})};buildQuery(f);return actions.current.shuffle(f)}},{signal:life.signal})).catch(()=>{})}catch{}return()=>life.abort()},[]);
 const summary=formatArticleSummary(paper);const p=paper.summaryParagraphs;
 const topic=paper.discipline||paper.topic||'Science';const wordCount=summary.wordCount;
 const paperCard=showDeck?deckCards.find(c=>c.pmcid===paper.pmcid):undefined;
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
   if(s){setPaper({...s,...editorials[s.pmcid]});setDaily(false);setSourceOpen(false);setError('');setDrawStatus(`You drew ${c.name}.`);return}}
  const g=weightedPick(groups,x=>x.odds),years=groupRange(g);
  setDrawStatus(`No ${type||''} card${level?` at reading difficulty ${level}`:''}${yearChoice?` from ${yearChoice===1?'this year':'past years'}`:''} in the library yet, so here is a real paper from ${g.label} to read. Paper Patty will make its card.`.replace('No  card','No card'));
  shuffle({...filters,topic:type||'Everything',period:'custom',from:String(years.from),to:String(years.to)}).catch(()=>{});
 }
 // The paper's sections can hold several paragraphs, split on a blank line.
 const paras=(t:string)=>t.split(/\n\s*\n/).map((x,i)=><p key={i}>{x}</p>);
 const scienceDialog=(trigger:ReactNode)=><Dialog><DialogTrigger asChild>{trigger}</DialogTrigger><DialogContent className="source-dialog"><DialogTitle>The science behind Paper Girl</DialogTitle><DialogDescription>Clear explanations. Real sources. No subscriptions.</DialogDescription><div className="source-dialog-copy"><h3>Our journal shelf</h3><p>Live discovery searches <a href="https://europepmc.org/RestfulWebService" target="_blank" rel="noreferrer">Europe PMC</a> for open-access research in <a href="https://elifesciences.org/" target="_blank" rel="noreferrer">eLife</a>, PLOS Biology, PLOS Genetics, PLOS Computational Biology, PLOS Pathogens and PLOS Neglected Tropical Diseases. Original papers open on their journal websites.</p><h3>Simple subjects, honest coverage</h3><p>Biology and health are our strongest areas. Chemistry includes biochemistry; Math includes mathematical modeling; Physics includes biological physics. Earth science covers ecosystems, climate and fossils. Subject filters match titles and abstracts, so topics may overlap. This library does not cover every branch of science.</p><h3>Words and metaphors</h3><p>Daily picks rotate through a prepared collection with edited plain-English explanations. We use metaphors only where they fit the mechanism, keep the study’s actual scope, and include a specific limitation. Live papers use selected whole sentences from the publisher’s digest or author summary in the same three-part format. The full explanation remains under Source details. Some publisher text is more technical. We do not invent a metaphor or conclusion for it.</p><h3>What we check</h3><p>Live finds must have an accessible publisher summary and a CC BY license. We skip reviews, preprints and known retraction or concern notices present in the index. These checks are not a guarantee that a study’s conclusion is correct. One study is one piece of evidence.</p><h3>Keep exploring, for free</h3><p>{staticEdition?'The article index searches the supported open-access collection live. Summaries are checked when selected. Your browser remembers the articles you have read, so you will not see repeats; clearing this site’s data starts a new reading history. Your searches are saved in this browser only, with their filters, time and outcome. Nothing about you is sent anywhere: the only thing that leaves your device is the search itself, sent to Europe PMC. Narrow filters can run out; widen them to keep exploring.':'The article index covers the supported open-access collection. Summaries are checked when selected. An anonymous browser cookie remembers articles you have read across visits; clearing cookies starts a new reading history. Every search is saved in the shared history with its filters, time and outcome. Names, emails and account IDs are not stored. Narrow filters can run out; widen them to keep exploring.'}</p><p>Daily picks were edited October 19, 2026. The cartoon button remixes three original illustrations, not scientific diagrams. There is no paid AI service, subscription, or payment collection.</p></div></DialogContent></Dialog>;
 const scienceFooter=<footer><span>Made for curious minds. Always free.</span>{scienceDialog(<button>Where the science comes from</button>)}</footer>;
 // The "More information" pop-up: where the write-up comes from and the paper's full source details.
 const moreInfo=<div className="source-dialog-copy more-info"><p>{summary.attribution}</p><p>{summary.sourceNote}</p>{paper.caveat&&<p><b>The small print:</b> {paper.caveat}</p>}<h3>{paper.title}</h3><p>{paper.authors}</p><p>Published {paper.publicationDate} · DOI {paper.doi||'not supplied'}</p><p>{paper.copyright||paper.authors} · <a href={paper.licenseUrl} target="_blank" rel="noreferrer">Creative Commons attribution license</a></p><details><summary>Full publisher explanation</summary>{p.map((t,i)=><p key={i}>{t}</p>)}</details><p><a href={paper.fullTextUrl} target="_blank" rel="noreferrer">Full text at Europe PMC</a> · <a href={paper.articleUrl} target="_blank" rel="noreferrer">Original article</a></p></div>;
 const popup=(label:string,title:string,body:ReactNode,description?:string)=><Dialog><DialogTrigger asChild><button type="button" className="pick-more">{label}</button></DialogTrigger><DialogContent className="source-dialog"><DialogTitle>{title}</DialogTitle>{description&&<DialogDescription>{description}</DialogDescription>}{body}</DialogContent></Dialog>;
 const researchDetails=sourceOpen&&<div id="research-details" className="research-details"><h2>{paper.title}</h2><p>{paper.authors}</p><p>Published {paper.publicationDate} · DOI {paper.doi||'not supplied'}</p><p>{paper.copyright||paper.authors} · <a href={paper.licenseUrl} target="_blank" rel="noreferrer">Creative Commons attribution license</a></p><p>{summary.sourceNote}</p><details><summary>Full publisher explanation</summary>{p.map((t,i)=><p key={i}>{t}</p>)}</details><a href={paper.fullTextUrl} target="_blank" rel="noreferrer">Full text at Europe PMC</a></div>;
 return <div className={showDeck?'site deck-mode':'site'}><header><a className="brand" href={base}>{showDeck&&<img className="brand-logo" src={base+'papermon-logo-20261114.svg'} alt="" width={64} height={64}/>}{showDeck?<PapermonWord/>:<>Paper<span>mon</span></>}<Sparkles size={23}/></a><span className="header-note">a little science. a lot of curiosity.</span><button onClick={showDaily} disabled={busy} className={daily?'daily-link active':'daily-link'}><Sun size={16}/> Today’s paper</button></header>
 <main><div className="above-card"><span><Sparkles size={14}/>{showDeck?(daily?'CARD OF THE DAY':'YOUR NEW RABBIT HOLE'):(daily?'YOUR PAPER OF THE DAY':'YOUR NEW RABBIT HOLE')}</span><span>{date?new Date(date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):''}</span></div>
 <div className="cotd-box" style={showDeck?PAGE_GOLD:undefined}><article className="paper-card" aria-busy={busy}><div className="paper-copy" key={paper.pmcid}><div className="paper-sheet-wrap"><div className="paper-sheet"><h1 className={((paper.headline||paper.title).length>95)?'long-title':''}>{paper.headline||paper.title.replace(/\.$/,'')}</h1>
 <div className="story-section hook"><span className="section-label"><span>01</span> {ARTICLE_SECTION_LABELS[0]}</span>{paperCard?.paper?.hook?paras(paperCard.paper.hook):<p>{summary.hook}</p>}</div><div className="story-section"><span className="section-label"><span>02</span> {paperCard?'WHAT THEY FOUND':ARTICLE_SECTION_LABELS[1]}</span>{paperCard?.paper?.found?paras(paperCard.paper.found):<p>{summary.explanation}</p>}</div><div className="story-section significance"><span className="section-label"><span>03</span> {ARTICLE_SECTION_LABELS[2]}</span>{/* The side line runs only beside the body (Astra, 2026-11-14) */}<div className="matters-body">{paperCard?.paper?.matters?paras(paperCard.paper.matters):<p>{summary.importance}</p>}</div></div>
 {/* 04 Bibliography (Astra, 2026-11-14): only the paper cited exactly as you would cite it (MLA 9th edition,
     EasyBib's default style). Nothing after it on the paper; the study's small print is in More information. */}
 {showDeck&&<div className="story-section paper-bib"><span className="section-label"><span>04</span> BIBLIOGRAPHY</span>
  <p className="bib-entry">{citation(paperCard?.cite||mla(paper))}</p></div>}
</div></div>{!showDeck&&<><div className="paper-meta"><span className="subject-tag">{topic}</span><span>{paper.journal} <i>·</i> {paper.year}</span><span className="read-time">{`${Math.max(1,Math.ceil(wordCount/180))} min read`}</span></div> {paper.caveat&&<div className="reality-check"><Info size={15}/><p><strong>The small print:</strong> {paper.caveat}</p></div>}
 <div className="attribution">{summary.attribution} <button onClick={()=>setSourceOpen(!sourceOpen)} aria-expanded={sourceOpen} aria-controls="research-details">{sourceOpen?'Hide source details':'Source details'}</button></div>
 {researchDetails}
 <a className="original-link" href={paper.articleUrl} target="_blank" rel="noreferrer"><BookOpen size={16}/> Read the original paper <span>OPEN ACCESS</span></a></>}
</div>
 {showDeck&&<aside className="cotd-card" aria-label="Today's card">{paperCard?<DeckCard card={paperCard}/>:<div className="cotd-nocard"><p>Paper Patty hasn’t made a card for this paper yet.</p></div>}
  {/* The little motto under the card, like the old "Stay curious, sweet thing" note: every card makes you a bit smarter. */}
  <div className="cotd-below">
  <DrawPicker busy={busy} type={drawType} level={drawLevel} year={drawYear} onType={setDrawType} onLevel={setDrawLevel} onYear={setDrawYear} onDraw={drawFromReels} status={error||drawStatus}>
   {/* Every link is a button here, under the draw buttons, not on the paper (Astra, 2026-11-14) */}
   {popup('How to play Papermon','How to play Papermon',<HowToPlay/>,'Collect real science, one card at a time.')}
   {scienceDialog(<button type="button" className="pick-more">Where the science comes from</button>)}
   {popup('More information','More about this paper',moreInfo)}
  </DrawPicker></div></aside>}
 <aside className="art-panel"><div className="window-chrome"><span aria-hidden="true"><i/><i/><i/></span><span>curiosity.exe</span><Sparkles size={13}/></div><div className="art-image"><img src={base+'art/'+artworks[art].file} width={1024} height={1024} alt={artworks[art].alt}/></div><div className="art-caption"><span>{captions[caption]}</span><button onClick={remix} aria-label="Remix cartoon" title="Remix cartoon"><Shuffle size={17}/></button></div><span className="art-note">a little illustration, just for fun</span><div className="margin-note"><Sparkles size={20}/><p>Stay curious,<br/><em>sweet thing.</em></p></div></aside></article>
 <section className="controls" aria-label="Pick your next paper"><div className="controls-heading"><h2>Your next rabbit hole</h2><button className="date-toggle" aria-expanded={advanced} aria-controls="year-controls" onClick={()=>setAdvanced(!advanced)}><SlidersHorizontal size={14}/>{filters.period==='any'?'Any year':filters.period==='recent'?'Past year':filters.period==='older'?'5+ years ago':`${filters.from}–${filters.to}`} {advanced?<Minus size={13}/>:<Plus size={13}/>}</button></div><div className="subject-row">{subjectsUI.map(({name,icon:Icon})=><button key={name} className={filters.topic===name?'subject active':'subject'} aria-pressed={filters.topic===name} onClick={()=>change({topic:name})} disabled={busy}><Icon size={15}/>{name}</button>)}</div>
 {advanced&&<div className="year-controls" id="year-controls"><label id="year-label">Published</label><Select value={filters.period} onValueChange={v=>change({period:v})} disabled={busy}><SelectTrigger aria-labelledby="year-label"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="any">Any year</SelectItem><SelectItem value="recent">Past 12 months</SelectItem><SelectItem value="older">At least 5 years ago</SelectItem><SelectItem value="custom">Choose years</SelectItem></SelectContent></Select>{filters.period==='custom'&&<div className="year-range"><Input type="number" aria-label="First year" min={1900} max={new Date().getFullYear()} value={filters.from} onChange={e=>change({from:e.target.value})} disabled={busy}/><span>to</span><Input type="number" aria-label="Last year" min={1900} max={new Date().getFullYear()} value={filters.to} onChange={e=>change({to:e.target.value})} disabled={busy}/></div>}<button className="reset" disabled={busy} onClick={()=>{setFilters(defaultFilters);setError('');setStatus('Filters reset. Your reading history is saved.')}}><RotateCcw size={13}/> Reset</button></div>}
 <div className="shuffle-row"><p>No paywalls here. Just one more “wait, really?”</p><button className="shuffle-button" disabled={busy} onClick={()=>{shuffle().catch(()=>{})}}>{busy?<LoaderCircle size={20} className="spin"/>:<Shuffle size={20}/>} {busy?'Finding a paper…':'Surprise me'} {!busy&&<Sparkles size={16}/>}</button></div><div role="status" aria-live="polite" className="status">{status}{reads>0&&!busy&&<span>{reads} new {reads===1?'discovery':'discoveries'} this session</span>}</div>{error&&<div className="error" role="alert"><Info size={17}/><p>{error}</p><button onClick={()=>setError('')} aria-label="Dismiss message"><X size={16}/></button></div>}</section>
 {/* Deck mode: "Where the science comes from" lives on the paper, in Article information (Astra, 2026-11-14) */}
 </div>
 <LibraryPanel revision={reads}/>{showDeck&&<MyDeck onPick={c=>{const s=seeds.find(x=>x.pmcid===c.pmcid);if(!s)return;setPaper({...s,...editorials[s.pmcid]});setDaily(false);setSourceOpen(false);setError('');setDrawStatus('');(document.activeElement as HTMLElement|null)?.blur?.();setTimeout(()=>requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'smooth'})),60)}}/>}{!showDeck&&scienceFooter}
 {showDeck&&<AstraFooter/>}
 </main></div>
}
