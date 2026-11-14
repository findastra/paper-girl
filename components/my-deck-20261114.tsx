"use client";
// "My deck": the visitor's cards in a grid at the bottom of the main page (Astra, 2026-11-14: "it should just be
// below everything else so you can see everything all at once"). Tap a card to flip it.
// Front (Astra, 2026-11-14): the picture, always a perfect square; the name, a subject icon like a trading card's
// type symbol, the level, the headline, the rarity and difficulty stars. No links on the front.
// Back: the three sections, the "Read the paper" link, the source, the author status and the card number.
// DRAFT: shows ten sample cards and only when the address has ?deck (for example /paper-girl/?deck), so the live site
// is unchanged until real cards exist. Card rules: docs/card-plan-20261113.md.
import {useEffect,useState,type CSSProperties} from 'react';
import {Atom,Brain,CircleHelp,FlaskConical,Globe2,Leaf,Sigma,type LucideIcon} from 'lucide-react';
import sample from '@/lib/data/sample-deck-20261114.json';
import {base} from '@/lib/edition';
import '@/app/my-deck-20261114.css';

type Card={lv:number;author?:boolean;name:string;subject:string;src:string;art:string;no:string;url:string;headline:string;hook:string;found:string;matters:string};
const cards=sample as Card[];
const RARITY:Record<number,string>={1:'Common',2:'Uncommon',3:'Rare',4:'Holo rare',5:'Legendary'};
// Subject = the card's type: one icon and color each, like a trading card's type symbol.
const SUBJECT:Record<string,{icon:LucideIcon;color:string}>={
 // Each subject always has the same symbol and color (Astra, 2026-11-14: "psychology, which is always a brain in pink").
 Biology:{icon:Leaf,color:'#4f9a5e'},Psychology:{icon:Brain,color:'#d26a9a'},Chemistry:{icon:FlaskConical,color:'#d08a2e'},
 'Earth science':{icon:Globe2,color:'#3f8ccc'},Physics:{icon:Atom,color:'#d4664a'},Math:{icon:Sigma,color:'#2f9c95'}};
const FALLBACK={icon:CircleHelp,color:'#6b6470'};

function Stars({n}:{n:number}){
 return <span className="deck-stars" aria-label={`Difficulty ${n} of 5`}><em>Difficulty</em>{[1,2,3,4,5].map(i=><i key={i} className={i<=n?'on':''} aria-hidden="true">★</i>)}</span>;
}

// Sparkles from Astra's portfolio (findastra.github.io, the twinkles over her portrait): four-point stars that grow,
// turn 45 degrees and fade, placed by a hash so each card keeps its own pattern. Rainbow on Holo rare, gold on Legendary.
function hash(s:string){let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0}
function Glitter({seed,gold,count=14,whole=false}:{seed:string;gold:boolean;count?:number;whole?:boolean}){
 const RAINBOW=[330,20,50,140,190,260],GOLD=['hsl(45 95% 72%)','hsl(40 90% 62%)','hsl(50 100% 88%)','hsl(35 85% 58%)'];
 return <span className={'deck-glitter'+(gold?' gold':'')+(whole?' whole':'')} aria-hidden="true">{Array.from({length:count},(_,i)=>{
  const k=hash(seed+':'+i);
  const style={'--x':`${8+(k%84)}%`,'--y':`${8+((k>>>7)%84)}%`,'--s':`${3.2+((k>>>14)%40)/10}cqw`,'--d':`${((k>>>20)%30)/10}s`,
   '--c':gold?GOLD[(k>>>24)%GOLD.length]:`hsl(${RAINBOW[(k>>>24)%RAINBOW.length]} 70% 78%)`} as CSSProperties;
  return <i key={i} style={style}/>;
 })}</span>;
}

// "Read it?" tick, kept in this browser per card.
const READ_KEY='paper-girl:read:v1';
function useRead(no:string):[boolean,(v:boolean)=>void]{
 const [read,setRead]=useState(false);
 useEffect(()=>{try{setRead(!!JSON.parse(localStorage.getItem(READ_KEY)||'{}')[no])}catch{}},[no]);
 return [read,(v:boolean)=>{setRead(v);try{const m=JSON.parse(localStorage.getItem(READ_KEY)||'{}');if(v)m[no]=1;else delete m[no];localStorage.setItem(READ_KEY,JSON.stringify(m))}catch{}}];
}

function DeckCard({card}:{card:Card}){
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
 const flip=(e:{target:EventTarget})=>{if(own(e.target))return;turn()};
 // Gold card (Astra, 2026-11-14): Legendary or verified by its author = the whole card is gold, whatever the subject,
 // with sparkles over the whole card. The Type stat's colored chip still tells the subject.
 const gold=card.lv>=5||!!card.author;
 return <div className={'deck-slot '+(card.author?'author':'lv'+card.lv)+(gold?' gold-card':'')} style={{'--sc':type.color} as CSSProperties}>
  <div className={'deck-card'+(flipped?' flipped':'')+(sweep?` sweep${sweep}`:'')} role="button" tabIndex={0} aria-pressed={flipped}
   aria-label={`${card.name}, ${card.subject}, ${rarity}, level ${card.lv}. Tap to flip.`}
   onClick={flip} onKeyDown={e=>{if((e.key==='Enter'||e.key===' ')&&!own(e.target)){e.preventDefault();turn()}}}>
   <div className="deck-inner">
    <div className="deck-face deck-front">
     {gold&&<Glitter seed={card.no+':card'} gold count={22} whole/>}
     <div className="deck-top">
      <span className="deck-type" title={card.subject}><TypeIcon aria-hidden="true"/></span>
      <p className="deck-name">{card.name}</p>
      <span className="deck-lv" aria-label={`Level ${card.lv}`}><b>{card.lv}</b></span>
     </div>
     <div className="deck-frame"><div className="deck-window"><img src={`${base}art/${card.art}`} alt="" loading="lazy"/>
      {(card.lv>=4||gold)&&<Glitter seed={card.no} gold={gold}/>}</div></div>
     <div className="deck-stats">
      <div><span>type</span><b className="deck-type-stat"><i aria-hidden="true"><TypeIcon/></i>{card.subject}</b></div>
      <div><span>paper</span><a href={card.url} target="_blank" rel="noreferrer">Open ↗</a></div>
      <label className="deck-read"><span>read paper</span><input type="checkbox" checked={read} onChange={e=>setRead(e.target.checked)} aria-label={`I read ${card.name}`}/><b>{read?'Read':'Not yet'}</b></label>
     </div>
     <div className="deck-band"><span className="deck-rarity">{rarity}</span><Stars n={card.lv}/></div>
    </div>
    <div className="deck-face deck-back">
     {gold&&<Glitter seed={card.no+':back'} gold count={16} whole/>}
     <div className="deck-rim" aria-hidden="true"/>
     <div><h4>STRANGE HOOK</h4><p>{card.hook}</p></div>
     <div><h4>WHAT THEY FOUND</h4><p>{card.found}</p></div>
     <div><h4>WHY IT MATTERS</h4><p>{card.matters}</p></div>
     <div className="deck-bfoot">
      <a href={card.url} target="_blank" rel="noreferrer">Read the paper ↗</a>
      {card.author&&<span className="deck-approved">✍ Approved by its author</span>}
      <span>No. {card.no}</span>
     </div>
    </div>
   </div>
  </div>
 </div>;
}

export function MyDeck(){
 return <section className="my-deck" aria-labelledby="my-deck-title">
  <div className="my-deck-head"><h2 id="my-deck-title">My deck</h2><span>{cards.length} cards, one of each rarity · tap a card to flip it</span></div>
  <div className="my-deck-grid">{cards.map(c=><DeckCard key={c.no} card={c}/>)}</div>
 </section>;
}
