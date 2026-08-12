import { StyleSheet } from '@react-pdf/renderer';

// Matches the app's existing slate/blue/emerald/amber/red system (same hexes
// Tailwind's slate-*/blue-*/emerald-*/amber-*/red-* resolve to), plus one navy
// accent reserved for the cover banner.
export const colors = {
  navy: '#0F1E3D',
  navySoft: '#1E3A6E',
  ink: '#0F172A',
  inkSoft: '#475569',
  inkFaint: '#94A3B8',
  line: '#E2E8F0',
  paper: '#FFFFFF',
  sunken: '#F8FAFC',
  blue: '#2563EB',
  blueSoft: '#EFF6FF',
  emerald: '#059669',
  emeraldSoft: '#ECFDF5',
  amber: '#B45309',
  amberSoft: '#FFFBEB',
  red: '#B91C1C',
  redSoft: '#FEF2F2',
};

export const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  pageFooter: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: colors.inkFaint,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
  },

  h1: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: colors.ink, marginBottom: 4 },
  h2: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: colors.ink, marginBottom: 10 },
  h3: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: colors.ink, marginBottom: 4 },
  eyebrow: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: colors.inkFaint, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  body: { fontSize: 10, color: colors.inkSoft, lineHeight: 1.5 },
  small: { fontSize: 8.5, color: colors.inkFaint },

  card: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 16, backgroundColor: colors.paper },
  sunkenCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 16, backgroundColor: colors.sunken },
  row: { flexDirection: 'row' },
  spaceBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  gap16: { gap: 16 },

  chip: { fontSize: 8, fontFamily: 'Helvetica-Bold', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
});

export function toneColors(tone: 'positive' | 'strong' | 'neutral' | 'warning' | 'critical') {
  switch (tone) {
    case 'positive': return { text: colors.emerald, bg: colors.emeraldSoft, border: '#A7F3D0' };
    case 'strong': return { text: colors.blue, bg: colors.blueSoft, border: '#BFDBFE' };
    case 'warning': return { text: colors.amber, bg: colors.amberSoft, border: '#FDE68A' };
    case 'critical': return { text: colors.red, bg: colors.redSoft, border: '#FECACA' };
    default: return { text: colors.inkSoft, bg: colors.sunken, border: colors.line };
  }
}
