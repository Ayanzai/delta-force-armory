"use client";

import { useState, useMemo } from "react";
import { getData, formatPrice } from "@/lib/data";
import Link from "next/link";

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

    if (typeFilter) {
      list = list.filter((g) => g.type === typeFilter);
    }
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
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [data, typeFilter, search, sortBy, sortDir]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">枪械列表</h1>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="搜索枪械名称..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm w-64"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm"
        >
          <option value="name">名称</option>
          <option value="price">价格</option>
          <option value="fireSpeed">射速</option>
          <option value="damage">伤害</option>
        </select>
        <button
          onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm hover:bg-slate-700"
        >
          {sortDir === "asc" ? "↑ 升序" : "↓ 降序"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTypeFilter("")}
          className={`px-3 py-1.5 rounded-lg text-sm transition ${
            !typeFilter ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          全部
        </button>
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              typeFilter === t ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3">
        {filtered.map((gun) => (
          <Link
            key={gun.id}
            href={`/guns/${gun.id}`}
            className="bg-slate-800 hover:bg-slate-700 rounded-xl p-4 flex items-center gap-4 transition"
          >
            <img src={gun.pic} alt={gun.name} className="w-14 h-14 object-contain" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-lg">{gun.name}</div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-400 mt-1">
                <span className="bg-slate-700 px-2 py-0.5 rounded">{gun.type}</span>
                <span>伤害 {gun.stats.meatHarm}</span>
                <span>射速 {gun.stats.fireSpeed}</span>
                <span>射程 {gun.stats.shootDistance}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-yellow-400 font-medium">{formatPrice(gun.price)}</div>
              <div className="text-xs text-slate-500">哈夫币</div>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-slate-500 py-12">没有找到匹配的枪械</div>
      )}
    </div>
  );
}
