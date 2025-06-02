import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Multi-Agent RAG System",
  description: "Intelligent web scraping and retrieval augmented generation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <header className="border-b">
          <div className="container flex h-14 items-center">
            <div className="flex items-center space-x-4 font-medium">
              <Link 
                href="/" 
                className="hover:text-primary transition-colors"
              >
                Home
              </Link>
              <Link 
                href="/scraper" 
                className="hover:text-primary transition-colors"
              >
                Web Scraper
              </Link>
              <Link 
                href="/search" 
                className="hover:text-primary transition-colors"
              >
                Search
              </Link>
            </div>
          </div>
        </header>
        <main className="flex-1">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
