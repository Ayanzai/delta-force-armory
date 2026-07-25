"use client";

import { useState, useMemo } from "react";
import { getData, formatPrice, getGradeColor, getGradeLabel } from "@/lib/data";

export default function AttachmentsPage() {
  const data = getData();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const types = Object.entries(data.attachments);

  // Flatten all attachments
  const allItems = useMemo(() => {
    const items: any[] = [];
    for (const [key, cat] of types) {
      for (const acc of cat.items) {
        items.push({ ...acc, typeKey: key, typeName: cat.name });
      }
    }
    return items;
  }, []);

  const filtered = useMemo(() => {
    let list = [...allItems];
    if (typeFilter) list = list.filter((a) => a.typeKey === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "price") cmp = (a.price ?? 0) - (b.price ?? 0);
      else if (sortBy === "grade") cmp = a.grade - b.grade;
      else if (sortBy === "recoil") cmp = (a.stats?.recoil ?? 0) - (b.stats?.recoil ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [allItems, typeFilter, search, sortBy, sortDir]);

  const statLabel: Record<string, string> = {
    recoil: "后坐力", controlSpeed: "操控速度", controlStable: "据枪稳定",
    hipShot: "腰射精度", shotDistancePercent: "射程%", extraBullet: "额外子弹"
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">配件列表</h1>

      {/* 筛选栏 */}
      <div className="flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="搜索配件..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm w-48" />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm">
          <option value="name">名称</option>
          <option value="price">价格</option>
          <option value="grade">品质</option>
          <option value="recoil">后坐力</option>
        </select>
        <button onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm hover:bg-slate-700">
          {sortDir === "asc" ? "↑ 升序" : "↓ 降序"}
        </button>
      </div>

      {/* 类型标签 */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTypeFilter("")}
          className={`px-3 py-1.5 rounded-lg text-sm ${!typeFilter ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>全部（{allItems.length}）</button>
        {types.map(([key, cat]) => (
          <button key={key} onClick={() => setTypeFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm ${typeFilter === key ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
            {cat.name}（{cat.items.length}）
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
              <th className="text-center p-3">属性加成</th>
              <th className="text-right p-3 pr-4">价格</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((acc) => {
              const stats = acc.stats || {};
              const statParts: string[] = [];
              if (stats.recoil) statParts.push(`后坐力${stats.recoil > 0 ? "+" : ""}${stats.recoil}`);
              if (stats.controlSpeed) statParts.push(`操控${stats.controlSpeed > 0 ? "+" : ""}${stats.controlSpeed}`);
              if (stats.controlStable) statParts.push(`稳定${stats.controlStable > 0 ? "+" : ""}${stats.controlStable}`);
              if (stats.hipShot) statParts.push(`腰射${stats.hipShot > 0 ? "+" : ""}${stats.hipShot}`);
              if (stats.shotDistancePercent) statParts.push(`射程+${stats.shotDistancePercent}%`);
              if (stats.extraBullet) statParts.push(`弹容+${stats.extraBullet}`);

              return (
                <tr key={acc.id} className="border-t border-slate-700 hover:bg-slate-700/50 transition">
                  <td className="p-3 pl-4">
                    <div className="flex items-center gap-3">
                      <img src={acc.pic} alt="" className="w-8 h-8 object-contain" />
                      <span className="font-medium truncate max-w-[200px]">{acc.name}</span>
                    </div>
                  </td>
                  <td className="text-center p-3 text-slate-400 text-xs">{acc.typeName}</td>
                  <td className="text-center p-3">
                    <span className="text-xs px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: getGradeColor(acc.grade) + "33", color: getGradeColor(acc.grade) }}>
                      {getGradeLabel(acc.grade)}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {statParts.length > 0 ? statParts.map((s, i) => {
                        const isPos = s.includes("+");
                        return (
                          <span key={i} className={`text-xs px-1.5 py-0.5 rounded ${isPos ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
                            {s}
                          </span>
                        );
                      }) : <span className="text-xs text-slate-600">—</span>}
                    </div>
                  </td>
                  <td className="text-right p-3 pr-4 font-mono text-yellow-400">
                    {acc.price ? formatPrice(acc.price) : <span className="text-slate-600">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-slate-500 py-12">没有找到匹配的配件</div>
      )}

      <div className="text-xs text-slate-600 text-right">
        共 {filtered.length} 个配件
      </div>
    </div>
  );
}
