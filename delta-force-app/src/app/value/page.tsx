"use client";

import { useState, useMemo } from "react";
import { getData, formatPrice, getGradeColor, getGradeLabel } from "@/lib/data";
import { isCompatible } from "@/lib/optimizer";

interface ValueItem {
  name: string;
  type: string;
  pic: string;
  grade: number;
  price: number | null;
  statPoints: number;
  statDetail: string[];
  valueScore: number | null; // 价格/属性点，越小越划算
}

export default function ValuePage() {
  const data = getData();

  const [typeFilter, setTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState("valueScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [minPoints, setMinPoints] = useState(1);
  const [selectedGun, setSelectedGun] = useState(0); // 0 = 全部枪械

  const gun = data.guns.find((g) => g.id === selectedGun);

  // 计算所有配件的性价比
  const items = useMemo(() => {
    const result: ValueItem[] = [];

    for (const [tk, cat] of Object.entries(data.attachments)) {
      for (const acc of cat.items) {
        // 枪械过滤：仅显示该枪能装的配件
        if (gun && !isCompatible(gun, acc.id)) continue;
        const s = acc.stats || {};

        // 计算属性点数（排除 hipShot 和 shotDistancePercent）
        const stats: { key: string; label: string; val: number }[] = [];
        if (s.recoil) stats.push({ key: "recoil", label: "后坐力", val: s.recoil });
        if (s.controlSpeed) stats.push({ key: "controlSpeed", label: "操控速度", val: s.controlSpeed });
        if (s.controlStable) stats.push({ key: "controlStable", label: "据枪稳定", val: s.controlStable });
        if (s.extraBullet) stats.push({ key: "extraBullet", label: "额外弹容", val: s.extraBullet });

        const totalPoints = stats.reduce((sum, st) => sum + st.val, 0);

        result.push({
          name: acc.name,
          type: cat.name,
          pic: acc.pic,
          grade: acc.grade,
          price: acc.price ?? null,
          statPoints: totalPoints,
          statDetail: stats.map((st) => `${st.label}+${st.val}`),
          valueScore: acc.price && totalPoints >= minPoints ? acc.price / totalPoints : null,
        });
      }
    }

    return result;
  }, [data, minPoints, gun]);

  const filtered = useMemo(() => {
    let list = [...items];
    if (typeFilter) list = list.filter((i) => i.type === typeFilter);
    // 只显示有价格且有属性点的
    list = list.filter((i) => i.price !== null && i.statPoints >= minPoints);

    list.sort((a, b) => {
      const aVal = a.valueScore ?? 999999;
      const bVal = b.valueScore ?? 999999;
      let cmp = 0;
      if (sortBy === "valueScore") cmp = aVal - bVal;
      else if (sortBy === "price") cmp = (a.price ?? 0) - (b.price ?? 0);
      else if (sortBy === "statPoints") cmp = a.statPoints - b.statPoints;
      else if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [items, typeFilter, sortBy, sortDir, minPoints]);

  const types = useMemo(() => {
    const t = new Set(items.filter((i) => i.price !== null).map((i) => i.type));
    return Array.from(t);
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">配件性价比分析</h1>
        <span className="text-xs text-slate-500">价格 ÷ 属性点数（值越低越划算）</span>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={selectedGun} onChange={(e) => setSelectedGun(Number(e.target.value))}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm">
          <option value={0}>全部枪械</option>
          {data.guns.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm">
          <option value="valueScore">性价比</option>
          <option value="price">价格</option>
          <option value="statPoints">属性点总数</option>
          <option value="name">名称</option>
        </select>
        <button onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm hover:bg-slate-700">
          {sortDir === "asc" ? "↑ 升序" : "↓ 降序"}
        </button>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">最少属性点：</span>
          <input type="number" value={minPoints} onChange={(e) => setMinPoints(Number(e.target.value))}
            className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-sm w-16 text-center" />
        </div>
      </div>

      {/* 类型标签 */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTypeFilter("")}
          className={`px-3 py-1.5 rounded-lg text-sm ${!typeFilter ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
          全部（{filtered.length}）
        </button>
        {types.map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm ${typeFilter === t ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-slate-400 uppercase text-xs">
              <th className="text-left p-3 pl-4">配件</th>
              <th className="text-center p-3">类型</th>
              <th className="text-center p-3">品质</th>
              <th className="text-center p-3">属性点数</th>
              <th className="text-center p-3">属性详情</th>
              <th className="text-right p-3">价格</th>
              <th className="text-right p-3 pr-4">
                <span className="text-yellow-400">性价比</span>
                <span className="text-slate-600 ml-1 font-normal">(价格/点)</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, idx) => (
              <tr key={item.name + item.type}
                className="border-t border-slate-700 hover:bg-slate-700/50 transition">
                <td className="p-3 pl-4">
                  <div className="flex items-center gap-3">
                    <img src={item.pic} alt="" className="w-8 h-8 object-contain" />
                    <span className="font-medium truncate max-w-[180px]">{item.name}</span>
                  </div>
                </td>
                <td className="text-center p-3 text-xs text-slate-400">{item.type}</td>
                <td className="text-center p-3">
                  <span className="text-xs px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: getGradeColor(item.grade) + "33", color: getGradeColor(item.grade) }}>
                    {getGradeLabel(item.grade)}
                  </span>
                </td>
                <td className="text-center p-3 font-mono font-bold text-lg">{item.statPoints}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {item.statDetail.map((d, i) => (
                      <span key={i} className="text-xs bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded">
                        {d}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="text-right p-3 font-mono text-yellow-400">{formatPrice(item.price)}</td>
                <td className="text-right p-3 pr-4">
                  {item.valueScore !== null ? (
                    <span className="font-mono font-bold text-lg"
                      style={{ color: item.valueScore < 10000 ? "#22c55e" : item.valueScore < 30000 ? "#f59e0b" : "#ef4444" }}>
                      {item.valueScore.toFixed(0)}
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-slate-500 py-12">
          没有匹配的数据。
          <br />价格数据正在后台采集中，请稍后刷新。
        </div>
      )}

      <div className="text-xs text-slate-600 flex justify-between">
        <span>共 {filtered.length} 个配件</span>
        <span>属性点数不含腰射精度和射程 | 性价比 = 价格 ÷ 属性点数</span>
      </div>
    </div>
  );
}
