"use client";

import { useState, useEffect, useMemo } from "react";
import { getData, formatPrice, getGradeColor, getGradeLabel } from "@/lib/data";

// ============ 类型定义 ============
interface Modifier {
  name: string;
  delta: number | null;
  value: string;
  param1: number | null;
  polarity: string;
  targetPath: string;
  attributeId: string;
  conditionId: string | null;
  modifierType: string;
  conditionName: string | null;
}

interface Part {
  id: string;
  name: string;
  grade: string;
  iconUrl: string;
  isVirtual?: boolean;
  modifiersByMode?: Record<string, Modifier[]>;
}

interface SlotDef {
  id: string;
  name: string;
  type: string;
  label: string;
  candidateIds: string[];
}

interface GunData {
  gunId: string;
  weaponStatsById: Record<string, number>;
  slotsByHost: Record<string, SlotDef[]>;
  parts: Record<string, Part>;
}

interface GunFull {
  [gunId: string]: GunData;
}

const ATTR_MAP: Record<string, string> = {
  "10001": "有效射程",
  "10005": "后坐力控制",
  "10006": "操控速度",
  "10007": "稳定性",
  "10008": "腰射精准度",
  "base_damage": "基础伤害",
};

// 属性基础值排序（用于展示顺序）
const ATTR_ORDER = ["base_damage", "10001", "10005", "10006", "10007", "10008"];

// ============ 计算逻辑 ============
interface AttrResult {
  attrId: string;
  name: string;
  base: number;
  delta: number;
  mult: number;
  final: number;
}

function computeAttrs(gunData: GunData, selected: Record<string, string>, mode: string): AttrResult[] {
  const baseStats = gunData.weaponStatsById || {};
  const results: AttrResult[] = [];

  for (const attrId of ATTR_ORDER) {
    const base = baseStats[attrId];
    if (base === undefined) continue;

    let delta = 0;
    let mult = 1;

    // 遍历已选配件，累加该属性的加成
    for (const partId of Object.values(selected)) {
      const part = gunData.parts?.[partId];
      const mods = part?.modifiersByMode?.[mode] || [];
      for (const m of mods) {
        if (m.attributeId !== attrId) continue;
        if (m.modifierType === "Addend" && m.delta != null) {
          delta += m.delta;
        } else if (m.modifierType === "Mult_A" && m.param1 != null) {
          mult *= 1 + m.param1;
        }
      }
    }

    const final = Math.round((base + delta) * mult);
    results.push({ attrId, name: ATTR_MAP[attrId] || attrId, base, delta, mult, final });
  }

  return results;
}

// 提取所有槽位类型（去重 + 合并候选）
function extractSlots(gunData: GunData): SlotDef[] {
  const map = new Map<string, SlotDef>();
  for (const slots of Object.values(gunData.slotsByHost || {})) {
    for (const slot of slots) {
      const key = slot.id + ":" + slot.label;
      const existing = map.get(key);
      if (existing) {
        // 合并候选（去重）
        const set = new Set([...existing.candidateIds, ...slot.candidateIds]);
        existing.candidateIds = [...set];
      } else {
        map.set(key, { ...slot, candidateIds: [...slot.candidateIds] });
      }
    }
  }
  return [...map.values()];
}

export default function GunsmithBuilderPage() {
  const data = getData();
  const [gunFull, setGunFull] = useState<GunFull | null>(null);
  const [selectedGun, setSelectedGun] = useState<number>(0);
  const [mode, setMode] = useState<"warfare" | "operations">("warfare");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [activeSlot, setActiveSlot] = useState<SlotDef | null>(null);
  const [search, setSearch] = useState("");

  // 加载完整数据
  useEffect(() => {
    fetch("/data/gunsmith_full.json")
      .then((r) => r.json())
      .then((d) => setGunFull(d))
      .catch((e) => console.error("加载失败:", e));
  }, []);

  const gun = data.guns.find((g) => g.id === selectedGun);
  const gunData = gunFull?.[String(gun?.id || "")];

  const slots = useMemo(() => (gunData ? extractSlots(gunData) : []), [gunData]);

  const attrs = useMemo(() => {
    if (!gunData) return [];
    return computeAttrs(gunData, selected, mode);
  }, [gunData, selected, mode]);

  // 当前弹窗的候选配件
  const activeCandidates = useMemo(() => {
    if (!activeSlot || !gunData) return [];
    let list = activeSlot.candidateIds
      .map((id) => gunData.parts?.[id])
      .filter((p): p is Part => !!p && !p.isVirtual);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [activeSlot, gunData, search]);

  // 候选配件价格查找
  const priceOf = (partId: string): number | null => {
    const numId = parseInt(partId, 10);
    for (const cat of Object.values(data.attachments)) {
      const acc = cat.items.find((a) => a.id === numId);
      if (acc) return acc.price ?? null;
    }
    return null;
  };

  // 配件属性摘要
  const partSummary = (part: Part): string[] => {
    const mods = part.modifiersByMode?.[mode] || [];
    return mods
      .filter((m) => !m.conditionId && m.delta != null && m.delta !== 0)
      .slice(0, 3)
      .map((m) => `${m.name}${(m.delta as number) > 0 ? "+" : ""}${m.delta}`);
  };

  function selectPart(slotId: string, partId: string) {
    setSelected((prev) => ({ ...prev, [slotId]: partId }));
    setActiveSlot(null);
    setSearch("");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">改枪配置器</h1>
        <span className="text-xs text-slate-500">复刻 moligod 改枪，实时属性模拟</span>
      </div>

      {/* 选枪 + 模式 */}
      <div className="flex flex-wrap gap-3 items-center bg-slate-800 rounded-xl p-3">
        <select
          value={selectedGun}
          onChange={(e) => {
            setSelectedGun(Number(e.target.value));
            setSelected({});
          }}
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm w-64"
        >
          <option value={0}>-- 请选择枪械 --</option>
          {data.guns.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {(["warfare", "operations"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${
                mode === m ? "bg-sky-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {m === "warfare" ? "烽火地带" : "全面战场"}
            </button>
          ))}
        </div>
        {!gunFull && <span className="text-xs text-slate-500">数据加载中...</span>}
      </div>

      {gun && gunData ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 左栏：配件槽位 */}
          <div className="bg-slate-800 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-slate-400 mb-3">配件槽位（点击选择）</h2>
            <div className="space-y-2">
              {slots.map((slot) => {
                const selId = selected[slot.id];
                const selPart = selId ? gunData.parts?.[selId] : null;
                return (
                  <button
                    key={slot.id + slot.label}
                    onClick={() => { setActiveSlot(slot); setSearch(""); }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-700 bg-slate-700/30 hover:bg-slate-700/60 transition text-left"
                  >
                    <span className="text-xs text-sky-400 w-16 shrink-0">{slot.label}</span>
                    {selPart ? (
                      <>
                        <img src={selPart.iconUrl} alt="" className="w-8 h-8 object-contain" />
                        <span className="text-sm truncate flex-1">{selPart.name}</span>
                        <span className="text-xs text-yellow-400 shrink-0">
                          {formatPrice(priceOf(selPart.id))}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-slate-500 flex-1">未选择（空槽）</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 右栏：实时属性面板 */}
          <div className="bg-slate-800 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-slate-400 mb-3">枪械属性</h2>
            <div className="space-y-3">
              {attrs.map((a) => (
                <div key={a.attrId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">{a.name}</span>
                    <span>
                      <span className="text-slate-500 line-through mr-1">{a.base}</span>
                      <span className="font-bold text-white">{a.final}</span>
                      {a.delta !== 0 && (
                        <span className={`ml-1 text-xs ${a.final >= a.base ? "text-green-400" : "text-red-400"}`}>
                          {a.delta > 0 ? "+" : ""}{a.delta}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        a.final >= a.base ? "bg-green-500" : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min((a.final / (a.base * 2)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700 text-xs text-slate-500">
              模式：{mode === "warfare" ? "烽火地带" : "全面战场"} | 已装 {Object.keys(selected).length} 个配件
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center text-slate-500 py-16">
          {gun ? "数据加载中..." : "请选择一把枪械"}
        </div>
      )}

      {/* 配件选择弹窗 */}
      {activeSlot && gunData && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setActiveSlot(null)}>
          <div
            className="bg-slate-800 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold">选择{activeSlot.label}</h3>
              <button onClick={() => setActiveSlot(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="p-3">
              <input
                type="text"
                placeholder="搜索配件..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="overflow-y-auto p-3 space-y-1.5 flex-1">
              <button
                onClick={() => selectPart(activeSlot.id, "")}
                className="w-full text-left p-2.5 rounded-lg border border-slate-700 bg-slate-700/30 hover:bg-slate-700/60 text-sm text-slate-400 transition"
              >
                不安装（空槽）
              </button>
              {activeCandidates.map((part) => {
                const sum = partSummary(part);
                return (
                  <button
                    key={part.id}
                    onClick={() => selectPart(activeSlot.id, part.id)}
                    className="w-full text-left p-2.5 rounded-lg border border-slate-700 bg-slate-700/30 hover:bg-slate-700/60 transition"
                  >
                    <div className="flex items-center gap-3">
                      <img src={part.iconUrl} alt="" className="w-9 h-9 object-contain shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{part.name}</div>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {sum.map((s, i) => (
                            <span key={i} className="text-[10px] bg-green-900/50 text-green-400 px-1 rounded">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-yellow-400 shrink-0">
                        {formatPrice(priceOf(part.id))}
                      </span>
                    </div>
                  </button>
                );
              })}
              {activeCandidates.length === 0 && (
                <div className="text-center text-slate-500 py-6 text-sm">没有匹配的配件</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
