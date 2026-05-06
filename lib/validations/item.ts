// Validation schema for creating/editing an Item.
//
// Why a separate file: this schema is the SINGLE SOURCE OF TRUTH for what
// counts as a valid item. The form, the server action, and (later in M6)
// the edit endpoint all import from here. If we change "max title is 200
// chars" we change it in ONE place.
//
// The roadmap M5 lesson: validate INPUT before it touches the DB. This
// schema is that line of defense.

import { z } from "zod";

// We mirror the Prisma enums explicitly. We could import them from the
// generated client, but keeping the literals here means the validation
// layer doesn't depend on Prisma at all — Zod can be used in client
// components without dragging in the database client.
export const ITEM_TYPES = ["BOOK", "MOVIE", "SHOW"] as const;
export const ITEM_STATUSES = ["WANT", "IN_PROGRESS", "DONE"] as const;

export const itemInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less"),

  type: z.enum(ITEM_TYPES, { error: "Pick a type" }),

  status: z.enum(ITEM_STATUSES, { error: "Pick a status" }),

  // Rating is optional. Form submits a string ("3") or empty (""); we
  // coerce to number, then constrain. Empty string -> undefined.
  rating: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(5)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),

  // Notes optional, capped to keep things sane (and prevent storage abuse).
  notes: z
    .string()
    .trim()
    .max(5000, "Notes must be 5000 characters or less")
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : v)),
});

export type ItemInput = z.infer<typeof itemInputSchema>;
