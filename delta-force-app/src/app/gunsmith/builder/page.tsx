"use client";

import { useState, useEffect, useMemo } from "react";
import { getData, formatPrice, getGradeColor } from "@/lib/data";
import {
  MagnifyingGlass,
  X,
  Check,
  Plus,
  Crosshair,
  Fire,
  Target,
  Gauge,
  Speedometer,
  ShieldCheck,
  Coin,
} from "@phosphor-icons/react";

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

const ATTR_META: Record<string, { name: string; icon: any; max: number }> = {
  "10001": { name: "有效射程", icon: Target, max: 120 },
  "10005": { name: "后坐力控制", icon: Fire, max: 120 },
  "10006": { name: "操控速度", icon: Speedometer, max: 120 },
  "10007": { name: "稳定性", icon: ShieldCheck, max: 120 },
  "10008": { name: "腰射精准度", icon: Crosshair, max: 120 },
  "base_damage": { name: "基础伤害", icon: Gauge, max: 100 },
};

const ATTR_ORDER = ["base_damage", "10001", "10005", "10006", "10007", "10008"];

interface AttrResult {
  attrId: string;
  name: string;
  base: number;
  delta: number;
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

    for (const partId of Object.values(selected)) {
      const part = gunData.parts?.[partId];
      const mods = part?.modifiersByMode?.[mode] || [];
      for (const m of mods) {
        if (m.attributeId !== attrId) continue;
        if (m.modifierType === "Addend" && m.delta != null) delta += m.delta;
        else if (m.modifierType === "Mult_A" && m.param1 != null) mult *= 1 + m.param1;
      }
    }

    const final = Math.round((base + delta) * mult);
    results.push({ attrId, name: ATTR_META[attrId]?.name || attrId, base, delta, final });
  }

  return results;
}

function extractSlots(gunData: GunData): SlotDef[] {
  const map = new Map<string, SlotDef>();
  for (const slots of Object.values(gunData.slotsByHost || {})) {
    for (const slot of slots) {
      const key = slot.id + ":" + slot.label;
      const existing = map.get(key);
      if (existing) {
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

  useEffect(() => {
    fetch("/data/gunsmith_full.json")
      .then((r) => r.json())
      .then((d) => setGunFull(d))
      .catch((e) => console.error("加载失败:", e));
  }, []);

  const gun = data.guns.find((g) => g.id === selectedGun);
  const gunData = gunFull?.[String(gun?.id || "")];
  const slots = useMemo(() => (gunData ? extractSlots(gunData) : []), [gunData]);
  const attrs = useMemo(() => (gunData ? computeAttrs(gunData, selected, mode) : []), [gunData, selected, mode]);

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

  const priceOf = (partId: string): number | null => {
    const numId = parseInt(partId, 10);
    for (const cat of Object.values(data.attachments)) {
      const acc = cat.items.find((a) => a.id === numId);
      if (acc) return acc.price ?? null;
    }
    return null;
  };

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

  // 总价
  const totalPrice = useMemo(() => {
    return Object.values(selected).reduce((sum, pid) => sum + (priceOf(pid) || 0), 0);
  }, [selected]);

  const filledCount = Object.values(selected).filter(Boolean).length;
  const gradeNum = (g: string) => parseInt(g, 10) || 0;

  return (
    <div className="space-y-5">
      {/* 顶部标题栏 */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">改枪配置器</h1>
          <p className="mt-1 text-sm text-slate-500">选择配件，实时模拟枪械属性变化</p>
        </div>
        <div className="hidden items-center gap-2 text-sm sm:flex">
          <span className="rounded-md px-2.5 py-1" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
            已装 <span className="num font-semibold text-white">{filledCount}</span> 件
          </span>
          <span className="rounded-md px-2.5 py-1" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
            总价 <span className="num font-semibold" style={{ color: "var(--accent)" }}>{formatPrice(totalPrice)}</span>
          </span>
        </div>
      </div>

      {/* 选枪 + 模式 */}
      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <div className="flex flex-1 items-center gap-2">
          <Crosshair size={16} className="text-slate-500" />
          <select
            value={selectedGun}
            onChange={(e) => {
              setSelectedGun(Number(e.target.value));
              setSelected({});
            }}
            className="input flex-1 px-3 py-2 text-sm sm:max-w-xs"
          >
            <option value={0}>选择枪械...</option>
            {data.guns.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1 rounded-md p-0.5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          {(["warfare", "operations"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-3 py-1.5 text-[13px] transition ${
                mode === m ? "text-black" : "text-slate-400 hover:text-white"
              }`}
              style={mode === m ? { background: "var(--accent)" } : {}}
            >
              {m === "warfare" ? "烽火地带" : "全面战场"}
            </button>
          ))}
        </div>
        {!gunFull && <span className="text-xs text-slate-500">数据加载中...</span>}
      </div>

      {gun && gunData ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_1fr]">
          {/* 左栏：槽位选择 */}
          <div className="panel p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">配件槽位</h2>
            <div className="space-y-1.5">
              {slots.map((slot) => {
                const selId = selected[slot.id];
                const selPart = selId ? gunData.parts?.[selId] : null;
                const price = selPart ? priceOf(selPart.id) : null;
                return (
                  <button
                    key={slot.id + slot.label}
                    onClick={() => { setActiveSlot(slot); setSearch(""); }}
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/4"
                    style={{ border: "1px solid var(--border)", background: "var(--surface-1)" }}
                  >
                    <span className="w-14 shrink-0 text-xs font-medium text-slate-500">{slot.label}</span>
                    {selPart ? (
                      <>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                          style={{ background: "var(--surface-3)" }}>
                          <img src={selPart.iconUrl} alt="" className="h-7 w-7 object-contain" />
                        </span>
                        <span className="flex-1 truncate text-sm">{selPart.name}</span>
                        <span className="num shrink-0 text-xs" style={{ color: "var(--accent)" }}>
                          {formatPrice(price)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                          style={{ background: "var(--surface-2)" }}>
                          <Plus size={16} className="text-slate-600" />
                        </span>
                        <span className="flex-1 text-sm text-slate-600">未安装</span>
                        <span className="shrink-0 text-slate-600 opacity-0 transition group-hover:opacity-100">
                          选择
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
              {slots.length === 0 && (
                <div className="py-10 text-center text-sm text-slate-600">该枪械暂无槽位数据</div>
              )}
            </div>
          </div>

          {/* 右栏：属性面板 */}
          <div className="panel p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">枪械属性</h2>
            <div className="space-y-4">
              {attrs.map((a) => {
                const meta = ATTR_META[a.attrId];
                const Icon = meta?.icon || Gauge;
                const pct = Math.min((a.final / (meta?.max || 100)) * 100, 100);
                const up = a.final >= a.base;
                const changed = a.final !== a.base;
                return (
                  <div key={a.attrId}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[13px] text-slate-400">
                        <Icon size={14} className="text-slate-500" />
                        {a.name}
                      </span>
                      <span className="num text-sm">
                        <span className="mr-1.5 text-slate-600">{a.base}</span>
                        <span className="font-bold text-white">{a.final}</span>
                        {changed && (
                          <span className="num ml-2 rounded px-1.5 py-0.5 text-xs font-semibold"
                            style={{
                              color: up ? "var(--green)" : "var(--red)",
                              background: up ? "var(--green-soft)" : "var(--red-soft)",
                            }}>
                            {a.delta > 0 ? "+" : ""}{a.delta}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          background: up ? "linear-gradient(90deg, #10b981, #34d399)" : "linear-gradient(90deg, #ef4444, #f87171)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-center justify-between border-t pt-4 text-xs text-slate-500"
              style={{ borderColor: "var(--border)" }}>
              <span>{mode === "warfare" ? "烽火地带" : "全面战场"}模式</span>
              <span className="flex items-center gap-1">
                <Coin size={13} />
                <span className="num">{formatPrice(totalPrice)}</span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="panel flex flex-col items-center justify-center py-24 text-slate-600">
          <Crosshair size={40} weight="thin" className="mb-3 opacity-40" />
          <p className="text-sm">{gun ? "数据加载中..." : "选择一把枪械开始配置"}</p>
        </div>
      )}

      {/* 配件选择弹窗 */}
      {activeSlot && gunData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setActiveSlot(null)}
        >
          <div
            className="panel flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-sm font-semibold">选择{activeSlot.label}</h3>
              <button onClick={() => setActiveSlot(null)} className="rounded p-1 text-slate-500 transition hover:bg-white/5 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-3">
              <div className="relative">
                <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="搜索配件..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input w-full py-2 pl-9 pr-3 text-sm"
                />
              </div>
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
              <button
                onClick={() => selectPart(activeSlot.id, "")}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-500 transition hover:bg-white/4"
                style={{ border: "1px dashed var(--border-strong)" }}
              >
                <X size={15} />
                不安装（空槽）
              </button>
              {activeCandidates.map((part) => {
                const sum = partSummary(part);
                const price = priceOf(part.id);
                const grade = getGradeColor(gradeNum(part.grade));
                return (
                  <button
                    key={part.id}
                    onClick={() => selectPart(activeSlot.id, part.id)}
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/4"
                    style={{ border: "1px solid var(--border)", background: "var(--surface-1)" }}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                      style={{ background: "var(--surface-3)" }}>
                      <img src={part.iconUrl} alt="" className="h-8 w-8 object-contain" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm">{part.name}</span>
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: grade }} />
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {sum.map((s, i) => (
                          <span key={i} className="rounded px-1 text-[10px] font-medium"
                            style={{ color: "var(--green)", background: "var(--green-soft)" }}>
                            {s}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="num shrink-0 text-xs" style={{ color: "var(--accent)" }}>
                      {formatPrice(price)}
                    </span>
                    <Check size={14} className="shrink-0 text-emerald-400 opacity-0 transition group-hover:opacity-100" />
                  </button>
                );
              })}
              {activeCandidates.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-600">没有匹配的配件</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
