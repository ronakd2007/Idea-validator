'use client';
import dynamic from 'next/dynamic';

const IdeaValidatorLanding = dynamic(() => import('@/components/landing/IdeaValidatorLanding'), {
  ssr: false,
});

export default function HomePage() {
  return <IdeaValidatorLanding />;
}
