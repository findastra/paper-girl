"use client";
// One gold surface behind the whole page (Astra, 2026-11-14: "if you were to cut a hole out in the page and look through
// it ... no matter where you move that hole, you would see the same on the other side ... one image behind it all, and
// it's moving in the same way").
//
// Every gold thing paints the same big repeating gold pattern (--sheen in app/my-deck-20261114.css). This keeps each
// one's piece of the pattern lined up with where it sits on the screen, so together they read as windows onto one sheet
// of gold, and slides the whole sheet slowly back and forth, all in step. GOLD lists every gold thing; the CSS block
// "One gold surface" lists the same ones.
//
// Smooth while drawing (Astra, 2026-11-19: "the sheen on the gold gets very glitchy when drawing"): the list of gold
// things is found again only when the page changes, every position is read before any is written (reading after a
// write made the browser lay the page out again for each gold thing, every frame), and positions leave out transforms,
// so the gold stays put on a card while it flips or a reel while it spins instead of sliding across it.
import {useEffect} from 'react';

export const GOLD=[
 '.pm-word','.pm-logo','.pm-tagline','.pick-motto','.pick-draw','.pick-year','.pick-order','.pick-more','.pick-random',
 '.deck-back-actions>*','.deck-dir','.deck-rate button','.pick-types.labeled .pick-dot','.pick-dot i','.tally-sub','.tally-sub i',
 '.howto-subjects i','.card-form-chips button','.card-form-send','.deck-pick select','.deck-type','.deck-stats a','.deck-no',
 '.pick-star','.read-dot','.sun-rays','.sun-disc','.pm-seal-gold','.gold-card .deck-face','.cotd-box','.my-deck','.matters-body',
 '.source-dialog','.code-mock-foil','.code-mock-card','.af-row','.af-sparkle','.af-star-gold','.pick-divider i','.pick-divider span','.card-form input','.card-form textarea','.deck-star-row i','.gold-card .deck-band','.gold-card .deck-frame','.gold-card .deck-rim',
].join(',');

/** How far the sheet slides (px, along the gold's diagonal) and how long one sweep takes (the gold card's old 9 s). */
const DRIFT=360,SWEEP=9000,OFFSET=1000;

/**
 * Where a gold thing's border box sits on the screen, without transforms: the layout position (offsetLeft/offsetTop up
 * the chain, less any scrolling). A pop-up (position: fixed) keeps its own on-screen place, transforms and all.
 */
function placeOf(el:Element):{x:number;y:number}{
 if(!(el instanceof HTMLElement)){const r=el.getBoundingClientRect();return {x:r.left,y:r.top}}
 let x=0,y=0,n:HTMLElement=el,top:HTMLElement=el;
 for(;;){
  x+=n.offsetLeft;y+=n.offsetTop;
  const p=n.offsetParent as HTMLElement|null;
  if(!p){top=n;break}
  x+=p.clientLeft;y+=p.clientTop;n=p;
 }
 const page=top===document.body||top===document.documentElement;
 if(!page){const r=top.getBoundingClientRect();x+=r.left-top.offsetLeft;y+=r.top-top.offsetTop}
 for(let a=el.parentElement;a&&a!==top&&a!==document.body&&a!==document.documentElement;a=a.parentElement){x-=a.scrollLeft;y-=a.scrollTop}
 if(page){x-=window.scrollX;y-=window.scrollY}
 return {x,y};
}

export function GoldSurface(){
 useEffect(()=>{
  let frame=0,els:HTMLElement[]=[],stale=true;
  const start=performance.now(),still=window.matchMedia('(prefers-reduced-motion: reduce)').matches,last=new WeakMap<Element,string>();
  // Find the gold things again only after the page changed (new cards, opened pop-ups, a button turning gold)
  const watch=new MutationObserver(()=>{stale=true});
  watch.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  const tick=(t:number)=>{
   if(stale){els=[...document.querySelectorAll<HTMLElement>(GOLD)];stale=false}
   // Back and forth, eased, like the gold card's sheen
   const k=still?0:(1-Math.cos((t-start)/SWEEP*Math.PI))/2,shift=k*DRIFT;
   const at=els.map(placeOf);
   els.forEach((el,i)=>{
    const v=`${(shift-at[i].x-OFFSET).toFixed(1)}px ${(shift-at[i].y-OFFSET).toFixed(1)}px`;
    if(last.get(el)!==v){last.set(el,v);el.style.setProperty('--gold-pos',v)}
   });
   frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
  return ()=>{cancelAnimationFrame(frame);watch.disconnect()};
 },[]);
 return null;
}
