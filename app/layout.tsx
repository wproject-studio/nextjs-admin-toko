// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "@/components/AuthContext";
import { ThemeProvider } from "@/components/theme-provider";
import { Noto_Sans } from "next/font/google";

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Admin Toko",
  description: "Sistem admin sederhana dengan Next.js + AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${notoSans.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
