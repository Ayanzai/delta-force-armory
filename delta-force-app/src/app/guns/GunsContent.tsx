"use client";

import { useState, useMemo } from "react";
import { getData, formatPrice, getGradeColor, getGradeLabel } from "@/lib/data";

export default function GunsContent() {
  const data = getData();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const types = useMemo(() => {
    const t = new Set(data.guns.map((g) => g.type));
    return Array.from(t);
  }, [data]);

  const filtered = useMemo(() => {
    let list = [...data.guns];
    if (typeFilter) list = list.filter((g) => g.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((g) => g.name.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "price") cmp = (a.price ?? 0) - (b.price ?? 0);
      else if (sortBy === "fireSpeed") cmp = a.stats.fireSpeed - b.stats.fireSpeed;
      else if (sortBy === "damage") cmp = a.stats.meatHarm - b.stats.meatHarm;
      else if (sortBy === "recoil") cmp = a.stats.recoil - b.stats.recoil;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [data, typeFilter, search, sortBy, sortDir]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">枪械列表</h1>

      {/* 筛选栏 */}
      <div className="flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="搜索枪械..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm w-48" />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm">
          <option value="name">名称</option>
          <option value="price">价格</option>
          <option value="fireSpeed">射速</option>
          <option value="damage">伤害</option>
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
          className={`px-3 py-1.5 rounded-lg text-sm ${!typeFilter ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>全部</button>
        {types.map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm ${typeFilter === t ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>{t}</button>
        ))}
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-slate-400 uppercase text-xs">
              <th className="text-left p-3 pl-4">枪械</th>
              <th className="text-center p-3">类型</th>
              <th className="text-center p-3">伤害</th>
              <th className="text-center p-3">射速</th>
              <th className="text-center p-3">射程</th>
              <th className="text-center p-3">后坐力</th>
              <th className="text-center p-3">操控</th>
              <th className="text-center p-3">弹匣</th>
              <th className="text-right p-3 pr-4">价格</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((gun) => (
              <tr key={gun.id} onClick={() => window.location.href = `/guns/${gun.id}`}
                className="border-t border-slate-700 hover:bg-slate-700/50 cursor-pointer transition">
                <td className="p-3 pl-4">
                  <div className="flex items-center gap-3">
                    <img src={gun.pic} alt="" className="w-8 h-8 object-contain" />
                    <span className="font-medium truncate max-w-[180px]">{gun.name}</span>
                  </div>
                </td>
                <td className="text-center p-3">
                  <span className="bg-slate-700 px-2 py-0.5 rounded text-xs">{gun.type}</span>
                </td>
                <td className="text-center p-3 font-mono">{gun.stats.meatHarm}</td>
                <td className="text-center p-3 font-mono">{gun.stats.fireSpeed}</td>
                <td className="text-center p-3 font-mono">{gun.stats.shootDistance}</td>
                <td className="text-center p-3 font-mono">{gun.stats.recoil}</td>
                <td className="text-center p-3 font-mono">{gun.stats.control}</td>
                <td className="text-center p-3 font-mono">{gun.stats.capacity}</td>
                <td className="text-right p-3 pr-4 font-mono text-yellow-400">
                  {formatPrice(gun.price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-slate-500 py-12">没有找到匹配的枪械</div>
      )}

      <div className="text-xs text-slate-600 text-right">
        共 {filtered.length} 把枪械
      </div>
    </div>
  );
}
