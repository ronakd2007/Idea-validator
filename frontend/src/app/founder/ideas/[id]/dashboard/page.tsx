'use client';
import { useParams } from 'next/navigation';
import IdeaDashboardView from '@/components/idea/IdeaDashboardView';

export default function IdeaDashboardPage() {
  const params = useParams();
  return <IdeaDashboardView ideaId={params.id as string} />;
}
