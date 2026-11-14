"use client";
// "How to play Papermon" (Astra, 2026-11-14): a button under the draw buttons opens these rules in a pop-up. The
// objective is to read as many papers as you can. The rarity chart is built from the same numbers the cards use
// (SCORE, TIERS in my-deck), so the two can never disagree. Rules: docs/card-plan-20261113.md.
import type {CSSProperties} from 'react';
import {SUBJECTS,SCORE,TIERS,RARITY} from '@/components/my-deck-20261114';
import {AGE_ODDS} from '@/components/draw-bar-20261114';

const LOOK:Record<number,string>={1:'plain gray band',2:'pale blue band',3:'polished silver band and frame',
 4:'rainbow frame and sparkles on the picture',5:'the whole card is gold'};
const range=(t:typeof TIERS[number])=>t.max===null?`${t.min}+`:`${t.min}–${t.max}`;
// Worked out from SCORE, so the examples follow any change to the weights.
const EXAMPLES=[{what:'A 2-star paper from 10 years ago',stars:2,age:10},{what:'A 1-star paper from 56 years ago',stars:1,age:56},
 {what:'A 2-star paper from last year, checked by its author',stars:2,age:1,author:true}].map(e=>{
 const score=e.stars*SCORE.perStar+e.age*SCORE.perYear+(e.author?SCORE.author:0);
 return {what:e.what,score,sum:`${e.stars} × ${SCORE.perStar} + ${e.age}${e.author?` + ${SCORE.author}`:''} = ${score}`}});
const tierOf=(s:number)=>[...TIERS].reverse().find(t=>s>=t.min)!.tier;

/** The rarity chart: what earns points, the score ranges as a colored scale, and worked examples. */
export function RarityChart(){
 return <div className="rarity-chart">
  <table className="rc-points"><thead><tr><th>What the card has</th><th>Points</th></tr></thead><tbody>
   <tr><td>Each reading-difficulty star (how hard the original article is)</td><td>{SCORE.perStar} per star, up to {SCORE.perStar*5}</td></tr>
   <tr><td>Each year since the paper came out</td><td>{SCORE.perYear} per year, no limit</td></tr>
   <tr><td>Checked by the paper’s own author</td><td>{SCORE.author}</td></tr>
  </tbody></table>
  <div className="rc-scale" role="img" aria-label={TIERS.map(t=>`${range(t)} ${RARITY[t.tier]}`).join(', ')}>
   {TIERS.map(t=><div key={t.tier} className={'rc-seg rc-t'+t.tier}><b>{RARITY[t.tier]}</b><span>{range(t)}</span></div>)}
  </div>
  <table className="rc-tiers"><thead><tr><th>Score</th><th>Rarity</th><th>How it looks</th></tr></thead><tbody>
   {TIERS.map(t=><tr key={t.tier}><td>{range(t)}</td><td><b>{RARITY[t.tier]}</b></td><td>{LOOK[t.tier]}</td></tr>)}
  </tbody></table>
  <ul className="rc-examples">{EXAMPLES.map(e=><li key={e.what}>{e.what}: {e.sum}, <b>{RARITY[tierOf(e.score)]}</b>.</li>)}</ul>
 </div>;
}

export function HowToPlay(){
 return <div className="source-dialog-copy howto">
  <h3>The goal</h3>
  <p>Read as many papers as you can. Every card is a real, published study. When you finish the original article, tick
   <b> Completion</b> on the card: the circle turns gold, and that article’s reading time is added to the minutes at the
   top of your deck.</p>
  <h3>Draw a card</h3>
  <p>Under the card of the day, pick a subject (the rainbow circle means any subject), a reading difficulty (tap a
   star; tap it again for any) and <b>This year</b> or <b>Past years</b> (tap again for any year). Then press
   <b> Draw a card</b>. If the library has no card like that yet, you get a real paper to read, and Paper Patty makes
   its card later.</p>
  <p>Newer papers come up more often. When the year is left open, a drawn card’s paper is from:</p>
  <table className="rc-points howto-odds"><thead><tr><th>Published</th><th>Chance</th></tr></thead><tbody>
   {AGE_ODDS.map(g=><tr key={g.label}><td>{g.label.replace(/^./,c=>c.toUpperCase())}</td><td>{g.odds}%</td></tr>)}
  </tbody></table>
  <p><b>Past years</b> uses the same odds without this year.</p>
  <h3>Three ways to read</h3>
  <ul>
   <li><b>The card</b>: the idea in three short lines.</li>
   <li><b>The paper</b> beside it: about two minutes, with more of the story and the study’s small print.</li>
   <li><b>The original article</b>: the real thing, linked on the card and in the bibliography.</li>
  </ul>
  <h3>What makes a card rare: the rarity score</h3>
  <p>Every card has a <b>rarity score</b>, shown on its bottom band. Harder papers, older papers and papers their
   own author has checked score higher. Because age counts, a card gets a point rarer every year you keep it.</p>
  <RarityChart/>
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
