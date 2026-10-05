import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePublisherXml, fetchPublisherPaper} from '../lib/publisher.ts';

const record={pmcid:'PMC123456',id:'123',source:'MED',title:'A controlled study',authorString:'Researcher et al.',pubYear:'2025',firstPublicationDate:'2025-04-10',doi:'10.1000/test'};
const paragraph='The researchers compared groups of plants in a controlled experiment. Plants receiving the treatment grew more leaves in this setting, although the study does not establish what would happen in other environments.';
function xml(license,paragraphs=[paragraph]){return `<article xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:ali="http://www.niso.org/schemas/ali/1.0/"><front><journal-meta><journal-title>PLOS Biology</journal-title></journal-meta><article-meta><permissions>${license}</permissions><abstract abstract-type="summary"><title>Author summary</title>${paragraphs.map(p=>`<p>${p}</p>`).join('')}</abstract></article-meta></front></article>`}
for(const [kind,license] of Object.entries({legacy:'<license xlink:href="http://creativecommons.org/licenses/by/4.0/"/>',ali:'<license><ali:license_ref>https://creativecommons.org/licenses/by/4.0/</ali:license_ref></license>',nested:'<license><license-p><ext-link xlink:href="https://creativecommons.org/licenses/by/4.0/">CC BY</ext-link></license-p></license>'})){
 test(`accepts ${kind} CC BY licensing`,()=>assert.equal(parsePublisherXml(xml(license),record)?.licenseUrl,'https://creativecommons.org/licenses/by/4.0/'));
}
test('does not accept restricted or lookalike licenses',()=>{
 for(const url of ['https://creativecommons.org/licenses/by-nc/4.0/','https://creativecommons.org/licenses/by-nd/4.0/','https://creativecommons.org.evil.test/licenses/by/4.0/'])assert.equal(parsePublisherXml(xml(`<license xlink:href="${url}"/>`),record),null);
});
test('preserves one paragraph once and multiple paragraphs in order',()=>{
 const license='<license xlink:href="https://creativecommons.org/licenses/by/4.0/"/>';
 assert.deepEqual(parsePublisherXml(xml(license),record).summaryParagraphs,[paragraph]);
 assert.deepEqual(parsePublisherXml(xml(license,[paragraph,'A second paragraph.']),record).summaryParagraphs,[paragraph,'A second paragraph.']);
});
test('rejects retraction notices and absent summary',()=>{
 const license='<license xlink:href="https://creativecommons.org/licenses/by/4.0/"/>';
 assert.equal(parsePublisherXml(xml(license),{...record,commentCorrectionList:{commentCorrection:[{type:'Retraction in'}]}}),null);
 assert.equal(parsePublisherXml(xml(license,[]),record),null);
});
test('article-specific 404 is skippable',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('',{status:404});
 try{assert.equal(await fetchPublisherPaper('PMC123456'),null)}finally{globalThis.fetch=original}
});
test('rate limiting stays retryable',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('',{status:429});
 try{await assert.rejects(fetchPublisherPaper('PMC123456'),e=>e.status===429)}finally{globalThis.fetch=original}
});
