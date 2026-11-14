"use client";
// One gold surface behind the whole page (Astra, 2026-11-14: "if you were to cut a hole out in the page and look through
// it ... no matter where you move that hole, you would see the same on the other side ... one image behind it all, and
// it's moving in the same way").
//
// Every gold thing paints the same big repeating gold pattern (--sheen in app/my-deck-20261114.css). This keeps each
// one's piece of the pattern lined up with where it sits on the screen, so together they read as windows onto one sheet
// of gold, and slides the whole sheet slowly back and forth, all in step. GOLD lists every gold thing; the CSS block
// "One gold surface" lists the same ones.
import {useEffect} from 'react';

export const GOLD=[
 '.pm-word','.pm-logo','.pm-tagline','.pick-motto','.pick-draw','.pick-year','.pick-order','.pick-more','.pick-random',
 '.deck-back-actions>*','.deck-dir','.deck-rate button','.pick-types.labeled .pick-dot','.pick-dot i','.tally-sub','.tally-sub i',
 '.howto-subjects i','.card-form-chips button','.card-form-send','.deck-pick select','.deck-type','.deck-stats a','.deck-no',
 '.pick-star','.read-dot','.sun-rays','.sun-disc','.pm-seal-gold','.gold-card .deck-face','.cotd-box','.my-deck','.matters-body',
 '.source-dialog','.card-form input','.card-form textarea','.deck-star-row i','.gold-card .deck-band','.gold-card .deck-frame','.gold-card .deck-rim',
].join(',');

/** How far the sheet slides (px, along the gold's diagonal) and how long one sweep takes (the gold card's old 9 s). */
const DRIFT=360,SWEEP=9000,OFFSET=1000;

export function GoldSurface(){
 useEffect(()=>{
  let frame=0;const start=performance.now(),still=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick=(t:number)=>{
   // Back and forth, eased, like the gold card's sheen
   const k=still?0:(1-Math.cos((t-start)/SWEEP*Math.PI))/2,shift=k*DRIFT;
   for(const el of document.querySelectorAll<HTMLElement>(GOLD)){
    const r=el.getBoundingClientRect();
    el.style.setProperty('--gold-pos',`${(shift-r.left-OFFSET).toFixed(1)}px ${(shift-r.top-OFFSET).toFixed(1)}px`);
   }
   frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
  return ()=>cancelAnimationFrame(frame);
 },[]);
 return null;
}
