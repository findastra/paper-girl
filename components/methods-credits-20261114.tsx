"use client";
// "Methods & credits" pop-up (Astra, 2026-11-14: in place of "Where the science comes from", something like "game design
// methodology and credits"): where the papers come from, how a card is made, what each number on a card means, the
// honest limits, and who made what. The rarity numbers come from SCORE and TIERS, the journals from lib/science, the
// draws from DRAWS_PER_DAY, so this stays true when they change.
import {SCORE,TIERS,RARITY} from '@/components/my-deck-20261114';
import {DRAWS_PER_DAY} from '@/components/draw-bar-20261114';
import {journals} from '@/lib/science';

export function MethodsCredits(){
 const shelf=Object.values(journals).map(j=>j.name);
 return <div className="source-dialog-copy methods">
  <h3>Where the papers come from</h3>
  <p>Every card is a real, published research article. Papermon finds them through{' '}
   <a href="https://europepmc.org/" target="_blank" rel="noreferrer">Europe PMC</a>, from open-access journals:{' '}
   {shelf.slice(0,-1).join(', ')} and {shelf[shelf.length-1]}. Only articles under a CC BY license with the publisher’s own
   plain summary are used; reviews, preprints and papers with a retraction or concern notice are skipped. Every card
   links to its original article.</p>
  <h3>How a card is made</h3>
  <p>Paper Patty, Papermon’s writer, reads the paper and the publisher’s summary and writes the card: a name, the
   three-part story on the back, and the two-minute write-up on the paper. The picture is drawn in one cartoon style,
   and its hero is always a creature with eyes. Nothing on a card is made up: no moves or invented stats.</p>
  <h3>What the numbers mean</h3>
  <ul>
   <li><b>Read time:</b> how long the full original article takes to read, counting its words at 230 words a minute.</li>
   <li><b>Reading difficulty</b> (1–5 stars, also the card’s LV.): how hard the original paper is to read.</li>
   <li><b>Rarity score:</b> {SCORE.perStar} points for each star, {SCORE.perYear} for every year since the paper came
    out, and {SCORE.author} when the paper’s own author has checked the card.{' '}
    {TIERS.map((t,i)=>`${t.min}${t.max===null?'+':`–${t.max}`} ${RARITY[t.tier]}${i<TIERS.length-1?', ':'.'}`).join('')}</li>
   <li><b>Card No.:</b> the order cards are minted in. <b>Minted</b> is the day the card was made.</li>
   <li><b>Draws:</b> {DRAWS_PER_DAY} a day for each reader, because every new card is written and checked.</li>
  </ul>
  <h3>Honest limits</h3>
  <p>One study is one piece of evidence. The cards and the write-up keep each study’s real scope but leave detail out;
   the original article is always the full story. Subjects are matched from titles and summaries, and today’s journals
   are mostly life science, so some subjects have few papers so far.</p>
  <h3>Credits</h3>
  <ul>
   <li><b>Game design:</b> Astra.</li>
   <li><b>The science:</b> each paper’s authors and journal, used under their CC BY licenses (see the card’s
    bibliography and More information).</li>
   <li><b>Paper search:</b> Europe PMC.</li>
   <li><b>Writing:</b> Claude (Anthropic). <b>Card pictures:</b> OpenAI’s image model.</li>
   <li><b>Fonts:</b> Luckiest Guy, Caveat, DM Sans and Space Grotesk, from Google Fonts.</li>
  </ul>
  <p className="methods-by">By Astra.</p>
 </div>;
}
