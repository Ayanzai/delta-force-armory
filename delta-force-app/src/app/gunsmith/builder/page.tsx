"use client";

import { useState, useEffect, useMemo } from "react";
import { getData, formatPrice, getGradeColor } from "@/lib/data";
import {
  Crosshair, Fire, Target, Gauge, Speedometer, ShieldCheck, Coin,
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

  const totalPrice = useMemo(
    () => Object.values(selected).reduce((sum, pid) => sum + (priceOf(pid) || 0), 0),
    [selected]
  );

  const filledCount = Object.values(selected).filter(Boolean).length;
  const gradeNum = (g: string) => parseInt(g, 10) || 0;

  return (
    <div className="space-y-5">
      {/* 顶部标题栏 */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">改枪配置器</h1>
          <p className="mt-1 text-sm text-slate-500">在表格中直接选择配件，右侧实时查看属性变化</p>
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
              className={`rounded px-3 py-1.5 text-[13px] transition ${mode === m ? "text-black" : "text-slate-400 hover:text-white"}`}
              style={mode === m ? { background: "var(--accent)" } : {}}
            >
              {m === "warfare" ? "烽火地带" : "全面战场"}
            </button>
          ))}
        </div>
        {!gunFull && <span className="text-xs text-slate-500">数据加载中...</span>}
      </div>

      {gun && gunData ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_1fr]">
          {/* 左：槽位选择表格 */}
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: "var(--surface-2)" }}>
                    <th className="table-head w-[64px]">槽位</th>
                    <th className="table-head">可选配件（点击选择）</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot) => {
                    const selId = selected[slot.id];
                    const selPart = selId ? gunData.parts?.[selId] : null;
                    const candidates = slot.candidateIds
                      .map((id) => gunData.parts?.[id])
                      .filter((p): p is Part => !!p && !p.isVirtual);
                    return (
                      <tr key={slot.id + slot.label} className="row-hover align-top">
                        <td className="table-cell">
                          <div className="text-sm font-medium text-slate-300">{slot.label}</div>
                          {selPart ? (
                            <div className="mt-1 text-xs text-slate-500">{selPart.name}</div>
                          ) : (
                            <div className="mt-1 text-xs text-slate-700">未安装</div>
                          )}
                        </td>
                        <td className="table-cell">
                          <div
                            className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1"
                            style={{ scrollbarWidth: "thin" }}
                          >
                            {candidates.map((part) => {
                              const isSel = selId === part.id;
                              const sum = partSummary(part);
                              const price = priceOf(part.id);
                              const grade = getGradeColor(gradeNum(part.grade));
                              return (
                                <button
                                  key={part.id}
                                  onClick={() => setSelected((prev) => ({ ...prev, [slot.id]: isSel ? "" : part.id }))}
                                  className="flex w-[84px] shrink-0 flex-col items-center rounded-lg px-1.5 pb-1.5 pt-2 text-center transition hover:brightness-110"
                                  style={{
                                    border: `1px solid ${isSel ? "var(--accent)" : "var(--border)"}`,
                                    background: isSel ? "var(--accent-soft)" : "var(--surface-1)",
                                  }}
                                  title={part.name}
                                >
                                  <span className="relative mb-1 flex items-center justify-center rounded-md"
                                    style={{ background: "var(--surface-3)", width: 32, height: 32 }}>
                                    <img
                                      src={part.iconUrl}
                                      alt=""
                                      style={{ width: 24, height: 24, objectFit: "contain", display: "block" }}
                                    />
                                    <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
                                      style={{ background: grade }} />
                                  </span>
                                  <div
                                    style={{ display: "block", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, fontWeight: 500, lineHeight: 1.25, color: "#e2e8f0" }}
                                  >
                                    {part.name}
                                  </div>
                                  {sum.length > 0 ? (
                                    <div
                                      style={{ display: "block", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10, lineHeight: 1.25, color: "var(--green)", marginTop: 2 }}
                                    >
                                      {sum[0]}
                                    </div>
                                  ) : (
                                    <div
                                      style={{ display: "block", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10, lineHeight: 1.25, color: "#4b5563", marginTop: 2 }}
                                    >
                                      无加成
                                    </div>
                                  )}
                                  <div
                                    style={{ display: "block", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10, lineHeight: 1.25, color: "var(--accent)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}
                                  >
                                    {formatPrice(price)}
                                  </div>
                                </button>
                              );
                            })}
                            <button
                              onClick={() => setSelected((prev) => ({ ...prev, [slot.id]: "" }))}
                              className="flex w-[84px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-slate-600 transition hover:text-slate-400"
                              style={{ borderColor: "var(--border-strong)", height: 88 }}
                            >
                              空槽
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {slots.length === 0 && (
                    <tr><td className="table-cell py-10 text-center text-sm text-slate-600" colSpan={2}>该枪械暂无槽位数据</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 右：实时属性面板 */}
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
                            style={{ color: up ? "var(--green)" : "var(--red)", background: up ? "var(--green-soft)" : "var(--red-soft)" }}>
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
    </div>
  );
}
