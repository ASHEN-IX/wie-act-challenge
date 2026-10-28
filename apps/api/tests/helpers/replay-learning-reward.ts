/** Fresh-process recovery probe, only for isolated synthetic reward databases. */
import mongoose from 'mongoose';
import { awardAcceptedLearningEvidence } from '../../modules/user-profile/src/services/learningRewards';
async function main() {
  const uri = process.env.REWARD_TEST_URI || '';
  if (!/^mongodb:\/\/127\.0\.0\.1:27018\/ednova_reward_[a-zA-Z0-9_]+$/.test(uri))
    throw new Error('Isolated synthetic reward database required');
  await mongoose.connect(uri);
  try {
    const result = await awardAcceptedLearningEvidence(
      process.env.REWARD_TEST_ACTOR || '',
      process.env.REWARD_TEST_EVIDENCE || ''
    );
    process.stdout.write(JSON.stringify(result) + '\n');
  } finally {
    await mongoose.disconnect();
  }
}
main().catch(() => {
  process.stderr.write('Reward replay probe failed\n');
  process.exitCode = 1;
});
