import FounderShell from '@/components/founder/FounderShell';

// Route-level shell: every /founder/* page renders inside the sidebar layout.
// Pages keep their own max-w containers; the shell only owns navigation.
export default function FounderLayout({ children }: { children: React.ReactNode }) {
  return <FounderShell>{children}</FounderShell>;
}
