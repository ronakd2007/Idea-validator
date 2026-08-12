import { pdf } from '@react-pdf/renderer';
import ValidationReportDocument from '@/components/report/ValidationReportDocument';
import { sanitizeIdeaTitle } from '@/lib/reportStatus';

interface DownloadReportArgs {
  idea: any;
  aggregated: any;
  aiSummary: string;
  marketResponseLabel: { label: string; tone: 'positive' | 'strong' | 'neutral' | 'warning' | 'critical' } | null;
  surveyAnalytics: any;
}

// Renders the same data already loaded on the idea dashboard into a PDF and
// triggers a browser download — no new fetches, no server round trip.
export async function downloadValidationReport({ idea, aggregated, aiSummary, marketResponseLabel, surveyAnalytics }: DownloadReportArgs) {
  const doc = (
    <ValidationReportDocument
      idea={idea}
      aggregated={aggregated}
      aiSummary={aiSummary}
      marketResponseLabel={marketResponseLabel}
      surveyResponseCount={surveyAnalytics?.summary?.totalResponses || 0}
      generatedAt={new Date()}
    />
  );

  const blob = await pdf(doc).toBlob();
  const safeTitle = sanitizeIdeaTitle(idea?.title).replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
  const filename = `${safeTitle || 'Idea'}_Validation_Report.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
