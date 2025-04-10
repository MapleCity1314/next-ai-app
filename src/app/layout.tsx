import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeHydration } from "@/components/theme-hydration";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI 助手",
  description: "基于Next.js和AI SDK构建的聊天应用",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <ThemeHydration>
            {children}
          </ThemeHydration>
        </ThemeProvider>
      </body>
    </html>
  );
}
