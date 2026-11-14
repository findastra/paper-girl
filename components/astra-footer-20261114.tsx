// Astra's unified footer, copied from Spoonfed (findastra/spoonfed App.tsx AstraFooter, 2026-11-14), the same footer as
// on her pet program pages and findastra.github.io: a soft fading line, "By Astra", a sparkle, her star, a sparkle,
// "Find Out More" and the GitHub link. Rules carried over: the star is a picture, never a link (2026-11-13); GitHub is
// the only link (2026-11-13); no black outline on the sparkles (2026-11-13); serif words, small.
const SPARKLE = '#D994C6';
const STAR = 'https://findastra.github.io/astras-star-window/star-window.svg';
const GITHUB = 'M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.09c-3.14.68-3.8-1.33-3.8-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.73 1.16 1.73 1.16 1 1.73 2.63 1.23 3.27.94.1-.73.4-1.23.71-1.51-2.51-.29-5.15-1.26-5.15-5.58 0-1.23.44-2.24 1.16-3.03-.12-.29-.5-1.43.11-2.98 0 0 .95-.3 3.08 1.16A10.7 10.7 0 0 1 12 6.12c.95 0 1.9.13 2.8.38 2.14-1.46 3.08-1.16 3.08-1.16.61 1.55.23 2.69.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.33-2.65 5.29-5.17 5.57.41.35.77 1.03.77 2.08v3.09c0 .3.2.65.78.54A11.2 11.2 0 0 0 12 .8Z';

function Sparkle(){
 return <svg className="af-sparkle" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5 L14.7 9.3 L22.5 12 L14.7 14.7 L12 22.5 L9.3 14.7 L1.5 12 L9.3 9.3 Z" fill={SPARKLE}/></svg>;
}

export function AstraFooter(){
 return <div className="astra-footer" aria-label="By Astra and her links">
  <div className="af-row">
   <span className="af-title">By Astra</span>
   <Sparkle/>
   <span className="af-star"><img src={STAR} alt="" width={48} height={48}/></span>
   <Sparkle/>
   <span className="af-title">Find Out More</span>
   <a className="af-icon" href="https://github.com/findastra" target="_blank" rel="noreferrer" aria-label="GitHub: Astra">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={GITHUB} fill="currentColor"/></svg>
   </a>
  </div>
 </div>;
}
