// Verification subprocess only. Intercepts acknowledged DB operations and is
// actually SIGKILLed by the parent. No production failure-injection hooks.
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { StudentAttempt, LearningEvidence } from '../../modules/study/src/models';
import { submitAttempt } from '../../modules/study/src/services/activityAttempt';

async function main() {
  const { actor, submission, stage } = JSON.parse(await readFile(process.argv[2], 'utf8'));
  await mongoose.connect(process.env.MONGODB_URI!);
  const model = stage === 'evidence' ? LearningEvidence : StudentAttempt;
  const method = stage === 'claim' ? 'findOneAndUpdate' : 'updateOne';
  const original = (model as unknown as Record<string, Function>)[method];
  Object.defineProperty(model, method, {
    value: async (...args: unknown[]) => {
      const result = await original.apply(model, args);
      const update = args[1] as { $set?: { processingState?: string } };
      if (stage !== 'prepare' || update.$set?.processingState === 'prepared') {
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
