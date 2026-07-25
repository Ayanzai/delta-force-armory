"use client";

import { useState, useMemo } from "react";
import { getData, formatPrice, getGradeColor, getGradeLabel } from "@/lib/data";

// 配件槽位映射
const SLOT_MAP: Record<string, string> = {
  "2": "accMuzzle", "4": "accBarrel", "6": "accScope",
  "10": "accForeGrip", "11": "accBackGrip", "17": "accMagazine",
  "19": "accStock", "20": "accStock", "32": "accFunctional",
  "34": "accHandGuard", "35": "accHandGuard",
};

const SLOT_NAMES: Record<string, string> = {
  accMuzzle: "枪口", accBarrel: "枪管", accScope: "瞄具",
  accForeGrip: "前握把", accBackGrip: "后握把", accMagazine: "弹匣",
  accStock: "枪托", accFunctional: "功能性配件", accHandGuard: "护木",
};

// 计算属性点数（排除 hipShot 和 shotDistancePercent）
function calcPoints(stats: any): number {
  let total = 0;
  if (stats?.recoil) total += Math.abs(stats.recoil);
  if (stats?.controlSpeed) total += Math.abs(stats.controlSpeed);
  if (stats?.controlStable) total += Math.abs(stats.controlStable);
  if (stats?.extraBullet) total += Math.abs(stats.extraBullet);
  return total;
}

interface Selection {
  [slotKey: string]: number; // slotKey -> attachment id
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

  // 当前枪械
  const gun = data.guns.find((g) => g.id === selectedGun);

  // 枪械的配件槽位
  const slots = useMemo(() => {
    if (!gun) return [];
    const keys = [...new Set(gun.accessorySlots.map((s) => SLOT_MAP[s]).filter(Boolean))];
    return keys.map((k) => ({
      key: k,
      name: SLOT_NAMES[k] || k,
      items: data.attachments[k]?.items || [],
    }));
  }, [gun, data]);

  // 当前总价和总属性点
  const totalPrice = useMemo(() => {
    let t = 0;
    for (const [slotKey, accId] of Object.entries(selection)) {
      const cat = data.attachments[slotKey];
      if (!cat) continue;
      const acc = cat.items.find((a) => a.id === accId);
      if (acc?.price) t += acc.price;
    }
    return t;
  }, [selection, data]);

  const totalPoints = useMemo(() => {
    let t = 0;
    for (const [slotKey, accId] of Object.entries(selection)) {
      const cat = data.attachments[slotKey];
      if (!cat) continue;
      const acc = cat.items.find((a) => a.id === accId);
      if (acc) t += calcPoints(acc.stats);
    }
    return t;
  }, [selection, data]);

  // 选择配件
  function selectAttachment(slotKey: string, accId: number) {
    setSelection((prev) => ({ ...prev, [slotKey]: accId }));
  }

  // 自动推荐：按价格区间找最优组合（贪心——每个槽位选性价比最高的）
  function getRecommendation(tier: PriceTier) {
    const result: { slotKey: string; acc: any }[] = [];
    let totalPts = 0;

    for (const slot of slots) {
      // 在该价位内找性价比最高的
      const available = slot.items.filter((a) => {
        const price = a.price ?? 0;
        return price >= tier.min && price < tier.max;
      });

      if (available.length === 0) {
        // 该价位没有，选最便宜的
        const sorted = [...slot.items]
          .filter((a) => a.price != null)
          .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        if (sorted.length > 0) {
          result.push({ slotKey: slot.key, acc: sorted[0] });
          totalPts += calcPoints(sorted[0].stats);
        }
        continue;
      }

      // 按性价比排序（价格/属性点）
      const sorted = available
        .map((a) => ({ acc: a, value: (a.price ?? 0) / Math.max(calcPoints(a.stats), 1) }))
        .sort((a, b) => a.value - b.value);

      if (sorted.length > 0) {
        result.push({ slotKey: slot.key, acc: sorted[0].acc });
        totalPts += calcPoints(sorted[0].acc.stats);
      }
    }

    const totalCost = result.reduce((sum, r) => sum + (r.acc.price ?? 0), 0);
    return { result, totalCost, totalPoints: totalPts };
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">改枪方案推荐器</h1>

      {/* 选择枪械 */}
      <div className="bg-slate-800 rounded-xl p-4">
        <label className="text-sm text-slate-400 mb-2 block">选择枪械</label>
        <select
          value={selectedGun}
          onChange={(e) => {
            setSelectedGun(Number(e.target.value));
            setSelection({});
          }}
          className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-base w-full max-w-md"
        >
          <option value={0}>-- 请选择枪械 --</option>
          {data.guns.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({formatPrice(g.price)})
            </option>
          ))}
        </select>
      </div>

      {gun && (
        <>
          {/* 配件选择区 */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">选择配件</h2>
            {slots.map((slot) => {
              const selectedId = selection[slot.key];
              const selectedAcc = slot.items.find((a) => a.id === selectedId);

              return (
                <div key={slot.key} className="bg-slate-800/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-sky-400">{slot.name}</h3>
                    {selectedAcc && (
                      <span className="text-sm text-slate-400">
                        已选: {selectedAcc.name}
                        {selectedAcc.price != null && ` (${formatPrice(selectedAcc.price)})`}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {slot.items.map((acc) => {
                      const isSelected = selection[slot.key] === acc.id;
                      const pts = calcPoints(acc.stats);
                      const hasPrice = acc.price != null;

                      return (
                        <button
                          key={acc.id}
                          onClick={() => selectAttachment(slot.key, acc.id)}
                          className={`text-left p-3 rounded-xl border transition ${
                            isSelected
                              ? "border-sky-500 bg-sky-900/30"
                              : "border-slate-700 bg-slate-700/30 hover:bg-slate-700/60"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <img src={acc.pic} alt="" className="w-8 h-8 object-contain" />
                            <div>
                              <div className="text-sm font-medium truncate max-w-[140px]">{acc.name}</div>
                              <div className="text-xs text-slate-500">
                                {hasPrice ? formatPrice(acc.price) : "价格待查"}
                                {pts > 0 && ` · ${pts}点`}
                              </div>
                            </div>
                          </div>
                          {pts > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {acc.stats?.recoil ? (
                                <span className="text-xs bg-green-900/50 text-green-400 px-1 rounded">
                                  后坐力{acc.stats.recoil > 0 ? "+" : ""}{acc.stats.recoil}
                                </span>
                              ) : null}
                              {acc.stats?.controlSpeed ? (
                                <span className="text-xs bg-green-900/50 text-green-400 px-1 rounded">
                                  操控{acc.stats.controlSpeed > 0 ? "+" : ""}{acc.stats.controlSpeed}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 当前方案统计 */}
          <div className="bg-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-3">当前方案</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-yellow-400">{formatPrice(totalPrice)}</div>
                <div className="text-xs text-slate-400">总价</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">{totalPoints}</div>
                <div className="text-xs text-slate-400">属性点</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-sky-400">
                  {totalPoints > 0 ? (totalPrice / totalPoints).toFixed(0) : "—"}
                </div>
                <div className="text-xs text-slate-400">性价比(价格/点)</div>
              </div>
            </div>
            {totalPoints > 0 && (
              <div className="mt-2 text-xs text-slate-500 text-center">
                平均每 {totalPrice / totalPoints} 哈夫币获得 1 属性点
              </div>
            )}
          </div>

          {/* 各价格区间推荐方案 */}
          <div className="bg-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">各价位推荐方案</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PRICE_TIERS.map((tier) => {
                const rec = getRecommendation(tier);
                if (rec.result.length === 0) return null;
                return (
                  <div key={tier.label} className="bg-slate-700/50 rounded-xl p-4">
                    <div className="text-sm font-medium text-yellow-400 mb-2">{tier.label}</div>
                    <div className="text-xs text-slate-400 mb-2">
                      总价: {formatPrice(rec.totalCost)} | 属性: {rec.totalPoints}点
                      {rec.totalPoints > 0 && ` | 性价比: ${(rec.totalCost / rec.totalPoints).toFixed(0)}`}
                    </div>
                    <div className="space-y-1">
                      {rec.result.map((r) => (
                        <div key={r.slotKey} className="flex justify-between text-xs">
                          <span className="text-slate-400">{SLOT_NAMES[r.slotKey] || r.slotKey}</span>
                          <span className="text-slate-300">
                            {r.acc.name} ({formatPrice(r.acc.price)})
                          </span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        const newSel: Selection = {};
                        rec.result.forEach((r) => {
                          newSel[r.slotKey] = r.acc.id;
                        });
                        setSelection(newSel);
                      }}
                      className="mt-3 w-full text-xs bg-sky-600 hover:bg-sky-500 text-white py-1.5 rounded-lg transition"
                    >
                      应用此方案
                    </button>
                  </div>
                );
              })}
            </div>
            {PRICE_TIERS.every((t) => !getRecommendation(t).result.length) && (
              <div className="text-center text-slate-500 py-6 text-sm">
                暂无推荐方案，请等待配件价格数据采集完成后刷新
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
