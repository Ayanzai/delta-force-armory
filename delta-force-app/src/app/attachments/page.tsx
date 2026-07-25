"use client";

import { useState, useMemo } from "react";
import { getData, formatPrice, getGradeColor, getGradeLabel } from "@/lib/data";

export default function AttachmentsPage() {
  const data = getData();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  const types = Object.entries(data.attachments);

  const filtered = useMemo(() => {
    return types
      .map(([key, cat]) => ({
        key,
        cat,
        items: cat.items.filter((item) => {
          if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
          if (typeFilter && key !== typeFilter) return false;
          return true;
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [types, search, typeFilter]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">配件浏览</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="搜索配件名称..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm w-64"
        />
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTypeFilter("")}
          className={`px-3 py-1.5 rounded-lg text-sm transition ${
            !typeFilter ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          全部
        </button>
        {types.map(([key, cat]) => (
          <button
            key={key}
            onClick={() => setTypeFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              typeFilter === key
                ? "bg-sky-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {cat.name} ({cat.items.length})
          </button>
        ))}
      </div>

      {/* Attachment categories */}
      {filtered.map(({ key, cat, items }) => (
        <section key={key} id={key} className="bg-slate-800/50 rounded-2xl p-5">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            {cat.name}
            <span className="text-sm text-slate-400 font-normal">{items.length} 个</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((acc) => {
              const stats = acc.stats;
              const statParts: string[] = [];
              if (stats.recoil) statParts.push(`后坐力 ${stats.recoil > 0 ? "+" : ""}${stats.recoil}`);
              if (stats.controlSpeed) statParts.push(`操控 ${stats.controlSpeed > 0 ? "+" : ""}${stats.controlSpeed}`);
              if (stats.controlStable) statParts.push(`稳定 ${stats.controlStable > 0 ? "+" : ""}${stats.controlStable}`);
              if (stats.hipShot) statParts.push(`腰射 ${stats.hipShot > 0 ? "+" : ""}${stats.hipShot}`);
              if (stats.shotDistancePercent) statParts.push(`射程 +${stats.shotDistancePercent}%`);

              return (
                <div
                  key={acc.id}
                  className="bg-slate-700/50 rounded-xl p-4 hover:bg-slate-700 transition"
                >
                  <div className="flex items-start gap-3">
                    <img src={acc.pic} alt={acc.name} className="w-10 h-10 object-contain mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{acc.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: getGradeColor(acc.grade) + "33",
                            color: getGradeColor(acc.grade),
                          }}
                        >
                          {getGradeLabel(acc.grade)}
                        </span>
                        <span className="text-xs text-slate-500">{acc.weight}kg</span>
                      </div>

                      {/* Stats */}
                      {statParts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {statParts.map((s, i) => {
                            const isPositive = s.includes("+");
                            return (
                              <span
                                key={i}
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  isPositive
                                    ? "bg-green-900/50 text-green-400"
                                    : "bg-red-900/50 text-red-400"
                                }`}
                              >
                                {s}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Advantage/Disadvantage text */}
                      {acc.effectText.advantage.length > 0 && (
                        <div className="mt-2 text-xs text-green-400 space-y-0.5">
                          {acc.effectText.advantage.map((e, i) => (
                            <div key={i}>+ {e}</div>
                          ))}
                        </div>
                      )}
                      {acc.effectText.disadvantage.length > 0 && (
                        <div className="mt-1 text-xs text-red-400 space-y-0.5">
                          {acc.effectText.disadvantage.map((e, i) => (
                            <div key={i}>- {e}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {filtered.length === 0 && (
        <div className="text-center text-slate-500 py-12">没有找到匹配的配件</div>
      )}
    </div>
  );
}
