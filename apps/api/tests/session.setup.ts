jest.mock('../shared/sessionIdentity', () => ({
  resolveIdentity: (headers: Parameters<typeof import('./sessionFixtures').resolveIdentity>[0]) =>
    require('./sessionFixtures').resolveIdentity(headers)
}));
