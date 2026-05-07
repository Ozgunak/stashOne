// /players — paginated, searchable, filterable list of all NHL players.
// Reads from Postgres (seeded by scripts/seed-players.ts; eventually
// kept current by N6's cron job).
//
// URL state owns everything: ?q=mcdavid&team=EDM&pos=C&page=2
// Each filter is independent; clearing one preserves the others.

import Link from "next/link";
import { Suspense } from "react";

import { prisma } from "@/lib/prisma";
import SearchInput from "@/components/search-input";
import { Position } from "@/generated/prisma/enums";

export const metadata = { title: "Players" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 32;

const POSITIONS = ["C", "LW", "RW", "D", "G"] as const;
const POSITION_LABEL: Record<(typeof POSITIONS)[number], string> = {
  C: "Center",
  LW: "Left wing",
  RW: "Right wing",
  D: "Defense",
  G: "Goalie",
};

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    team?: string;
    pos?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const query = sp.q?.trim() || null;
  const teamAbbr = sp.team?.toUpperCase() || null;
  const positionStr = sp.pos?.toUpperCase() || null;
  const position = (POSITIONS as readonly string[]).includes(positionStr ?? "")
    ? (positionStr as (typeof POSITIONS)[number])
    : null;

  // Page parsing — clamp to >= 1 in case someone types ?page=0 or ?page=-3.
  const pageRaw = parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

  // Build the where clause from the active filters. Each filter only
  // applies if its param is set; this is the M8 search pattern again,
  // applied to three dimensions.
  const where = {
    ...(query ? { fullName: { contains: query, mode: "insensitive" as const } } : {}),
    ...(position ? { position: position as Position } : {}),
    ...(teamAbbr ? { team: { abbreviation: teamAbbr } } : {}),
  };

  // Three queries in parallel: page of results, total count for
  // pagination math, and the team list for the team filter dropdown.
  const [players, totalCount, teams] = await Promise.all([
    prisma.player.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
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
    prisma.player.count({ where }),
    prisma.team.findMany({
      orderBy: { name: "asc" },
      select: { abbreviation: true, name: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Players
          </h1>
          <span className="text-sm text-zinc-500">
            {totalCount.toLocaleString()} {totalCount === 1 ? "match" : "matches"}
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Suspense fallback={null}>
            <SearchInput />
          </Suspense>
        </div>
      </div>

      {/* Filter row: team + position dropdowns. We render as native
          <form action="GET"> so submitting reloads the page with new
          search params. Combining with the SearchInput's q is automatic
          because the form doesn't include q (it preserves whatever's
          already there via hidden input). */}
      <FilterBar
        teams={teams}
        activeTeam={teamAbbr}
        activePosition={position}
        currentQuery={query ?? ""}
      />

      {players.length === 0 ? (
        <NoMatches q={query} team={teamAbbr} pos={position} />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((p) => (
              <li key={p.id}>
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
                  <div className="min-w-0 flex-1">
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

          <Pagination
            page={safePage}
            totalPages={totalPages}
            currentParams={sp}
          />
        </>
      )}
    </main>
  );
}

// ---------- Filter bar ----------

function FilterBar({
  teams,
  activeTeam,
  activePosition,
  currentQuery,
}: {
  teams: { abbreviation: string; name: string }[];
  activeTeam: string | null;
  activePosition: string | null;
  currentQuery: string;
}) {
  // Native form GET: simplest possible filter UI. Browser handles
  // serialization and reload. We preserve `q` (search) via a hidden input
  // so changing team/position doesn't blow away the search.
  return (
    <form
      method="GET"
      action="/players"
      className="mb-6 flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="q" value={currentQuery} />

      <label className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
        Team:
        <select
          name="team"
          defaultValue={activeTeam ?? ""}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">All</option>
          {teams.map((t) => (
            <option key={t.abbreviation} value={t.abbreviation}>
              {t.name} ({t.abbreviation})
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
        Position:
        <select
          name="pos"
          defaultValue={activePosition ?? ""}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">All</option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {POSITION_LABEL[p]}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="rounded-md bg-zinc-200 px-3 py-1 text-sm font-medium text-black hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
      >
        Apply
      </button>

      {(activeTeam || activePosition) && (
        <Link
          href={currentQuery ? `/players?q=${encodeURIComponent(currentQuery)}` : "/players"}
          className="text-xs text-zinc-500 hover:underline"
        >
          Clear filters
        </Link>
      )}
    </form>
  );
}

// ---------- Pagination ----------

function Pagination({
  page,
  totalPages,
  currentParams,
}: {
  page: number;
  totalPages: number;
  currentParams: { q?: string; team?: string; pos?: string };
}) {
  if (totalPages <= 1) return null;

  // Build query string carrying everything except `page`. Each link
  // overrides page on click.
  function buildHref(p: number) {
    const params = new URLSearchParams();
    if (currentParams.q) params.set("q", currentParams.q);
    if (currentParams.team) params.set("team", currentParams.team);
    if (currentParams.pos) params.set("pos", currentParams.pos);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/players?${qs}` : "/players";
  }

  // Sliding window of 5 pages around current.
  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(totalPages, page + 2);
  const pages: number[] = [];
  for (let i = windowStart; i <= windowEnd; i++) pages.push(i);

  return (
    <nav className="mt-6 flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
      <PageLink page={page - 1} totalPages={totalPages} buildHref={buildHref} disabled={page === 1}>
        ← Prev
      </PageLink>

      {windowStart > 1 && (
        <>
          <PageLink page={1} totalPages={totalPages} buildHref={buildHref}>
            1
          </PageLink>
          {windowStart > 2 && <span className="text-zinc-400">…</span>}
        </>
      )}

      {pages.map((p) => (
        <PageLink
          key={p}
          page={p}
          totalPages={totalPages}
          buildHref={buildHref}
          active={p === page}
        >
          {p}
        </PageLink>
      ))}

      {windowEnd < totalPages && (
        <>
          {windowEnd < totalPages - 1 && <span className="text-zinc-400">…</span>}
          <PageLink page={totalPages} totalPages={totalPages} buildHref={buildHref}>
            {totalPages}
          </PageLink>
        </>
      )}

      <PageLink
        page={page + 1}
        totalPages={totalPages}
        buildHref={buildHref}
        disabled={page === totalPages}
      >
        Next →
      </PageLink>
    </nav>
  );
}

function PageLink({
  page,
  totalPages,
  buildHref,
  active,
  disabled,
  children,
}: {
  page: number;
  totalPages: number;
  buildHref: (p: number) => string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  if (disabled || page < 1 || page > totalPages) {
    return (
      <span className="rounded-md px-2 py-1 text-zinc-300 dark:text-zinc-700">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={buildHref(page)}
      className={`rounded-md px-2 py-1 ${
        active
          ? "bg-black text-white dark:bg-zinc-50 dark:text-black"
          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

// ---------- No matches ----------

function NoMatches({ q, team, pos }: { q: string | null; team: string | null; pos: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
      <p className="text-base font-medium text-black dark:text-zinc-50">
        No players match
        {q && (
          <>
            {" "}
            <span className="font-mono">&ldquo;{q}&rdquo;</span>
          </>
        )}
        {team && (
          <>
            {q ? "," : ""} on <span className="font-mono">{team}</span>
          </>
        )}
        {pos && (
          <>
            {q || team ? "," : ""} at position{" "}
            <span className="font-mono">{pos}</span>
          </>
        )}
        .
      </p>
      <Link href="/players" className="mt-2 text-sm text-zinc-600 hover:underline">
        Clear filters
      </Link>
    </div>
  );
}
