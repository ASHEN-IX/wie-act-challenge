module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/session.setup.ts'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.{js,ts}', '!src/index.js', '!**/node_modules/**'],
  testMatch: ['**/tests/**/*.test.[jt]s'],
  // node:test suites run through test:node/test:node:integration, never through Jest.
  testPathIgnorePatterns: [
    '\\.node\\.test\\.ts$',
    '/tests/integration/ed07-study-rooms-e2e-real.test.ts$',
    '/tests/integration/ed09-facilitator.integration.test.ts$'
  ],
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        isolatedModules: true,
        diagnostics: false
      }
    ]
  },
  moduleNameMapper: {
    '^\\.\\./\\.\\./src/(.*)$': '<rootDir>/dist/$1',
    '^\\.\\./src/(.*)$': '<rootDir>/dist/$1'
  },
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
