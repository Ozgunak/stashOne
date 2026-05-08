"use client";

// Renders a UTC Date in the user's local timezone using Intl.DateTimeFormat.
//
// Why client component: the timezone we want to display in is the
// BROWSER's, not the server's. The server doesn't know the user's TZ
// (the request doesn't carry it reliably). So we hydrate with a UTC
// timestamp and let the browser format.
//
// SSR fallback: server renders a UTC string. After hydration, the
// browser swaps in the local-formatted version. Slight visual flash on
// first load is acceptable; the alternative (heuristics from headers)
// is wrong more often than right.

import { useEffect, useState } from "react";

type Props = {
  /**
   * The instant to format. Accepts a Date object, a numeric timestamp,
   * or an ISO string (server components serialize Date to string when
   * passing to a client component).
   */
  date: Date | string | number;

  /**
   * Tailored formatter — picks one of a few common layouts.
   *   - "datetime"  → "Thu, May 7 · 7:00 PM"
   *   - "time"      → "7:00 PM"
   *   - "date"      → "Thu, May 7"
   */
  format?: "datetime" | "time" | "date";
};

const formatters: Record<NonNullable<Props["format"]>, Intl.DateTimeFormatOptions> = {
  datetime: {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
  time: {
    hour: "numeric",
    minute: "2-digit",
  },
  date: {
    weekday: "short",
    month: "short",
    day: "numeric",
  },
};

export default function LocalTime({ date, format = "datetime" }: Props) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    setText(new Intl.DateTimeFormat(undefined, formatters[format]).format(d));
  }, [date, format]);

  // Pre-hydration: render a stable UTC fallback so the server-rendered
  // HTML matches up to the suppressHydrationWarning boundary.
  // suppressHydrationWarning lets React skip the mismatch warning for
  // this single text node — exactly the use case it's documented for.
  const fallback =
    typeof date === "string" ? date : new Date(date as number | Date).toISOString();

  return (
    <time
      dateTime={fallback}
      suppressHydrationWarning
      className="tabular-nums"
    >
      {text ?? fallback}
    </time>
  );
}
