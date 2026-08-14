import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import ViewAsBanner from '@/components/ViewAsBanner';
import BackendWarmup from '@/components/BackendWarmup';
import FeedbackProvider from '@/components/ui/feedback';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'IdeaValidator – Validate Your Business Idea',
  description: 'Get structured feedback from expert validators before you invest.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen`}>
        <div className="relative">
          {/* Wakes the backend + database the moment any page loads, so the
              visitor's first real action doesn't pay the cold-start cost. */}
          <BackendWarmup />
          {/* Renders only while an admin is in View-as-User mode; sits above
              every sticky header (z-60) and cannot be dismissed. */}
          <FeedbackProvider>
            <ViewAsBanner />
            <Navbar />
            <main>{children}</main>
          </FeedbackProvider>
        </div>
      </body>
    </html>
  );
}
