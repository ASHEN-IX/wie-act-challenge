import type { DomainRequest } from '../../src/framework/contracts';
import { ContractError, parseContract, type AttemptSubmission } from './contracts';

/** For future owning-domain handlers after their current source/ACL checks.
 * A schema is not evidence of enrollment, publication or presenter authority. */
export function readAttemptSubmission(request: DomainRequest): {
  userId: string;
  submission: AttemptSubmission;
} {
  if (!request.user?.userId) throw new ContractError();
  return {
    userId: request.user.userId,
    submission: parseContract('AttemptSubmission', request.body)
  };
}
