// /favorites — user's saved teams + players. Two sections, recent first.
//
// Auth is required (proxy enforces, page double-checks). The query
// filters by userId — same M4 lesson, applied to NHL favorites.

import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Favorites" };
export const dynamic = "force-dynamic";

const POSITION_LABEL: Record<"C" | "LW" | "RW" | "D" | "G", string> = {
  C: "Center",
  LW: "Left wing",
  RW: "Right wing",
  D: "Defense",
  G: "Goalie",
};

export default async function FavoritesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized: no session.user.id");
  }
  const userId = session.user.id;

  // 1. Pull all favorites for this user, recent first.
  const favorites = await prisma.userFavorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, kind: true, externalId: true, createdAt: true },
  });

  // 2. Resolve each favorite to its actual entity. The polymorphic
  // shape (kind + externalId) means we do TWO queries — one per kind
  // — rather than one big polymorphic JOIN that Prisma can't model
  // natively. For the volumes here this is fine.
  const teamExternalIds = favorites.filter((f) => f.kind === "TEAM").map((f) => f.externalId);
  const playerExternalIds = favorites.filter((f) => f.kind === "PLAYER").map((f) => f.externalId);

  // Prisma handles `where: { externalId: { in: [] } }` natively, so we
  // don't need a special-case for empty arrays. Always run both queries.
  const [teams, players] = await Promise.all([
    prisma.team.findMany({
      where: { externalId: { in: teamExternalIds } },
      select: {
        externalId: true,
        abbreviation: true,
        name: true,
        logoUrl: true,
        division: true,
        points: true,
      },
    }),
    prisma.player.findMany({
      where: { externalId: { in: playerExternalIds } },
      select: {
        externalId: true,
        firstName: true,
        lastName: true,
        position: true,
        jerseyNumber: true,
        headshotUrl: true,
        team: { select: { abbreviation: true, name: true } },
      },
    }),
  ]);

  // 3. Re-order each list by the favorite's createdAt (recent first).
  const teamByExt = new Map(teams.map((t) => [t.externalId, t]));
  const playerByExt = new Map(players.map((p) => [p.externalId, p]));

  const orderedTeams = favorites
    .filter((f) => f.kind === "TEAM")
    .map((f) => teamByExt.get(f.externalId))
    .filter(<T,>(x: T): x is NonNullable<T> => x != null);

  const orderedPlayers = favorites
    .filter((f) => f.kind === "PLAYER")
    .map((f) => playerByExt.get(f.externalId))
    .filter(<T,>(x: T): x is NonNullable<T> => x != null);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Favorites
        </h1>
        <span className="text-sm text-zinc-500 dark:text-zinc-500">
          {orderedTeams.length} {orderedTeams.length === 1 ? "team" : "teams"} ·{" "}
          {orderedPlayers.length} {orderedPlayers.length === 1 ? "player" : "players"}
        </span>
      </div>

      {orderedTeams.length === 0 && orderedPlayers.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-10">
          {/* Teams section */}
          {orderedTeams.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Teams ({orderedTeams.length})
              </h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {orderedTeams.map((t) => (
                  <li key={t.externalId}>
                    <Link
                      href={`/teams/${t.abbreviation}`}
                      className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 hover:border-black hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-50 dark:hover:bg-zinc-900"
                    >
                      {t.logoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.logoUrl} alt="" width={40} height={40} className="shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-black dark:text-zinc-50">
                          {t.name}
                        </div>
                        <div className="truncate text-xs text-zinc-500">
                          {t.division ?? "—"} · {t.points} pts
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Players section */}
          {orderedPlayers.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Players ({orderedPlayers.length})
              </h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {orderedPlayers.map((p) => (
                  <li key={p.externalId}>
                    <Link
                      href={`/players/${p.externalId}`}
                      className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 hover:border-black hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-50 dark:hover:bg-zinc-900"
                    >
                      {p.headshotUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.headshotUrl}
                          alt=""
                          width={48}
                          height={48}
                          className="shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800"
                        />
                      ) : (
                        <div className="h-12 w-12 shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800" />
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-black dark:text-zinc-50">
                          {p.firstName} {p.lastName}
                        </div>
                        <div className="truncate text-xs text-zinc-500">
                          {POSITION_LABEL[p.position]}
                          {p.team ? ` · ${p.team.abbreviation}` : " · No team"}
                          {p.jerseyNumber != null && ` · #${p.jerseyNumber}`}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
      <p className="text-base font-medium text-black dark:text-zinc-50">
        No favorites yet.
      </p>
      <p className="mt-1 text-sm text-zinc-500">
        Star a team or player from their detail page to save it here.
      </p>
      <div className="mt-4 flex gap-2">
        <Link
          href="/teams"
          className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
        >
          Browse teams
        </Link>
        <Link
          href="/players"
          className="rounded-md bg-zinc-200 px-3 py-1.5 text-sm font-medium text-black hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
        >
          Browse players
        </Link>
      </div>
    </div>
  );
}
