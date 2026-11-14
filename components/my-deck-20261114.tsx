"use client";
// "My deck": the visitor's cards in a grid at the bottom of the main page (Astra, 2026-11-14: "it should just be
// below everything else so you can see everything all at once"). Tap a card to flip it.
// Front (Astra, 2026-11-14): the picture, always a perfect square; the name, a subject icon like a trading card's
// type symbol, the level, the headline, the rarity and difficulty stars. No links on the front.
// Back: the three sections, the "Read the paper" link, the source, the author status and the card number.
// DRAFT: shows ten sample cards and only when the address has ?deck (for example /paper-girl/?deck), so the live site
// is unchanged until real cards exist. Card rules: docs/card-plan-20261113.md.
import {useState} from 'react';
import {Atom,Brain,FlaskConical,Globe2,Leaf,Sigma,Sparkles,type LucideIcon} from 'lucide-react';
import sample from '@/lib/data/sample-deck-20261114.json';
import {base} from '@/lib/edition';
import '@/app/my-deck-20261114.css';

type Card={lv:number;author?:boolean;name:string;subject:string;src:string;art:number;no:string;url:string;headline:string;hook:string;found:string;matters:string};
const cards=sample as Card[];
const ART=['curious-brain','ecology-friends','cosmic-curiosity'];
const RARITY:Record<number,[string,string]>={1:['Common','●'],2:['Uncommon','◆'],3:['Rare','★'],4:['Holo rare','★'],5:['Legendary','✦']};
// Subject = the card's type: one icon and color each, like a trading card's type symbol.
const SUBJECT:Record<string,{icon:LucideIcon;color:string}>={
 Biology:{icon:Leaf,color:'#4f9a5e'},Psychology:{icon:Brain,color:'#d9709f'},Chemistry:{icon:FlaskConical,color:'#8a68d6'},
 'Earth science':{icon:Globe2,color:'#3f8ccc'},Physics:{icon:Atom,color:'#e0843a'},Math:{icon:Sigma,color:'#2f9c95'}};
const FALLBACK={icon:Sparkles,color:'#b0398a'};

function Stars({n}:{n:number}){
 return <span className="deck-stars" aria-label={`Difficulty ${n} of 5`}>{[1,2,3,4,5].map(i=><i key={i} className={i<=n?'on':''}>★</i>)}</span>;
}

function DeckCard({card}:{card:Card}){
 const [flipped,setFlipped]=useState(false);
 const [rarity,mark]=card.author?["Author's Edition",'✍']:RARITY[card.lv];
 const type=SUBJECT[card.subject]||FALLBACK;const TypeIcon=type.icon;
 const flip=(e:{target:EventTarget})=>{if((e.target as HTMLElement).closest('a'))return;setFlipped(f=>!f)};
 return <div className={'deck-slot '+(card.author?'author':'lv'+card.lv)}>
  <div className={'deck-card'+(flipped?' flipped':'')} role="button" tabIndex={0} aria-pressed={flipped}
   aria-label={`${card.name}, ${card.subject}, ${rarity}, level ${card.lv}. Tap to flip.`}
   onClick={flip} onKeyDown={e=>{if((e.key==='Enter'||e.key===' ')&&!(e.target as HTMLElement).closest('a')){e.preventDefault();setFlipped(f=>!f)}}}>
   <div className="deck-inner">
    <div className="deck-face deck-front">
     <div className="deck-top">
      <span className="deck-type" style={{background:type.color}} title={card.subject}><TypeIcon aria-hidden="true"/></span>
      <p className="deck-name">{card.name}</p>
      <span className="deck-lv">LV <b>{card.lv}</b></span>
     </div>
     <div className="deck-window"><img src={`${base}art/${ART[card.art]}-20261113.webp`} alt="" loading="lazy"/></div>
     <p className="deck-headline">{card.headline}</p>
     <div className="deck-band"><span className="deck-rarity">{mark} {rarity}</span><Stars n={card.lv}/></div>
    </div>
    <div className="deck-face deck-back">
     <div className="deck-rim" aria-hidden="true"/>
     <div><h4>STRANGE HOOK</h4><p>{card.hook}</p></div>
     <div><h4>WHAT THEY FOUND</h4><p>{card.found}</p></div>
     <div><h4>WHY IT MATTERS</h4><p>{card.matters}</p></div>
     <div className="deck-bfoot">
      <a href={card.url} target="_blank" rel="noreferrer">Read the paper ↗</a>
      <span>{card.subject} · {card.src}</span>
      <span>{card.author?'✍ Approved by its author':'Not yet seen by the authors'} · No. {card.no}</span>
     </div>
    </div>
   </div>
  </div>
 </div>;
}

export function MyDeck(){
 return <section className="my-deck" aria-labelledby="my-deck-title">
  <div className="my-deck-head"><h2 id="my-deck-title">My deck</h2><span>{cards.length} cards · tap a card to flip it · sample cards</span></div>
  <div className="my-deck-grid">{cards.map(c=><DeckCard key={c.no} card={c}/>)}</div>
 </section>;
}
