/**
 * Create and migrate a throwaway PostgreSQL database for one test run.
 *
 * Suites used to create a uniquely named MongoDB database and drop it at the
 * end. The equivalent here is a real database per run: created from the
 * maintenance database, migrated with `prisma migrate deploy`, and dropped when
 * the process exits.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require('pg');

const ADMIN_URL =
  process.env.TEST_DATABASE_ADMIN_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/postgres';
const APP_USER = process.env.TEST_DATABASE_USER || 'ednova';

function adminClient(database: string) {
  const url = new URL(ADMIN_URL);
  url.pathname = `/${database}`;
  return new Client({ connectionString: url.toString() });
}

async function drop(database: string): Promise<void> {
  const client = adminClient('postgres');
  await client.connect();
  try {
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [database]
    );
    await client.query(`DROP DATABASE IF EXISTS "${database}"`);
  } finally {
    await client.end();
  }
}

export async function provision(database: string): Promise<void> {
  const client = adminClient('postgres');
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${database}"`);
    await client.query(`CREATE DATABASE "${database}" OWNER "${APP_USER}"`);
  } finally {
    await client.end();
  }

  execFileSync(
    path.resolve(__dirname, '../../node_modules/.bin/prisma'),
    ['migrate', 'deploy', '--schema', path.resolve(__dirname, '../../prisma/schema.prisma')],
    {
      env: {
        ...process.env,
        DATABASE_URL: `postgresql://${APP_USER}:${process.env.TEST_DATABASE_PASSWORD || 'ednova'}@127.0.0.1:5433/${database}`
      },
      stdio: 'ignore'
    }
  );
}

/** Drop a provisioned database. Call from the suite's teardown. */
export async function deprovision(database: string): Promise<void> {
  await drop(database);
}
