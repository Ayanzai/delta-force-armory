"use client";

import { useState, useMemo } from "react";
import { getData, formatPrice } from "@/lib/data";
import {
  optimizeGun, optimizeForRange, optimizeAdvanced, getPossibleRanges, getGunSlots,
} from "@/lib/optimizer";
import { FunnelSimple, MagnifyingGlass, Trophy, Target } from "@phosphor-icons/react";

export default function GunsmithPage() {
  const data = getData();
  const [selectedGun, setSelectedGun] = useState<number>(0);
  const [rangeFilter, setRangeFilter] = useState(0);
  const [minRecoil, setMinRecoil] = useState(0);
  const [minStable, setMinStable] = useState(0);
  const [minControl, setMinControl] = useState(0);
  const [showTop, setShowTop] = useState(30);
  const [minPoints, setMinPoints] = useState(0);

  const gun = data.guns.find((g) => g.id === selectedGun);
  const slots = useMemo(() => (gun ? getGunSlots(gun, data) : []), [gun, data]);
  const possibleRanges = useMemo(() => (gun ? getPossibleRanges(gun, data) : []), [gun, data]);
  const hasConstraints = minRecoil > 0 || minStable > 0 || minControl > 0;

  const ranking = useMemo(() => {
    if (!gun) return [];
    if (hasConstraints) {
      return optimizeAdvanced(gun, data, {
        minRange: rangeFilter > 0 ? rangeFilter : undefined,
        minRecoil: minRecoil > 0 ? minRecoil : undefined,
        minStable: minStable > 0 ? minStable : undefined,
        minControl: minControl > 0 ? minControl : undefined,
      });
    }
    if (rangeFilter > 0) return optimizeForRange(gun, data, rangeFilter);
    return optimizeGun(gun, data);
  }, [gun, data, rangeFilter, minRecoil, minStable, minControl, hasConstraints]);

  const display = useMemo(() => {
    let list = ranking;
    if (minPoints > 0) list = list.filter((b) => b.totalPoints >= minPoints);
    if (rangeFilter > 0 && !hasConstraints) list = list.filter((b) => b.totalRange === rangeFilter);
    return list.slice(0, showTop);
  }, [ranking, showTop, minPoints, rangeFilter, hasConstraints]);

  const valueColor = (v: number) =>
    v < 1000 ? "var(--green)" : v < 3000 ? "var(--accent)" : "var(--red)";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">配件组合性价比排行</h1>
        <p className="mt-1 text-sm text-slate-500">性价比 = 总价 ÷ 属性点，值越低越划算</p>
      </div>

      {/* 筛选栏 */}
      <div className="panel flex flex-wrap items-center gap-4 p-3">
        <div className="flex flex-1 items-center gap-2">
          <MagnifyingGlass size={15} className="text-slate-500" />
          <select
            value={selectedGun}
            onChange={(e) => { setSelectedGun(Number(e.target.value)); setRangeFilter(0); }}
            className="input flex-1 px-3 py-2 text-sm sm:max-w-xs"
          >
            <option value={0}>选择枪械...</option>
            {data.guns.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        {possibleRanges.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <Target size={13} />
            射程
            <select value={rangeFilter} onChange={(e) => setRangeFilter(Number(e.target.value))}
              className="input px-2 py-1.5 text-sm">
              <option value={0}>全部（基础{gun?.stats.shootDistance}）</option>
              {possibleRanges.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        )}

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <FunnelSimple size={13} />
          <input type="number" value={minRecoil} onChange={(e) => setMinRecoil(Number(e.target.value))}
            className="input w-14 px-2 py-1.5 text-center text-sm" placeholder="后坐力" />
          <input type="number" value={minStable} onChange={(e) => setMinStable(Number(e.target.value))}
            className="input w-14 px-2 py-1.5 text-center text-sm" placeholder="稳定" />
          <input type="number" value={minControl} onChange={(e) => setMinControl(Number(e.target.value))}
            className="input w-14 px-2 py-1.5 text-center text-sm" placeholder="操控" />
        </div>

        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          显示
          <select value={showTop} onChange={(e) => setShowTop(Number(e.target.value))}
            className="input px-2 py-1.5 text-sm">
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>
        </label>
      </div>

      {gun ? (
        <>
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: "var(--surface-2)" }}>
                    <th className="table-head">排名</th>
                    <th className="table-head text-center">总价</th>
                    <th className="table-head text-center">属性点</th>
                    <th className="table-head text-center">性价比</th>
                    <th className="table-head text-center">射程</th>
                    <th className="table-head text-center">后坐/稳定/操控</th>
                    {slots.map((s) => (
                      <th key={s.slotKey} className="table-head text-center">{s.slotName}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {display.map((build, i) => (
                    <tr key={build.totalPrice + "-" + build.totalPoints + "-" + build.totalRange}
                      className="row-hover">
                      <td className="table-cell">
                        <span className="num inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold"
                          style={i < 3
                            ? { background: "var(--accent-soft)", color: "var(--accent)" }
                            : { background: "var(--surface-3)", color: "var(--text-dim)" }}>
                          {i < 3 ? <Trophy size={13} weight="fill" /> : i + 1}
                        </span>
                      </td>
                      <td className="table-cell num text-center font-medium" style={{ color: "var(--accent)" }}>
                        {formatPrice(build.totalPrice)}
                      </td>
                      <td className="table-cell num text-center font-bold" style={{ color: "var(--green)" }}>
                        {build.totalPoints}
                      </td>
                      <td className="table-cell num text-center font-bold" style={{ color: valueColor(build.valueScore) }}>
                        {build.valueScore.toFixed(0)}
                      </td>
                      <td className="table-cell num text-center text-sky-400">
                        {build.totalRange}
                        {build.totalRange > (gun?.stats.shootDistance || 0) && "↑"}
                      </td>
                      <td className="table-cell num text-center text-xs text-slate-500">
                        {(() => {
                          let r = 0, s = 0, ct = 0;
                          for (const p of build.parts) {
                            r += Math.abs(p.acc.stats?.recoil || 0);
                            s += Math.abs(p.acc.stats?.controlStable || 0);
                            ct += Math.abs(p.acc.stats?.controlSpeed || 0);
                          }
                          return (
                            <span>
                              <span style={minRecoil > 0 && r >= minRecoil ? { color: "var(--green)" } : {}}>{r}</span>
                              {" / "}
                              <span style={minStable > 0 && s >= minStable ? { color: "var(--green)" } : {}}>{s}</span>
                              {" / "}
                              <span style={minControl > 0 && ct >= minControl ? { color: "var(--green)" } : {}}>{ct}</span>
                            </span>
                          );
                        })()}
                      </td>
                      {slots.map((s) => {
                        const part = build.parts.find((p) => p.slotKey === s.slotKey);
                        return (
                          <td key={s.slotKey} className="table-cell text-center text-xs">
                            {part ? (
                              <span className="text-slate-400">
                                {part.acc.name}
                                <span className="num ml-1 text-slate-600">{formatPrice(part.acc.price)}</span>
                              </span>
                            ) : (
                              <span className="text-slate-700">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {display.length === 0 && (
            <div className="panel py-12 text-center text-sm text-slate-600">
              没有符合条件的组合，试试放宽筛选条件
            </div>
          )}

          <div className="flex justify-between text-xs text-slate-600">
            <span>{gun.name} · {ranking.length} 个最优方案，当前显示 {display.length} 个</span>
            <span>属性点不含腰射/射程 · 射程 = 基础 × 加成</span>
          </div>
        </>
      ) : (
        <div className="panel flex flex-col items-center justify-center py-24 text-slate-600">
          <Trophy size={40} weight="thin" className="mb-3 opacity-40" />
          <p className="text-sm">选择一把枪械，自动计算所有配件组合的性价比排行</p>
        </div>
      )}
    </div>
  );
}
