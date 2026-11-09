import { Prisma } from '../../../../src/generated/prisma/client';

/** JSON columns accept any document; this narrows without a per-call cast. */
export function json<T>(value: T | null | undefined): Prisma.InputJsonValue | undefined {
  return value === null || value === undefined
    ? undefined
    : (value as unknown as Prisma.InputJsonValue);
}

export function jsonOrNull<T>(
  value: T | null | undefined
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null || value === undefined
    ? Prisma.JsonNull
    : (value as unknown as Prisma.InputJsonValue);
}
