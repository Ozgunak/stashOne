// Wraps any sync function with SyncRun logging.
//
// Pattern: insert a SyncRun row in RUNNING state, run the work, on
// success update to SUCCESS with recordsProcessed; on error update to
// FAILED and capture the message. Always returns a JSON-serializable
// summary the route handler can pass back to the caller.
//
// Cron secret check is also done here so every sync endpoint shares
// the same auth gate. If the header is missing/wrong, we reject with
// 401 BEFORE writing any SyncRun row (no need to log unauthorized
// pings).

import { prisma } from "@/lib/prisma";
import type { SyncKind } from "@/generated/prisma/enums";

export type SyncResult = {
  ok: boolean;
  kind: SyncKind;
  syncRunId?: string;
  recordsProcessed?: number;
  durationMs?: number;
  error?: string;
};

/**
 * Verify the Authorization header matches CRON_SECRET. Returns null if
 * OK; returns a Response (401) if not — caller short-circuits with that.
 *
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically
 * for cron triggers; manual curl needs the same header.
 */
export function checkCronAuth(req: Request): Response | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return new Response("CRON_SECRET not configured", { status: 500 });
  }
  const got = req.headers.get("authorization");
  if (got !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

/**
 * Wrap a sync work function with SyncRun bookkeeping.
 *
 * The work function:
 *   - Receives the SyncRun id (so it can log progress if it wants)
 *   - Returns the count of records processed
 *   - Throws on any failure — we capture and re-mark the SyncRun
 */
export async function runWithSyncLog(
  kind: SyncKind,
  work: (syncRunId: string) => Promise<number>,
): Promise<SyncResult> {
  const run = await prisma.syncRun.create({
    data: { kind, status: "RUNNING" },
  });
  const startedAt = run.startedAt;

  try {
    const recordsProcessed = await work(run.id);
    const completedAt = new Date();
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        completedAt,
        recordsProcessed,
      },
    });
    return {
      ok: true,
      kind,
      syncRunId: run.id,
      recordsProcessed,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    };
  } catch (err) {
    const completedAt = new Date();
    const message = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ""}` : String(err);
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt,
        errorMessage: message.slice(0, 5000),
      },
    });
    // Re-throw so the route handler can return 500 with a useful body.
    // Cron's "fail loud" is what alerts us on the Vercel dashboard.
    throw err;
  }
}
