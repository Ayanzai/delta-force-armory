"use client";

import { useState, useMemo } from "react";
import { getData, formatPrice } from "@/lib/data";
import { optimizeGun, optimizeForRange, getPossibleRanges, getGunSlots, type OptimizedBuild } from "@/lib/optimizer";

export default function GunsmithPage() {
  const data = getData();
  const [selectedGun, setSelectedGun] = useState<number>(0);
  const [rangeFilter, setRangeFilter] = useState(0); // 0 = 全部
  const [showTop, setShowTop] = useState(30);
  const [minPoints, setMinPoints] = useState(0);

  const gun = data.guns.find((g) => g.id === selectedGun);

  // 当前枪械的槽位（用于表头）
  const slots = useMemo(() => (gun ? getGunSlots(gun, data) : []), [gun, data]);

  // 可能的射程值
  const possibleRanges = useMemo(() => (gun ? getPossibleRanges(gun, data) : []), [gun, data]);

  // 性价比排行榜（根据射程过滤）
  const ranking = useMemo(() => {
    if (!gun) return [];
    if (rangeFilter > 0) return optimizeForRange(gun, data, rangeFilter);
    return optimizeGun(gun, data);
  }, [gun, data, rangeFilter]);

  // 过滤 + 截断
  const display = useMemo(() => {
    let list = ranking;
    if (minPoints > 0) list = list.filter((b) => b.totalPoints >= minPoints);
    if (rangeFilter > 0) list = list.filter((b) => b.totalRange === rangeFilter);
    return list.slice(0, showTop);
  }, [ranking, showTop, minPoints, rangeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">配件组合性价比排行</h1>
        <span className="text-xs text-slate-500">性价比 = 总价 ÷ 属性点（越低越划算）</span>
      </div>

      {/* 选枪 + 筛选 */}
      <div className="flex flex-wrap gap-3 items-center bg-slate-800 rounded-xl p-3">
        <select
          value={selectedGun}
          onChange={(e) => {
            setSelectedGun(Number(e.target.value));
            setRangeFilter(0);
          }}
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm w-64"
        >
          <option value={0}>-- 请选择枪械 --</option>
          {data.guns.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({formatPrice(g.price)})
            </option>
          ))}
        </select>
        {possibleRanges.length > 0 && (
          <label className="text-xs text-slate-400 flex items-center gap-1">
            射程
            <select
              value={rangeFilter}
              onChange={(e) => setRangeFilter(Number(e.target.value))}
              className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm"
            >
              <option value={0}>全部（基础{gun?.stats.shootDistance}）</option>
              {possibleRanges.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs text-slate-400 flex items-center gap-1">
          最少属性点
          <input
            type="number"
            value={minPoints}
            onChange={(e) => setMinPoints(Number(e.target.value))}
            className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm w-16 text-center"
          />
        </label>
        <label className="text-xs text-slate-400 flex items-center gap-1">
          显示条数
          <select
            value={showTop}
            onChange={(e) => setShowTop(Number(e.target.value))}
            className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>
        </label>
      </div>

      {gun ? (
        <>
          {/* 性价比排行榜表格 */}
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800 text-slate-400 text-xs">
                  <th className="text-left p-3 pl-4">排名</th>
                  <th className="text-center p-3">总价</th>
                  <th className="text-center p-3">属性点</th>
                  <th className="text-center p-3 text-yellow-400">性价比</th>
                  <th className="text-center p-3 text-sky-400">射程</th>
                  {slots.map((s) => (
                    <th key={s.slotKey} className="text-center p-3">{s.slotName}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.map((build, i) => (
                  <tr
                    key={build.totalPrice + "-" + build.totalPoints + "-" + build.totalRange}
                    className="border-t border-slate-700 hover:bg-slate-700/40 transition"
                  >
                    <td className="p-3 pl-4">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                        i < 3 ? "bg-yellow-600/30 text-yellow-400" : "bg-slate-700 text-slate-300"
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="text-center p-3 font-mono text-yellow-400">{formatPrice(build.totalPrice)}</td>
                    <td className="text-center p-3 font-mono font-bold text-green-400">{build.totalPoints}</td>
                    <td className="text-center p-3">
                      <span className={`font-mono font-bold ${
                        build.valueScore < 1000 ? "text-green-400" :
                        build.valueScore < 3000 ? "text-yellow-400" : "text-red-400"
                      }`}>
                        {build.valueScore.toFixed(0)}
                      </span>
                    </td>
                    <td className="text-center p-3 font-mono text-sky-400">
                      {build.totalRange}
                      {build.totalRange > (gun?.stats.shootDistance || 0) && "↑"}
                    </td>
                    {slots.map((s) => {
                      const part = build.parts.find((p) => p.slotKey === s.slotKey);
                      return (
                        <td key={s.slotKey} className="text-center p-2 text-xs">
                          {part ? (
                            <span className="text-slate-300" title={part.acc.name}>
                              {part.acc.name}
                              <span className="text-slate-500 ml-1">({formatPrice(part.acc.price)})</span>
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {display.length === 0 && (
            <div className="text-center text-slate-500 py-10 text-sm">
              没有符合条件的组合，试试调整射程或"最少属性点"
            </div>
          )}

          <div className="text-xs text-slate-600 flex justify-between">
            <span>
              {gun.name} 共 {ranking.length} 个最优方案（帕累托前沿），当前显示 {display.length} 个
            </span>
            <span>属性点不含腰射/射程 | 性价比 = 总价 ÷ 总属性点 | 射程 = 基础×加成</span>
          </div>
        </>
      ) : (
        <div className="text-center text-slate-500 py-16">
          请选择一把枪械，系统将自动计算所有配件组合的性价比排行
        </div>
      )}
    </div>
  );
}
