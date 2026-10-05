import {createInterface} from 'node:readline';
const url=process.argv[2];
if(!url)throw new Error('Usage: node scripts/index-library.mjs <site URL> [--service]');
let token;
if(process.argv.includes('--service')){
  // Service credentials stay in memory and stdin, never arguments or files.
  process.stdout.write('Ready for service credential on stdin (hidden).\n');
  if(process.stdin.isTTY)process.stdin.setRawMode(true);
  token=await new Promise(resolve=>{let value='';process.stdin.on('data',chunk=>{for(const c of chunk.toString()){if(c==='\n'||c==='\r'){process.stdin.pause();if(process.stdin.isTTY)process.stdin.setRawMode(false);resolve(value);return}value+=c}});process.stdin.resume()});
}
let failures=0,lastPrinted=0;
for(let batch=0;batch<1000;batch++){
  try{
    const r=await fetch(new URL('/api/index',url),{method:'POST',headers:token?{'OAI-Sites-Authorization':`Bearer ${token}`}:{},signal:AbortSignal.timeout(45000)});
    if(!r.ok)throw Error(`Index request returned ${r.status}`);
    const state=await r.json();
    failures=0;
    if(state.scanned-lastPrinted>=5000||state.complete){console.log(JSON.stringify(state));lastPrinted=state.scanned}
    if(state.complete)process.exit(0);
    await new Promise(r=>setTimeout(r,state.busy?2500:250));
  }catch(error){if(++failures>=3)throw error;console.log('Indexing paused; retrying the saved position.');await new Promise(r=>setTimeout(r,2000*failures))}
}
throw Error('Indexing stopped at the batch limit; rerun to resume.');
