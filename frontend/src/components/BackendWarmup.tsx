'use client';
import { useEffect } from 'react';

/**
 * Fire-and-forget wake-up call to the backend the moment ANY page loads.
 *
 * The free-tier backend spins down when idle and takes tens of seconds to
 * cold-start; the database suspends too. By pinging the cheapest endpoint as
 * soon as a visitor lands (usually the static landing page or login screen,
 * both served instantly by the CDN), the backend is warming while they read /
 * type — so their first real action doesn't eat the cold start.
 *
 * Once per tab session; the result is irrelevant, only the wake-up matters.
 */
export default function BackendWarmup() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('iv_warmed')) return;
      sessionStorage.setItem('iv_warmed', '1');
    } catch {
      // storage unavailable (private mode edge cases) — ping anyway
    }
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    fetch(`${base}/payment/config`, { cache: 'no-store' }).catch(() => {});
  }, []);

  return null;
}
