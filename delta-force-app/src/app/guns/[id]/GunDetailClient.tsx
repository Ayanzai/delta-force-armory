"use client";

import Link from "next/link";
import { getData, formatPrice, type Gun } from "@/lib/data";

interface Props {
  gun: Gun;
}

export default function GunDetailClient({ gun }: Props) {
  const data = getData();

  const slotMap: Record<string, string> = {
    "2": "accMuzzle",
    "4": "accBarrel",
    "6": "accScope",
    "10": "accForeGrip",
    "11": "accBackGrip",
    "17": "accMagazine",
    "19": "accStock",
    "20": "accStock",
    "32": "accFunctional",
    "34": "accHandGuard",
    "35": "accHandGuard",
  };

  const compatibleAttachments = gun.accessorySlots
    .map((slot) => slotMap[slot])
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .map((key) => data.attachments[key])
    .filter(Boolean);

  const statRows = [
    { label: "对肉体伤害", value: gun.stats.meatHarm, max: 80 },
    { label: "对护甲伤害", value: gun.stats.armorHarm, max: 80 },
    { label: "射速 (RPM)", value: gun.stats.fireSpeed, max: 1200 },
    { label: "有效射程", value: gun.stats.shootDistance, max: 100 },
    { label: "后坐力控制", value: gun.stats.recoil, max: 100 },
    { label: "操控速度", value: gun.stats.control, max: 100 },
    { label: "据枪稳定性", value: gun.stats.stable, max: 100 },
    { label: "腰际射击精度", value: gun.stats.hipShot, max: 100 },
    { label: "弹匣容量", value: gun.stats.capacity, max: 150 },
    { label: "枪口初速", value: gun.stats.muzzleVelocity, max: 1000 },
    { label: "声音传播距离", value: gun.stats.soundDistance, max: 600 },
  ];

  return (
    <div className="space-y-6">
      <Link href="/guns" className="text-sm text-sky-400 hover:text-sky-300">
        ← 返回枪械列表
      </Link>

      <div className="bg-slate-800 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-start">
        <img src={gun.pic} alt={gun.name} className="w-28 h-28 object-contain" />
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{gun.name}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="bg-slate-700 px-3 py-1 rounded-lg text-sm">{gun.type}</span>
            <span className="bg-slate-700 px-3 py-1 rounded-lg text-sm">重量 {gun.weight}kg</span>
            <span className="bg-slate-700 px-3 py-1 rounded-lg text-sm">射击模式 {gun.stats.fireMode}</span>
            <span className="bg-slate-700 px-3 py-1 rounded-lg text-sm">口径 {gun.stats.caliber}</span>
          </div>
          {gun.price && (
            <div className="mt-3 text-lg">
              <span className="text-yellow-400 font-bold">{formatPrice(gun.price)}</span>
              <span className="text-slate-400 text-sm ml-1">哈夫币</span>
            </div>
          )}
          {gun.desc && <p className="text-slate-400 mt-2 text-sm">{gun.desc}</p>}
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-4">基础属性</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {statRows.map((row) => (
            <div key={row.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">{row.label}</span>
                <span className="font-medium">{row.value}</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full transition-all"
                  style={{ width: `${Math.min((row.value / row.max) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-4">可用配件</h2>
        {compatibleAttachments.length === 0 ? (
          <p className="text-slate-500">暂无配件数据</p>
        ) : (
          <div className="space-y-4">
            {compatibleAttachments.map((cat) =>
              cat ? (
                <div key={cat.name}>
                  <h3 className="text-sm font-medium text-sky-400 mb-2">{cat.name}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {cat.items.slice(0, 6).map((acc) => (
                      <Link
                        key={acc.id}
                        href={`/attachments#${acc.typeKey}`}
                        className="bg-slate-700/50 hover:bg-slate-700 rounded-lg p-3 flex items-center gap-2 transition"
                      >
                        <img src={acc.pic} alt={acc.name} className="w-8 h-8 object-contain" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm truncate">{acc.name}</div>
                          <div className="text-xs text-slate-400">{formatPrice(0)}</div>
                        </div>
                      </Link>
                    ))}
                    {cat.items.length > 6 && (
                      <Link
                        href={`/attachments#${cat.name}`}
                        className="bg-slate-700/50 hover:bg-slate-700 rounded-lg p-3 flex items-center justify-center text-sm text-slate-400 transition"
                      >
                        +{cat.items.length - 6} 更多
                      </Link>
                    )}
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}
      </div>
    </div>
  );
}
