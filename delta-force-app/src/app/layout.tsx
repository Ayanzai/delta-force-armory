import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Crosshair, Table, ChartBar, ArrowsDownUp, SlidersHorizontal } from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = {
  title: "三角洲军械库 - 枪械配件数据库",
  description: "三角洲行动(Delta Force)全枪械及配件属性、价格、改枪方案查询",
};

const NAV = [
  { href: "/guns", label: "枪械列表", icon: Crosshair },
  { href: "/attachments", label: "配件浏览", icon: Table },
  { href: "/value", label: "性价比", icon: ChartBar },
  { href: "/gunsmith", label: "改枪排行", icon: ArrowsDownUp },
  { href: "/gunsmith/builder", label: "改枪配置器", icon: SlidersHorizontal },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="sticky top-0 z-50 border-b backdrop-blur-md"
          style={{ borderColor: "var(--border)", background: "rgba(11,15,20,0.85)" }}>
          <div className="flex h-14 w-full items-center gap-1 px-4">
            <Link href="/" className="mr-4 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                <Crosshair size={16} weight="bold" />
              </span>
              <span className="text-[15px] font-bold tracking-tight">三角洲军械库</span>
            </Link>
            <nav className="flex items-center gap-0.5">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] text-slate-400 transition hover:bg-white/5 hover:text-white"
                >
                  <item.icon size={14} />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="w-full px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
