import type {Paper} from './science';

export const ARTICLE_SECTION_LABELS = ['THE STRANGE HOOK', 'THE COOL EXPLANATION', 'WHY IT MATTERS'] as const;
export type ArticleSummary = {
  hook: string;
  explanation: string;
  importance: string;
  kind: 'edited' | 'publisher-excerpts';
  attribution: string;
  sourceNote: string;
  wordCount: number;
};

type Unit = {text: string; words: number; index: number; paragraph: number};
const budgets = {hook: 45, explanation: 105, importance: 45};
const guidance = {
  hook: 'Start with the paper’s title, then explore the study below.',
  explanation: 'Open the full publisher explanation below for the methods, findings and study limits.',
  importance: 'Read the original paper for the study’s broader context and limitations.',
};
const wordCount = (text: string) => text.trim().split(/\s+/u).filter(Boolean).length;

// Keep the publisher's sentences intact. In particular, a length limit must never
// remove a "not", a confidence qualifier, or the second half of a comparison.
export function summarySentences(text: string): string[] {
  return [...new Intl.Segmenter('en', {granularity: 'sentence'}).segment(text)]
    .map(part => part.segment.trim()).filter(Boolean);
}

function qualifiesPrevious(text: string): boolean {
  return /^(?:but\b|however\b|although\b|yet\b|nevertheless\b|nonetheless\b|despite\b|except\b|even so\b|in contrast\b|on the other hand\b|that said\b)/iu.test(text)
    || /\b(?:cannot|can not|does not|do not|did not) (?:prove|establish|demonstrate|rule out|necessarily|mean)|\b(?:a|the|this|one) (?:major |important |key )?limitation\b/iu.test(text);
}

function unitsFrom(paragraphs: string[]): Unit[] {
  const units: Unit[] = [];
  const seen = new Set<string>();
  paragraphs.forEach((paragraph, paragraphIndex) => {
    for (const text of summarySentences(paragraph)) {
      if (seen.has(text)) continue;
      seen.add(text);
      const previous = units.at(-1);
      // A contrast/limitation stays attached even across a paragraph break. If
      // the pair is too long, omit the pair instead of displaying just its claim.
      if (previous && qualifiesPrevious(text)) {
        previous.text += ` ${text}`;
        previous.words = wordCount(previous.text);
      } else {
        units.push({text, words: wordCount(text), index: units.length, paragraph: paragraphIndex});
      }
    }
  });
  return units;
}

function lead(units: Unit[], budget: number, maxUnits = 2): Unit[] {
  const result: Unit[] = [];
  let words = 0;
  for (const unit of units) {
    if (result.length && unit.paragraph !== result[0].paragraph) break;
    if (words + unit.words > budget) break;
    result.push(unit);
    words += unit.words;
    if (result.length === maxUnits) break;
  }
  return result;
}

function findingScore(text: string): number {
  return (text.match(/\b(?:found|showed|revealed|discovered|observed|results|findings)\b/giu) || []).length * 5
    + (text.match(/\b(?:increased?|decreased?|became|grew|smaller|larger|stronger|weaker|higher|lower|difference|effect|effects|response|responses|consistent|suggests?)\b/giu) || []).length * 2
    + (text.match(/\b(?:tested|compared|measured|experiment|experiments)\b/giu) || []).length;
}

function importanceScore(text: string): number {
  return (text.match(/\b(?:findings|suggests?|could|may|help|understand|future|implications?|potential|insights?|important|importance|limitations?|cannot|does not)\b/giu) || []).length * 3;
}

function selectRun(units: Unit[], used: Set<number>, budget: number, score: (text: string) => number, preferLater = false): Unit[] {
  let best: Unit[] = [];
  let bestScore = -1;
  for (let start = 0; start < units.length; start++) {
    const candidate: Unit[] = [];
    let words = 0;
    for (let end = start; end < units.length && end < start + 4; end++) {
      const unit = units[end];
      if (used.has(unit.index) || words + unit.words > budget) break;
      // Keep a passage contiguous; do not stitch together unrelated paragraphs.
      if (candidate.length && unit.paragraph !== candidate[0].paragraph) break;
      candidate.push(unit);
      words += unit.words;
      const candidateScore = score(candidate.map(part => part.text).join(' ')) + Math.min(words, 75) / 75 + (preferLater ? candidate[0].paragraph * 1.5 : 0);
      if (candidateScore > bestScore) {
        best = [...candidate];
        bestScore = candidateScore;
      }
    }
  }
  return best;
}

const textOf = (units: Unit[]) => units.map(unit => unit.text).join(' ');

/** A consistent short card, without generated scientific claims or cut sentences. */
export function formatArticleSummary(paper: Pick<Paper, 'summaryParagraphs' | 'summaryLabel' | 'hook' | 'explanation' | 'importance'>): ArticleSummary {
  const edited = Boolean(paper.hook?.trim() && paper.explanation?.trim() && paper.importance?.trim());
  let hook: string;
  let explanation: string;
  let importance: string;
  if (edited) {
    hook = textOf(lead(unitsFrom([paper.hook!]), budgets.hook)) || guidance.hook;
    explanation = textOf(lead(unitsFrom([paper.explanation!]), budgets.explanation, 10)) || guidance.explanation;
    importance = textOf(lead(unitsFrom([paper.importance!]), budgets.importance)) || guidance.importance;
  } else {
    const paragraphs = paper.summaryParagraphs.filter(text => text.trim());
    const units = unitsFrom(paragraphs);
    const firstBriefUnit = units.findIndex(unit => unit.words <= budgets.hook);
    const hookUnits = firstBriefUnit < 0 ? [] : lead(units.slice(firstBriefUnit), budgets.hook);
    const used = new Set(hookUnits.map(unit => unit.index));
    // Reserve a short concluding passage first, then select methods/findings
    // from what remains. This also prevents a one-paragraph summary repeating.
    const conclusion = units.filter(unit => unit.paragraph === paragraphs.length - 1 && !used.has(unit.index));
    const importanceUnits = selectRun(conclusion, used, budgets.importance, importanceScore);
    importanceUnits.forEach(unit => used.add(unit.index));
    const middle = units.filter(unit => unit.paragraph > 0);
    const explanationUnits = selectRun(middle.length ? middle : units, used, budgets.explanation, findingScore, true);
    hook = textOf(hookUnits) || guidance.hook;
    explanation = textOf(explanationUnits) || guidance.explanation;
    importance = textOf(importanceUnits) || guidance.importance;
  }
  return {
    hook, explanation, importance,
    kind: edited ? 'edited' : 'publisher-excerpts',
    attribution: edited
      ? 'Plain-English take by Paper Girl, based on the publisher explanation.'
      : `A short reading guide using selected sentences from the publisher’s ${paper.summaryLabel || 'explanation'}.`,
    sourceNote: edited
      ? 'Paper Girl’s wording and metaphors are editorial; the findings come from the cited study. Read the full publisher explanation for context.'
      : 'Publisher sentences are kept intact, with some omitted for length. The headings and any brief reading prompts are ours. The full publisher explanation below provides the complete context.',
    wordCount: wordCount([hook, explanation, importance].join(' ')),
  };
}
