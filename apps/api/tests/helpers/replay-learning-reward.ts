/** Fresh-process recovery probe, only for the isolated synthetic reward fixture. */
import { connectDatabase, disconnectDatabase } from '../../shared/database';
import { awardAcceptedLearningEvidence } from '../../modules/user-profile/src/services/learningRewards';

async function main() {
  const databaseUrl = process.env.REWARD_TEST_DATABASE_URL || '';
  if (!/\/ednova(?:_{1,2})test$/.test(databaseUrl))
    throw new Error('The shared synthetic reward database is required');
  process.env.DATABASE_URL = databaseUrl;
  await connectDatabase();
  try {
    const result = await awardAcceptedLearningEvidence(
      process.env.REWARD_TEST_ACTOR || '',
      process.env.REWARD_TEST_EVIDENCE || ''
    );
    process.stdout.write(JSON.stringify(result) + '\n');
  } finally {
    await disconnectDatabase();
  }
}
main().catch(() => {
  process.stderr.write('Reward replay probe failed\n');
  process.exitCode = 1;
});
