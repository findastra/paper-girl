import { historyPage } from '@/lib/catalog';
import { noStore,pageParams } from '@/lib/api';
export async function GET(request:Request){try{const p=pageParams(request);return Response.json(await historyPage(p.query,p.offset),{headers:noStore})}catch{return Response.json({error:'Shared search history is temporarily unavailable. Please try again.'},{status:503,headers:noStore})}}
