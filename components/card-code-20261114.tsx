"use client";
// "Enter Card Code" (Astra, 2026-11-14): a printed Papermon card comes with a code that adds the same card to your deck
// online. The code is only ever on the printed card, never on the site's cards, so it sits in a spot a screen never
// shows: under a small gold scratch-off strip along the bottom edge of the card's back. The pop-up shows a drawing of
// that spot.
//
// Printed cards are not out yet, and a code can only be checked by Papermon's server (a code kept in this site's own
// files would be readable by anyone), so Add to My Deck checks the shape of the code and says plainly that codes
// don't work yet. Nothing is stored.
import {useState,type FormEvent} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';

/** Card codes: "PM-" and two groups of four letters and digits, without the easily confused I, L, O and U. */
const CODE=/^PM-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
const EXAMPLE='PM-7K4Q-92XD';

/** A little trading card with a star: the button's picture. */
export function CardIcon({size=16}:{size?:number}){
 return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="card-icon">
  <rect x="3.25" y="1.25" width="9.5" height="13.5" rx="1.7" fill="none" stroke="currentColor" strokeWidth="1.5"/>
  <path d="M8 4.9l.95 1.9 2.1.3-1.52 1.48.36 2.1L8 9.7 6.11 10.68l.36-2.1L4.95 7.1l2.1-.3z" fill="currentColor"/>
 </svg>;
}

/** The mock: the back of a printed card, with the code's spot under a gold scratch-off strip at the bottom. */
function PrintedBackMock(){
 return <figure className="code-mock" aria-label="Where the card code is: under the gold scratch-off strip along the bottom edge of a printed card's back">
  <div className="code-mock-card">
   {['01 STRANGE HOOK','02 WHAT THEY FOUND','03 WHY IT MATTERS'].map(h=><div key={h} className="code-mock-section"><b>{h}</b><i/><i/><i className="short"/></div>)}
   <div className="code-mock-foot"><i/><i className="short"/></div>
   <div className="code-mock-strip"><span className="code-mock-foil">SCRATCH FOR CARD CODE</span><span className="code-mock-code">{EXAMPLE}</span></div>
  </div>
  <figcaption><b>Your card code is here:</b> on the back of a printed card, under the small gold scratch-off strip along the
   bottom edge. Cards on this site never show it.</figcaption>
 </figure>;
}

export function CardCodeButton(){
 const [open,setOpen]=useState(false),[code,setCode]=useState(''),[note,setNote]=useState('');
 const close=(o:boolean)=>{setOpen(o);if(!o){setCode('');setNote('')}};
 const tidy=(v:string)=>v.toUpperCase().replace(/[^0-9A-Z]/g,'').slice(0,10).replace(/^(PM)?(.{0,4})(.{0,4}).*$/,(_,_p,a,b)=>['PM',a,b].filter(Boolean).join('-'));
 const add=(e:FormEvent)=>{e.preventDefault();
  setNote(CODE.test(code)
   ?'Printed Papermon cards aren’t out yet, so no code works yet. When they are, Papermon checks your code and adds that card to your deck.'
   :`Card codes look like ${EXAMPLE}: PM and two groups of four letters and numbers.`)};
 return <>
  <button type="button" className="pick-more pick-code" onClick={()=>setOpen(true)}><CardIcon/>Enter Card Code</button>
  <Dialog open={open} onOpenChange={close}>
   <DialogContent className="source-dialog card-form card-code">
    <DialogTitle>Enter Card Code</DialogTitle>
    <DialogDescription>Have a printed Papermon card? Its code adds the same card to your deck here.</DialogDescription>
    <PrintedBackMock/>
    <form onSubmit={add}>
     <label>Card code<input value={code} onChange={e=>{setCode(tidy(e.target.value));setNote('')}} placeholder={EXAMPLE}
      autoComplete="off" spellCheck={false} inputMode="text" aria-describedby="code-note"/></label>
     <button type="submit" className="card-form-send">Add to My Deck</button>
     {note&&<p id="code-note" className="code-note" role="status">{note}</p>}
    </form>
   </DialogContent>
  </Dialog>
 </>;
}
