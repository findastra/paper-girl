import { buildQuery, defaultFilters, type Filters } from '@/lib/science';
import { selectPaper, logFailure } from '@/lib/catalog';
import { readerCookie, checkOrigin } from '@/lib/api';
import { LibraryError } from '@/lib/publisher';
export async function POST(request:Request){
  const {reader,headers}=readerCookie(request);
  try{checkOrigin(request)}catch{return Response.json({error:'Request origin not allowed.'},{status:403,headers})}
  let filters:Filters,id:string,current:string,exclude:string[];
  try{
    const body=await request.json() as Record<string,unknown>;
    if(!body || typeof body!=='object' || !body.filters || typeof body.filters!=='object')throw new Error('Choose valid filters.');
    filters={...defaultFilters,...body.filters};
    if(Object.entries(filters).some(([k,v])=>k==='humans'?typeof v!=='boolean':typeof v!=='string'))throw new Error('Choose valid filters.');
    buildQuery(filters);
    id=typeof body.requestId==='string' && /^[a-f0-9-]{36}$/.test(body.requestId)?body.requestId:crypto.randomUUID();
    current=typeof body.current==='string' && /^PMC\d+$/.test(body.current)?body.current:'';
    exclude=Array.isArray(body.exclude)?body.exclude.filter((p):p is string=>typeof p==='string' && /^PMC\d+$/.test(p)).slice(0,100):[];
  }catch(e){return Response.json({error:e instanceof Error?e.message:'Choose valid filters.'},{status:400,headers})}
  try{return Response.json(await selectPaper(filters,reader,current,id,exclude),{headers})}
  catch(error){
    const message=error instanceof LibraryError?error.message:'The journal library is taking too long. Please try again; your current paper is still here.';
    try{await logFailure(id,reader,filters,message,error instanceof LibraryError&&error.status===404?'no_match':'error')}catch{console.error('Could not save search outcome')}
    console.error('Discovery failed',error);
    return Response.json({error:message},{status:error instanceof LibraryError?error.status:503,headers});
  }
}
