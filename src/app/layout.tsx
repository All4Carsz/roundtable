import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { CircleDot, KeyRound } from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "השולחן העגול | Round Table POC",
  description:
    "POC למערכת Multi-Brain עם Control Plane, Evidence, ו-Round Table לפיתוח תוכנה",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300">
                <CircleDot className="h-4 w-4" />
              </span>
              <span>
                השולחן העגול
                <span className="mr-2 text-xs font-medium text-zinc-500">POC</span>
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <div className="hidden text-xs text-zinc-500 sm:block">
                LLM Proposes · System Decides · Evidence over Consensus
              </div>
              <Link href="/settings" className="btn btn-secondary !py-2 !text-xs">
                <KeyRound className="h-3.5 w-3.5" />
                API Keys
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
