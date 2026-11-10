import { CourseRevision } from '../models';
import aiClient from '../../../../shared/aiClient';
import { DraftForbiddenError, canonicalHasReviewableRegions, getCourseDraft } from './courseDraft';

/**
 * Automated review of an extracted course draft.
 *
 * Two layers, both advisory:
 *  1. deterministic checks that always run (no model, no network);
 *  2. an optional AI proposal for clearer titles and objectives.
 *
 * Neither layer writes anything or attests anything on the instructor's behalf.
 * Source-region acknowledgement and "instructor reviewed" stay human decisions;
 * the instructor applies a proposal through the normal draft save.
 */

export type Severity = 'blocker' | 'warning' | 'info';
export type Verdict = 'ready' | 'needs_attention' | 'blocked';

export interface ReviewFinding {
  code: string;
  severity: Severity;
  message: string;
  topicId?: string;
  subtopicId?: string;
}

interface DraftObjective {
  id?: string;
  statement?: string;
  text?: string;
  bloomLevel?: string;
}
interface DraftSubtopic {
  id?: string;
  title?: string;
  summary?: string;
  learning_objectives?: DraftObjective[];
}
interface DraftTopic {
  id?: string;
  title?: string;
  subtopics?: DraftSubtopic[];
}

export interface ProposalLesson {
  id: string;
  title: string;
  objectives: Array<{ statement: string; bloomLevel: string }>;
}
export interface Proposal {
  chapters: Array<{ id: string; title: string }>;
  lessons: ProposalLesson[];
  notes: string[];
}
export type AiStatus = 'proposed' | 'unavailable' | 'invalid' | 'skipped';

export interface DraftReview {
  revisionTag: string;
  verdict: Verdict;
  findings: ReviewFinding[];
  counts: { chapters: number; lessons: number; objectives: number };
  ai: {
    status: AiStatus;
    reason?: string;
    executionMode?: string;
    proposal?: Proposal;
  };
}

const PLACEHOLDER_OBJECTIVE = /^explain the main ideas and methods in\b/i;
const TITLE_PREFIX = /^(course|chapter|section|lesson|unit)\s*\d*\s*[:\-–.]\s*/i;
const TRAILING_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'of',
  'and',
  'or',
  'to',
  'in',
  'on',
  'for',
  'then',
  'with',
  'is',
  'are',
  'that',
  'which'
]);

function lessonTitleLooksCutOff(title: string): boolean {
  const t = title.trim();
  if (TITLE_PREFIX.test(t) && t.split(/\s+/).length > 5) return true;
  if (/[.!?:)]$/.test(t)) return false;
  const words = t.split(/\s+/);
  const last = (words[words.length - 1] || '').replace(/[^\p{L}]/gu, '').toLowerCase();
  if (TRAILING_STOPWORDS.has(last)) return true;
  // A long title with several sentence-like words is far more likely a clipped sentence than a name.
  return words.length >= 8 && /\s(is|are|follows|adds|removes|uses)\s/.test(` ${t} `);
}

/** Deterministic checks. Pure: same draft in, same findings out. */
export function analyzeDraft(input: {
  topics: DraftTopic[];
  summary?: string;
  sourceReviewPending: boolean;
}): { findings: ReviewFinding[]; verdict: Verdict; counts: DraftReview['counts'] } {
  const findings: ReviewFinding[] = [];
  const topics = input.topics || [];
  const lessons = topics.flatMap((t) => (t.subtopics || []).map((s) => ({ topic: t, sub: s })));
  const objectives = lessons.reduce((n, l) => n + (l.sub.learning_objectives?.length || 0), 0);

  if (!topics.length || !lessons.length)
    findings.push({
      code: 'NO_CONTENT',
      severity: 'blocker',
      message: 'The draft has no chapters or lessons to publish.'
    });

  if (input.sourceReviewPending)
    findings.push({
      code: 'SOURCE_REVIEW_PENDING',
      severity: 'blocker',
      message:
        'Some source regions were flagged as low confidence. Compare them with the original and confirm the source review. This is your decision; automation cannot confirm it for you.'
    });

  const seen = new Map<string, number>();
  const lengths = lessons.map((l) => (l.sub.summary || '').length).sort((a, b) => a - b);
  const median = lengths.length ? lengths[Math.floor(lengths.length / 2)] : 0;

  for (const { topic, sub } of lessons) {
    const where = { topicId: topic.id, subtopicId: sub.id };
    const title = (sub.title || '').trim();
    const key = title.toLowerCase();
    seen.set(key, (seen.get(key) || 0) + 1);

    if (lessonTitleLooksCutOff(title))
      findings.push({
        code: 'TITLE_CUT_OFF',
        severity: 'warning',
        message: `The lesson title "${title.slice(0, 70)}" looks like a clipped sentence rather than a topic name.`,
        ...where
      });

    const objs = sub.learning_objectives || [];
    if (!objs.length)
      findings.push({
        code: 'NO_OBJECTIVE',
        severity: 'warning',
        message: `"${title.slice(0, 70)}" has no learning objective, so students cannot practise it.`,
        ...where
      });
    else if (objs.some((o) => PLACEHOLDER_OBJECTIVE.test((o.statement || o.text || '').trim())))
      findings.push({
        code: 'GENERIC_OBJECTIVE',
        severity: 'warning',
        message: `"${title.slice(0, 70)}" still has an automatic placeholder objective. Replace it with something students can be assessed on.`,
        ...where
      });

    const length = (sub.summary || '').trim().length;
    if (length < 80)
      findings.push({
        code: 'THIN_LESSON',
        severity: 'warning',
        message: `"${title.slice(0, 70)}" has very little text (${length} characters).`,
        ...where
      });
    else if (length > 2500 && median > 0 && length > median * 3)
      findings.push({
        code: 'LONG_LESSON',
        severity: 'info',
        message: `"${title.slice(0, 70)}" is much longer than the other lessons and may cover several topics. Check whether the original has more chapters than were detected.`,
        ...where
      });
  }

  for (const [title, count] of seen)
    if (title && count > 1)
      findings.push({
        code: 'DUPLICATE_TITLE',
        severity: 'warning',
        message: `${count} lessons share the title "${title.slice(0, 70)}".`
      });

  if (topics.length === 1 && lessons.length >= 2 && topics[0].title)
    findings.push({
      code: 'SINGLE_CHAPTER',
      severity: 'info',
      message:
        'Everything sits in one chapter. If the original has several chapters, the structure may not have been detected; you can reorder or rename in the outline.'
    });

  if (!(input.summary || '').trim())
    findings.push({
      code: 'NO_SUMMARY',
      severity: 'info',
      message: 'The course summary is empty. A one-line summary helps students choose the course.'
    });

  const verdict: Verdict = findings.some((f) => f.severity === 'blocker')
    ? 'blocked'
    : findings.some((f) => f.severity === 'warning')
      ? 'needs_attention'
      : 'ready';
  return {
    findings,
    verdict,
    counts: { chapters: topics.length, lessons: lessons.length, objectives }
  };
}

const VERB_LEVEL: Array<[RegExp, string]> = [
  [/^(identify|list|define|name|state|recall|label)\b/i, 'remember'],
  [/^(apply|trace|calculate|compute|solve|use|perform|implement|demonstrate|execute)\b/i, 'apply'],
  [/^(compare|analy[sz]e|distinguish|differentiate|examine|contrast|classify)\b/i, 'analyze'],
  [/^(evaluate|justify|critique|assess|judge|defend)\b/i, 'evaluate'],
  [/^(design|create|construct|develop|compose|propose|formulate)\b/i, 'create']
];
export function bloomFromStatement(statement: string): string {
  const match = VERB_LEVEL.find(([re]) => re.test(statement.trim()));
  return match ? match[1] : 'understand';
}

function aiAvailable(): boolean {
  return process.env.COURSE_REVIEW_AI !== '0';
}

async function requestAiProposal(
  courseTitle: string,
  topics: DraftTopic[]
): Promise<DraftReview['ai']> {
  // Drafts that were never saved have no topic ids yet; use the position (the editor does the same).
  const chapters = topics
    .map((t, i) => ({
      id: String(t.id || `ch_${i}`),
      title: String(t.title || '').slice(0, 400),
      lessons: (t.subtopics || [])
        .filter((s) => s.id)
        .slice(0, 40)
        .map((s) => ({
          id: String(s.id),
          title: String(s.title || '').slice(0, 400),
          excerpt: String(s.summary || '').slice(0, 1500),
          objectives: (s.learning_objectives || [])
            .map((o) => String(o.statement || o.text || '').slice(0, 240))
            .filter(Boolean)
            .slice(0, 8)
        }))
    }))
    .filter((c) => c.lessons.length)
    .slice(0, 30);
  if (!chapters.length) return { status: 'skipped', reason: 'Nothing to review.' };

  try {
    const response = await aiClient.post(
      '/api/ai/course-review/propose',
      { courseTitle: courseTitle.slice(0, 300) || 'Course', language: 'en', chapters },
      { timeout: 25_000 }
    );
    const raw = response.data as {
      status?: string;
      reason?: string;
      executionMode?: string;
      proposal?: {
        chapters?: Array<{ id: string; title: string }>;
        lessons?: Array<{ id: string; title: string; objectives: string[] }>;
        notes?: string[];
      };
    };
    if (raw?.status !== 'proposed' || !raw.proposal)
      return {
        status: raw?.status === 'invalid' ? 'invalid' : 'unavailable',
        reason: raw?.reason || 'AI review is unavailable right now.',
        executionMode: raw?.executionMode
      };

    // The AI service validated shape; the gateway re-checks identity so a proposal can
    // never reference, add or retarget anything outside the draft the caller owns.
    const chapterIds = new Set(chapters.map((c) => c.id));
    const lessonIds = new Set(chapters.flatMap((c) => c.lessons.map((l) => l.id)));
    const clean = (s: string) => String(s).replace(/\s+/g, ' ').trim();
    const proposal: Proposal = {
      chapters: (raw.proposal.chapters || [])
        .filter((c) => chapterIds.has(c.id) && clean(c.title).length >= 3)
        .map((c) => ({ id: c.id, title: clean(c.title).slice(0, 120) })),
      lessons: (raw.proposal.lessons || [])
        .filter((l) => lessonIds.has(l.id) && clean(l.title).length >= 3 && l.objectives?.length)
        .map((l) => ({
          id: l.id,
          title: clean(l.title).slice(0, 120),
          objectives: l.objectives
            .map(clean)
            .filter((o) => o.length >= 12 && o.length <= 240)
            .slice(0, 4)
            .map((statement) => ({ statement, bloomLevel: bloomFromStatement(statement) }))
        }))
        .filter((l) => l.objectives.length),
      notes: (raw.proposal.notes || []).map(clean).filter(Boolean).slice(0, 5)
    };
    if (!proposal.chapters.length && !proposal.lessons.length)
      return { status: 'invalid', reason: 'The AI suggestion did not match this draft.' };
    return { status: 'proposed', proposal, executionMode: raw.executionMode };
  } catch {
    return { status: 'unavailable', reason: 'AI review is unavailable right now.' };
  }
}

export async function reviewCourseDraft(
  actorUserId: string,
  courseId: string,
  options: { useAi: boolean }
): Promise<DraftReview> {
  // getCourseDraft enforces owner / assigned-instructor / admin access.
  const draft = await getCourseDraft(actorUserId, courseId);
  const revision = await CourseRevision.findOne({ courseId, revisionTag: draft.revisionTag })
    .select({ contentDocument: 1 })
    .lean();
  if (!revision) throw new DraftForbiddenError('Draft not found');
  const canonical = revision.contentDocument as
    { extractionReview?: { acknowledged?: boolean } } | undefined;
  const sourceReviewPending =
    canonicalHasReviewableRegions(canonical) && canonical?.extractionReview?.acknowledged !== true;

  const topics = (draft.topics || []) as unknown as DraftTopic[];
  const analysis = analyzeDraft({ topics, summary: draft.summary, sourceReviewPending });
  const ai =
    options.useAi && aiAvailable()
      ? await requestAiProposal(
          String((draft as { title?: string }).title || draft.summary || ''),
          topics
        )
      : ({ status: 'skipped' } as DraftReview['ai']);

  return { revisionTag: draft.revisionTag, ...analysis, ai };
}
