import { boundedInteger, activityRange } from '@study-partner/shared/pagination';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@study-partner/shared/domainContracts');
import Joi from 'joi';
import type { Request, Response } from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AnalyticsEvent = require('../models/AnalyticsEvent');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getCacheClient } = require('@study-partner/shared');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { asyncHandler } = require('@study-partner/shared/middleware');

const router = createContracts();
const cache = getCacheClient();

const buildCacheKey = (
  userId: string,
  scope: string,
  query: Record<string, unknown> = {}
): string => `analytics:${scope}:${userId}:${JSON.stringify(query)}`;

// Validation schema
const trackEventSchema = Joi.object({
  eventType: Joi.string()
    .valid(
      'study_session_started',
      'study_session_completed',
      'task_created',
      'task_completed',
      'course_ingested',
      'plan_generated',
      'focus_tracked',
      'login',
      'profile_updated'
    )
    .required(),
  metadata: Joi.object().optional()
});

// Track an event
router.post(
  '/track',
  asyncHandler(async (req: Request, res: Response) => {
    const { error } = trackEventSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = (req as any).user.userId;
    const { eventType, metadata } = req.body;

    await AnalyticsEvent.create({
      userId,
      eventType,
      metadata
    });

    await cache.del(
      buildCacheKey(userId, 'timeline'),
      buildCacheKey(userId, 'summary'),
      buildCacheKey(userId, 'insights')
    );

    res.status(201).json({ message: 'Event tracked' });
  })
);

// Get user activity timeline
router.get(
  '/timeline',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const {
      startDate,
      endDate,
      limit = 50
    } = req.query as {
      startDate?: string;
      endDate?: string;
      limit?: string | number;
    };
    const cacheKey = buildCacheKey(userId, 'timeline', {
      startDate: startDate || null,
      endDate: endDate || null,
      limit: Number(limit)
    });

    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const filter: Record<string, any> = { userId };
    filter.timestamp = activityRange(startDate, endDate);

    const events = await AnalyticsEvent.find(filter)
      .sort({ timestamp: -1 })
      .limit(boundedInteger(limit));

    const payload = { events };
    await cache.setex(cacheKey, 60, JSON.stringify(payload));
    res.json(payload);
  })
);

// Get activity summary
router.get(
  '/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const cacheKey = buildCacheKey(userId, 'summary', {
      startDate: startDate || null,
      endDate: endDate || null
    });

    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const filter: Record<string, any> = { userId };
    filter.timestamp = activityRange(startDate, endDate);

    const grouped = await AnalyticsEvent.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            type: '$eventType',
            day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
          },
          count: { $sum: 1 }
        }
      }
    ]);
    const eventCounts: Record<string, number> = {};
    const days = new Set<string>();
    let totalEvents = 0;
    for (const group of grouped) {
      eventCounts[group._id.type] = (eventCounts[group._id.type] || 0) + group.count;
      totalEvents += group.count;
      days.add(group._id.day);
    }
    const sortedDates = [...days].sort();
    let currentStreak = 0;
    let longestStreak = 0;
    let streakCount = 0;
    for (let i = 0; i < sortedDates.length; i++) {
      const adjacent =
        i > 0 &&
        new Date(sortedDates[i]).getTime() - new Date(sortedDates[i - 1]).getTime() === 86400000;
      streakCount = adjacent ? streakCount + 1 : 1;
      longestStreak = Math.max(longestStreak, streakCount);
    }
    if (
      sortedDates.length &&
      Date.now() - new Date(sortedDates[sortedDates.length - 1]).getTime() < 2 * 86400000
    )
      currentStreak = streakCount;

    const payload = {
      totalEvents,
      eventCounts,
      activeDays: days.size,
      currentStreak,
      longestStreak
    };
    await cache.setex(cacheKey, 120, JSON.stringify(payload));
    res.json(payload);
  })
);

// Get event statistics by type
router.get(
  '/stats/:eventType',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { eventType } = req.params;
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

    const filter: Record<string, any> = { userId, eventType };
    filter.timestamp = activityRange(startDate, endDate);

    const groups = await AnalyticsEvent.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    const dailyStats = Object.fromEntries(
      groups.map((group: { _id: string; count: number }) => [group._id, { count: group.count }])
    );

    res.json({
      eventType,
      totalCount: groups.reduce((sum: number, group: { count: number }) => sum + group.count, 0),
      dailyStats
    });
  })
);

// Get insights
router.get(
  '/insights',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { days = 30 } = req.query as { days?: string | number };
    const cacheKey = buildCacheKey(userId, 'insights', { days: Number(days) });

    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(String(days)));

    const events = await AnalyticsEvent.find({
      userId,
      timestamp: { $gte: startDate }
    });

    // Calculate insights
    const studySessions = events.filter((e: any) => e.eventType === 'study_session_completed');
    const completedTasks = events.filter((e: any) => e.eventType === 'task_completed');

    const totalStudyTime = studySessions.reduce((sum: number, e: any) => {
      return sum + (e.metadata?.duration || 0);
    }, 0);

    const avgStudyTime = studySessions.length > 0 ? totalStudyTime / studySessions.length : 0;

    // Calculate most active day of the week
    const dayOfWeekCount: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const dayOfWeekDuration: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const session of studySessions) {
      const dayOfWeek = new Date(session.timestamp).getDay();
      dayOfWeekCount[dayOfWeek]++;
      dayOfWeekDuration[dayOfWeek] += session.metadata?.duration || 0;
    }

    // Find the day with the highest weighted activity score
    let mostActiveDay: Record<string, unknown> | null = null;
    let maxScore = 0;

    for (let day = 0; day < 7; day++) {
      // Weighted score: frequency (40%) + total study duration (60%)
      const frequencyScore = dayOfWeekCount[day];
      const durationScore = dayOfWeekDuration[day];
      const score = frequencyScore * 0.4 + durationScore * 0.6;

      if (score > maxScore) {
        maxScore = score;
        mostActiveDay = {
          day: day,
          name: dayNames[day],
          sessionCount: dayOfWeekCount[day],
          totalDuration: Math.round(dayOfWeekDuration[day]),
          avgDuration:
            dayOfWeekCount[day] > 0 ? Math.round(dayOfWeekDuration[day] / dayOfWeekCount[day]) : 0
        };
      }
    }

    // Calculate peak study hours (group by hour of day)
    const hourlyActivity: Record<number, { count: number; totalDuration: number }> = {};
    for (const session of studySessions) {
      const hour = new Date(session.timestamp).getHours();
      if (!hourlyActivity[hour]) {
        hourlyActivity[hour] = { count: 0, totalDuration: 0 };
      }
      hourlyActivity[hour].count++;
      hourlyActivity[hour].totalDuration += session.metadata?.duration || 0;
    }

    let peakHour: number | null = null;
    let maxHourScore = 0;
    for (const [hour, data] of Object.entries(hourlyActivity)) {
      if (data.count > maxHourScore) {
        maxHourScore = data.count;
        peakHour = parseInt(hour);
      }
    }

    // Weekly consistency: how many distinct days of the week had at least one study session
    const activeDaysCount = Object.values(dayOfWeekCount).filter((count) => count > 0).length;
    const weeklyConsistencyScore = Math.round((activeDaysCount / 7) * 100);

    const insights = {
      period: `${days} days`,
      studySessions: studySessions.length,
      completedTasks: completedTasks.length,
      totalStudyTime: Math.round(totalStudyTime),
      avgStudyTime: Math.round(avgStudyTime),
      mostActiveDay: mostActiveDay,
      peakStudyHour: peakHour !== null ? `${peakHour}:00 - ${peakHour + 1}:00` : null,
      weeklyConsistency: weeklyConsistencyScore,
      dayOfWeekBreakdown: dayNames.map((name, i) => ({
        day: name,
        sessions: dayOfWeekCount[i],
        totalDuration: Math.round(dayOfWeekDuration[i])
      })),
      hourlyActivity: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: hourlyActivity[i]?.count || 0,
        totalDuration: hourlyActivity[i]?.totalDuration || 0
      })),
      productivity:
        completedTasks.length > 0
          ? Math.round(
              (completedTasks.length / (completedTasks.length + studySessions.length)) * 100
            )
          : 0
    };

    const payload = { insights };
    await cache.setex(cacheKey, 120, JSON.stringify(payload));
    res.json(payload);
  })
);

// Get daily activity breakdown
router.get(
  '/daily-activity',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { days = 30 } = req.query as { days?: string | number };
    const cacheKey = buildCacheKey(userId, 'daily-activity', { days: Number(days) });

    const cached = await cache.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(String(days)));

    const events = await AnalyticsEvent.find({
      userId,
      timestamp: { $gte: startDate }
    }).sort({ timestamp: 1 });

    const dailyMap: Record<
      string,
      { date: string; sessions: number; duration: number; tasks: number; totalEvents: number }
    > = {};
    for (const event of events) {
      const date = event.timestamp.toISOString().split('T')[0];
      if (!dailyMap[date]) {
        dailyMap[date] = { date, sessions: 0, duration: 0, tasks: 0, totalEvents: 0 };
      }
      dailyMap[date].totalEvents++;
      if (event.eventType === 'study_session_completed') {
        dailyMap[date].sessions++;
        dailyMap[date].duration += event.metadata?.duration || 0;
      } else if (event.eventType === 'task_completed') {
        dailyMap[date].tasks++;
      }
    }

    const dailyActivity = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    const payload = { dailyActivity };
    await cache.setex(cacheKey, 120, JSON.stringify(payload));
    res.json(payload);
  })
);

module.exports = router;
export default router;
