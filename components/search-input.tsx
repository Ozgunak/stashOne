"use client";

// Debounced search input. Updates the URL's `?q=` parameter after the
// user stops typing for ~300ms. Server component re-renders /items with
// the new search.
//
// Why URL-driven instead of local state:
//   - Refresh preserves the search (browser remembers the URL).
//   - Sharable / bookmarkable.
//   - Plays nicely with the Back button.
//   - The list page already reads searchParams, so we ride that path.
//
// We use router.replace() instead of router.push() so each keystroke
// doesn't add a Back-button history entry (you'd press Back once per
// character typed, which is annoying).

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function SearchInput() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initial input value from the URL — keeps display in sync if the
  // user navigates here with `?q=` already set.
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  // Reset local state if the URL changes externally (e.g., user clicks
  // a tag link which doesn't carry q forward — though we *do* preserve
  // q in the link below).
  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
    // re-run only when q in URL changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("q")]);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushQueryToURL(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("q", next);
    else params.delete("q");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setValue(next);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => pushQueryToURL(next), 300);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      // Submit immediately — flush the pending debounce.
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      pushQueryToURL(value);
    } else if (e.key === "Escape") {
      setValue("");
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      pushQueryToURL("");
    }
  }

  return (
    <input
      type="search"
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder="Search title or notes…"
      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-black placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 sm:w-72"
    />
  );
}
