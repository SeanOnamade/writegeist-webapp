import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeApplier } from '@/components/layout/ThemeApplier'
import { UserProvider } from '@/contexts/UserContext'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { Toaster } from '@/components/ui/toaster'

// Applies the saved theme before hydration to avoid a flash of the wrong theme.
const themeInitScript = `
(function () {
  try {
    var theme = localStorage.getItem('writegeist-theme') || 'system';
    var dark = theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Writegeist - AI-Powered Writing Assistant",
  description: "Manage your books, chapters, and creative projects with AI-powered analysis and real-time collaboration.",
};

// viewportFit cover lets the app extend under the notch/home indicator;
// safe-area utilities (.pt-safe/.pb-safe) pad the chrome back out.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <UserProvider>
          <SettingsProvider>
            <ThemeApplier />
            {children}
            <Toaster />
          </SettingsProvider>
        </UserProvider>
      </body>
    </html>
  );
}
