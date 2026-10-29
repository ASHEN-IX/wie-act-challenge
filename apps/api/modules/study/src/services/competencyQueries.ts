/**
 * BLOOM-09 — Competency read service.
 *
 * Read-side aggregation of CompetencyProfile rows for the competency API.
 */

import {
  Subject,
  Course,
  CourseEnrollment,
  CourseRevision,
  CompetencyProfile
} from '../models/index';
import type { ICompetencyProfile } from '../models/index';
import mongoose from 'mongoose';

type CompetencyRow = Pick<
  ICompetencyProfile,
  'topicId' | 'knowledgeType' | 'bloomLevel' | 'score' | 'confidence' | 'evidence'
>;
interface CompetencyLevel {
  bloomLevel: string;
  score: number;
  confidence: number;
  count: number;
  /** True when confidence is too low to treat the score as settled. */
  needsReview?: boolean;
  knowledgeTypes?: KnowledgeTypeGroup[];
}
interface CompetencyTopic {
  topicId: string;
  topicName: string;
  parentTopic: string;
  subjectId: string;
  courseId: string;
  levels: CompetencyLevel[];
}
interface WeakCompetency {
  topic_id: string;
  topic_title: string | undefined;
  scores: Record<string, number>;
  current_level: string | null;
  unlocked_levels: string[];
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BLOOM_LEVELS, UNLOCK_THRESHOLD } = require('@study-partner/shared/bloom/taxonomy');

const BLOOM_ORDER = ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYSE', 'EVALUATE', 'CREATE'];

// Confidence is 1 - (1 - ALPHA)^n, so a single observation yields exactly 0.4 and
// two yield 0.64. The bar sits above one observation on purpose: a percentage from
// a single data point is the case most likely to be misread as settled mastery.
const NEEDS_REVIEW_MIN_CONFIDENCE = 0.5;

const BLOOM_LEVEL_TO_KEY: Record<string, string> = {
  REMEMBER: 'remember',
  UNDERSTAND: 'understand',
  APPLY: 'apply',
  ANALYZE: 'analyze',
  ANALYSE: 'analyze',
  EVALUATE: 'evaluate',
  CREATE: 'create'
};

interface TopicMeta {
  title: string;
  parentTopic: string;
  subjectId: string;
  courseId: string;
}

interface RevisionTopicRecord {
  id?: string;
  title?: string;
  subtopics?: Array<{ id?: string; title?: string }>;
}

/** Index one course's hierarchy into topicId → metadata. */
function indexTopics(
  index: Map<string, TopicMeta>,
  course: { _id: unknown; subjectId?: string; title?: string },
  topics: RevisionTopicRecord[]
) {
  for (const topic of topics) {
    const parentTitle = topic.title || '';
    // Evidence is keyed by the subtopic that owns the objective, which is also the
    // level this projection reports. Index the parent id as well so a topic-level
    // key still resolves instead of silently dropping its rows.
    if (topic.id)
      index.set(topic.id, {
        title: topic.title || topic.id,
        parentTopic: '',
        subjectId: course.subjectId || String(course._id),
        courseId: String(course._id)
      });
    for (const sub of topic.subtopics || []) {
      if (!sub || !sub.id) continue;
      index.set(sub.id, {
        title: sub.title || sub.id,
        parentTopic: parentTitle,
        subjectId: course.subjectId || String(course._id),
        courseId: String(course._id)
      });
    }
  }
}

/**
 * Build a topicId → { title, parentTopic, subjectId } index for every course the
 * learner can read, not only the ones they own.
 *
 * Learners reach institutional courses through enrollment, so an owner-only query
 * leaves the index empty and silently drops every competency row. The curriculum
 * is also authoritative on the published revision, while `Course.topics` is a
 * legacy editable projection that may never have been materialized.
 */
async function buildTopicIndex(userId: string): Promise<Map<string, TopicMeta>> {
  const enrolledIds = await CourseEnrollment.find({ userId, status: 'active' }).distinct(
    'courseId'
  );
  const courses = await Course.find({
    $or: [
      { userId },
      { ownerUserId: userId },
      { assignedInstructorIds: userId },
      { _id: { $in: enrolledIds } }
    ]
  })
    .select('subjectId title topics activeRevisionId')
    .lean();

  const index = new Map<string, TopicMeta>();
  for (const course of courses) {
    indexTopics(index, course, (course.topics || []) as RevisionTopicRecord[]);
  }

  // Published revisions carry the curriculum that activities and evidence are
  // pinned to; index those too so revision-only courses resolve.
  if (courses.length) {
    const revisions = await CourseRevision.find({
      courseId: { $in: courses.map((c) => c._id) },
      status: { $in: ['published', 'deprecated'] },
      activationState: 'committed'
    })
      .select('courseId revisionTag topics')
      .lean();
    const byId = new Map(courses.map((c) => [String(c._id), c]));
    for (const revision of revisions) {
      const course = byId.get(String(revision.courseId));
      if (course)
        indexTopics(index, course, (revision.topics || []) as unknown as RevisionTopicRecord[]);
    }
  }
  return index;
}

interface KnowledgeTypeEntry {
  score: number;
  confidence: number;
  evidenceCount: number;
}

interface KnowledgeTypeGroup {
  knowledgeType: string;
  score: number;
  confidence: number;
  count: number;
}

/**
 * Group one level's rows by knowledgeType. Used when ?knowledgeType=breakdown.
 */
function groupKnowledgeTypes(rows: CompetencyRow[]): KnowledgeTypeGroup[] {
  const byType: Record<string, KnowledgeTypeEntry[]> = {};
  for (const row of rows) {
    if (!byType[row.knowledgeType]) byType[row.knowledgeType] = [];
    byType[row.knowledgeType].push({
      score: row.score,
      confidence: row.confidence,
      evidenceCount: (row.evidence || []).length
    });
  }
  return Object.entries(byType).map(([knowledgeType, entries]) => ({
    knowledgeType,
    score: entries.length
      ? Math.round((entries.reduce((s, e) => s + e.score, 0) / entries.length) * 1000) / 1000
      : 0,
    confidence: entries.length
      ? Math.round((entries.reduce((s, e) => s + e.confidence, 0) / entries.length) * 1000) / 1000
      : 0,
    count: entries.length
  }));
}

interface CompetencyMapOpts {
  subjectId?: string;
  knowledgeTypeBreakdown?: boolean;
}

/**
 * Aggregated competency map grouped by subject → topic → bloom level.
 */
async function getUserCompetencyMap(
  userId: string,
  { subjectId, knowledgeTypeBreakdown = false }: CompetencyMapOpts = {}
) {
  const [profiles, topicIndex] = await Promise.all([
    CompetencyProfile.find({ userId }).lean(),
    buildTopicIndex(userId)
  ]);

  const topicsByTopicId: Record<string, CompetencyRow[]> = {};
  for (const row of profiles) {
    if (!topicsByTopicId[row.topicId]) topicsByTopicId[row.topicId] = [];
    topicsByTopicId[row.topicId].push(row);
  }

  const subjects = new Map<
    string,
    {
      subjectId: string;
      topics: Map<string, TopicMeta & { topicId: string; rows: CompetencyRow[] }>;
    }
  >();

  for (const [topicId, rows] of Object.entries(topicsByTopicId)) {
    const meta = topicIndex.get(topicId);
    if (!meta) continue;
    if (subjectId && meta.subjectId !== subjectId) continue;

    if (!subjects.has(meta.subjectId)) {
      subjects.set(meta.subjectId, { subjectId: meta.subjectId, topics: new Map() });
    }
    const subject = subjects.get(meta.subjectId)!;
    if (!subject.topics.has(topicId)) {
      subject.topics.set(topicId, { ...meta, topicId, rows });
    }
  }

  // Resolve subject names. Courses may carry either a Subject ObjectId or a slug,
  // so only well-formed ids are sent to an ObjectId query.
  const subjectIds = [...subjects.keys()];
  const objectIds = subjectIds.filter((id) => mongoose.isValidObjectId(id));
  // Subjects are authored by whoever created the course, not by the learner
  // reading their progress, so scope the lookup to the ids the learner can reach.
  const subjectDocs = objectIds.length
    ? await Subject.find({ _id: { $in: objectIds } })
        .select('name')
        .lean()
    : [];
  const nameById = new Map(subjectDocs.map((s) => [String(s._id), s.name]));

  const result: Array<{
    subjectId: string;
    subjectName: string | null;
    topics: CompetencyTopic[];
  }> = [];
  for (const [sid, subject] of subjects) {
    const topics: CompetencyTopic[] = [];
    for (const [topicId, topic] of subject.topics) {
      // Profiles are written from the canonical lowercase taxonomy, while this
      // projection has always reported uppercase levels. Map through the canonical
      // key so spellings such as ANALYZE/ANALYSE collapse onto one level instead of
      // being dropped.
      const levelsByBloom = new Map<string, CompetencyRow[]>();
      for (const row of topic.rows) {
        const key = BLOOM_LEVEL_TO_KEY[String(row.bloomLevel).toUpperCase()];
        if (!key) continue;
        const level = key.toUpperCase() === 'ANALYZE' ? 'ANALYSE' : key.toUpperCase();
        if (!levelsByBloom.has(level)) levelsByBloom.set(level, []);
        levelsByBloom.get(level)!.push(row);
      }

      const levels = BLOOM_ORDER.filter((lvl: string) => levelsByBloom.has(lvl)).map(
        (lvl: string) => {
          const levelRows = levelsByBloom.get(lvl)!;
          const level: CompetencyLevel = {
            bloomLevel: lvl,
            score:
              Math.round(
                (levelRows.reduce((s: number, r: CompetencyRow) => s + r.score, 0) /
                  levelRows.length) *
                  1000
              ) / 1000,
            confidence:
              Math.round(
                (levelRows.reduce((s: number, r: CompetencyRow) => s + r.confidence, 0) /
                  levelRows.length) *
                  1000
              ) / 1000,
            count: levelRows.length
          };
          // A score built from one observation is not settled evidence. Say so at
          // the same place the score is reported, so a learner is never shown a
          // confident-looking percentage that rests on a single data point.
          level.needsReview = level.confidence < NEEDS_REVIEW_MIN_CONFIDENCE;
          if (knowledgeTypeBreakdown) level.knowledgeTypes = groupKnowledgeTypes(levelRows);
          return level;
        }
      );

      topics.push({
        topicId,
        topicName: topic.title,
        parentTopic: topic.parentTopic,
        subjectId: topic.subjectId,
        courseId: topic.courseId,
        levels
      });
    }

    result.push({
      subjectId: sid,
      subjectName: nameById.get(sid) || null,
      topics
    });
  }

  return result;
}

/**
 * Topic detail — every competency profile row for a topic.
 */
async function getTopicDetail(userId: string, topicId: string) {
  const [profiles, topicIndex] = await Promise.all([
    CompetencyProfile.find({ userId, topicId }).lean(),
    buildTopicIndex(userId)
  ]);

  if (!profiles || profiles.length === 0) return null;

  const meta: Partial<TopicMeta> = topicIndex.get(topicId) || {};
  const competencies = profiles.map((row) => ({
    topicId: row.topicId,
    topicName: meta.title || topicId,
    parentTopic: meta.parentTopic || null,
    subjectId: meta.subjectId || null,
    knowledgeType: row.knowledgeType,
    bloomLevel: row.bloomLevel,
    score: row.score,
    confidence: row.confidence,
    needsReview: row.confidence < NEEDS_REVIEW_MIN_CONFIDENCE,
    evidence: (row.evidence || []).slice(-5).map((e) => ({
      objectiveId: e.objectiveId,
      demonstratedBloomLevel: e.demonstratedBloomLevel,
      masteryScore: e.masteryScore,
      evaluatedAt: e.evaluatedAt,
      correlationId: e.correlationId
    }))
  }));

  return {
    topicId,
    topicName: meta.title || topicId,
    parentTopic: meta.parentTopic || null,
    subjectId: meta.subjectId || null,
    courseId: meta.courseId || null,
    competencies
  };
}

/**
 * Weakest-first competency input for the planner (BLOOM-10).
 */
async function getWeakCompetenciesForCourse(userId: string, courseId: string, limit = 10) {
  // Learners rarely own the course they study, so resolve the hierarchy through
  // the readable-course index that enrollments feed.
  const topicIndex = await buildTopicIndex(userId);
  const titleById = new Map<string, string>();
  for (const [topicId, meta] of topicIndex) {
    if (meta.courseId !== courseId) continue;
    titleById.set(topicId, meta.title || topicId);
  }
  const validTopicIds = [...titleById.keys()];
  if (validTopicIds.length === 0) return [];

  const rows = await CompetencyProfile.find({
    userId,
    topicId: { $in: validTopicIds }
  }).lean();

  // Aggregate per topicId: level -> average score across knowledge types
  const buckets = new Map<string, Map<string, { total: number; count: number }>>();
  for (const row of rows) {
    const key = BLOOM_LEVEL_TO_KEY[String(row.bloomLevel).toUpperCase()];
    if (!key) continue;
    if (!buckets.has(row.topicId)) buckets.set(row.topicId, new Map());
    const scores = buckets.get(row.topicId)!;
    if (!scores.has(key)) scores.set(key, { total: 0, count: 0 });
    scores.get(key)!.total += row.score;
    scores.get(key)!.count += 1;
  }

  const scored: WeakCompetency[] = [];
  for (const topicId of validTopicIds) {
    const scoresMap = buckets.get(topicId);
    const scores: Record<string, number> = {};
    if (scoresMap) {
      for (const [level, { total, count }] of scoresMap) {
        scores[level] = Math.round((total / count) * 1000) / 1000;
      }
    }

    // Progression gate
    const unlocked: string[] = [];
    for (const level of BLOOM_LEVELS) {
      const idx = BLOOM_LEVELS.indexOf(level);
      if (idx === 0) {
        unlocked.push(level);
        continue;
      }
      const prevScore = scores[BLOOM_LEVELS[idx - 1]];
      if (prevScore != null && prevScore >= UNLOCK_THRESHOLD) unlocked.push(level);
    }

    let currentLevel: string | null = null;
    for (let i = BLOOM_LEVELS.length - 1; i >= 0; i -= 1) {
      const level = BLOOM_LEVELS[i];
      if (unlocked.includes(level) && scores[level] != null) {
        currentLevel = level;
        break;
      }
    }
    if (currentLevel === null && unlocked.length > 0 && scores[BLOOM_LEVELS[0]] != null) {
      currentLevel = BLOOM_LEVELS[0];
    }

    scored.push({
      topic_id: topicId,
      topic_title: titleById.get(topicId),
      scores,
      current_level: currentLevel,
      unlocked_levels: unlocked
    });
  }

  const sortScore = (wc: WeakCompetency): number => {
    if (wc.current_level == null) return -1;
    return wc.scores[wc.current_level] != null ? wc.scores[wc.current_level] : 1;
  };
  return scored.sort((a, b) => sortScore(a) - sortScore(b)).slice(0, limit);
}

export {
  BLOOM_ORDER,
  NEEDS_REVIEW_MIN_CONFIDENCE,
  buildTopicIndex,
  groupKnowledgeTypes,
  getUserCompetencyMap,
  getTopicDetail,
  getWeakCompetenciesForCourse
};

module.exports = {
  BLOOM_ORDER,
  NEEDS_REVIEW_MIN_CONFIDENCE,
  buildTopicIndex,
  groupKnowledgeTypes,
  getUserCompetencyMap,
  getTopicDetail,
  getWeakCompetenciesForCourse
};
