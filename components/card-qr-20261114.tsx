"use client";
// The QR code on every card's back (Astra, 2026-11-14): "a mini one on the back that takes you right to the article ...
// something that's cuter than a QR code ... next to the left of the seal". A phone's camera only reads real QR codes
// (made-up codes like Spotify's need their own app), so this is a real QR code made cute instead: round dots, the three
// corner squares drawn as eyes (every Papermon hero has eyes), and the gold Papermon sparkle in the middle. Error
// correction M lets a camera read it with the middle covered, and keeps the squares big enough to read at GIF size:
// tested with a QR reader on every card, down to 72 px wide (Q, with smaller squares, failed there). It opens the
// original article (the card's DOI link).
import {useMemo} from 'react';
import {encode} from 'uqr';

const INK = '#2b1d0e';
const GOLD = '#c9952e';
const MARGIN = 2;   // light space around the code, in modules (the white tile gives the rest of the quiet zone)
const HOLE = 5;     // the clear square in the middle for the sparkle, in modules (about 3% of the code)

export function CardQR({url, label}: {url: string; label: string}) {
  const {size, dots} = useMemo(() => {
    const {size, data, types} = encode(url, {ecc: 'M', border: 0});
    const lo = Math.floor((size - HOLE) / 2), hi = lo + HOLE;
    const dots: [number, number][] = [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      // Position = the three corner squares (drawn as eyes below); the middle stays clear for the sparkle.
      if (!data[y][x] || types[y][x] === 2) continue;
      if (x >= lo && x < hi && y >= lo && y < hi) continue;
      dots.push([x, y]);
    }
    return {size, dots};
  }, [url]);
  const box = size + MARGIN * 2, c = box / 2;
  // An eye fills a corner square's 7 × 7 modules: a round-cornered ring (the white of the eye) and a round pupil with
  // a small shine, so a camera still sees a dark ring, a light ring and a dark middle.
  const eye = (x: number, y: number, k: string) => <g key={k} transform={`translate(${x + MARGIN} ${y + MARGIN})`}>
    <rect x=".5" y=".5" width="6" height="6" rx="2.2" fill="none" stroke={INK} strokeWidth="1"/>
    <circle cx="3.5" cy="3.5" r="1.75" fill={INK}/>
    <circle cx="4.15" cy="2.85" r=".42" fill="#fff"/>
  </g>;
  return <a className="card-qr" href={url} target="_blank" rel="noreferrer" aria-label={`QR code: open the original article of ${label}`}
    title="Scan with a phone camera to open the original article">
    <svg viewBox={`0 0 ${box} ${box}`} role="img" aria-hidden="true">
      <rect width={box} height={box} rx="3.2" fill="#fff"/>
      <g fill={INK}>{dots.map(([x, y]) => <circle key={`${x}.${y}`} cx={x + MARGIN + .5} cy={y + MARGIN + .5} r=".43"/>)}</g>
      {eye(0, 0, 'a')}{eye(size - 7, 0, 'b')}{eye(0, size - 7, 'c')}
      {/* The Papermon sparkle (the four-point star from the gold dividers) in a little gold-rimmed circle */}
      <circle cx={c} cy={c} r={HOLE / 2 - .45} fill="#fff" stroke={GOLD} strokeWidth=".55"/>
      <path transform={`translate(${c} ${c}) scale(${(HOLE / 2 - 1.15) / 10})`} fill={GOLD}
        d="M0-10C.9-3.6 3.6-.9 10 0 3.6.9.9 3.6 0 10-.9 3.6-3.6.9-10 0-3.6-.9-.9-3.6 0-10Z"/>
    </svg>
  </a>;
}
