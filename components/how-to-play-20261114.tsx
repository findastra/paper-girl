"use client";
// "How to play Papermon" (Astra, 2026-11-14): a button under the draw buttons opens these rules in a pop-up. The
// objective is to read as many papers as you can. Rarity rules follow docs/card-plan-20261113.md; when the rule for
// older and author-verified papers is decided, add it to the Rarity list here.
import type {CSSProperties} from 'react';
import {SUBJECTS} from '@/components/my-deck-20261114';

const RARITIES=[
 {stars:1,name:'Common',look:'plain gray band'},
 {stars:2,name:'Uncommon',look:'pale blue band'},
 {stars:3,name:'Rare',look:'polished silver band and frame'},
 {stars:4,name:'Holo rare',look:'rainbow frame and sparkles on the picture'},
 {stars:5,name:'Legendary',look:'the whole card is gold'},
];

export function HowToPlay(){
 return <div className="source-dialog-copy howto">
  <h3>The goal</h3>
  <p>Read as many papers as you can. Every card is a real, published study. When you finish the original article, tick
   <b> Completion</b> on the card: the circle turns gold, and that article’s reading time is added to the minutes at the
   top of your deck.</p>
  <h3>Draw a card</h3>
  <p>Under the card of the day, pick a subject (the rainbow circle means any subject), a reading difficulty (tap a
   star; tap it again for any) and how long ago it was published. Then press <b>Draw a card</b>. If the library has no
   card like that yet, you get a real paper to read, and Paper Patty makes its card later.</p>
  <h3>Three ways to read</h3>
  <ul>
   <li><b>The card</b>: the idea in three short lines.</li>
   <li><b>The paper</b> beside it: about two minutes, with more of the story and the study’s small print.</li>
   <li><b>The original article</b>: the real thing, linked on the card and in the bibliography.</li>
  </ul>
  <h3>What makes a card rare</h3>
  <p>Rarity comes from the <b>reading difficulty</b>: how hard the original article is to understand. The stars on
   the card show it.</p>
  <ul className="howto-rarity">{RARITIES.map(r=><li key={r.stars}><span className="howto-stars" aria-label={`${r.stars} of 5`}>{'★'.repeat(r.stars)}</span>
   <b>{r.name}</b> <span>{r.look}</span></li>)}</ul>
  <h3>Subjects</h3>
  <p>Each subject has its own symbol and color. Hover a symbol anywhere on the site to see its name.</p>
  <ul className="howto-subjects">{SUBJECTS.map(s=>{const Icon=s.icon;return <li key={s.name} style={{'--sc':s.color} as CSSProperties}>
   <i aria-hidden="true"><Icon/></i>{s.name.replace(/\b\w/g,c=>c.toUpperCase())}</li>})}</ul>
  <h3>Your deck</h3>
  <p>Your deck is at the bottom of the page, saved in this browser. For now everyone starts with the same five
   cards. Tap a card to flip it; its back has buttons for the longer write-up and the original article. The line at
   the top counts your cards by subject, how many you have read, and your minutes of reading.</p>
  <h3>Every day</h3>
  <p>A new card of the day appears every morning. <b>Order my deck</b> will let you order your cards printed
   (coming soon).</p>
 </div>;
}
