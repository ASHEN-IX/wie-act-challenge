export interface DomainOperation {
  method: string;
  path: string;
  handlers: Array<Function>;
  [key: string]: unknown;
}

export interface DomainMetadata {
  name: string;
  directory: string;
  operations: DomainOperation[];
}

type MountDefinition = [prefix: string, filename: string];
type DomainTuple = [name: string, directory: string, mounts: MountDefinition[]];

const definitions: DomainTuple[] = [
  [
    'auth',
    'auth',
    [
      ['/api/v1/auth', 'auth'],
      ['/api/v1/auth/stripe', 'stripe'],
      ['/api/v1/auth/admin', 'admin']
    ]
  ],
  [
    'users',
    'user-profile',
    [
      ['/api/v1/users/profile', 'profile'],
      ['/api/v1/users/availability', 'availability'],
      ['/api/v1/users/gamification', 'gamification'],
      ['/api/v1/users/learning-rewards', 'learningRewards'],
      ['/api/v1/users/gamification/rank', 'ranking'],
      ['/api/v1/users/quests', 'quests'],
      ['/api/v1/users/friends', 'friends'],
      ['/api/v1/users/groups', 'groups']
    ]
  ],
  [
    'study',
    'study',
    [
      ['/api/v1/study/tasks', 'tasks'],
      ['/api/v1/study/topics', 'topics'],
      ['/api/v1/study/sessions', 'sessions'],
      ['/api/v1/study/subjects', 'subjects'],
      ['/api/v1/study/courses', 'courses'],
      ['/api/v1/study/plans', 'plans'],
      ['/api/v1/study/learning-objectives', 'learningObjectives'],
      ['/api/v1/competencies', 'competencies'],
      ['/api/v1/coach', 'coach'],
      ['/api/v1/study/rooms', 'rooms'],
      ['/api/v1/study/institutions', 'institutions'],
      ['/api/v1/study/activities', 'activities'],
      ['/api/v1/study/learning', 'learning'],
      ['/api/v1/study/insights', 'instructorAnalytics'],
      ['/api/v1/study/private-help', 'privateHelp'],
      ['/api/v1/study/visual-lab', 'visualLab'],
      ['/api/v1/study/nardouch', 'nardouch'],
      ['/api/v1/study/internal', 'internal']
    ]
  ],
  [
    'ai',
    'ai-orchestrator',
    [
      ['/api/v1/ai', 'ai'],
      ['/api/v1/ai', 'jobs'],
      ['/api/v1/eval', 'eval'],
      ['/api/v1/search', 'search']
    ]
  ],
  ['signals', 'signal-processing', [['/api/v1/signals/focus', 'focus']]],
  ['analytics', 'analytics', [['/api/v1/analytics', 'analytics']]],
  [
    'notifications',
    'notification',
    [
      ['/api/v1/notifications', 'notifications'],
      ['/api/v1/session-chat', 'chat'],
      ['/api/v1/voice', 'voice']
    ]
  ]
];

export function loadDefinitions(): DomainMetadata[] {
  return definitions.map(([name, directory, mounts]) => ({
    name,
    directory,
    operations: mounts.flatMap(([prefix, filename]) => {
      const exported = require(`../modules/${directory}/src/routes/${filename}`);
      const unwrapped = exported.default || exported;
      const contract = unwrapped.router || unwrapped;
      const operations: DomainOperation[] = (contract.operations || []).map(
        (operation: { path: string; handlers: Function[]; [key: string]: unknown }) => ({
          ...operation,
          path: prefix + (operation.path === '/' ? '' : operation.path),
          handlers: [
            ...contract.middleware.flatMap((entry: { handlers: Function[] }) => entry.handlers),
            ...operation.handlers
          ]
        })
      );
      if (exported.webhookHandler) {
        operations.unshift({
          method: 'post',
          path: prefix + '/webhook',
          handlers: [exported.webhookHandler]
        });
      }
      return operations;
    })
  }));
}

module.exports = { loadDefinitions };
