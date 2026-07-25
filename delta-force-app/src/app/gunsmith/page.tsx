"use client";

import { useState, useMemo } from "react";
import { getData, formatPrice } from "@/lib/data";

// 枪械系列兼容性映射：配件的关键词前缀 → 适用的枪械名称关键词
const GUN_FAMILIES: Record<string, string[]> = {
  // AR系
  "M4": ["M4A1", "K416"],
  "AR": ["M4A1", "K416", "M7"],
  // AK系
  "AK": ["AK-12", "AKM"],
  "AKM": ["AKM"],
  "AKS": ["AK-12"],
  "AK12": ["AK-12"],
  "AK545": ["AK-12"],
  "AK762": ["AKM"],
  // 其他特定枪系
  "M14": ["M14"],
  "SR25": ["SR-25"],
  "SCARH": ["SCAR-H"],
  "G3": ["G3"],
  "MP5": ["MP5"],
  "MP7": ["MP7"],
  "VSS": ["VSS"],
  "ASh": ["ASh-12"],
  "Vector": ["Vector"],
  "R93": ["R93"],
  "UZI": ["UZI"],
  "SVD": ["SVD"],
  "PKM": ["PKM"],
  "M700": ["M700"],
  "S12K": ["S12K"],
  "SG552": ["SG552"],
  "SMG45": ["SMG45"],
  "PSG": ["PSG"],
  "Mini": ["Mini-14"],
  "aug": ["AUG"],
  "野牛": ["野牛"],
  "沙鹰": ["沙鹰"],
  "93R": ["93R"],
  "勇士": ["勇士"],
  "G系": ["G系列"],
};

// 检查配件是否兼容当前枪械
function isCompatible(gunName: string, accName: string): boolean {
  // 只在弹匣、枪管、枪托这三种类型做过滤
  // 通用配件（枪口、瞄具、握把等）全部显示
  for (const [prefix, guns] of Object.entries(GUN_FAMILIES)) {
    if (accName.includes(prefix)) {
      // 配件标注了特定枪系，检查当前枪械是否属于该枪系
      return guns.some((g) => gunName.includes(g));
    }
  }
  // 配件名称中不包含任何特定枪系关键词 → 通用配件，兼容
  return true;
}

const SLOT_MAP: Record<string, string> = {
  "2": "accMuzzle", "4": "accBarrel", "6": "accScope",
  "10": "accForeGrip", "11": "accBackGrip", "17": "accMagazine",
  "19": "accStock", "20": "accStock", "32": "accFunctional",
  "34": "accHandGuard", "35": "accHandGuard",
};


const SLOT_NAMES: Record<string, string> = {
  accMuzzle: "枪口", accBarrel: "枪管", accHandGuard: "护木",
  accForeGrip: "前握把", accBackGrip: "后握把", accMagazine: "弹匣",
  accScope: "瞄具", accStock: "枪托", accFunctional: "功能配件",
};

function calcPoints(stats: any): number {
  let t = 0;
  if (stats?.recoil) t += Math.abs(stats.recoil);
  if (stats?.controlSpeed) t += Math.abs(stats.controlSpeed);
  if (stats?.controlStable) t += Math.abs(stats.controlStable);
  if (stats?.extraBullet) t += Math.abs(stats.extraBullet);
  return t;
}

interface Selection {
  [slotKey: string]: number;
}

interface PriceTier {
  label: string;
  min: number;
  max: number;
}

const PRICE_TIERS: PriceTier[] = [
  { label: "5w以下", min: 0, max: 50000 },
  { label: "5w~10w", min: 50000, max: 100000 },
  { label: "10w~20w", min: 100000, max: 200000 },
  { label: "20w~30w", min: 200000, max: 300000 },
  { label: "30w以上", min: 300000, max: Infinity },
];

export default function GunsmithPage() {
  const data = getData();
  const [selectedGun, setSelectedGun] = useState<number>(0);
  const [selection, setSelection] = useState<Selection>({});

  const gun = data.guns.find((g) => g.id === selectedGun);

  const slots = useMemo(() => {
    if (!gun) return [];
    const keys = [...new Set(gun.accessorySlots.map((s) => SLOT_MAP[s]).filter(Boolean))];
    return [...keys].map((k) => ({
      key: k,
      name: SLOT_NAMES[k] || k,
      items: data.attachments[k]?.items.filter((a) => isCompatible(gun.name, a.name)) || [],
    }));
  }, [gun, data]);

  // 当前方案统计
  const totalPrice = useMemo(() => {
    let t = 0;
    for (const [sk, id] of Object.entries(selection)) {
      const a = data.attachments[sk]?.items.find((x) => x.id === id);
      if (a?.price) t += a.price;
    }
    return t;
  }, [selection, data]);

  const totalPoints = useMemo(() => {
    let t = 0;
    for (const [sk, id] of Object.entries(selection)) {
      const a = data.attachments[sk]?.items.find((x) => x.id === id);
      if (a) t += calcPoints(a.stats);
    }
    return t;
  }, [selection, data]);

  // 推荐方案
  function getRec(tier: PriceTier) {
    const result: Record<string, any> = {};
    for (const slot of slots) {
      const avail = slot.items.filter((a) => {
        const p = a.price ?? 0;
        return p >= tier.min && p < tier.max && a.price != null;
      });
      if (avail.length === 0) {
        const fallback = [...slot.items].filter((a) => a.price != null).sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        if (fallback.length > 0) result[slot.key] = fallback[0];
        continue;
      }
      const sorted = avail
        .map((a) => ({ acc: a, v: (a.price ?? 0) / Math.max(calcPoints(a.stats), 1) }))
        .sort((a, b) => a.v - b.v);
      if (sorted.length > 0) result[slot.key] = sorted[0].acc;
    }
    const cost = Object.values(result).reduce((s, a: any) => s + (a.price ?? 0), 0);
    const pts = Object.values(result).reduce((s, a: any) => s + calcPoints(a.stats), 0);
    return { result, cost, pts };
  }

  const tiers = PRICE_TIERS.map((t) => ({ ...t, rec: getRec(t) }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">改枪方案推荐</h1>

      {/* 选枪 */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-400">枪械：</span>
        <select value={selectedGun} onChange={(e) => { setSelectedGun(Number(e.target.value)); setSelection({}); }}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm w-64">
          <option value={0}>-- 请选择 --</option>
          {data.guns.map((g) => (
            <option key={g.id} value={g.id}>{g.name} ({formatPrice(g.price)})</option>
          ))}
        </select>
      </div>

      {gun && (
        <>
          {/* 配件选择栏 — 每行一个类型，紧凑显示 */}
          <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-medium text-slate-400">点击选择配件</h2>
            {slots.map((slot) => {
              const selId = selection[slot.key];
              const selAcc = slot.items.find((a) => a.id === selId);
              return (
                <div key={slot.key} className="flex items-start gap-2">
                  <span className="text-xs text-sky-400 w-14 shrink-0 mt-2">{slot.name}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {slot.items.map((acc) => {
                      const isSel = selection[slot.key] === acc.id;
                      const pts = calcPoints(acc.stats);
                      const hasPrice = acc.price != null;
                      return (
                        <button key={acc.id} onClick={() => selectAttachment(slot.key, acc.id)}
                          className={`text-xs px-2 py-1 rounded-md border transition ${
                            isSel ? "border-sky-500 bg-sky-900/40 text-white" : "border-slate-700 bg-slate-700/30 text-slate-300 hover:bg-slate-700/60"
                          }`}>
                          <div className="truncate max-w-[110px]">{acc.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {hasPrice ? formatPrice(acc.price) : "—"} {pts > 0 && `·${pts}p`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {selAcc && (
                    <span className="text-xs text-green-400 shrink-0 mt-2 ml-auto">
                      ✓ {selAcc.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 当前方案统计 */}
          <div className="flex gap-6 bg-slate-800 rounded-xl p-4 text-sm">
            <div><span className="text-slate-400">总价：</span><span className="text-yellow-400 font-bold">{formatPrice(totalPrice)}</span></div>
            <div><span className="text-slate-400">属性点：</span><span className="text-green-400 font-bold">{totalPoints}</span></div>
            <div><span className="text-slate-400">性价比：</span><span className="text-sky-400 font-bold">{totalPoints > 0 ? (totalPrice / totalPoints).toFixed(0) : "—"}</span></div>
          </div>

          {/* 各价位推荐对比表格 */}
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800 text-slate-400 text-xs">
                  <th className="text-left p-3 pl-4">方案</th>
                  {slots.map((s) => (
                    <th key={s.key} className="text-center p-3">{s.name}</th>
                  ))}
                  <th className="text-right p-3">总价</th>
                  <th className="text-right p-3 pr-4 text-yellow-400">性价比</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier) => {
                  const rec = tier.rec;
                  const hasAny = Object.keys(rec.result).length > 0;
                  const value = rec.pts > 0 ? (rec.cost / rec.pts).toFixed(0) : "—";

                  return (
                    <tr key={tier.label} className="border-t border-slate-700 hover:bg-slate-700/30 transition">
                      <td className="p-3 pl-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-yellow-400">{tier.label}</span>
                          {hasAny && (
                            <button onClick={() => {
                              const ns: Selection = {};
                              for (const [k, v] of Object.entries(rec.result)) ns[k] = (v as any).id;
                              setSelection(ns);
                            }}
                              className="text-[10px] bg-sky-600 hover:bg-sky-500 text-white px-1.5 py-0.5 rounded">
                              应用
                            </button>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">{gun.name}</div>
                      </td>
                      {slots.map((sk) => {
                        const acc = rec.result[sk.key] as any;
                        return (
                          <td key={sk.key} className="text-center p-2 text-xs">
                            {acc ? (
                              <span className="text-slate-300 truncate block max-w-[80px] mx-auto" title={acc.name}>{acc.name}</span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-right p-3 font-mono text-yellow-400">{hasAny ? formatPrice(rec.cost) : <span className="text-slate-600">—</span>}</td>
                      <td className="text-right p-3 pr-4">
                        {hasAny ? (
                          <span className={`font-mono font-bold ${Number(value) < 10000 ? "text-green-400" : Number(value) < 30000 ? "text-yellow-400" : "text-red-400"}`}>
                            {value}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {tiers.every((t) => Object.keys(t.rec.result).length === 0) && (
            <div className="text-center text-slate-500 py-4 text-xs">
              ⚠️ 配件价格数据不全，暂时无法生成推荐方案
              <br />项目目录运行 <code className="text-sky-400">node scripts/fetch_all_prices.js</code> 采集价格
            </div>
          )}
        </>
      )}
    </div>
  );

  function selectAttachment(slotKey: string, accId: number) {
    setSelection((prev) => ({ ...prev, [slotKey]: accId }));
  }
}
