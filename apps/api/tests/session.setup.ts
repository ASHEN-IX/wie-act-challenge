jest.mock('../shared/sessionIdentity', () => ({
  resolveIdentity: (headers: any) => require('./sessionFixtures').resolveIdentity(headers)
}));
