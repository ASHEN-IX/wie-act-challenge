// What each cut contains. Scenes and their sections are recorded by demo/record.mjs;
// this file only decides order, chapter cards, which sections are kept and extra speed.

export const TITLE = {
  subtitle: 'A GenAI peer-learning companion: a course-grounded tutor, a peer-first facilitator and live study rooms.',
  note: 'EdNova Challenge · IEEE WIE ACT 5.0 · synthetic demo data, real model calls',
};

export const OUTRO = {
  points: [
    'Hints before answers, grounded in the course',
    'Compact and capable models, each where it fits',
    'Labelled fallback when capacity runs out',
    'Real-time peer rooms with a peer-first facilitator',
    'Private evidence; privacy-thresholded teacher insights',
  ],
};

export const CHAPTERS = {
  landing: { kicker: 'Learner', title: 'Meet Tasnim', subtitle: 'A university student preparing a databases course.' },
  reader: { kicker: 'Learner · AI tutor', title: 'Understand, don’t copy', subtitle: 'Course-grounded explanations, checked sources, and honest fallback.' },
  practice: { kicker: 'Learner · Practice', title: 'Hints before answers', subtitle: 'Private feedback, a learning-style probe and graduated hints.' },
  'nardouch-voice': { kicker: 'Learner · Multilingual', title: 'Practice out loud', subtitle: 'Nardouch can speak Tunisian Darija, French or English.' },
  tasks: { kicker: 'Learner · Planning', title: 'Plan your study', subtitle: 'Tasks with priority, time and status.' },
  lab: { kicker: 'Learner · Visual Lab', title: 'See the concept move', subtitle: 'The model proposes the scenario; trusted code computes it.' },
  room: { kicker: 'Peers · Real time', title: 'Study Together', subtitle: 'Two real browser sessions in one live room.' },
  instructor: { kicker: 'Instructor', title: 'Teach with evidence', subtitle: 'Course Studio and privacy-thresholded insights.' },
};

/**
 * Cut definitions. Per scene: `sections` (default: all), `speed` (multiplies the recorded pacing),
 * `sectionSpeed` (per-section multiplier).
 */
export const CUTS = {
  master: {
    file: 'noveris-demo-master.mp4',
    chapters: true,
    crf: 15,
    scenes: [
      { scene: 'landing' },
      { scene: 'onboarding' },
      { scene: 'reader' },
      { scene: 'practice', sectionSpeed: { style: 0.8 } },
      { scene: 'nardouch-voice', sections: ['ask', 'voice'], voiceSection: 'voice' },
      { scene: 'lab' },
      { scene: 'room' },
      { scene: 'progress' },
      { scene: 'tasks' },
      { scene: 'instructor' },
    ],
  },
  short: {
    file: 'noveris-demo-90s.mp4',
    chapters: false,
    maxSeconds: 90,
    crf: 18,
    titleSeconds: 2.5,
    outroSeconds: 3,
    scenes: [
      { scene: 'landing', sections: ['landing', 'login', 'dashboard'], speed: 1.6, sectionSpeed: { login: 1.6 } },
      { scene: 'reader', sections: ['tutor', 'fallback'], speed: 1.5 },
      { scene: 'practice', sections: ['attempt', 'hints', 'retry'], speed: 1.6 },
      { scene: 'nardouch-voice', sections: ['ask', 'voice'], sectionSpeed: { ask: 1.4 }, voiceSection: 'voice' },
      { scene: 'room', sections: ['join', 'chat', 'board', 'facilitator', 'attempt'], speed: 1.7 },
      { scene: 'lab', sections: ['open', 'interact'], speed: 2.2 },
      { scene: 'tasks', speed: 1.5 },
      { scene: 'progress', speed: 1.8 },
      { scene: 'instructor', sections: ['insights'], speed: 1.4 },
    ],
  },
};
