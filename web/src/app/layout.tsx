import type { Metadata } from "next";
import { Suspense } from "react";

import { Nav } from "@/components/app/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "kumishift | シフト自動作成",
  description: "営業時間と必要人数から、シフト表を自動で作るオープンソースツール",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <Suspense>
          <Nav />
        </Suspense>
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
