"use client";
// The draw bar inside the card-of-the-day box (Astra, 2026-11-14): two wheels like Spoonfed's reels (Type and
// Difficulty), each turned by the mouse wheel, the arrows, a swipe or the keyboard, and a face-down deck of cards you
// click to draw from. The Type wheel shows the same pills as a card's type chip: colored circle, symbol, name capitalized.
import {useEffect,useRef,type ReactNode,type CSSProperties} from 'react';
import {ChevronUp,ChevronDown} from 'lucide-react';
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
