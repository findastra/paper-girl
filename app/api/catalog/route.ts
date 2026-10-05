import { catalogPage } from '@/lib/catalog';
import { noStore,pageParams } from '@/lib/api';
export async function GET(request:Request){try{const p=pageParams(request);return Response.json(await catalogPage(p.query,p.offset,p.readyOnly),{headers:noStore})}catch{return Response.json({error:'The article index is temporarily unavailable. Please try again.'},{status:503,headers:noStore})}}
