import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { Metadata } from 'next';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata: Metadata = {
  title: 'KFC File Manager',
  description: 'A secure file management system for KFC',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                fontFamily: "var(--font-primary, 'Inter', 'Segoe UI', sans-serif)",
                fontSize: '13px',
                borderRadius: '4px',
                boxShadow: 'var(--shadow-md)',
              },
            }}
          />
          <SpeedInsights />
        </AuthProvider>
      </body>
    </html>
  );
}
