'use client';
import { useParams } from 'next/navigation';
import IdeaDashboardView from '@/components/idea/IdeaDashboardView';

/**
 * The shared-idea link. Renders the founder's own dashboard component, so a
 * viewer sees exactly the page the founder sees — owner-only actions removed
 * and reviewer contact details never sent by the server.
 */
export default function PublicIdeaPage() {
  const params = useParams();
  return <IdeaDashboardView publicId={params.publicId as string} />;
}
