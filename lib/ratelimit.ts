// Rate limiters backed by Upstash Redis.
//
// Why Upstash and not in-memory: Vercel functions are stateless +
// cold-start often. An in-process counter resets every cold start, so
// an attacker just spamming a fresh function instance defeats it. A
// shared store (Redis here) gives all instances one source of truth.
//
// Two limiters because two attack shapes:
//   - PER EMAIL: slows down targeting a specific user's inbox
//   - PER IP: slows down a single attacker varying email addresses
// Either limit triggering is enough to block the request.
//
// We use sliding-window counters with a 15-minute window; that's a
// reasonable tradeoff between blocking abuse and not annoying real
// users who fat-finger their email.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Redis client reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// from process.env automatically (their default).
const redis = Redis.fromEnv();

export const signinEmailLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "15 m"),
  prefix: "rl:signin:email",
  analytics: true, // shows up in Upstash dashboard, helpful for tuning
});

export const signinIpLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "15 m"),
  prefix: "rl:signin:ip",
  analytics: true,
});
