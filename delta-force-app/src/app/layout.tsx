import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "三角洲行动 - 枪械配件数据库",
  description: "三角洲行动(Delta Force)全枪械及配件属性、价格查询",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
            <Link href="/" className="text-lg font-bold text-sky-400 hover:text-sky-300">
              🎯 三角洲军械库
            </Link>
            <Link href="/guns" className="text-sm text-slate-300 hover:text-white transition">
              枪械列表
            </Link>
            <Link href="/attachments" className="text-sm text-slate-300 hover:text-white transition">
              配件浏览
            </Link>
            <Link href="/value" className="text-sm text-yellow-400 hover:text-yellow-300 transition">
              性价比
            </Link>
            <Link href="/gunsmith" className="text-sm text-green-400 hover:text-green-300 transition">
              改枪方案
            </Link>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
