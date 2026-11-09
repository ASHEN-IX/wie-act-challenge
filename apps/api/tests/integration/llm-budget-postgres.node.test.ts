import test from 'node:test';
import assert from 'node:assert/strict';
import { provision, deprovision } from '../helpers/provision-test-database';

test('LLM budget binds limits, enforces concurrent reservations and revocation', async () => {
  const database = `ednova_budget_${process.pid}_${Date.now()}`;
  await provision(database);
  process.env.DATABASE_URL = `postgresql://ednova:ednova@127.0.0.1:5433/${database}`;
  const { prisma } = require('../../shared/database') as typeof import('../../shared/database.js');
  const ledger =
    require('../../modules/study/src/services/llmBudget') as typeof import('../../modules/study/src/services/llmBudget.js');
  try {
    const approval = {
      approvalId: 'budget-test',
      task: 'facilitator',
      model: 'fixture/model',
      maxRequests: 3,
      maxTokens: 100,
      maxCostUsd: 1,
      expiresAt: Date.now() / 1000 + 300
    };
    const reservations = await Promise.all(
      Array.from({ length: 10 }, () => ledger.reserveRequest(approval))
    );
    assert.equal(reservations.filter(Boolean).length, 3);
    assert.equal(await ledger.reserveRequest({ ...approval, maxTokens: 200 }), false);
    assert.equal(await ledger.stillActive({ ...approval, maxCostUsd: 2 }), false);
    assert.equal(await ledger.reserveTokens({ ...approval, maxCostUsd: 2 }, 10), false);
    assert.equal(await ledger.reserveTokens(approval, 60), true);
    assert.equal(await ledger.reserveTokens(approval, 41), false);
    assert.equal(await ledger.revoke(approval.approvalId, 'test'), true);
    assert.equal(await ledger.stillActive(approval), false);
    assert.equal(await ledger.reserveTokens(approval, 1), false);
  } finally {
    await prisma.$disconnect();
    await deprovision(database);
  }
});
