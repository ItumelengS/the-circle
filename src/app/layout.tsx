import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Circle — Rotation Society',
  description: 'A stokvel/rotation savings group app for South Africa',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="bg-blobs" />
        <main className="min-h-screen flex flex-col items-center">
          {children}
        </main>
      </body>
    </html>
  );
}
