import { DOMParser } from '@xmldom/xmldom';
import type { Paper } from './science';

export const API = 'https://www.ebi.ac.uk/europepmc/webservices/rest';
export type RecordData = { pmcid: string; id?: string; source?: string; doi?: string; title?: string; authorString?: string; journalTitle?: string; journalInfo?: {journal?: {title?: string}}; pubYear?: string; firstPublicationDate?: string; abstractText?: string; pubTypeList?: {pubType?: string[]}; commentCorrectionList?: {commentCorrection?: {type?: string}[]} };
export class LibraryError extends Error { constructor(message: string, public status = 503) {super(message)} }
export async function libraryGet(url: string, signal?: AbortSignal) {
  const response = await fetch(url, {signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000)});
  if (response.status === 404) return null;
  if (!response.ok) throw new LibraryError(response.status === 429 ? 'The journal library is busy. Please try again shortly.' : 'The journal library is unavailable. Your current paper is still here.', response.status === 429 ? 429 : 503);
  return response;
}
export function eligible(r: RecordData) {
  return /^PMC\d+$/.test(r.pmcid || '') && r.source === 'MED' &&
    !(r.pubTypeList?.pubType || []).some(t => /retract|preprint|review|expression of concern/i.test(t)) &&
    !(r.commentCorrectionList?.commentCorrection || []).some(c => /retract|expression of concern/i.test(c.type || ''));
}
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
export function parsePublisherXml(raw: string, r: RecordData): Paper | null {
  if (!eligible(r)) return null;
  try {
    const doc = new DOMParser({onError: () => {}}).parseFromString(raw, 'application/xml');
    const tag = (name: string) => Array.from(doc.getElementsByTagName(name));
    const journal = clean(tag('journal-title')[0]?.textContent || r.journalInfo?.journal?.title || r.journalTitle || '');
    if (!/^elife$|^plos (biology|genetics|computational biology|pathogens|neglected tropical diseases)$/i.test(journal)) return null;
    // JATS permits an attribute, an ALI license_ref, or a nested ext-link.
    const urls = tag('license').flatMap(el => [el.getAttribute('xlink:href'), el.getAttribute('href'),
      ...Array.from(el.getElementsByTagName('*')).flatMap(child => [child.localName === 'license_ref' ? child.textContent : '', child.getAttribute('xlink:href'), child.getAttribute('href')])]);
    const licenseUrl = urls.map(u => (u || '').trim()).find(u => /^https?:\/\/creativecommons\.org\/licenses\/by\/\d\.\d\/?$/i.test(u));
    if (!licenseUrl) return null;
    const section = tag('abstract').find(el => ['plain-language-summary', 'summary'].includes(el.getAttribute('abstract-type') || '') && /elife digest|author summary|plain.language summary/i.test(el.getElementsByTagName('title')[0]?.textContent || ''));
    if (!section) return null;
    const summaryParagraphs = Array.from(section.getElementsByTagName('p')).map(p => clean(p.textContent || '')).filter(Boolean);
    if (summaryParagraphs.join(' ').length < 150) return null;
    const abstract = tag('abstract').find(el => !el.hasAttribute('abstract-type'))?.textContent || '';
    return {pmcid:r.pmcid,pmid:r.id || '',doi:r.doi || '',title:clean(r.title || tag('article-title')[0]?.textContent || ''),authors:r.authorString || '',journal,year:Number(r.pubYear),publicationDate:r.firstPublicationDate || `${r.pubYear}-01-01`,articleUrl:r.doi ? `https://doi.org/${encodeURI(r.doi)}` : `https://europepmc.org/articles/${r.pmcid}`,fullTextUrl:`https://europepmc.org/articles/${r.pmcid}`,summaryLabel:section.getElementsByTagName('title')[0]?.textContent || 'Publisher summary',summaryParagraphs,abstract:clean(abstract),licenseUrl:licenseUrl.replace(/^http:/,'https:'),copyright:tag('copyright-statement')[0]?.textContent || `${r.authorString || ''} ${r.pubYear || ''}`};
  } catch { return null; }
}
export async function fetchPublisherPaper(pmcid: string, signal?: AbortSignal) {
  const response = await libraryGet(`${API}/search?format=json&resultType=core&pageSize=1&query=${encodeURIComponent(`PMCID:${pmcid} AND SRC:MED`)}`,signal);
  if (!response) return null;
  const data = await response.json() as {resultList?: {result?: RecordData[]}};
  const record = data.resultList?.result?.find(r => r.pmcid === pmcid);
  if (!record || !eligible(record)) return null;
  const xml = await libraryGet(`${API}/${pmcid}/fullTextXML`, signal);
  return xml ? parsePublisherXml(await xml.text(), record) : null;
}
