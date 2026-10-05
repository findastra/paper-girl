export type Filters={topic:string;period:string;from:string;to:string;journal:string;humans:boolean};
export type Paper={pmcid:string;pmid:string;doi:string;title:string;authors:string;journal:string;year:number;publicationDate:string;articleUrl:string;fullTextUrl:string;summaryLabel:string;summaryParagraphs:string[];abstract:string;licenseUrl:string;copyright:string;topic?:string;headline?:string;takeaway?:string;plainParagraphs?:string[];caveat?:string;hook?:string;explanation?:string;importance?:string;discipline?:string};
export const defaultFilters:Filters={topic:'Everything',period:'any',from:'2012',to:String(new Date().getFullYear()),journal:'all',humans:false};
export const subjects:Record<string,string>={Everything:'',Biology:'biology OR genetic OR cell OR evolution OR animal OR plant',Chemistry:'chemistry OR chemical OR molecule OR protein OR biochemical',Math:'mathematical OR mathematics OR mathematical-model OR probability OR stochastic OR topology',Physics:'physics OR biophysics OR mechanical OR thermodynamic OR fluid OR force',Psychology:'psychology OR cognition OR memory OR learning OR perception OR behavior','Earth science':'climate OR ecology OR ecosystem OR environment OR fossil OR biodiversity'};
export const journals:Record<string,{name:string,issn:string}>={elife:{name:'eLife',issn:'2050-084X'},biology:{name:'PLOS Biology',issn:'1545-7885'},genetics:{name:'PLOS Genetics',issn:'1553-7404'},computational:{name:'PLOS Computational Biology',issn:'1553-7358'},pathogens:{name:'PLOS Pathogens',issn:'1553-7374'},tropical:{name:'PLOS Neglected Tropical Diseases',issn:'1935-2735'}};
export function dayKey(date=new Date()){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')}
export function hash(s:string){let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0}
export function buildQuery(f:Filters,now=new Date()):string{
 if(!(f.topic in subjects)||!['any','recent','older','custom'].includes(f.period)||!(f.journal==='all'||f.journal in journals))throw new Error('Choose one of the available subjects, dates and journals.');
 let start='1900-01-01',end=dayKey(now);
 if(f.period==='recent'){const d=new Date(now);d.setFullYear(d.getFullYear()-1);start=dayKey(d)}
 if(f.period==='older'){const d=new Date(now);d.setFullYear(d.getFullYear()-5);end=dayKey(d)}
 if(f.period==='custom'){const a=Number(f.from),b=Number(f.to);if(!/^\d{4}$/.test(f.from)||!/^\d{4}$/.test(f.to)||a<1900||b>now.getFullYear()||a>b)throw new Error(`Choose a start and end year from 1900 to ${now.getFullYear()}, with the start first.`);start=`${a}-01-01`;end=b===now.getFullYear()?dayKey(now):`${b}-12-31`}
 const names=f.journal==='all'?Object.keys(journals):[f.journal];
 const source=names.map(k=>`(ISSN:${journals[k].issn} AND "${k==='elife'?'eLife digest':'Author summary'}")`).join(' OR ');
 return `OPEN_ACCESS:Y AND IN_PMC:Y AND SRC:MED AND PUB_TYPE:research-article AND LICENSE:"CC-BY" AND FIRST_PDATE:[${start} TO ${end}] AND (${source})${subjects[f.topic]?` AND TITLE_ABS:(${subjects[f.topic]})`:''}${f.humans?' AND KW:Humans':''} NOT PUB_TYPE:"Review" NOT PUB_TYPE:"Preprint" NOT PUB_TYPE:"Retracted Publication" NOT PUB_TYPE:"Retraction of Publication"`;
}
export async function discover(filters:Filters,exclude:Set<string>,signal?:AbortSignal,current=''):Promise<{paper:Paper}>{
 buildQuery(filters);
 const response=await fetch('/api/discover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filters,current,exclude:[...exclude].slice(-100),requestId:crypto.randomUUID()}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(45000)]):AbortSignal.timeout(45000)});
 const result=await response.json() as {paper:Paper;error?:string};
 if(!response.ok)throw new Error(result.error || 'Unable to find a new paper. Please try again.');
 if(!result.paper || result.paper.pmcid===current || exclude.has(result.paper.pmcid))throw new Error('That paper has already been shown. Please try again.');
 return result;
}
export function shortVersion(paragraphs:string[]){return paragraphs.map(p=>p.match(/[^.!?]+[.!?]+(?:[”’"']|(?=\s|$))?/g)?.[0]?.trim()||p).filter(Boolean)}
export const glossary:Record<string,string>={polyphenism:'One set of genes can produce different body forms.',ocelli:'Small, simple eyes that detect light.',synesthesia:'An automatic extra sensory experience, such as seeing colors when reading numbers.',pupillometry:'Measuring changes in the size of the pupil in the eye.',genome:'The complete set of genetic instructions in an organism.',phenotype:'An observable trait, such as size or color.',correlation:'Two things vary together; this alone does not show that one causes the other.',cohort:'A group followed or studied together.',microbiome:'The community of tiny organisms living in a place, such as the gut.',transcriptome:'The set of RNA messages made from genes.',phylogenetic:'Related to the evolutionary family tree.',inhibition:'Reducing or blocking an activity.',neurons:'Nerve cells that carry signals.',plasticity:'The ability to change in response to experience or conditions.','in vitro':'Studied outside a living organism, usually in a lab dish.'};
