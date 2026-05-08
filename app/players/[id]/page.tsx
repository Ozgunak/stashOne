// /players/[id] — single player detail.
//
// Hybrid data source (the N5 lesson):
//   - DB lookup by externalId for basic identity (name, team, position).
//     Came from our seed; will be kept fresh by N6's cron.
//   - Live API call to getPlayer() for current-season stats. The seed
//     doesn't capture stats yet — that's N6 territory. So this page
//     "tops up" with live data per render.
//
// Both fire in parallel via Promise.all.

import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPlayer, NhlApiError } from "@/lib/nhl/client";
import FavoriteButton from "@/components/favorite-button";

export const metadata = { title: "Player" };
export const revalidate = 600;

const POSITION_LABEL: Record<"C" | "LW" | "RW" | "D" | "G", string> = {
  C: "Center",
  LW: "Left wing",
  RW: "Right wing",
  D: "Defense",
  G: "Goalie",
};

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const externalId = parseInt(id, 10);
  if (!Number.isFinite(externalId)) notFound();

  // Parallel: our DB row + the live NHL stats. We only fail the page if
  // the DB lookup misses (the player isn't in our seed → 404). If the
  // API call fails, we still render — just without the stats card.
  const [dbPlayer, apiResult] = await Promise.all([
    prisma.player.findUnique({
      where: { externalId },
      select: {
        id: true,
        externalId: true,
        firstName: true,
        lastName: true,
        position: true,
        jerseyNumber: true,
        headshotUrl: true,
        team: { select: { abbreviation: true, name: true, logoUrl: true } },
      },
    }),
    getPlayer(externalId).catch((err) => {
      // Swallow — degraded mode without stats is fine.
      if (err instanceof NhlApiError) {
        console.warn(`[players/${externalId}] API call failed:`, err.kind, err.message);
      }
      return null;
    }),
  ]);

  if (!dbPlayer) notFound();

  const stats = apiResult?.featuredStats?.regularSeason?.subSeason ?? null;

  // Resolve current user's favorite status for this player.
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const isFavorited = userId
    ? !!(await prisma.userFavorite.findUnique({
        where: {
          userId_kind_externalId: {
            userId,
            kind: "PLAYER",
            externalId: dbPlayer.externalId,
          },
        },
        select: { id: true },
      }))
    : false;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
      <Link
        href="/players"
        className="mb-4 inline-block text-sm text-zinc-600 hover:underline dark:text-zinc-400"
      >
        ← All players
      </Link>

      {/* Header */}
      <header className="mb-6 flex items-center gap-4">
        {dbPlayer.headshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dbPlayer.headshotUrl}
            alt=""
            width={80}
            height={80}
            className="shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800"
          />
        ) : (
          <div className="h-20 w-20 shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800" />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            {dbPlayer.firstName} {dbPlayer.lastName}
            {dbPlayer.jerseyNumber != null && (
              <span className="ml-3 font-mono text-zinc-400">#{dbPlayer.jerseyNumber}</span>
            )}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {POSITION_LABEL[dbPlayer.position]}
            {dbPlayer.team && (
              <>
                {" · "}
                <Link
                  href={`/teams/${dbPlayer.team.abbreviation}`}
                  className="hover:underline"
                >
                  {dbPlayer.team.name}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {userId && (
            <FavoriteButton
              kind="PLAYER"
              externalId={dbPlayer.externalId}
              initialFavorited={isFavorited}
              label={`Favorite ${dbPlayer.firstName} ${dbPlayer.lastName}`}
            />
          )}
          {dbPlayer.team?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dbPlayer.team.logoUrl}
              alt=""
              width={48}
              height={48}
              className="shrink-0"
            />
          )}
        </div>
      </header>

      {/* Stats card (degraded gracefully if API failed) */}
      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-zinc-500">
          {apiResult?.featuredStats?.season
            ? `Regular season ${String(apiResult.featuredStats.season).slice(0, 4)}–${String(apiResult.featuredStats.season).slice(4)}`
            : "Regular season"}
        </h2>

        {stats == null ? (
          <p className="text-sm text-zinc-500">
            Stats unavailable. (Either the player has no current-season data, or
            the live API call failed.)
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="GP" value={stats.gamesPlayed ?? 0} />
            <Stat label="Goals" value={stats.goals ?? 0} />
            <Stat label="Assists" value={stats.assists ?? 0} />
            <Stat label="Points" value={stats.points ?? 0} highlight />
            <Stat label="+/−" value={stats.plusMinus ?? 0} />
            <Stat label="PIM" value={stats.pim ?? 0} />
            <Stat label="Shots" value={stats.shots ?? 0} />
            <Stat
              label="Shooting %"
              value={
                stats.shootingPctg != null
                  ? `${(stats.shootingPctg * 100).toFixed(1)}%`
                  : "—"
              }
            />
          </dl>
        )}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd
        className={`mt-1 font-mono ${
          highlight
            ? "text-lg font-semibold text-black dark:text-zinc-50"
            : "text-base text-zinc-700 dark:text-zinc-300"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
