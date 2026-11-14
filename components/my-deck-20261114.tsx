"use client";
// "My deck": the visitor's cards in a grid at the bottom of the main page (Astra, 2026-11-14: "it should just be
// below everything else so you can see everything all at once"). Tap a card to flip it.
// Front (Astra, 2026-11-14): the picture, always a perfect square; the name, a subject icon like a trading card's
// type symbol, the level, the headline, the rarity and difficulty stars. No links on the front.
// Back: the three sections, the "Read the paper" link, the source, the author status and the card number.
// DRAFT: shows ten sample cards and only when the address has ?deck (for example /paper-girl/?deck), so the live site
// is unchanged until real cards exist. Card rules: docs/card-plan-20261113.md.
import {useEffect,useState,type CSSProperties} from 'react';
import {Atom,Brain,Check,CircleHelp,Cog,Cpu,Dna,FlaskConical,Globe2,HeartPulse,Leaf,Sigma,Telescope,type LucideIcon} from 'lucide-react';
import sample from '@/lib/data/sample-deck-20261114.json';
import {base} from '@/lib/edition';
import '@/app/my-deck-20261114.css';

export type Card={made?:string;published?:string;readMinutes?:number;paper?:{hook:string;found:string;matters:string};lv:number;author?:boolean;name:string;subject:string;src:string;art:string;no:string;url:string;pmcid:string;headline:string;hook:string;found:string;matters:string};
export const cards=sample as Card[];
const RARITY:Record<number,string>={1:'Common',2:'Uncommon',3:'Rare',4:'Holo rare',5:'Legendary'};
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
 // Only the filled stars: 1 to 5 (Astra, 2026-11-14: "I don't want to see the non-filled stars").
 return <span className="deck-stars" aria-label={`Difficulty ${n} of 5`}><em>Difficulty</em>{Array.from({length:n},(_,i)=><i key={i} className="on" aria-hidden="true">★</i>)}</span>;
}

// Sparkles from Astra's portfolio (findastra.github.io, the twinkles over her portrait): four-point stars that grow,
// turn 45 degrees and fade, placed by a hash so each card keeps its own pattern. Rainbow on Holo rare, gold on Legendary.
// FNV hash, then a strong bit mix so neighboring sparkles get unrelated sizes and spots (plain FNV gave runs of big ones).
function hash(s:string){let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);
 n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;n=Math.imul(n,0x846ca68b);n^=n>>>16;return n>>>0}
function Glitter({seed,gold,count=14,whole=false}:{seed:string;gold:boolean;count?:number;whole?:boolean}){
 const RAINBOW=[330,20,50,140,190,260],GOLD=['hsl(45 95% 72%)','hsl(40 90% 62%)','hsl(50 100% 88%)','hsl(35 85% 58%)'];
 // Spread evenly over the whole square (Astra, 2026-11-14: "randomly across the card", not around one object): the
 // picture is cut into a grid and each sparkle sits somewhere random inside its own cell.
 const cols=Math.ceil(Math.sqrt(count)),rows=Math.ceil(count/cols);
 return <span className={'deck-glitter'+(gold?' gold':'')+(whole?' whole':'')} aria-hidden="true">{Array.from({length:count},(_,i)=>{
  const k=hash(seed+':'+i),cx=i%cols,cy=Math.floor(i/cols);
  // Sizes vary a lot (Astra, 2026-11-14: "really tiny ones and big ones"): mostly small, a few large.
  const r=((k>>>14)%1000)/1000,size=1.2+Math.pow(r,2.2)*7.8;
  const style={'--x':`${((cx+.15+((k%70)/100))/cols*100).toFixed(1)}%`,'--y':`${((cy+.15+(((k>>>7)%70)/100))/rows*100).toFixed(1)}%`,'--s':`${size.toFixed(2)}cqw`,'--d':`${((k>>>20)%30)/10}s`,
   '--c':gold?GOLD[(k>>>24)%GOLD.length]:`hsl(${RAINBOW[(k>>>24)%RAINBOW.length]} 70% 78%)`} as CSSProperties;
  return <i key={i} style={style}/>;
 })}</span>;
}

const fmtDate=(d:string)=>new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});

// "Read it?" tick, kept in this browser per card.
const READ_KEY='paper-girl:read:v1';
function useRead(no:string):[boolean,(v:boolean)=>void]{
 const [read,setRead]=useState(false);
 useEffect(()=>{try{setRead(!!JSON.parse(localStorage.getItem(READ_KEY)||'{}')[no])}catch{}},[no]);
 return [read,(v:boolean)=>{setRead(v);try{const m=JSON.parse(localStorage.getItem(READ_KEY)||'{}');if(v)m[no]=1;else delete m[no];localStorage.setItem(READ_KEY,JSON.stringify(m))}catch{}}];
}

export function DeckCard({card,onPick}:{card:Card;onPick?:(c:Card)=>void}){
 const [flipped,setFlipped]=useState(false);
 // The sheen that sweeps across the card while it turns, like light on a real card; flips toggle between two
 // identical animations so each flip plays it again.
 const [sweep,setSweep]=useState(0);
 const [read,setRead]=useRead(card.no);
 const turn=()=>{setFlipped(f=>!f);setSweep(s=>s===1?2:1)};
 // An author-approved card is Legendary (Astra, 2026-11-14); the stars still show how hard the paper is.
 const rarity=card.author?'Legendary':RARITY[card.lv];
 const type=SUBJECT[card.subject]||FALLBACK;const TypeIcon=type.icon;
 const own=(t:EventTarget)=>!!(t as HTMLElement).closest('a,label,input');
 // In My deck a click opens the card up top with its full write-up (onPick); in the top box a click flips it.
 const flip=(e:{target:EventTarget})=>{if(own(e.target))return;if(onPick)onPick(card);else turn()};
 // Gold card (Astra, 2026-11-14): Legendary or verified by its author = the whole card is gold, whatever the subject,
 // with sparkles over the whole card. The Type stat's colored chip still tells the subject.
 const gold=card.lv>=5||!!card.author;
 return <div className={'deck-slot '+(card.author?'author':'lv'+card.lv)+(gold?' gold-card':'')} style={{'--sc':type.color} as CSSProperties}>
  <div className={'deck-card'+(flipped?' flipped':'')+(sweep?` sweep${sweep}`:'')} role="button" tabIndex={0} aria-pressed={flipped}
   // The sheen sits where the mouse is, like light on a real card (Astra, 2026-11-14); it drifts on its own otherwise.
   onPointerMove={e=>{if(e.pointerType!=='mouse')return;const r=e.currentTarget.getBoundingClientRect(),el=e.currentTarget;
    el.classList.add('lit');el.style.setProperty('--lx',`${((e.clientX-r.left)/r.width*100).toFixed(1)}%`);el.style.setProperty('--ly',`${((e.clientY-r.top)/r.height*100).toFixed(1)}%`)}}
   onPointerLeave={e=>{e.currentTarget.classList.remove('lit')}}
   aria-label={`${card.name}, ${card.subject}, ${rarity}, level ${card.lv}. Tap to flip.`}
   onClick={flip} onKeyDown={e=>{if((e.key==='Enter'||e.key===' ')&&!own(e.target)){e.preventDefault();turn()}}}>
   <div className="deck-inner">
    <div className="deck-face deck-front">
     {gold&&<Glitter seed={card.no+':card'} gold count={22} whole/>}
     <div className="deck-top">
      <span className="deck-type" title={card.subject}><TypeIcon aria-hidden="true"/></span>
      <div className="deck-title"><p className="deck-name">{card.name}</p><span className="deck-no">No. {card.no}</span></div>
      <span className="deck-lv" aria-label={`Level ${card.lv}`}>LV <b>{card.lv}</b></span>
     </div>
     <div className="deck-frame"><div className="deck-window"><img src={`${base}art/${card.art}`} alt="" loading="lazy"/>
      {(card.lv>=4||gold)&&<Glitter seed={card.no} gold={gold} count={30}/>}</div></div>
     <div className="deck-stats">
      <div><span>type</span><b className="deck-type-stat"><i aria-hidden="true"><TypeIcon/></i>{card.subject}</b></div>
      <div><span>paper</span><a href={card.url} target="_blank" rel="noreferrer">Open ↗</a></div>
      <label className="deck-read"><span>read paper</span><input type="checkbox" checked={read} onChange={e=>setRead(e.target.checked)} aria-label={`I read ${card.name}`}/>
       {/* Looks like the Type stat: a circle that fills in when you tap it (Astra, 2026-11-14) */}
       <b className="deck-type-stat"><i className={'read-dot'+(read?' on':'')} aria-hidden="true">{read&&<Check/>}</i>{read?'Read':'Not read'}</b></label>
     </div>
     <div className="deck-band"><span className="deck-rarity">{rarity}</span><Stars n={card.lv}/></div>
    </div>
    <div className="deck-face deck-back">
     {gold&&<Glitter seed={card.no+':back'} gold count={16} whole/>}
     <div className="deck-rim" aria-hidden="true"/>
     <div><h4>STRANGE HOOK</h4><p>{card.hook}</p></div>
     <div><h4>WHAT THEY FOUND</h4><p>{card.found}</p></div>
     <div><h4>WHY IT MATTERS</h4><p>{card.matters}</p></div>
     {/* Back footer (Astra, 2026-11-14): the day the card was made; on an author-approved card, the author's own
         signature or their lab's logo as a stamp (they send it with their answer; this one is a placeholder). */}
     <div className="deck-bfoot">
      {card.author&&<div className="deck-stamp" aria-label="Author's stamp"><span>✍</span><small>author’s<br/>stamp</small></div>}
      {/* Two dates (Astra, 2026-11-14): when the paper came out, and when this card was minted. */}
      <div className="deck-made">{card.author&&<b className="deck-approved">Approved by its author</b>}
       {card.published&&<span>Paper published {fmtDate(card.published)}</span>}
       {card.made&&<span>Card minted {fmtDate(card.made)}</span>}</div>
     </div>
    </div>
   </div>
  </div>
 </div>;
}

// Order printed cards of your deck (Astra, 2026-11-14), shown next to the Draw deck. Printing is not set up yet, so it
// says so instead of taking an order.
export function OrderDeck(){
 const [open,setOpen]=useState(false);
 return <div className="order-deck"><button type="button" className="order-deck-button" aria-expanded={open} onClick={()=>setOpen(o=>!o)}>Order my deck</button>
  {open&&<p className="order-deck-note" role="status">Printed decks are coming soon. Your cards are saved here until then.</p>}</div>;
}

export function MyDeck({onPick}:{onPick?:(c:Card)=>void}){
 return <section className="my-deck" aria-labelledby="my-deck-title">
  <h2 id="my-deck-title" className="sr-only">Your deck</h2>
  <div className="my-deck-grid">{cards.map(c=><DeckCard key={c.no} card={c} onPick={onPick}/>)}</div>
 </section>;
}
