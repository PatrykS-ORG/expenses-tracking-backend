import { AsyncLocalStorage } from 'node:async_hooks';

const testNowAls = new AsyncLocalStorage<Date>();

export function parseTestNow(
  value: string | Date | null | undefined,
): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isProductionEnv(nodeEnv = process.env.NODE_ENV): boolean {
  return nodeEnv === 'production';
}

export function resolveMonthCloseNow(options?: {
  explicit?: string | Date | null;
  envNow?: string | null;
  nodeEnv?: string;
  fallback?: Date;
}): Date {
  const fallback = options?.fallback ?? new Date();
  if (isProductionEnv(options?.nodeEnv)) {
    return fallback;
  }

  const explicit = parseTestNow(options?.explicit);
  if (explicit) {
    return explicit;
  }

  const fromAls = testNowAls.getStore();
  if (fromAls) {
    return fromAls;
  }

  const fromEnv = parseTestNow(options?.envNow ?? process.env.TEST_NOW_ISO);
  if (fromEnv) {
    return fromEnv;
  }

  return fallback;
}

export function runWithMonthCloseNow<T>(now: Date, fn: () => T): T {
  return testNowAls.run(now, fn);
}
