'use client';
import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

// Thin wrapper around Google Identity Services' native button. No redirect —
// Google hands back an ID token directly in the browser, which the caller
// posts to the backend (see api.googleLogin / api.googleRegisterFounder).
export default function GoogleSignInButton({ onCredential, text = 'continue_with' }: { onCredential: (idToken: string) => void; text?: 'signin_with' | 'signup_with' | 'continue_with' }) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!scriptReady) return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || !(window as any).google || !buttonRef.current) return;

    (window as any).google.accounts.id.initialize({
      client_id: clientId,
      callback: (response: { credential: string }) => onCredential(response.credential),
    });
    (window as any).google.accounts.id.renderButton(buttonRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      width: 320,
      text,
    });
  }, [scriptReady, onCredential, text]);

  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return null;

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setScriptReady(true)} />
      <div ref={buttonRef} className="flex justify-center" />
    </>
  );
}
