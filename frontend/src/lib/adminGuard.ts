'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser } from './auth';

/**
 * Client-side admin gate, matching what the existing admin pages already do
 * inline. This is a navigation convenience only — it is NOT the security
 * boundary. Every admin endpoint enforces the ADMIN role server-side, so a
 * non-admin who reaches these pages still gets nothing back from the API.
 *
 * Returns false until the check has run, so a page never renders admin chrome
 * for a split second before redirecting.
 */
export function useAdminGuard() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'ADMIN') {
      router.push('/auth/login');
      return;
    }
    setAllowed(true);
  }, []);

  return allowed;
}
