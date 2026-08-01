# AI credit renewal process

AI credits are a **monthly budget**, not a stored balance that gets topped up by a job.

There is no cron, webhook, or migration that “renews” credits. Remaining credits are recalculated on every check from:

```text
remaining = User.ai_credit_limit − SUM(AiUsageLog.credits_used in current UTC month)
```

When the UTC calendar month rolls over, that sum covers a new empty window, so `used` becomes `0` and the full limit is available again.

## Period definition

Computed in `AiUsageService.getCurrentPeriod()`:

| Bound         | Value                                              |
| ------------- | -------------------------------------------------- |
| `periodStart` | `00:00:00.000` UTC on the 1st of the current month |
| `periodEnd`   | `00:00:00.000` UTC on the 1st of the next month    |

Usage rows count when `created_at >= periodStart AND created_at < periodEnd`.

The Settings UI “Resets on” date is `periodEnd` (start of next UTC month).

## What is stored vs what is derived

| Concept              | Storage / source                                                                      |
| -------------------- | ------------------------------------------------------------------------------------- |
| Monthly limit        | `User.ai_credit_limit` (set on profile create from `AI_MONTHLY_CREDIT_LIMIT`)         |
| Tokens → credits     | `ceil(total_tokens / AI_TOKENS_PER_CREDIT)` at write time → `AiUsageLog.credits_used` |
| Credits used (month) | Derived: sum of `credits_used` in the current period                                  |
| Remaining            | Derived: `max(0, limit − used)`                                                       |
| Audit history        | Permanent `AiUsageLog` rows (not cleared on month change)                             |

Past months’ `AiUsageLog` rows remain for the audit table; they simply stop counting toward the live budget.

## Renewal timeline

```mermaid
flowchart TD
  call[AI call or usage query]
  period[Resolve UTC month window]
  sum[Sum credits_used in window]
  limit[Read User.ai_credit_limit]
  remaining["remaining = limit - used"]
  gate{used greater or equal limit?}
  allow[Allow / show remaining]
  block[Block manual call or skip cron]

  call --> period --> sum --> limit --> remaining --> gate
  gate -->|no| allow
  gate -->|yes| block
```

1. User (or cron) triggers an AI action, or Settings loads `myAiUsageSummary`.
2. Service resolves the current UTC month `[periodStart, periodEnd)`.
3. It sums `AiUsageLog.credits_used` for that user in the window.
4. It compares against `User.ai_credit_limit`.
5. At `periodEnd` (next month UTC), the window moves forward → sum for the new window starts at `0` → budget is fully available again.

No row is updated and no job runs at midnight; renewal is a side effect of the time window.

## Enforcement around renewal

| Path                       | Over-limit behavior                                              |
| -------------------------- | ---------------------------------------------------------------- |
| Manual GraphQL AI actions  | `BadRequestException` with reset date (`periodEnd`)              |
| Cron `processDueSummaries` | User outcome `skipped`, reason `AI credit limit reached`         |
| After month boundary (UTC) | New calls succeed again until the new month’s sum hits the limit |

Manual actions: `generateTemplate`, `scanReceipt`, `sendSummaryNow`.  
Scheduled: expense summary analysis inside the hourly cron batch.

## Changing the limit or ratio

- **Per-user limit**: update `User.ai_credit_limit` in the DB (no admin UI yet). Takes effect on the next summary/check; does not rewrite historical logs.
- **Default for new users**: set GitHub/env `AI_MONTHLY_CREDIT_LIMIT` (applied in `ensureUserProfile` on create).
- **Token → credit ratio**: set `AI_TOKENS_PER_CREDIT`. Affects **new** `credits_used` calculations only; existing log rows keep their stored `credits_used`.

## Related code

| Piece                   | Location                                       |
| ----------------------- | ---------------------------------------------- |
| Period + remaining math | `src/ai-usage/ai-usage.service.ts`             |
| Env fallbacks           | `src/ai-usage/ai-usage.constants.ts`           |
| Limit on profile create | `src/users/user-profile.service.ts`            |
| Pre-call gate + logging | `src/ai/ai.service.ts`                         |
| Cron skip               | `src/summary/summary.service.ts`               |
| Schema                  | `AiUsageLog`, `User.ai_credit_limit` in Prisma |

See also [architecture.md — AI credits and usage audit](../architecture.md#ai-credits-and-usage-audit) and [database.md](../database.md).
