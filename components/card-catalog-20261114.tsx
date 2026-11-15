"use client";
/**
 * The Card Catalog as friends see it (Astra, 2026-11-14, card server deck Q4 and Q5: "Card Catalog"; everyone with the
 * link can browse every card and its thumbs counts, like a collector's checklist). Notes, reports and who made which
 * card stay on Astra's own page (server/owner-page-20261114.html). The button shows only while Papermon's card server
 * answers; without it there is no catalog to show, and the page works as before.
 */
import {useEffect,useMemo,useState} from 'react';
import {Library,ThumbsDown,ThumbsUp} from 'lucide-react';
import {Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {DeckCard,type Card} from '@/components/my-deck-20261114';
import {fetchCatalog,useDeckCards,useServerUp,type Tally} from '@/lib/card-server-20261114';
import '@/app/card-catalog-20261114.css';

const num=(no:string)=>parseInt(no.replace(/\D/g,''),10)||0;
const ORDERS={newest:{label:'Newest',sort:(a:Card,b:Card)=>num(b.no)-num(a.no)},no:{label:'Card No.',sort:(a:Card,b:Card)=>num(a.no)-num(b.no)}} as const;
type OrderKey=keyof typeof ORDERS|'liked';

function CardCatalog({onPick}:{onPick?:(c:Card)=>void}){
 const [data,setData]=useState<{cards:Card[];tallies:Record<string,Tally>}|null|'loading'>('loading');
 const [subject,setSubject]=useState(''),[order,setOrder]=useState<OrderKey>('newest');
 const mine=useDeckCards(),have=useMemo(()=>new Set(mine.map(c=>num(c.no))),[mine]);
 useEffect(()=>{let live=true;fetchCatalog().then(d=>{if(live)setData(d)});return()=>{live=false}},[]);
 if(data==='loading')return <p className="catalog-note">Opening the Card Catalog…</p>;
 if(!data)return <p className="catalog-note">The Card Catalog can’t be reached right now. Astra’s server may be asleep; try again later.</p>;
 // Tallies come keyed "000,006"; match them by the number itself
 const byNo=new Map(Object.entries(data.tallies).map(([k,v])=>[num(k),v]));
 const tally=(c:Card)=>byNo.get(num(c.no))||{up:0,down:0};
 const subjects=[...new Set(data.cards.map(c=>c.subject))].sort();
 const shown=data.cards.filter(c=>!subject||c.subject===subject)
  .sort(order==='liked'?(a,b)=>(tally(b).up-tally(b).down)-(tally(a).up-tally(a).down)||num(b.no)-num(a.no):ORDERS[order].sort);
 const held=data.cards.filter(c=>have.has(num(c.no))).length;
 return <div className="catalog">
  <div className="catalog-bar">
   <span className="catalog-count"><b>{data.cards.length}</b> {data.cards.length===1?'card':'cards'} · <b>{held}</b> in your deck</span>
   <label className="deck-pick"><span>Subject</span><select value={subject} onChange={e=>setSubject(e.target.value)}>
    <option value="">All</option>{subjects.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
   <label className="deck-pick"><span>In order of</span><select value={order} onChange={e=>setOrder(e.target.value as OrderKey)}>
    <option value="newest">Newest</option><option value="no">Card No.</option><option value="liked">Most liked</option></select></label>
  </div>
  <div className="catalog-grid">{shown.map(c=>{const t=tally(c);return <figure key={c.no} className="catalog-item">
   <DeckCard card={c} onPick={onPick}/>
   <figcaption><span className="catalog-thumbs" aria-label={`${t.up} thumbs up, ${t.down} thumbs down`}>
    <ThumbsUp aria-hidden="true"/>{t.up}<ThumbsDown aria-hidden="true"/>{t.down}</span>
    {have.has(num(c.no))&&<span className="catalog-have">In your deck</span>}</figcaption>
  </figure>})}</div>
 </div>;
}

/** "Card Catalog" under Draw Card, beside Rules: opens every card anyone has drawn. Nothing shows without the server. */
export function CardCatalogButton({onPick}:{onPick?:(c:Card)=>void}){
 const up=useServerUp(),[open,setOpen]=useState(false);
 if(!up)return null;
 return <Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild><button type="button" className="pick-more"><Library size={16} aria-hidden="true"/>Card Catalog</button></DialogTrigger>
  <DialogContent className="source-dialog catalog-dialog">
   <DialogTitle>Card Catalog</DialogTitle>
   <DialogDescription>Every card anyone has drawn, numbered in the order Papermon made them. Tap a card to turn it over.</DialogDescription>
   {open&&<CardCatalog onPick={onPick&&(c=>{setOpen(false);onPick(c)})}/>}
  </DialogContent>
 </Dialog>;
}
