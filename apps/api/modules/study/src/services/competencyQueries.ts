/**
 * BLOOM-09 — Competency read service.
 *
 * Read-side aggregation of CompetencyProfile rows for the competency API.
 */

import { Subject, Course, CompetencyProfile, ICompetencyProfile } from '../models/index';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BLOOM_LEVELS, UNLOCK_THRESHOLD } = require('@study-partner/shared/bloom/taxonomy');

const BLOOM_ORDER = ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYSE', 'EVALUATE', 'CREATE'];

const NEEDS_REVIEW_MIN_CONFIDENCE = 0.4;

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

/**
 * Build a topicId → { title, parentTopic, subjectId } index.
 */
async function buildTopicIndex(userId: string): Promise<Map<string, TopicMeta>> {
  const courses = await Course.find({ userId }).select('subjectId title topics').lean();

  const index = new Map<string, TopicMeta>();
  for (const course of courses) {
    const topics = course.topics || [];
    for (const topic of topics) {
      const parentTitle = topic.title || '';
      for (const sub of topic.subtopics || []) {
        if (!sub || !sub.id) continue;
        index.set(sub.id, {
          title: sub.title || sub.id,
          parentTopic: parentTitle,
          subjectId: course.subjectId,
          courseId: String(course._id)
        });
      }
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
function groupKnowledgeTypes(rows: any[]): KnowledgeTypeGroup[] {
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

  const topicsByTopicId: Record<string, any[]> = {};
  for (const row of profiles) {
    if (!topicsByTopicId[row.topicId]) topicsByTopicId[row.topicId] = [];
    topicsByTopicId[row.topicId].push(row);
  }

  const subjects = new Map<string, { subjectId: string; topics: Map<string, any> }>();

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

  // Resolve subject names
  const subjectIds = [...subjects.keys()];
  const subjectDocs = subjectIds.length
    ? await Subject.find({ userId, _id: { $in: subjectIds } })
        .select('name')
        .lean()
    : [];
  const nameById = new Map(subjectDocs.map((s: any) => [String(s._id), s.name]));

  const result: any[] = [];
  for (const [sid, subject] of subjects) {
    const topics: any[] = [];
    for (const [topicId, topic] of subject.topics) {
      const levelsByBloom = new Map<string, any[]>();
      for (const row of topic.rows) {
        if (!levelsByBloom.has(row.bloomLevel)) levelsByBloom.set(row.bloomLevel, []);
        levelsByBloom.get(row.bloomLevel)!.push(row);
      }

      const levels = BLOOM_ORDER.filter((lvl: string) => levelsByBloom.has(lvl)).map(
        (lvl: string) => {
          const levelRows = levelsByBloom.get(lvl)!;
          const level: any = {
            bloomLevel: lvl,
            score:
              Math.round(
                (levelRows.reduce((s: number, r: any) => s + r.score, 0) / levelRows.length) * 1000
              ) / 1000,
            confidence:
              Math.round(
                (levelRows.reduce((s: number, r: any) => s + r.confidence, 0) / levelRows.length) *
                  1000
              ) / 1000,
            count: levelRows.length
          };
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

  const meta: any = topicIndex.get(topicId) || {};
  const competencies = profiles.map((row: any) => ({
    topicId: row.topicId,
    topicName: meta.title || topicId,
    parentTopic: meta.parentTopic || null,
    subjectId: meta.subjectId || null,
    knowledgeType: row.knowledgeType,
    bloomLevel: row.bloomLevel,
    score: row.score,
    confidence: row.confidence,
    needsReview: row.confidence < NEEDS_REVIEW_MIN_CONFIDENCE,
    evidence: (row.evidence || []).slice(-5).map((e: any) => ({
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
  const course = await Course.findOne({ _id: courseId, userId }).lean();
  if (!course) return [];

  const titleById = new Map<string, string>();
  for (const topic of course.topics || []) {
    for (const sub of topic.subtopics || []) {
      if (sub && sub.id) titleById.set(sub.id, sub.title || sub.id);
    }
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
    const key = BLOOM_LEVEL_TO_KEY[row.bloomLevel];
    if (!key) continue;
    if (!buckets.has(row.topicId)) buckets.set(row.topicId, new Map());
    const scores = buckets.get(row.topicId)!;
    if (!scores.has(key)) scores.set(key, { total: 0, count: 0 });
    scores.get(key)!.total += row.score;
    scores.get(key)!.count += 1;
  }

  const scored: any[] = [];
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

  const sortScore = (wc: any): number => {
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
