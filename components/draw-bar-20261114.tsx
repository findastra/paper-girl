"use client";
// The draw bar inside the card-of-the-day box (Astra, 2026-11-14): two wheels like Spoonfed's reels (Type and
// Difficulty), each turned by the mouse wheel, the arrows, a swipe or the keyboard, and a face-down deck of cards you
// click to draw from. The Type wheel shows the same pills as a card's type chip: colored circle, symbol, name capitalized.
import {useEffect,useRef,useState,type ReactNode,type CSSProperties} from 'react';
import {ChevronUp,ChevronDown,Printer} from 'lucide-react';
import {TYPES} from '@/components/my-deck-20261114';

type Item={key:string;view:ReactNode;label:string};

function Reel({name,items,index,onChange,disabled,spinning}:{name:string;items:Item[];index:number;onChange:(i:number)=>void;disabled:boolean;spinning:boolean}){
 const n=items.length,turn=(d:number)=>{if(!disabled)onChange((index+d+n)%n)};
 const lastWheel=useRef(0),touchY=useRef<number|null>(null),drum=useRef<HTMLDivElement>(null),turnRef=useRef(turn);turnRef.current=turn;
 // The mouse wheel turns the reel and never scrolls the page while the pointer is on it. React's own onWheel is
 // passive, so this listener is added by hand with passive: false.
 useEffect(()=>{const el=drum.current;if(!el)return;
  const onWheel=(e:WheelEvent)=>{e.preventDefault();const now=Date.now();if(now-lastWheel.current<110)return;lastWheel.current=now;turnRef.current(e.deltaY>0?1:-1)};
  el.addEventListener('wheel',onWheel,{passive:false});return()=>el.removeEventListener('wheel',onWheel)},[]);
 const at=(d:number)=>items[(index+d+n)%n];
 return <div className={'reel'+(spinning?' spinning':'')}>
  <span className="reel-name">{name}</span>
  <div ref={drum} className="reel-drum" role="spinbutton" tabIndex={0} aria-label={name} aria-valuetext={items[index].label}
   aria-valuenow={index} aria-valuemin={0} aria-valuemax={n-1}
   onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();turn(1)}if(e.key==='ArrowUp'){e.preventDefault();turn(-1)}}}
   onTouchStart={e=>{touchY.current=e.touches[0].clientY}}
   onTouchEnd={e=>{if(touchY.current===null)return;const dy=e.changedTouches[0].clientY-touchY.current;touchY.current=null;if(Math.abs(dy)>18)turn(dy<0?1:-1)}}>
   <button className="reel-arrow" tabIndex={-1} aria-hidden="true" disabled={disabled} onClick={()=>turn(-1)}><ChevronUp size={16}/></button>
   <div className="reel-window">
    <div className="reel-item dim">{at(-1).view}</div>
    <div className="reel-item now" key={items[index].key}>{items[index].view}</div>
    <div className="reel-item dim">{at(1).view}</div>
   </div>
   <button className="reel-arrow" tabIndex={-1} aria-hidden="true" disabled={disabled} onClick={()=>turn(1)}><ChevronDown size={16}/></button>
  </div>
 </div>;
}

const typePill=(color:string,icon:ReactNode,label:string)=><span className="type-pill" style={{'--tc':color} as CSSProperties}><i aria-hidden="true">{icon}</i>{label}</span>;
export const TYPE_ITEMS:Item[]=[{key:'',label:'Any type',view:<span className="type-pill random"><i aria-hidden="true">?</i>Any type</span>},
 ...TYPES.map(t=>{const Icon=t.icon;return {key:t.name,label:t.label,view:typePill(t.color,<Icon/>,t.label)}})];
// Only the filled stars, 1 to 5 (Astra, 2026-11-14).
export const LEVEL_ITEMS:Item[]=[{key:'0',label:'Any difficulty',view:<span className="reel-text">Any</span>},
 ...[1,2,3,4,5].map(n=>({key:String(n),label:`${n} of 5`,view:<span className="reel-stars">{'★'.repeat(n)}</span>}))];

/**
 * The compact picker under the motto (Astra, 2026-11-14: "I don't like the scroll wheel anymore. Click a color or
 * rainbow, click the stars out of 5, and then click the draw"): a row of type circles (rainbow = any type), five stars
 * (click the same star again for any difficulty), and the face-down deck to draw from.
 */
/**
 * Draw odds by age (Astra, 2026-11-14: only "this year" or "a past year" to pick, and newer papers more likely,
 * "like 30% this year, 20% last year"). The chance that a drawn card's paper comes from each age group. Picking
 * "Past years" uses the same odds without this year. No limit on how old a paper can be.
 */
export const AGE_ODDS:{label:string;ago:[number,number];odds:number}[]=[
 {label:'this year',ago:[0,0],odds:30},{label:'last year',ago:[1,1],odds:20},{label:'2–5 years ago',ago:[2,5],odds:20},
 {label:'6–10 years ago',ago:[6,10],odds:15},{label:'11–20 years ago',ago:[11,20],odds:10},{label:'more than 20 years ago',ago:[21,10000],odds:5}];
export type AgeGroup=typeof AGE_ODDS[number];
/** The picker's choices: 1 = this year, 2 = past years; 0 = any year. */
export const YEAR_CHOICES=['This year','Past years'];
export function allowedGroups(choice:number){return choice===1?AGE_ODDS.slice(0,1):choice===2?AGE_ODDS.slice(1):AGE_ODDS}
export function groupOfYear(year:number){const ago=new Date().getFullYear()-year;return AGE_ODDS.find(g=>ago>=g.ago[0]&&ago<=g.ago[1])}
/** The search can look back to 1900. */
export function groupRange(g:AgeGroup){const y=new Date().getFullYear();return {from:Math.max(1900,y-g.ago[1]),to:y-g.ago[0]}}
export function weightedPick<T>(items:T[],weight:(t:T)=>number):T{
 const total=items.reduce((n,t)=>n+weight(t),0);let r=Math.random()*total;
 for(const t of items){r-=weight(t);if(r<0)return t}return items[items.length-1];
}

export function DrawPicker({busy,type,level,year,onType,onLevel,onYear,onDraw,status,children}:{busy:boolean;type:number;level:number;year:number;
 onType:(i:number)=>void;onLevel:(i:number)=>void;onYear:(i:number)=>void;onDraw:()=>void;status:string;children?:ReactNode}){
 // Order printed cards of your deck. Printing is not set up yet, so it says so instead of taking an order.
 const [ordering,setOrdering]=useState(false);
 // Redone 2026-11-14 (Astra did not like the little deck with "Draw" or the "Order my deck" pill): everything centered
 // under the card, type circles, then stars, then two matching buttons side by side: Draw a card (gold) and Order my deck.
 return <div className="draw-picker" aria-label="Draw a card"><div className="pick-left">
  <div className="pick-types" role="radiogroup" aria-label="Type">
   <button role="radio" aria-checked={type===0} title="Random type" aria-label="Random type" className={'pick-dot any'+(type===0?' on':'')} disabled={busy} onClick={()=>onType(0)}><i aria-hidden="true">?</i></button>
   {TYPES.map((t,i)=>{const Icon=t.icon;return <button key={t.name} role="radio" aria-checked={type===i+1} title={t.label} aria-label={t.label}
    className={'pick-dot'+(type===i+1?' on':'')} style={{'--tc':t.color} as CSSProperties} disabled={busy} onClick={()=>onType(i+1)}><i aria-hidden="true"><Icon/></i></button>})}
  </div>
  <div className="pick-stars" role="radiogroup" aria-label="Difficulty">
   {[1,2,3,4,5].map(n=><button key={n} role="radio" aria-checked={level===n} aria-label={`Reading difficulty ${n} of 5`} title={`Reading difficulty ${n}`}
    className={'pick-star'+(level>=n?' on':'')} disabled={busy} onClick={()=>onLevel(level===n?0:n)}>★</button>)}
   <span className="pick-any">{level?`reading difficulty ${level} of 5`:'any reading difficulty'}</span>
  </div>
  {/* Published: this year or past years; tap again for any year (newer papers are more likely, see AGE_ODDS) */}
  <div className="pick-years" role="radiogroup" aria-label="Published">
   {YEAR_CHOICES.map((label,i)=><button key={label} role="radio" aria-checked={year===i+1} className={'pick-year'+(year===i+1?' on':'')} disabled={busy}
    onClick={()=>onYear(year===i+1?0:i+1)}>{label}</button>)}
   <span className="pick-any">{year?'':'any year'}</span>
  </div></div>
  <div className="pick-actions">
   <button type="button" className={'pick-draw'+(busy?' busy':'')} disabled={busy} onClick={onDraw}><span className="pick-draw-icon" aria-hidden="true">✦</span>{busy?'Drawing…':'Draw a card'}<span className="pick-draw-icon" aria-hidden="true">✦</span></button>
   <button type="button" className="pick-order" aria-expanded={ordering} onClick={()=>setOrdering(o=>!o)}><Printer size={16} aria-hidden="true"/>Order my deck</button>
   {children}
   {ordering&&<p className="pick-order-note" role="status">Printed decks are coming soon. Your cards are saved here until then.</p>}
  </div>
  <span className="draw-status" role="status" aria-live="polite">{status}</span>
 </div>;
}

export function DrawBar({busy,spinning,type,level,onType,onLevel,onDraw,status}:{busy:boolean;spinning:boolean;
 type:number;level:number;onType:(i:number)=>void;onLevel:(i:number)=>void;onDraw:()=>void;status:string}){
 return <section className="draw-bar" aria-label="Draw a card">
  <div className="reels">
   <Reel name="Type" items={TYPE_ITEMS} index={type} onChange={onType} disabled={busy} spinning={spinning}/>
   <Reel name="Difficulty" items={LEVEL_ITEMS} index={level} onChange={onLevel} disabled={busy} spinning={spinning}/>
   {/* A face-down deck to draw from, instead of a plain button (Astra, 2026-11-14: "that's just ugly") */}
   <button className={'draw-deck'+(busy?' busy':'')} disabled={busy} onClick={onDraw} aria-label="Draw a card">
    <span className="draw-deck-cards" aria-hidden="true"><span/><span/><span className="top"><b>?</b></span></span>
    <span className="draw-deck-label">{busy?'Drawing…':'Draw'}</span>
   </button>
  </div>
  <span className="draw-status" role="status" aria-live="polite">{status}</span>
 </section>;
}
