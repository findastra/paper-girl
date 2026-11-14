"use client";
// "My deck": the visitor's cards in a grid at the bottom of the main page (Astra, 2026-11-14: "it should just be
// below everything else so you can see everything all at once"). Tap a card to flip it.
// Front (Astra, 2026-11-14): the picture, always a perfect square; the name, a subject icon like a trading card's
// type symbol, the level, the headline, the rarity and difficulty stars. No links on the front.
// Back: the three sections, the "Read the paper" link, the source, the author status and the card number.
// Live since 2026-11-14 as the normal page (?classic shows the old one). For now everyone sees the same five starter
// cards (lib/data/sample-deck-20261114.json) until Paper Patty makes cards per visitor. Card rules: docs/card-plan-20261113.md.
import {useEffect,useState,type CSSProperties,type FormEvent} from 'react';
import {Atom,Brain,Check,CircleHelp,ThumbsDown,ThumbsUp,TreePine,Users,Cog,Cpu,Dna,FlaskConical,Globe2,HeartPulse,Leaf,Sigma,Telescope,type LucideIcon} from 'lucide-react';
import sample from '@/lib/data/sample-deck-20261114.json';
import {base} from '@/lib/edition';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import '@/app/my-deck-20261114.css';

// certifiedBy / certifiedOn: who checked the card for its paper's authors and when (only on author-checked cards).
export type Card={cite?:string;made?:string;published?:string;readMinutes?:number;paper?:{hook:string;found:string;matters:string};lv:number;author?:boolean;certifiedBy?:string;certifiedOn?:string;name:string;subject:string;src:string;art:string;no:string;url:string;pmcid:string;headline:string;hook:string;found:string;matters:string};
export const cards=sample as Card[];
export const RARITY:Record<number,string>={1:'Common',2:'Uncommon',3:'Rare',4:'Holo rare',5:'Legendary'};
/**
 * The Papermon rarity score (Astra, 2026-11-14: "our own type of rank for rarity ... a number score ... all the stuff
 * added up, weighted"). Points: 20 for each reading-difficulty star, 1 for every year since the paper came out (no
 * limit, so a card gets rarer every year), 50 when the paper's author has checked the card. The total picks the tier.
 * 20 per star (not 10) keeps the starter cards' gold and rainbow (Astra, 2026-11-14: "get that back").
 */
export const SCORE={perStar:20,perYear:1,author:50};
export const TIERS=[{tier:1,min:0,max:29},{tier:2,min:30,max:49},{tier:3,min:50,max:69},{tier:4,min:70,max:89},{tier:5,min:90,max:null}];
export function ageYears(published?:string,now=new Date()){
 if(!published)return 0;const p=new Date(published+'T12:00:00');let y=now.getFullYear()-p.getFullYear();
 if(now.getMonth()<p.getMonth()||(now.getMonth()===p.getMonth()&&now.getDate()<p.getDate()))y--;return Math.max(0,y);
}
export function rarityOf(card:{lv:number;published?:string;author?:boolean}){
 const age=ageYears(card.published),score=card.lv*SCORE.perStar+age*SCORE.perYear+(card.author?SCORE.author:0);
 const tier=[...TIERS].reverse().find(t=>score>=t.min)!.tier;return {score,tier,age};
}
// Subject = the card's type: one icon and color each, like a trading card's type symbol.
// covers: what belongs in each subject, so every paper has one obvious home (Astra, 2026-11-14). A paper that fits two
// goes in the more specific one (a genetics paper is Genetics, not Biology).
const SUBJECT:Record<string,{icon:LucideIcon;color:string;covers:string}>={
 // Each subject always has the same symbol and color (Astra, 2026-11-14: "psychology, which is always a brain in pink").
 Biology:{icon:Leaf,color:'#4f9a5e',covers:'living things: animals, plants, cells, evolution'},
 Psychology:{icon:Brain,color:'#d26a9a',covers:'the mind and behavior: thinking, memory, feelings, the brain at work'},
 Chemistry:{icon:FlaskConical,color:'#d08a2e',covers:'molecules, reactions and materials'},
 'Earth science':{icon:Globe2,color:'#3f8ccc',covers:'the planet itself: rocks, oceans, weather, earthquakes, fossils'},
 Physics:{icon:Atom,color:'#d4664a',covers:'forces, energy, light and motion'},
 Math:{icon:Sigma,color:'#2f9c95',covers:'numbers, patterns, models and chance'},
 // Added 2026-11-14 (Astra: "it seems like we're missing subjects")
 Medicine:{icon:HeartPulse,color:'#c94a4a',covers:'health and disease: patients, treatments, infections'},
 Genetics:{icon:Dna,color:'#7a5ec8',covers:'genes, DNA, heredity and mutations'},
 Space:{icon:Telescope,color:'#34478f',covers:'planets, stars and spaceflight'},
 'Computer science':{icon:Cpu,color:'#56656f',covers:'computers, code, algorithms and AI'},
 Engineering:{icon:Cog,color:'#8a6a4a',covers:'building things: devices, robots, sensors'},
 // Added 2026-11-14 (Astra: "yes, add both")
 'Social science':{icon:Users,color:'#8e4f8a',covers:'people and societies: economics, education, culture, language, the past'},
 Environment:{icon:TreePine,color:'#7a8a22',covers:'nature as a whole: ecosystems, climate, conservation, pollution'}};
const FALLBACK={icon:CircleHelp,color:'#6b6470',covers:''};
/** Every type, in order, with its symbol and color, for the draw bar's pills (Astra, 2026-11-14). */
export const TYPES=Object.entries(SUBJECT).map(([name,t])=>({name,label:name.replace(/\b\w/g,c=>c.toUpperCase()),icon:t.icon,color:t.color,covers:t.covers}));
/** The subject's color, so the page around a card can take it as its accent (Astra, 2026-11-14). */
export function subjectColor(subject?:string){return (subject&&SUBJECT[subject]?.color)||'#d9a53f'}

function Stars({n}:{n:number}){
 // Only the filled stars: 1 to 5 (Astra, 2026-11-14: "I don't want to see the non-filled stars"). The stars are the
 // READING difficulty: how hard the original paper is to understand (Astra, 2026-11-14).
 return <span className="deck-stars" aria-label={`Reading difficulty ${n} of 5`}><em>Reading difficulty</em><span className="deck-star-row">{Array.from({length:n},(_,i)=><i key={i} className="on" aria-hidden="true">★</i>)}</span></span>;
}

// Sparkles from Astra's portfolio (findastra.github.io, the twinkles over her portrait): four-point stars that grow,
// turn 45 degrees and fade, placed by a hash so each card keeps its own pattern. Rainbow on Holo rare, gold on Legendary.
// FNV hash, then a strong bit mix so neighboring sparkles get unrelated sizes and spots (plain FNV gave runs of big ones).
function hash(s:string){let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);
 n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;n=Math.imul(n,0x846ca68b);n^=n>>>16;return n>>>0}
// small: a layer of tiny sparkles that stay up longer, so many show at once (Astra, 2026-11-14).
function Glitter({seed,gold,count=14,whole=false,small=false}:{seed:string;gold:boolean;count?:number;whole?:boolean;small?:boolean}){
 const RAINBOW=[330,20,50,140,190,260],GOLD=['hsl(45 95% 72%)','hsl(40 90% 62%)','hsl(50 100% 88%)','hsl(35 85% 58%)'];
 // Spread evenly over the whole square (Astra, 2026-11-14: "randomly across the card", not around one object): the
 // picture is cut into a grid and each sparkle sits somewhere random inside its own cell.
 const cols=Math.ceil(Math.sqrt(count)),rows=Math.ceil(count/cols);
 return <span className={'deck-glitter'+(gold?' gold':'')+(whole?' whole':'')+(small?' small':'')} aria-hidden="true">{Array.from({length:count},(_,i)=>{
  const k=hash(seed+':'+i),cx=i%cols,cy=Math.floor(i/cols);
  // Sizes vary a lot (Astra, 2026-11-14: "really tiny ones and big ones"): mostly small, a few large. The small layer
  // is all tiny ones.
  const r=((k>>>14)%1000)/1000,size=small?.6+r*1.6:1.2+Math.pow(r,2.2)*7.8;
  // Start times spread over the whole cycle, so sparkles come and go one by one instead of pulsing together.
  const style={'--x':`${((cx+.15+((k%70)/100))/cols*100).toFixed(1)}%`,'--y':`${((cy+.15+(((k>>>7)%70)/100))/rows*100).toFixed(1)}%`,'--s':`${size.toFixed(2)}cqw`,'--d':`${-((k>>>20)%90)/10}s`,
   '--c':gold?GOLD[(k>>>24)%GOLD.length]:`hsl(${RAINBOW[(k>>>24)%RAINBOW.length]} 70% 78%)`} as CSSProperties;
  return <i key={i} style={style}/>;
 })}</span>;
}

const fmtDate=(d:string)=>new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});

/**
 * The Papermon seal on the back of gold cards (Astra, 2026-11-14): the logo (three gold cards) chiseled into a gold
 * sunburst, like a certificate of authenticity, with a crest of words around it. "Author's Edition Card" only when
 * the paper's own author has checked the card; otherwise "Certificate of Authenticity", so no card claims an author's
 * check it never had.
 */
function sunburst(cx:number,cy:number,outer:number,inner:number,points:number){
 return Array.from({length:points*2},(_,i)=>{const r=i%2?inner:outer,a=Math.PI*i/points-Math.PI/2;return `${(cx+r*Math.cos(a)).toFixed(2)},${(cy+r*Math.sin(a)).toFixed(2)}`}).join(' ');
}
/**
 * The Papermon logo's three fanned cards as a stencil (Astra, 2026-11-14): no drawn border; each card is masked by a
 * slightly larger copy of the cards in front of it, so a thin see-through gap outlines them. Same shapes as
 * public/papermon-logo-20261114.svg.
 */
const FAN=[-20,-2,16];
export function StencilFan({id,fills,gap=10}:{id:string;fills:string[];gap?:number}){
 const card=(a:number,fill:string,stroke?:string)=><rect key={a} x="64" y="40" width="72" height="108" rx="10" fill={fill} stroke={stroke} strokeWidth={stroke?gap:undefined} strokeLinejoin="round" transform={`rotate(${a} 100 175)`}/>;
 return <>
  <defs>{FAN.slice(0,2).map((_,i)=><mask key={i} id={`fan-m${i}-${id}`} maskUnits="userSpaceOnUse" x="-60" y="-60" width="320" height="320">
   <rect x="-60" y="-60" width="320" height="320" fill="#fff"/>{FAN.slice(i+1).map(a=>card(a,'#000','#000'))}</mask>)}</defs>
  {FAN.map((a,i)=><g key={a} mask={i<2?`url(#fan-m${i}-${id})`:undefined}>{card(a,fills[i])}</g>)}
 </>;
}
/**
 * The "read" mark (Astra, 2026-11-14): a plain gold circle until the paper is read, then a gold sun with jagged
 * triangle points, like a certification seal, with a check in the middle. It fills the same spot as the circle, so
 * ticking it never moves anything (no stamp at the top left: Astra, 2026-11-14).
 */
function SunSeal(_:{id:string}){
 // Made of the page's one gold surface (Astra, 2026-11-14): a gold sun of jagged points, a disc with a thin ring, a check
 return <span className="sun-seal" aria-hidden="true"><span className="sun-rays"/><span className="sun-disc"><Check/></span></span>;
}
function PapermonSeal({id,author}:{id:string;author:boolean}){
 const words=author?'AUTHOR’S EDITION CARD ✦ PAPERMON ✦ ':'PAPERMON ✦ CERTIFICATE OF AUTHENTICITY ✦ ';
 // Fit the crest's words once around the ring (radius 38, about 239 units round).
 const fs=Math.min(8.6,(232-words.length)/(words.length*.64));
 const p=`seal-p-${id}`;
 // The seal's gold is the page's one gold surface showing through (Astra, 2026-11-14); the drawing on top only adds the
 // chiseled rings, the crest of words and the card fan as light and dark tints.
 return <span className="pm-seal-wrap"><span className="pm-seal-gold" aria-hidden="true"/>
 <svg className="pm-seal" viewBox="0 0 120 120" role="img" aria-label={author?'Papermon seal: Author’s Edition Card':'Papermon seal: Certificate of Authenticity'}>
  <defs>
   <path id={p} d="M60,60 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0"/>
  </defs>
  <polygon points={sunburst(60,60,59,51,32)} fill="none" stroke="#7a520c" strokeWidth=".7" strokeLinejoin="round"/>
  <circle cx="60" cy="60" r="48" fill="#7a520c" fillOpacity=".16" stroke="#fff3c4" strokeOpacity=".8" strokeWidth="1"/>
  <circle cx="60" cy="60" r="45.5" fill="#fff8e0" fillOpacity=".1"/>
  <text fontSize={fs.toFixed(2)} fontWeight="700" letterSpacing="1" fill="#5a3c06" fontFamily="'Times New Roman',Times,serif">
   <textPath href={`#${p}`} startOffset="25%" textAnchor="middle">{words}</textPath></text>
  <circle cx="60" cy="60" r="29" fill="#7a520c" fillOpacity=".16" stroke="#7a520c" strokeWidth=".8"/>
  <circle cx="60" cy="60" r="26.5" fill="none" stroke="#fff3c4" strokeOpacity=".7" strokeWidth=".8"/>
  {/* The logo as a stencil (Astra, 2026-11-14: no white border, "see-through"): each card cuts a thin gap out of the
      cards behind it, so the outline is the seal's own gold showing through. */}
  <g transform="translate(60 61) scale(.24) translate(-96 -101)"><StencilFan id={id} fills={['#7a520c33','#fff8e04d','#fff8e080']}/></g>
 </svg></span>;
}
// Abbreviated months end with a period, like "No." and "LV." (Astra, 2026-11-14): "Nov. 14, 2026"; May is not shortened.
const MONTHS=['Jan.','Feb.','Mar.','Apr.','May','Jun.','Jul.','Aug.','Sep.','Oct.','Nov.','Dec.'];
const shortDate=(d:string)=>{const t=new Date(d+'T12:00:00');return `${MONTHS[t.getMonth()]} ${t.getDate()}, ${t.getFullYear()}`};
/** The card number as Astra asked for it: four digits, "0001" (the data keeps "000,001", which read ticks use). */
export const cardNumber=(no:string)=>String(parseInt(no.replace(/\D/g,''),10)||0).padStart(4,'0');

// "Read it?" tick (Completion), kept in this browser per card. One shared list, so the deck's tally (minutes read)
// updates the moment any card is ticked. Ticks saved under the old name are carried over once.
const READ_KEY='papermon:read:v1',OLD_READ_KEY='paper-girl:read:v1',READ_EVENT='papermon-read';
// Cards are numbered in the order they were minted (Astra, 2026-11-14), so the five starter cards became 1 to 5;
// ticks saved under their old numbers follow them.
const RENUMBERED:Record<string,string>={'000,181':'000,001','000,140':'000,002','000,131':'000,003','000,152':'000,004','000,128':'000,005'};
function loadRead():Record<string,1>{try{const now=localStorage.getItem(READ_KEY);if(now)return JSON.parse(now);
 const old=JSON.parse(localStorage.getItem(OLD_READ_KEY)||'{}') as Record<string,1>;return Object.fromEntries(Object.keys(old).map(k=>[RENUMBERED[k]||k,1]))}catch{return {}}}
function saveRead(no:string,v:boolean){const m=loadRead();if(v)m[no]=1;else delete m[no];
 try{localStorage.setItem(READ_KEY,JSON.stringify(m))}catch{}window.dispatchEvent(new Event(READ_EVENT))}
export function useReadMap(){
 const [m,setM]=useState<Record<string,1>>({});
 useEffect(()=>{const f=()=>setM(loadRead());f();window.addEventListener(READ_EVENT,f);window.addEventListener('storage',f);
  return()=>{window.removeEventListener(READ_EVENT,f);window.removeEventListener('storage',f)}},[]);
 return m;
}
function useRead(no:string):[boolean,(v:boolean)=>void]{const m=useReadMap();return [!!m[no],v=>saveRead(no,v)]}

// Thumbs up or down on a card (Astra, 2026-11-14: "you would immediately just rank it"), kept in this browser per card
// like the read ticks, until Papermon has a server to collect them.
const RATE_KEY='papermon:rate:v1',RATE_EVENT='papermon-rate';
function loadRates():Record<string,1|-1>{try{return JSON.parse(localStorage.getItem(RATE_KEY)||'{}')}catch{return {}}}
function useRate(no:string):[0|1|-1,(v:0|1|-1)=>void]{
 const [m,setM]=useState<Record<string,1|-1>>({});
 useEffect(()=>{const f=()=>setM(loadRates());f();window.addEventListener(RATE_EVENT,f);return()=>window.removeEventListener(RATE_EVENT,f)},[]);
 return [m[no]||0,v=>{const all=loadRates();if(v)all[no]=v;else delete all[no];try{localStorage.setItem(RATE_KEY,JSON.stringify(all))}catch{}window.dispatchEvent(new Event(RATE_EVENT))}];
}

/**
 * Report a problem / I wrote this paper (Astra, 2026-11-14: "a big thing that pops up on your page that lets you submit
 * something"). Papermon has no inbox yet, so Send keeps the message in this browser and says so plainly; nothing
 * pretends to have been sent.
 */
const OUTBOX_KEY='papermon:outbox:v1';
const PROBLEMS=['A fact is wrong','Hard to understand','The picture does not fit','Something else'];
function CardForm({card,kind,onClose}:{card:Card;kind:''|'report'|'author';onClose:()=>void}){
 const [done,setDone]=useState(false),[problem,setProblem]=useState(PROBLEMS[0]);
 const close=()=>{setDone(false);onClose()};
 const send=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget).entries());
  try{const box=JSON.parse(localStorage.getItem(OUTBOX_KEY)||'[]');box.push({kind,card:card.no,name:card.name,problem:kind==='report'?problem:undefined,...f,at:new Date().toISOString()});
   localStorage.setItem(OUTBOX_KEY,JSON.stringify(box))}catch{}setDone(true)};
 const report=kind==='report';
 return <Dialog open={!!kind} onOpenChange={o=>{if(!o)close()}}>
  <DialogContent className="source-dialog card-form">
   <DialogTitle>{report?'Report a problem':'I wrote this paper'}</DialogTitle>
   <DialogDescription>{card.name} · No. {cardNumber(card.no)} · {card.headline}</DialogDescription>
   {done?<div className="card-form-done"><p><b>Thank you.</b> Papermon can’t receive messages yet, so this is saved on this device for now.</p>
    <button type="button" className="card-form-send" onClick={close}>Close</button></div>
   :<form onSubmit={send}>
    {report?<>
     <fieldset><legend>What’s wrong?</legend><div className="card-form-chips">{PROBLEMS.map(p=><button key={p} type="button" aria-pressed={problem===p}
      className={problem===p?'on':''} onClick={()=>setProblem(p)}>{p}</button>)}</div></fieldset>
     <label>Tell us more<textarea name="details" rows={4} required placeholder="What should the card say instead?"/></label>
     <label>Your email, if you’d like an answer <small>(optional)</small><input name="email" type="email" autoComplete="email"/></label>
    </>:<>
     <p className="card-form-lead">Authors can check their paper’s card, fix one thing, and make it an Author’s Edition: a gold card with
      your certification on the back.</p>
     <label>Your name<input name="author" required autoComplete="name"/></label>
     <label>ORCID iD or your email at your institution<input name="contact" required placeholder="0000-0000-0000-0000 or you@university.edu"/></label>
     <label>The one thing you would fix <small>(optional)</small><textarea name="fix" rows={3}/></label>
    </>}
    <button type="submit" className="card-form-send">{report?'Send report':'Send to Papermon'}</button>
   </form>}
  </DialogContent>
 </Dialog>;
}

/** Every subject with its symbol, name and color, for places that list them (the How to play rules). */
export const SUBJECTS=Object.entries(SUBJECT).map(([name,t])=>({name,icon:t.icon,color:t.color,covers:t.covers}));

// onNext (in a pile): tapping the card's back puts it at the bottom of the pile instead of turning it back over.
export function DeckCard({card,onPick,onNext}:{card:Card;onPick?:(c:Card)=>void;onNext?:()=>void}){
 const [flipped,setFlipped]=useState(false);
 // The sheen that sweeps across the card while it turns, like light on a real card; flips toggle between two
 // identical animations so each flip plays it again.
 const [sweep,setSweep]=useState(0);
 const [read,setRead]=useRead(card.no);
 const [form,setForm]=useState<''|'report'|'author'>('');
 const [rate,setRate]=useRate(card.no);
 const turn=()=>{setFlipped(f=>!f);setSweep(s=>s===1?2:1)};
 // Rarity comes from the rarity score (difficulty, age and the author's check, weighted); the stars still show how
 // hard the paper is to read.
 const {score,tier}=rarityOf(card),rarity=RARITY[tier];
 const type=SUBJECT[card.subject]||FALLBACK;const TypeIcon=type.icon;
 const own=(t:EventTarget)=>!!(t as HTMLElement).closest('a,label,input,button');
 // A click always flips the card (Astra, 2026-11-14). In My deck its back has a button that opens the write-up up top.
 // Only clicks from the card itself: the forms' pop-ups render elsewhere on the page, but React still passes their
 // clicks and keys up to the card.
 const mine=(e:{target:EventTarget;currentTarget:EventTarget})=>(e.currentTarget as Element).contains(e.target as Node);
 const flip=(e:{target:EventTarget;currentTarget:EventTarget})=>{if(!mine(e)||own(e.target))return;if(flipped&&onNext){onNext();return}turn()};
 // Gold card (Astra, 2026-11-14): a Legendary card is gold all over, whatever the subject, with sparkles over the
 // whole card. The Subject stat's colored chip still tells the subject.
 const gold=tier>=5;
 const journal=card.src.replace(/\s*\d{4}$/,'');
 return <div className={'deck-slot lv'+tier+(card.author?' author':'')+(gold?' gold-card':'')} style={{'--sc':type.color} as CSSProperties}>
  <div className={'deck-card'+(flipped?' flipped':'')+(sweep?` sweep${sweep}`:'')} role="button" tabIndex={0} aria-pressed={flipped}
   // The sheen sits where the mouse is, like light on a real card (Astra, 2026-11-14); it drifts on its own otherwise.
   onPointerMove={e=>{if(e.pointerType!=='mouse')return;const r=e.currentTarget.getBoundingClientRect(),el=e.currentTarget;
    el.classList.add('lit');el.style.setProperty('--lx',`${((e.clientX-r.left)/r.width*100).toFixed(1)}%`);el.style.setProperty('--ly',`${((e.clientY-r.top)/r.height*100).toFixed(1)}%`)}}
   onPointerLeave={e=>{e.currentTarget.classList.remove('lit')}}
   aria-label={`${card.name}, ${card.subject}, ${rarity}, rarity score ${score}, reading difficulty ${card.lv}. Tap to flip.`}
   onClick={flip} onKeyDown={e=>{if((e.key==='Enter'||e.key===' ')&&mine(e)&&!own(e.target)){e.preventDefault();flip(e)}}}>
   <div className="deck-inner">
    <div className="deck-face deck-front">
     {gold&&<><Glitter seed={card.no+':card'} gold count={22} whole/><Glitter seed={card.no+':card-tiny'} gold count={30} whole small/></>}
     <div className="deck-top">
      <span className="deck-type" title={type.covers?`${card.subject}: ${type.covers}`:card.subject}><TypeIcon aria-hidden="true"/></span>
      <div className="deck-title"><p className="deck-name">{card.name}</p></div>
      <span className="deck-lv" aria-label={`Level ${card.lv}`}><small aria-hidden="true">LV.</small><b aria-hidden="true">{card.lv}</b></span>
     </div>
     <div className="deck-frame"><div className="deck-window"><img src={`${base}art/${card.art}`} alt="" loading="lazy"/>
      {(tier>=4||gold)&&<><Glitter seed={card.no} gold={gold} count={30}/><Glitter seed={card.no+':tiny'} gold={gold} count={42} small/></>}</div></div>
     {/* Stats (Astra, 2026-11-14): Subject, Article (the journal's name, linked), Read time (the full original
         article's, `readMinutes`) and Completion (a gold circle that fills in), centered in the space under the
         picture, with the card number centered under them. Still two rows: four stats on top, three below. */}
     <div className="deck-lower">
      <div className="deck-stats deck-stats-top">
       {/* Just the word: the subject's circle is already in the top corner (Astra, 2026-11-14) */}
       <div><span>subject</span><b>{card.subject}</b></div>
       <div><span>article</span><a href={card.url} target="_blank" rel="noreferrer">{journal} ↗</a></div>
       <div><span>read time</span><b>{card.readMinutes?`${card.readMinutes} min`:'—'}</b></div>
       <label className="deck-read"><span>completion</span><input type="checkbox" checked={read} onChange={e=>setRead(e.target.checked)} aria-label={`I read ${card.name}`}/>
        <b className="deck-type-stat"><i className={'read-dot'+(read?' on':'')} aria-hidden="true">{read&&<SunSeal id={card.no.replace(/\D/g,'')+'-stat'}/>}</i><em className="read-word">{read?'Read':'Unread'}</em></b></label>
      </div>
      {/* Second row, one line (Astra, 2026-11-14): the date the paper came out, the card number in gold, the date this
          card was minted, and the rarity score at the far right, so both rows have four stats that line up */}
      <div className="deck-stats deck-stats-years">
       <div><span>published</span><b>{card.published?shortDate(card.published):card.src.match(/\d{4}/)?.[0]||'—'}</b></div>
       <div className="deck-no-stat"><span>card</span><b className="deck-no">No. {cardNumber(card.no)}</b></div>
       <div><span>minted</span><b>{card.made?shortDate(card.made):'—'}</b></div>
       <div><span>rarity score</span><b>{score}</b></div>
      </div>
     </div>
     <div className="deck-band"><span className="deck-rarity-wrap"><span className={'deck-rarity'+(tier>=3?' shiny':'')}>{rarity}</span></span><Stars n={card.lv}/></div>
    </div>
    <div className="deck-face deck-back">
     {gold&&<Glitter seed={card.no+':back'} gold count={16} whole/>}
     <div className="deck-rim" aria-hidden="true"/>
     {/* Every part of the back has its own fixed spot, like a printed card (Astra, 2026-11-14): the three sections
         stack from the top, the four buttons always sit in the same place, and the footer keeps room for the
         certification lines even on cards that have none yet. Sections are numbered like the paper's. */}
     <div className="deck-back-text">
      <div><h4><span className="deck-num">01</span>STRANGE HOOK</h4><p>{card.hook}</p></div>
      <div><h4><span className="deck-num">02</span>WHAT THEY FOUND</h4><p>{card.found}</p></div>
      <div><h4><span className="deck-num">03</span>WHY IT MATTERS</h4><p>{card.matters}</p></div>
     </div>
     {/* Two buttons on the back (Astra, 2026-11-14): the longer write-up on the paper up top, and the original article. */}
     <CardForm card={card} kind={form} onClose={()=>setForm('')}/>
     <div className="deck-back-actions">
      {onPick&&<button type="button" onClick={()=>onPick(card)}>Read the write-up ↑</button>}
      <a href={card.url} target="_blank" rel="noreferrer">Original article ↗</a>
      {/* Two more (Astra, 2026-11-14), each opening a form in a big pop-up. Neither shows on a card its author has
          already verified: there is nothing left to report or claim. */}
      {!card.author&&<>
       <button type="button" onClick={()=>setForm('report')}>Report a problem</button>
       <button type="button" onClick={()=>setForm('author')}>I wrote this paper</button>
      </>}
     </div>
     {/* Thumbs up or down, under the four buttons (Astra, 2026-11-14: leaves room for long sentences); a quick rating,
         and Report a problem is still there for more */}
     <div className="deck-rate" role="group" aria-label="Rate this card"><span>Good card?</span>
      <button type="button" aria-pressed={rate===1} aria-label="Thumbs up" className={rate===1?'on':''} onClick={()=>setRate(rate===1?0:1)}><ThumbsUp aria-hidden="true"/></button>
      <button type="button" aria-pressed={rate===-1} aria-label="Thumbs down" className={rate===-1?'on':''} onClick={()=>setRate(rate===-1?0:-1)}><ThumbsDown aria-hidden="true"/></button>
     </div>
     {/* Back footer (Astra, 2026-11-14): the day the card was made; on an author-approved card, the author's own
         signature or their lab's logo as a stamp (they send it with their answer; this one is a placeholder). */}
     <div className="deck-bfoot">
      {/* No rarity score or dates here (Astra, 2026-11-14: they are on the front). Gold cards, which carry the Papermon
          seal on the right, say what the seal certifies, who certified it and when; other cards leave the space empty.
          An author's certification only shows when the paper's own author checked the card. */}
      <div className="deck-made">{card.author&&!gold&&<b className="deck-approved">Approved by its author</b>}
       {gold&&(card.author?<>
        <span><b>Certification:</b> Author’s Edition</span>
        <span><b>Author certifier:</b> {card.certifiedBy||'the paper’s author'}</span>
        {card.certifiedOn&&<span><b>Author certification date:</b> {shortDate(card.certifiedOn)}</span>}
       </>:<>
        <span><b>Certification:</b> Authenticity</span>
        <span><b>Certified by:</b> Papermon</span>
        {card.made&&<span><b>Certification date:</b> {shortDate(card.made)}</span>}
       </>)}</div>
      {gold&&<PapermonSeal id={card.no.replace(/\D/g,'')} author={!!card.author}/>}
     </div>
    </div>
   </div>
  </div>
 </div>;
}

/**
 * The collection's tally at the top of My deck (Astra, 2026-11-14): how many cards of each subject (the symbol only;
 * hover it for the name), how many are read, and the minutes of reading those read articles add up to.
 */
function DeckTally(){
 const read=useReadMap();
 const bySubject=Object.entries(cards.reduce<Record<string,number>>((m,c)=>{m[c.subject]=(m[c.subject]||0)+1;return m},{}));
 const done=cards.filter(c=>read[c.no]),minutes=done.reduce((n,c)=>n+(c.readMinutes||0),0);
 return <div className="deck-tally">
  <div className="tally-subjects" aria-label="Cards by subject">{bySubject.map(([s,n])=>{const t=SUBJECT[s]||FALLBACK,Icon=t.icon;
   return <span key={s} className="tally-sub" title={s} aria-label={`${n} ${s}`} style={{'--sc':t.color} as CSSProperties}><i aria-hidden="true"><Icon/></i><b>{n}</b></span>})}</div>
  <div className="tally-stats">
   <span><b>{cards.length}</b> {cards.length===1?'card':'cards'}</span>
   <span><b>{done.length}</b> read</span>
   <span><b>{minutes}</b> {minutes===1?'minute':'minutes'}</span>
  </div>
 </div>;
}

/**
 * The deck in piles (Astra, 2026-11-14): two ways to sort. **Group by** makes the piles (one pile per subject, per
 * difficulty, per rarity and so on; "None" lays every card out). **In order of** sorts the cards inside each pile, so
 * the top card is the first one. No labels: the cards and the chosen buttons say it all. Tap the chosen "In order of"
 * again to turn the order around. A pile looks like a stack of real cards; tap its top card to turn it over, tap the
 * back to put it at the bottom of the pile and bring up the next card.
 */
type Group={key:string;label:string;of?:(c:Card,read:Record<string,1>)=>string|number};
type Order={key:string;label:string;value:(c:Card)=>number|string;down?:boolean};
const time=(d?:string)=>d?new Date(d+'T12:00:00').getTime():0;
const GROUPS:Group[]=[
 {key:'subject',label:'Subject',of:c=>c.subject},
 {key:'stars',label:'Difficulty',of:c=>c.lv},
 {key:'rarity',label:'Rarity',of:c=>rarityOf(c).tier},
 {key:'done',label:'Completion',of:(c,read)=>read[c.no]?0:1},
 {key:'article',label:'Article',of:c=>c.src.replace(/\s*\d{4}$/,'')},
 {key:'published',label:'Published year',of:c=>-(parseInt((c.published||c.src).match(/\d{4}/)?.[0]||'0',10))},
 {key:'none',label:'None'},
];
const ORDERS:Order[]=[
 {key:'no',label:'Card No.',value:c=>parseInt(c.no.replace(/\D/g,''),10)||0},
 {key:'published',label:'Most recent',value:c=>time(c.published),down:true},
 {key:'minted',label:'Minted',value:c=>time(c.made),down:true},
 {key:'time',label:'Read time',value:c=>c.readMinutes||0,down:true},
 {key:'stars',label:'Difficulty',value:c=>c.lv,down:true},
 {key:'rarity',label:'Rarity score',value:c=>rarityOf(c).score,down:true},
];
const cmp=(a:number|string,b:number|string)=>a<b?-1:a>b?1:0;
function arrange(group:Group,order:Order,reverse:boolean,read:Record<string,1>):{key:string;cards:Card[]}[]{
 const dir=(order.down?-1:1)*(reverse?-1:1),sorted=[...cards].sort((a,b)=>cmp(order.value(a),order.value(b))*dir);
 if(!group.of)return [{key:'all',cards:sorted}];
 const piles=new Map<string|number,Card[]>();
 for(const c of sorted){const k=group.of(c,read);if(!piles.has(k))piles.set(k,[]);piles.get(k)!.push(c)}
 return [...piles.entries()].sort((a,b)=>cmp(a[0],b[0])).map(([k,v])=>({key:String(k),cards:v}));
}

/** One pile: the top card in front and up to three cards peeking out behind it. */
function Pile({pile,onPick}:{pile:Card[];onPick?:(c:Card)=>void}){
 const [turned,setTurned]=useState(0);
 const n=pile.length,at=n?turned%n:0,shown=[...pile.slice(at),...pile.slice(0,at)];
 if(n===1)return <div className="deck-pile single"><DeckCard card={shown[0]} onPick={onPick}/></div>;
 return <div className="deck-pile" style={{'--under':Math.min(3,n-1)} as CSSProperties}>
  {shown.slice(1,4).reverse().map((c,i,arr)=><div key={c.no} className="pile-under" style={{'--d':arr.length-i} as CSSProperties} aria-hidden="true" inert><DeckCard card={c}/></div>)}
  <div className="pile-top" key={shown[0].no}><DeckCard card={shown[0]} onPick={onPick} onNext={()=>setTurned(t=>t+1)}/></div>
 </div>;
}

export function MyDeck({onPick}:{onPick?:(c:Card)=>void}){
 const read=useReadMap();
 const [groupKey,setGroup]=useState('subject'),[orderKey,setOrder]=useState('no'),[reverse,setReverse]=useState(false);
 const group=GROUPS.find(g=>g.key===groupKey)||GROUPS[0],order=ORDERS.find(o=>o.key===orderKey)||ORDERS[0];
 const piles=arrange(group,order,reverse,read);
 const chooseOrder=(k:string)=>{if(k===orderKey)setReverse(r=>!r);else{setOrder(k);setReverse(false)}};
 return <section className="my-deck" aria-labelledby="my-deck-title">
  <h2 id="my-deck-title" className="sr-only">Your deck</h2>
  {/* One line (Astra, 2026-11-14: "fit that in one line"): the tally on the left, then Group by and In order of as
      two drop-downs, and an arrow button that turns the order around */}
  <div className="deck-bar">
   <DeckTally/>
   <label className="deck-pick"><span>Group by</span><select value={groupKey} onChange={e=>setGroup(e.target.value)}>
    {GROUPS.map(g=><option key={g.key} value={g.key}>{g.label}</option>)}</select></label>
   <label className="deck-pick"><span>In order of</span><select value={orderKey} onChange={e=>chooseOrder(e.target.value)}>
    {ORDERS.map(o=><option key={o.key} value={o.key}>{o.label}</option>)}</select></label>
   <button type="button" className="deck-dir" onClick={()=>setReverse(r=>!r)} aria-label="Turn the order around"
    title="Turn the order around">{(order.down?!reverse:reverse)?'↓':'↑'}</button>
  </div>
  {group.of
   ?<div className="my-deck-piles">{piles.map(p=><Pile key={p.key+':'+orderKey+':'+reverse} pile={p.cards} onPick={onPick}/>)}</div>
   :<div className="my-deck-grid">{piles[0].cards.map(c=><DeckCard key={c.no} card={c} onPick={onPick}/>)}</div>}
 </section>;
}
