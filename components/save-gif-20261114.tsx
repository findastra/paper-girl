"use client";
// Save as GIF (Astra, 2026-11-14): "a button somewhere in your deck ... you can click which ones you want to save, and
// then they all save as the exact separate files ... I want them to be GIFs ... transferable right on to Discord".
// Pick cards, then each one becomes its own looping GIF of the real card: the front with a light sweeping across it,
// a flip, the back (with its QR code to the article), and a flip back. Everything happens in the visitor's browser;
// nothing is uploaded. The GIFs are 400 × 560 and a few megabytes, under Discord's 10 MB limit.
import {useState,type ComponentType} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {toCanvas} from 'html-to-image';
import {GIFEncoder,quantize,applyPalette} from 'gifenc';
import {Film,Download,Share2} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {base} from '@/lib/edition';
import type {Card} from '@/components/my-deck-20261114';
import '@/app/card-extras-20261114.css';

const W=400,H=560;   // the card's 5 : 7
type Made={card:Card;name:string;blob:Blob;url:string};

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver'}).format(new Date()).replaceAll('-','');
const fileName=(c:Card)=>`papermon-${c.no.replace(/\D/g,'').slice(-4)}-${c.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${today()}.gif`;
const tick=()=>new Promise(r=>setTimeout(r,0));

/**
 * html-to-image waits for an animation frame after each picture it loads, and a page that isn't on screen gets no
 * frames (a browser window covered by Discord while the GIFs are made, a hidden window), so it would wait forever.
 * While a card is photographed, a frame that hasn't come within 100 ms is replaced by a timer.
 */
async function withFrameFallback<T>(work:()=>Promise<T>):Promise<T>{
 const raf=window.requestAnimationFrame;
 window.requestAnimationFrame=(cb:FrameRequestCallback)=>{
  let done=false;const run=(t:number)=>{if(!done){done=true;cb(t)}};
  const id=raf.call(window,run);setTimeout(()=>run(performance.now()),100);return id;
 };
 try{return await work()}finally{window.requestAnimationFrame=raf}
}

/**
 * The cards' paper and metal textures are SVG pictures drawn with filters (white Common cards: a marble texture
 * multiplied over white). html-to-image paints those black, so on the off-screen copy each one is first turned into
 * a plain PNG picture of itself; the card looks the same and photographs correctly.
 */
const rasters=new Map<string,Promise<string>>();
function raster(svg:string){
 if(!rasters.has(svg))rasters.set(svg,new Promise<string>(done=>{
  const img=new Image();
  img.onload=()=>{const c=document.createElement('canvas');c.width=img.naturalWidth||420;c.height=img.naturalHeight||420;
   c.getContext('2d')!.drawImage(img,0,0);try{done(c.toDataURL('image/png'))}catch{done(svg)}};
  img.onerror=()=>done(svg);img.src=svg;
 }));
 return rasters.get(svg)!;
}
async function flattenSvgTextures(root:HTMLElement){
 await Promise.all([root,...root.querySelectorAll<HTMLElement>('*')].map(async el=>{
  const bg=getComputedStyle(el).backgroundImage;
  if(!bg.includes('data:image/svg+xml'))return;
  let out=bg;
  for(const [,svg] of bg.matchAll(/url\("(data:image\/svg\+xml[^"]*)"\)/g))out=out.replace(svg,await raster(svg));
  el.style.backgroundImage=out;
 }));
}

/** Draws one card off screen, exactly as the deck shows it, and photographs its front and back. */
async function photograph(card:Card,CardView:ComponentType<{card:Card}>){
 return withFrameFallback(()=>photographNow(card,CardView));
}
async function photographNow(card:Card,CardView:ComponentType<{card:Card}>){
 const host=document.createElement('div');
 host.className='gif-stage';
 // Inside My deck, so the deck's own styles apply to it
 (document.querySelector('.my-deck')||document.body).appendChild(host);
 const root=createRoot(host);
 try{
  flushSync(()=>root.render(<CardView card={card}/>));
  const imgs=[...host.querySelectorAll('img')];
  for(const i of imgs)i.loading='eager';
  await Promise.all(imgs.map(i=>i.complete&&i.naturalWidth?null:new Promise(r=>{i.onload=i.onerror=()=>r(null)})));
  await Promise.all(imgs.map(i=>i.decode?.().catch(()=>null)));
  await document.fonts?.ready;
  await flattenSvgTextures(host);
  // A short pause for the browser to lay the card out. A timer, not animation frames: a page that isn't on screen
  // (a phone switched to another app, a hidden window) gets no frames, and the GIF would wait forever.
  await new Promise(r=>setTimeout(r,80));
  const face=(sel:string)=>toCanvas(host.querySelector(sel) as HTMLElement,{width:W,height:H,pixelRatio:1,
   style:{transform:'none',backfaceVisibility:'visible',boxShadow:'none'}});
  return {front:await face('.deck-front'),back:await face('.deck-back')};
 }finally{root.unmount();host.remove()}
}

/** The frames of one loop: sweep light over the front, hold, flip, hold the back, flip back. Delays in ms. */
function* frames(front:HTMLCanvasElement,back:HTMLCanvasElement):Generator<[CanvasRenderingContext2D,number]>{
 const cv=document.createElement('canvas');cv.width=W;cv.height=H;
 const ctx=cv.getContext('2d',{willReadFrequently:true})!;
 const sweep=(p:number)=>{
  ctx.clearRect(0,0,W,H);ctx.drawImage(front,0,0);
  const g=ctx.createLinearGradient(0,0,W,H),at=-.25+p*1.5;
  for(const [o,a] of [[at-.14,0],[at,.42],[at+.14,0]] as const)if(o>=0&&o<=1)g.addColorStop(o,`rgba(255,255,255,${a})`);
  if(at+.14>0&&at-.14<1){ctx.globalCompositeOperation='source-atop';ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.globalCompositeOperation='source-over'}
 };
 const turn=(a:HTMLCanvasElement,b:HTMLCanvasElement,k:number,n:number)=>{
  const s=Math.cos(Math.PI*k/n),img=s>=0?a:b,w=Math.max(1,Math.abs(s)*W);
  ctx.clearRect(0,0,W,H);ctx.drawImage(img,(W-w)/2,0,w,H);
 };
 const N=22,F=8;
 for(let i=0;i<N;i++){sweep(i/(N-1));yield [ctx,50]}
 ctx.clearRect(0,0,W,H);ctx.drawImage(front,0,0);yield [ctx,900];
 for(let k=1;k<F;k++){turn(front,back,k,F);yield [ctx,35]}
 ctx.clearRect(0,0,W,H);ctx.drawImage(back,0,0);yield [ctx,2800];
 for(let k=1;k<F;k++){turn(back,front,k,F);yield [ctx,35]}
}

async function makeGif(card:Card,CardView:ComponentType<{card:Card}>):Promise<Blob>{
 const {front,back}=await photograph(card,CardView);
 // One palette for the whole loop (no flicker between frames): 255 colors from both faces, plus one see-through
 // color for the rounded corners and the space around the card while it flips.
 const sample=new Uint8ClampedArray(W*H*8);
 sample.set(front.getContext('2d')!.getImageData(0,0,W,H).data,0);
 sample.set(back.getContext('2d')!.getImageData(0,0,W,H).data,W*H*4);
 const colors=quantize(sample,255,{format:'rgb565'}),palette=[...colors,[0,0,0]],clear=palette.length-1;
 const gif=GIFEncoder();let first=true,n=0;
 for(const [ctx,delay] of frames(front,back)){
  const rgba=ctx.getImageData(0,0,W,H).data,index=applyPalette(rgba,colors,'rgb565');
  for(let p=0,i=3;p<index.length;p++,i+=4)if(rgba[i]<128)index[p]=clear;
  gif.writeFrame(index,W,H,{palette,delay,transparent:true,transparentIndex:clear,dispose:2,...(first?{repeat:0}:{})});
  first=false;if(++n%6===0)await tick();
 }
 gif.finish();
 return new Blob([gif.bytes()],{type:'image/gif'});
}

function save(m:Made){const a=document.createElement('a');a.href=m.url;a.download=m.name;document.body.appendChild(a);a.click();a.remove()}

export function SaveGifButton({cards,Card:CardView}:{cards:Card[];Card:ComponentType<{card:Card}>}){
 const [open,setOpen]=useState(false),[picked,setPicked]=useState<Set<string>>(new Set());
 const [busy,setBusy]=useState(''),[made,setMade]=useState<Made[]>([]),[error,setError]=useState('');
 const toggle=(no:string)=>setPicked(s=>{const t=new Set(s);if(t.has(no))t.delete(no);else t.add(no);return t});
 const reset=()=>{made.forEach(m=>URL.revokeObjectURL(m.url));setMade([]);setError('')};
 const close=(o:boolean)=>{if(busy)return;setOpen(o);if(!o){reset();setPicked(new Set())}};
 const chosen=cards.filter(c=>picked.has(c.no));
 async function make(){
  reset();const out:Made[]=[];
  try{
   for(const [i,c] of chosen.entries()){
    setBusy(`Making ${i+1} of ${chosen.length}: ${c.name}…`);await tick();
    const blob=await makeGif(c,CardView);out.push({card:c,name:fileName(c),blob,url:URL.createObjectURL(blob)});
   }
   setMade(out);
  }catch(e){out.forEach(m=>URL.revokeObjectURL(m.url));setError(`Something went wrong making the GIFs (${(e as Error).message||e}). Please try again.`)}
  finally{setBusy('')}
 }
 async function saveAll(){for(const m of made){save(m);await new Promise(r=>setTimeout(r,450))}}
 const files=()=>made.map(m=>new File([m.blob],m.name,{type:'image/gif'}));
 const canShare=typeof navigator!=='undefined'&&!!navigator.canShare&&made.length>0&&navigator.canShare({files:files()});
 const share=()=>navigator.share({files:files(),title:'Papermon cards'}).catch(()=>null);
 const mb=(b:Blob)=>`${(b.size/1048576).toFixed(1)} MB`;
 return <>
  <button type="button" className="pick-more deck-gif" onClick={()=>setOpen(true)}><Film size={16} aria-hidden="true"/>Save as GIF</button>
  <Dialog open={open} onOpenChange={close}>
   <DialogContent className="gif-dialog">
    <DialogTitle>Save cards as GIFs</DialogTitle>
    <DialogDescription>Pick the cards to save. Each one becomes its own animated GIF: the front with a light sweeping
     across it, a flip, then the back with its QR code. Drop them straight into Discord.</DialogDescription>
    {!made.length&&<>
     <div className="gif-all">
      <button type="button" onClick={()=>setPicked(new Set(cards.map(c=>c.no)))} disabled={!!busy}>Select all</button>
      <button type="button" onClick={()=>setPicked(new Set())} disabled={!!busy||!picked.size}>Clear</button>
      <span>{picked.size} of {cards.length} picked</span>
     </div>
     <ul className="gif-list">{cards.map(c=><li key={c.no}><label>
      <input type="checkbox" checked={picked.has(c.no)} onChange={()=>toggle(c.no)} disabled={!!busy}/>
      <img src={`${base}art/${c.art}`} alt="" loading="lazy"/>
      <span><b>{c.name}</b><small>No. {c.no.replace(/\D/g,'').slice(-4)} · {c.subject}</small></span>
     </label></li>)}</ul>
     <button type="button" className="gif-go" onClick={make} disabled={!!busy||!picked.size}>
      {busy?'Making GIFs…':`Make ${picked.size||''} GIF${picked.size===1?'':'s'}`}</button>
    </>}
    <p className="gif-status" role="status" aria-live="polite">{busy||error}</p>
    {made.length>0&&<>
     <ul className="gif-list gif-done">{made.map(m=><li key={m.name}>
      <img src={m.url} alt={`${m.card.name} as a GIF`}/>
      <span><b>{m.card.name}</b><small>{m.name} · {mb(m.blob)}</small></span>
      <button type="button" onClick={()=>save(m)} aria-label={`Save ${m.name}`}><Download size={16} aria-hidden="true"/>Save</button>
     </li>)}</ul>
     <div className="gif-all gif-finish">
      <button type="button" className="gif-go" onClick={saveAll}><Download size={16} aria-hidden="true"/>{made.length>1?`Save all ${made.length}`:'Save'}</button>
      {canShare&&<button type="button" className="gif-go" onClick={share}><Share2 size={16} aria-hidden="true"/>Share</button>}
      <button type="button" onClick={reset}>Pick again</button>
     </div>
    </>}
   </DialogContent>
  </Dialog>
 </>;
}
