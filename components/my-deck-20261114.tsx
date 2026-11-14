"use client";
// "My deck": the visitor's cards in a grid at the bottom of the main page (Astra, 2026-11-14: "it should just be
// below everything else so you can see everything all at once"). Tap a card to flip it.
// Front (Astra, 2026-11-14): the picture, always a perfect square; the name, a subject icon like a trading card's
// type symbol, the level, the headline, the rarity and difficulty stars. No links on the front.
// Back: the three sections, the "Read the paper" link, the source, the author status and the card number.
// Live since 2026-11-14 as the normal page (?classic shows the old one). For now everyone sees the same five starter
// cards (lib/data/sample-deck-20261114.json) until Paper Patty makes cards per visitor. Card rules: docs/card-plan-20261113.md.
import {useEffect,useState,type CSSProperties} from 'react';
import {Atom,Brain,Check,CircleHelp,Cog,Cpu,Dna,FlaskConical,Globe2,HeartPulse,Leaf,Sigma,Telescope,type LucideIcon} from 'lucide-react';
import sample from '@/lib/data/sample-deck-20261114.json';
import {base} from '@/lib/edition';
import '@/app/my-deck-20261114.css';

export type Card={cite?:string;made?:string;published?:string;readMinutes?:number;paper?:{hook:string;found:string;matters:string};lv:number;author?:boolean;name:string;subject:string;src:string;art:string;no:string;url:string;pmcid:string;headline:string;hook:string;found:string;matters:string};
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
const SUBJECT:Record<string,{icon:LucideIcon;color:string}>={
 // Each subject always has the same symbol and color (Astra, 2026-11-14: "psychology, which is always a brain in pink").
 Biology:{icon:Leaf,color:'#4f9a5e'},Psychology:{icon:Brain,color:'#d26a9a'},Chemistry:{icon:FlaskConical,color:'#d08a2e'},
 'Earth science':{icon:Globe2,color:'#3f8ccc'},Physics:{icon:Atom,color:'#d4664a'},Math:{icon:Sigma,color:'#2f9c95'},
 // Added 2026-11-14 (Astra: "it seems like we're missing subjects")
 Medicine:{icon:HeartPulse,color:'#c94a4a'},Genetics:{icon:Dna,color:'#7a5ec8'},Space:{icon:Telescope,color:'#34478f'},
 'Computer science':{icon:Cpu,color:'#56656f'},Engineering:{icon:Cog,color:'#8a6a4a'}};
const FALLBACK={icon:CircleHelp,color:'#6b6470'};
/** Every type, in order, with its symbol and color, for the draw bar's pills (Astra, 2026-11-14). */
export const TYPES=Object.entries(SUBJECT).map(([name,t])=>({name,label:name.replace(/\b\w/g,c=>c.toUpperCase()),icon:t.icon,color:t.color}));
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
function PapermonSeal({id,author}:{id:string;author:boolean}){
 const words=author?'AUTHOR’S EDITION CARD ✦ PAPERMON ✦ ':'PAPERMON ✦ CERTIFICATE OF AUTHENTICITY ✦ ';
 // Fit the crest's words once around the ring (radius 38, about 239 units round).
 const fs=Math.min(8.6,(232-words.length)/(words.length*.64));
 const g=`seal-g-${id}`,d=`seal-d-${id}`,c=`seal-c-${id}`,p=`seal-p-${id}`;
 return <svg className="pm-seal" viewBox="0 0 120 120" role="img" aria-label={author?'Papermon seal: Author’s Edition Card':'Papermon seal: Certificate of Authenticity'}>
  <defs>
   <linearGradient id={g} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3c4"/><stop offset=".35" stopColor="#e8bb52"/><stop offset=".7" stopColor="#b8862e"/><stop offset="1" stopColor="#7a520c"/></linearGradient>
   <linearGradient id={d} x1="1" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#fff3c4"/><stop offset=".4" stopColor="#e0ac45"/><stop offset="1" stopColor="#8a5a10"/></linearGradient>
   <linearGradient id={c} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c48a24"/><stop offset=".4" stopColor="#fff3c4"/><stop offset=".6" stopColor="#f3d27a"/><stop offset="1" stopColor="#a8761c"/></linearGradient>
   <path id={p} d="M60,60 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0"/>
  </defs>
  <polygon points={sunburst(60,60,59,51,32)} fill={`url(#${g})`} stroke="#7a520c" strokeWidth=".7" strokeLinejoin="round"/>
  <circle cx="60" cy="60" r="48" fill={`url(#${d})`} stroke="#fff3c4" strokeOpacity=".8" strokeWidth="1"/>
  <circle cx="60" cy="60" r="45.5" fill={`url(#${g})`}/>
  <text fontSize={fs.toFixed(2)} fontWeight="700" letterSpacing="1" fill="#5a3c06" fontFamily="'Times New Roman',Times,serif">
   <textPath href={`#${p}`} startOffset="25%" textAnchor="middle">{words}</textPath></text>
  <circle cx="60" cy="60" r="29" fill={`url(#${d})`} stroke="#7a520c" strokeWidth=".8"/>
  <circle cx="60" cy="60" r="26.5" fill="none" stroke="#fff3c4" strokeOpacity=".7" strokeWidth=".8"/>
  <g transform="translate(60 61) scale(.24) translate(-96 -101)" stroke="#fff8e0" strokeOpacity=".75" strokeWidth="5" strokeLinejoin="round">
   <rect x="64" y="40" width="72" height="108" rx="10" fill={`url(#${g})`} transform="rotate(-20 100 175)"/>
   <rect x="64" y="40" width="72" height="108" rx="10" fill={`url(#${d})`} transform="rotate(-2 100 175)"/>
   <rect x="64" y="40" width="72" height="108" rx="10" fill={`url(#${c})`} transform="rotate(16 100 175)"/>
  </g>
 </svg>;
}
const shortDate=(d:string)=>new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
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

/** Every subject with its symbol, name and color, for places that list them (the How to play rules). */
export const SUBJECTS=Object.entries(SUBJECT).map(([name,t])=>({name,icon:t.icon,color:t.color}));

export function DeckCard({card,onPick}:{card:Card;onPick?:(c:Card)=>void}){
 const [flipped,setFlipped]=useState(false);
 // The sheen that sweeps across the card while it turns, like light on a real card; flips toggle between two
 // identical animations so each flip plays it again.
 const [sweep,setSweep]=useState(0);
 const [read,setRead]=useRead(card.no);
 const turn=()=>{setFlipped(f=>!f);setSweep(s=>s===1?2:1)};
 // Rarity comes from the rarity score (difficulty, age and the author's check, weighted); the stars still show how
 // hard the paper is to read.
 const {score,tier}=rarityOf(card),rarity=RARITY[tier];
 const type=SUBJECT[card.subject]||FALLBACK;const TypeIcon=type.icon;
 const own=(t:EventTarget)=>!!(t as HTMLElement).closest('a,label,input,button');
 // A click always flips the card (Astra, 2026-11-14). In My deck its back has a button that opens the write-up up top.
 const flip=(e:{target:EventTarget})=>{if(own(e.target))return;turn()};
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
   onClick={flip} onKeyDown={e=>{if((e.key==='Enter'||e.key===' ')&&!own(e.target)){e.preventDefault();turn()}}}>
   <div className="deck-inner">
    <div className="deck-face deck-front">
     {gold&&<><Glitter seed={card.no+':card'} gold count={22} whole/><Glitter seed={card.no+':card-tiny'} gold count={30} whole small/></>}
     <div className="deck-top">
      <span className="deck-type" title={card.subject}><TypeIcon aria-hidden="true"/></span>
      <div className="deck-title"><p className="deck-name">{card.name}</p></div>
      <span className="deck-lv" aria-label={`Level ${card.lv}`}>LV <b>{card.lv}</b></span>
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
        <b className="deck-type-stat"><i className={'read-dot'+(read?' on':'')} aria-hidden="true">{read&&<Check/>}</i>{read?'Read':'Unread'}</b></label>
      </div>
      {/* Second row, one line (Astra, 2026-11-14): the date the paper came out, the card number in gold in the middle,
          the date this card was minted */}
      <div className="deck-stats deck-stats-years">
       <div><span>published</span><b>{card.published?shortDate(card.published):card.src.match(/\d{4}/)?.[0]||'—'}</b></div>
       <div className="deck-no-stat"><span>card</span><b className="deck-no">No. {cardNumber(card.no)}</b></div>
       <div><span>minted</span><b>{card.made?shortDate(card.made):'—'}</b></div>
      </div>
     </div>
     <div className="deck-band"><span className="deck-rarity-wrap"><span className={'deck-rarity'+(tier>=3?' shiny':'')}>{rarity}</span></span><Stars n={card.lv}/></div>
    </div>
    <div className="deck-face deck-back">
     {gold&&<Glitter seed={card.no+':back'} gold count={16} whole/>}
     <div className="deck-rim" aria-hidden="true"/>
     <div><h4>STRANGE HOOK</h4><p>{card.hook}</p></div>
     <div><h4>WHAT THEY FOUND</h4><p>{card.found}</p></div>
     <div><h4>WHY IT MATTERS</h4><p>{card.matters}</p></div>
     {/* Two buttons on the back (Astra, 2026-11-14): the longer write-up on the paper up top, and the original article. */}
     <div className="deck-back-actions">
      {onPick&&<button type="button" onClick={()=>onPick(card)}>Read the write-up ↑</button>}
      <a href={card.url} target="_blank" rel="noreferrer">Original article ↗</a>
     </div>
     {/* Back footer (Astra, 2026-11-14): the day the card was made; on an author-approved card, the author's own
         signature or their lab's logo as a stamp (they send it with their answer; this one is a placeholder). */}
     <div className="deck-bfoot">
      {/* Two dates (Astra, 2026-11-14): "Article publication date:" and "Card mint date:", the Papermon seal to the right
          on gold cards. */}
      <div className="deck-made">{card.author&&<b className="deck-approved">Approved by its author</b>}
       {card.published&&<span><b>Article publication date:</b> {shortDate(card.published)}</span>}
       {card.made&&<span><b>Card mint date:</b> {shortDate(card.made)}</span>}
       {/* The rarity score lives on the back with a label (Astra, 2026-11-14: a bare number on the front was unclear) */}
       <span><b>Rarity score:</b> {score}</span></div>
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
   <span><b>{minutes}</b> {minutes===1?'minute':'minutes'} of reading</span>
  </div>
 </div>;
}

export function MyDeck({onPick}:{onPick?:(c:Card)=>void}){
 return <section className="my-deck" aria-labelledby="my-deck-title">
  <h2 id="my-deck-title" className="sr-only">Your deck</h2>
  <DeckTally/>
  <div className="my-deck-grid">{cards.map(c=><DeckCard key={c.no} card={c} onPick={onPick}/>)}</div>
 </section>;
}
