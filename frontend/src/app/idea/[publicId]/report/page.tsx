'use client';
import { useParams } from 'next/navigation';
import IdeaDashboardView from '@/components/idea/IdeaDashboardView';

// Alias of /idea/<publicId>/public — both render the same shared report.
export default function PublicIdeaReportPage() {
  const params = useParams();
  return <IdeaDashboardView publicId={params.publicId as string} />;
}
