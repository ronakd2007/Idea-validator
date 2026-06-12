import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';

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
          <Navbar />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
