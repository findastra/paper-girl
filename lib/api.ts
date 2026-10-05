export const noStore={'Cache-Control':'no-store'};
export function readerCookie(request:Request) {
  const existing=request.headers.get('cookie')?.match(/(?:^|;\s*)paper_reader=([a-f0-9-]{36})(?:;|$)/)?.[1];
  const reader=existing || crypto.randomUUID();
  return {reader,headers:{...noStore,...(!existing?{'Set-Cookie':`paper_reader=${reader}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(request.url).protocol==='https:'?'; Secure':''}`}:{})}};
}
export function checkOrigin(request:Request) {
  const origin=request.headers.get('origin');
  if(request.headers.get('sec-fetch-site')==='cross-site' || (origin && origin!==new URL(request.url).origin))throw new Error('Cross-site requests are not allowed.');
}
export function pageParams(request:Request){const u=new URL(request.url),n=Number(u.searchParams.get('offset') || 0);return {query:(u.searchParams.get('q') || '').trim().slice(0,120),offset:Number.isSafeInteger(n)&&n>=0?Math.min(n,10000000):0,readyOnly:u.searchParams.get('ready')==='1'}}
