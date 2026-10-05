import { indexStatus, syncIndex } from '@/lib/catalog';
import { checkOrigin, noStore, readerCookie } from '@/lib/api';
export async function GET(request:Request){const {headers}=readerCookie(request);try{return Response.json(await indexStatus(),{headers})}catch{return Response.json({error:'The article library is temporarily unavailable.'},{status:503,headers})}}
export async function POST(request:Request){
  try{checkOrigin(request)}catch{return Response.json({error:'Request origin not allowed.'},{status:403})}
  try{return Response.json(await syncIndex(),{headers:noStore})}catch(error){console.error('Index sync failed',error);return Response.json({error:'Indexing paused because the journal library could not be reached. Retry to continue from the saved position.'},{status:503,headers:noStore})}
}
