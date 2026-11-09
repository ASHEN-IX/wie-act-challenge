// Verification subprocess only. Intercepts acknowledged DB operations and is
// actually SIGKILLed by the parent. No production failure-injection hooks.
import { readFile } from 'node:fs/promises';
import { connectDatabase } from '../../shared/database';
import { StudentAttempt, LearningEvidence } from '../../modules/study/src/models';
import { submitAttempt } from '../../modules/study/src/services/activityAttempt';

async function main() {
  const { actor, submission, stage } = JSON.parse(await readFile(process.argv[2], 'utf8'));
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be supplied by the parent');
  await connectDatabase();
  const model = stage === 'evidence' ? LearningEvidence : StudentAttempt;
  // The claim is an upsert on the attempt; the prepared transition and the
  // evidence write are both conditional single-row updates.
  const method = stage === 'prepare' ? 'updateOne' : 'findOneAndUpdate';
  const original = (model as unknown as Record<string, Function>)[method];
  Object.defineProperty(model, method, {
    value: async (...args: unknown[]) => {
      const result = await original.apply(model, args);
      const update = args[1] as { $set?: { processingState?: string } };
      // `evidence` only passes `$setOnInsert`, so it always fires; `prepare`
      // waits for the prepared transition so the claim itself is observed.
      if (
        stage === 'evidence' ||
        update.$set?.processingState === 'prepared' ||
        stage === 'claim'
      ) {
        process.stdout.write('P0R1_CRASH_READY\n');
        await new Promise(() => {});
      }
      return result;
    }
  });
  await submitAttempt(actor, submission);
  throw new Error('Crash interception not reached');
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
