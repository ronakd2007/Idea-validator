import { Document, Page, View, Text } from '@react-pdf/renderer';
import { colors, styles, toneColors } from './reportStyles';
import RadarChartPdf from './RadarChartPdf';
import {
  MATRIX_CATEGORIES, RISK_LABELS, RISK_LABEL, breakdownStatus, dominantRisk, riskTone,
  resolveStrongestWeakest, sanitizeIdeaTitle, validationStage, type Tone, type MatrixCategory,
} from '@/lib/reportStatus';
import { parseAiSummary, firstSentences } from '@/lib/parseAiSummary';

interface ReportData {
  idea: any;
  aggregated: any;
  aiSummary: string;
  marketResponseLabel: { label: string; tone: Tone } | null;
  surveyResponseCount: number;
  generatedAt: Date;
}

// ---------- small shared pieces ----------

function Footer({ ideaTitle }: { ideaTitle: string }) {
  return (
    <View style={styles.pageFooter} fixed>
      <Text>{ideaTitle} — Idea Validation Report</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

function StatBlock({ value, unit, label, tone }: { value: string; unit?: string; label: string; tone: Tone }) {
  const c = toneColors(tone);
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, borderRadius: 8, padding: 12, alignItems: 'center' }}>
      <Text style={{ fontSize: 24, fontFamily: 'Helvetica-Bold', color: c.text }}>
        {value}{unit ? <Text style={{ fontSize: 10, color: c.text }}>{unit}</Text> : null}
      </Text>
      <Text style={{ fontSize: 8, color: colors.inkSoft, marginTop: 3 }}>{label}</Text>
    </View>
  );
}

function Dot({ tone }: { tone: Tone }) {
  return <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: toneColors(tone).text }} />;
}

function successStatus(score: number): { label: string; tone: Tone } {
  if (score >= 90) return { label: 'Very High Potential', tone: 'positive' };
  if (score >= 80) return { label: 'High Potential', tone: 'positive' };
  if (score >= 70) return { label: 'Good Potential', tone: 'strong' };
  if (score >= 60) return { label: 'Moderate Potential', tone: 'warning' };
  return { label: 'High Risk', tone: 'critical' };
}

function sharkStatusOf(score: number): { label: string; tone: Tone } {
  if (score >= 80) return { label: 'Excellent', tone: 'positive' };
  if (score >= 60) return { label: 'Good', tone: 'strong' };
  if (score >= 40) return { label: 'Fair', tone: 'warning' };
  return { label: 'Weak', tone: 'critical' };
}

function getMatrix(aggregated: any): MatrixCategory[] {
  return MATRIX_CATEGORIES
    .map((c) => ({ ...c, score: aggregated[c.key] || 0, pct: ((aggregated[c.key] || 0) / 50) * 100 }))
    .filter((c) => c.score > 0);
}

// `hasEnoughData` and `tied` are independent: a category can be uniquely
// strongest while the weakest spot is still a multi-way tie (or vice versa) —
// checking a single shared "tied" flag for both directions was the bug.
function strengthSentence(strongest: MatrixCategory | null, hasEnoughData: boolean): string {
  if (strongest) return `${strongest.label} — ${strongest.pct.toFixed(0)}% of max, the strongest area across validator scoring.`;
  if (hasEnoughData) return 'No single standout strength — multiple categories are tied for the top score.';
  return 'Not enough scored categories yet to identify a strength.';
}

function joinNatural(items: string[], conjunction: string): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
}

// The Key Risk on page 1 comes from the actual Risk Assessment (Competition,
// Regulatory, Technology, Funding, Market Adoption) — not from whichever
// 8-category validation score happens to be lowest, which isn't really "risk"
// data at all.
function keyRiskInfo(riskSummary: any): { text: string; tone: Tone } {
  if (!riskSummary || Object.keys(riskSummary).length === 0) {
    return { text: 'Not enough risk assessment data yet.', tone: 'neutral' };
  }
  const entries = Object.entries(riskSummary).map(([key, counts]: [string, any]) => ({ key, level: dominantRisk(counts) }));
  const high = entries.filter((e) => e.level === 'HIGH');
  const medium = entries.filter((e) => e.level === 'MEDIUM');
  const flagged = high.length ? high : medium;
  if (!flagged.length) {
    return { text: 'No elevated risk categories — all rated low risk.', tone: 'positive' };
  }
  const levelLabel = high.length ? 'High Risk' : 'Medium Risk';
  const names = joinNatural(flagged.map((e) => RISK_LABELS[e.key] || e.key), '&');
  return { text: `${names} — ${levelLabel}`, tone: high.length ? 'critical' : 'warning' };
}

// 3-4 sentences, one flowing paragraph — deliberately not split into labeled
// sub-sections, which is what made the earlier version run long.
function buildShortSummary({ idea, aggregated, marketResponseLabel, heroStatus }: any): string {
  const a = aggregated;
  const title = sanitizeIdeaTitle(idea?.title);
  if (!(a.totalValidations > 0)) {
    return `${title} has not yet received expert validation. This report will populate once validators score this idea.`;
  }
  const sentences: string[] = [];
  sentences.push(`${title} has received ${a.totalValidations} expert validation${a.totalValidations !== 1 ? 's' : ''}, with an overall score of ${(a.overallScore || 0).toFixed(0)}/100 (${heroStatus.label}).`);
  sentences.push(marketResponseLabel
    ? `Customer survey response has been ${marketResponseLabel.label.toLowerCase()}.`
    : 'No customer survey data has been collected yet.');
  if (a.totalValidations < 3) {
    sentences.push('With a small validator count, this reflects early-stage evidence rather than a statistically representative assessment.');
  }
  sentences.push('Further validation is recommended before treating this score as conclusive.');
  return sentences.join(' ');
}

function isMeaningfulFeedback(fb: any): boolean {
  const combined = `${fb.strength || ''}${fb.weakness || ''}${fb.improvement || ''}`.replace(/\s+/g, '');
  return combined.length > 20;
}

// ---------- Page 1 — Investor Snapshot ----------

function SnapshotPage({ idea, aggregated, marketResponseLabel, surveyResponseCount, generatedAt }: ReportData) {
  const a = aggregated;
  const title = sanitizeIdeaTitle(idea?.title);
  const founderName = idea?.founder?.name;
  const overall = a.overallScore != null ? Number(a.overallScore) : 0;
  const shark = a.sharkTankAvg != null ? Number(a.sharkTankAvg) : 0;
  const validation = a.startupSuccessAvg != null ? Number(a.startupSuccessAvg) : 0;
  const heroStatus = successStatus(overall);
  const sharkStatus = sharkStatusOf(shark);
  const validationStatus = successStatus(validation);
  const hasValidations = (a.totalValidations || 0) > 0;

  const matrix = getMatrix(a);
  const { strongest } = resolveStrongestWeakest(matrix);
  const hasEnoughData = matrix.length >= 2;
  const keyRisk = keyRiskInfo(a.riskSummary);

  return (
    <Page size="A4" style={styles.page}>
      <View style={{ flexDirection: 'row', height: 60, marginHorizontal: -40, marginTop: -40, marginBottom: 18, backgroundColor: colors.navy, paddingHorizontal: 40, alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', letterSpacing: 0.5 }}>IdeaValidator</Text>
          <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', marginTop: 2 }}>Investor Validation Brief</Text>
        </View>
        <Text style={{ fontSize: 8, color: '#B9C4DC', textAlign: 'right' }}>
          {founderName ? `Founder: ${founderName}\n` : ''}Report Date: {generatedAt.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: colors.ink }}>{title}</Text>
        {hasValidations && (
          <Text style={[styles.chip, { color: toneColors(heroStatus.tone).text, backgroundColor: toneColors(heroStatus.tone).bg }]}>
            {heroStatus.label}
          </Text>
        )}
      </View>

      {hasValidations ? (
        <>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <StatBlock value={overall.toFixed(0)} unit="/100" label="Overall Score" tone={heroStatus.tone} />
            <StatBlock value={shark.toFixed(0)} unit="/100" label="Investor Attractiveness Score" tone={sharkStatus.tone} />
            <StatBlock value={validation.toFixed(0)} unit="/100" label="Validation Score" tone={validationStatus.tone} />
          </View>

          <View style={[styles.card, { flexDirection: 'row', marginBottom: 14, paddingVertical: 10 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, color: colors.inkFaint, marginBottom: 2 }}>Expert Validators</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: colors.ink }}>{a.totalValidations}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: colors.line, marginHorizontal: 16 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, color: colors.inkFaint, marginBottom: 2 }}>Customer Survey Responses</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: colors.ink }}>{surveyResponseCount ?? 0}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 20, marginBottom: 14 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: toneColors('positive').text, width: 56 }}>Strength</Text>
                <Text style={[styles.body, { flex: 1, fontSize: 9 }]}>{strengthSentence(strongest, hasEnoughData)}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: toneColors(keyRisk.tone).text, width: 56 }}>Key Risk</Text>
                <Text style={[styles.body, { flex: 1, fontSize: 9 }]}>{keyRisk.text}</Text>
              </View>
            </View>
            {matrix.length >= 3 && (
              <View style={{ width: 130, alignItems: 'center', justifyContent: 'center' }}>
                <RadarChartPdf data={matrix.map((c) => ({ label: c.short, value: c.pct }))} size={125} showLegend={false} />
              </View>
            )}
          </View>

          <Text style={styles.eyebrow}>Executive Summary</Text>
          <Text style={styles.body}>{buildShortSummary({ idea, aggregated: a, marketResponseLabel, heroStatus })}</Text>
        </>
      ) : (
        <View style={styles.sunkenCard}>
          <Text style={styles.body}>No expert validations received yet. This report will fill in as validators score this idea.</Text>
        </View>
      )}

      <Footer ideaTitle={title} />
    </Page>
  );
}

// ---------- Page 2 — Evidence & Next Steps (extends naturally to page 3 if content overflows) ----------

function EvidencePage({ idea, aggregated, marketResponseLabel, surveyResponseCount, aiSummary }: ReportData) {
  const a = aggregated;
  const title = sanitizeIdeaTitle(idea?.title);
  const matrix = getMatrix(a);
  const risks = a.riskSummary ? (Object.entries(a.riskSummary) as [string, any][]) : [];
  const { weakest } = resolveStrongestWeakest(matrix);
  const feedbacks = ((a.openFeedbacks || []) as any[]).filter(isMeaningfulFeedback);

  // AI analysis is contextual synthesis, not validation evidence — it never
  // appears in either list.
  const available: string[] = [`${a.totalValidations} expert validator${a.totalValidations !== 1 ? 's' : ''}`];
  if (marketResponseLabel) available.push('customer survey data');

  const needsMoreValidators = (a.totalValidations || 0) < 3;
  const needsSurvey = !marketResponseLabel;
  const missingParts: string[] = [];
  if (needsSurvey) missingParts.push('customer/market survey data');
  if (needsMoreValidators) missingParts.push('additional expert validation');
  const missingText = missingParts.length === 0
    ? 'None identified.'
    : missingParts.length === 1
      ? `${missingParts[0][0].toUpperCase()}${missingParts[0].slice(1)}.`
      : `${missingParts[0][0].toUpperCase()}${missingParts[0].slice(1)} and ${missingParts[1]}.`;

  let milestone: string;
  if (needsMoreValidators && needsSurvey) milestone = 'Collect additional expert reviews and launch a customer survey to strengthen market validation.';
  else if (needsMoreValidators) milestone = 'Collect additional expert reviews to strengthen confidence in these scores.';
  else if (needsSurvey) milestone = 'Launch a customer survey to validate market demand beyond expert opinion.';
  else if (weakest) milestone = `Gather more evidence on ${weakest.label}, the weakest-rated area, before further fundraising conversations.`;
  else milestone = 'Continue gathering customer and market evidence to build on current results.';

  const aiRows = aiSummary ? (() => {
    const sections = parseAiSummary(aiSummary);
    const byHeading = (h: string) => sections.find((s) => s.heading === h)?.body || '';
    return [
      { label: 'Verdict', text: firstSentences(byHeading('VERDICT'), 1) },
      { label: 'Key Strength', text: firstSentences(byHeading("WHAT'S WORKING"), 1) },
      { label: 'Key Concern', text: firstSentences(byHeading('WHAT NEEDS WORK'), 1) },
      { label: 'Recommended Action', text: firstSentences(byHeading('NEXT STEPS'), 1) },
    ].filter((r) => r.text);
  })() : [];

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.h1}>Evidence & Next Steps</Text>

      {matrix.length > 0 && (
        <View style={{ marginBottom: 14 }}>
          <Text style={styles.h3}>Expert Validation — {a.totalValidations} validator{a.totalValidations !== 1 ? 's' : ''}</Text>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 3, marginBottom: 3 }}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: colors.inkFaint, flex: 1 }}>CATEGORY</Text>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: colors.inkFaint, width: 50, textAlign: 'right' }}>SCORE</Text>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: colors.inkFaint, width: 34, textAlign: 'right' }}>%</Text>
          </View>
          {matrix.map((c) => {
            const st = breakdownStatus(c.pct);
            return (
              <View key={c.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 2.5, borderBottomWidth: 1, borderBottomColor: colors.sunken }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
                  <Dot tone={st.tone} />
                  <Text style={{ fontSize: 8.5, color: colors.ink }}>{c.label}</Text>
                </View>
                <Text style={{ fontSize: 8.5, color: colors.inkSoft, width: 50, textAlign: 'right' }}>{c.score.toFixed(1)}/50</Text>
                <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: colors.ink, width: 34, textAlign: 'right' }}>{c.pct.toFixed(0)}%</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={{ marginBottom: 14 }}>
        <Text style={styles.h3}>Customer Validation</Text>
        {marketResponseLabel ? (
          <Text style={styles.body}>Market response: <Text style={{ fontFamily: 'Helvetica-Bold', color: toneColors(marketResponseLabel.tone).text }}>{marketResponseLabel.label}</Text> — based on {surveyResponseCount} survey response{surveyResponseCount !== 1 ? 's' : ''}.</Text>
        ) : (
          <Text style={styles.small}>Customer validation not available yet — no survey responses collected.</Text>
        )}
      </View>

      {risks.length > 0 && (
        <View style={{ marginBottom: 14 }}>
          <Text style={styles.h3}>Risk Assessment</Text>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 3, marginBottom: 3 }}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: colors.inkFaint, flex: 1 }}>CATEGORY</Text>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: colors.inkFaint, width: 90, textAlign: 'right' }}>RISK LEVEL</Text>
          </View>
          {risks.map(([risk, counts]) => {
            const level = dominantRisk(counts);
            const c = toneColors(riskTone(level));
            return (
              <View key={risk} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 2.5, borderBottomWidth: 1, borderBottomColor: colors.sunken }}>
                <Text style={{ fontSize: 8.5, color: colors.ink, flex: 1 }}>{RISK_LABELS[risk] || risk}</Text>
                <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: c.text, width: 90, textAlign: 'right' }}>{RISK_LABEL[level]}</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={{ marginBottom: (feedbacks.length || aiRows.length) ? 14 : 0 }}>
        <Text style={styles.h3}>Investor Takeaway</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <View style={{ width: '48%', gap: 2 }}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: colors.inkFaint, textTransform: 'uppercase' }}>Current Position</Text>
            <Text style={[styles.body, { fontSize: 9 }]}>{validationStage(a.totalValidations || 0)}</Text>
          </View>
          <View style={{ width: '48%', gap: 2 }}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: toneColors('positive').text, textTransform: 'uppercase' }}>Evidence Available</Text>
            <Text style={[styles.body, { fontSize: 9 }]}>{available.join(', ')}.</Text>
          </View>
          <View style={{ width: '48%', gap: 2 }}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: toneColors('warning').text, textTransform: 'uppercase' }}>Evidence Missing</Text>
            <Text style={[styles.body, { fontSize: 9 }]}>{missingText}</Text>
          </View>
          <View style={{ width: '48%', gap: 2 }}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: colors.blue, textTransform: 'uppercase' }}>Next Milestone</Text>
            <Text style={[styles.body, { fontSize: 9 }]}>{milestone}</Text>
          </View>
        </View>
      </View>

      {feedbacks.length > 0 && (
        <View style={{ marginBottom: aiRows.length ? 14 : 0 }}>
          <Text style={styles.h3}>Validator Feedback</Text>
          <View style={{ gap: 6 }}>
            {feedbacks.map((fb: any, i: number) => (
              <View key={i}>
                <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: colors.ink }}>{fb.validatorName || `Validator ${i + 1}`}{fb.validatorOccupation ? ` — ${fb.validatorOccupation}` : ''}</Text>
                {fb.strength && <Text style={[styles.small, { color: colors.inkSoft }]}>“{fb.strength}”</Text>}
              </View>
            ))}
          </View>
        </View>
      )}

      {aiRows.length > 0 && (
        <View>
          <Text style={styles.h3}>AI Analysis</Text>
          <View style={{ gap: 5 }}>
            {aiRows.map((r) => (
              <View key={r.label} style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: colors.blue, width: 100 }}>{r.label}</Text>
                <Text style={[styles.body, { flex: 1, fontSize: 9 }]}>{r.text}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <Text style={[styles.small, { marginTop: 14 }]}>Based on validation evidence available at the time of this report. This report is not an investment recommendation.</Text>

      <Footer ideaTitle={title} />
    </Page>
  );
}

// ---------- document ----------
// Exactly 2 logical <Page> components, always. A 3rd physical page only
// appears if page 2's own content (many validators' feedback, a long AI
// summary, many risk categories) genuinely overflows the page — react-pdf's
// native pagination handles that continuation; nothing here forces a 3rd page.

export default function ValidationReportDocument(data: ReportData) {
  const a = data.aggregated || {};
  const hasValidations = (a.totalValidations || 0) > 0;

  return (
    <Document title={`${sanitizeIdeaTitle(data.idea?.title)} — Validation Report`}>
      <SnapshotPage {...data} />
      {hasValidations && <EvidencePage {...data} />}
    </Document>
  );
}
