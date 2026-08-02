"use client";

import { useState, useEffect, useMemo } from "react";
import { getData, formatPrice, getGradeColor } from "@/lib/data";
import { optimizeAdvanced, getPossibleRanges } from "@/lib/optimizer";
import {
  Crosshair, Fire, Target, Gauge, Speedometer, ShieldCheck, Coin, Sparkle, Check,
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedGun, setSelectedGun] = useState<number>(data.guns[0]?.id || 0);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const mode = "warfare"; // 固定烽火地带模式
  const [planRange, setPlanRange] = useState(0); // 方案射程过滤
  const [planRecoil, setPlanRecoil] = useState(10); // 默认后坐力≥10
  const [planStable, setPlanStable] = useState(0);
  const [planControl, setPlanControl] = useState(0);

  useEffect(() => {
    fetch("/data/gunsmith_full.json")
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((d) => {
        setGunFull(d);
        console.log("gunsmith_full 加载成功:", Object.keys(d).length, "把枪");
      })
      .catch((e) => {
        console.error("加载失败:", e);
        setLoadError(String(e?.message || e));
      });
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
      .map((m) => `${m.name}${(m.delta as number) > 0 ? "+" : ""}${m.delta}`);
  };

  const totalPrice = useMemo(
    () => Object.values(selected).reduce((sum, pid) => sum + (priceOf(pid) || 0), 0),
    [selected]
  );

  const filledCount = Object.values(selected).filter(Boolean).length;
  const gradeNum = (g: string) => parseInt(g, 10) || 0;

  // 可能的射程
  const possibleRanges = useMemo(() => (gun ? getPossibleRanges(gun, data) : []), [gun, data]);

  // 生成改枪方案（带射程+属性过滤）
  const [planError, setPlanError] = useState<string | null>(null);
  const plans = useMemo(() => {
    if (!gun) return [];
    try {
      setPlanError(null);
      const result = optimizeAdvanced(gun, data, {
        minRange: planRange > 0 ? planRange : undefined,
        minRecoil: planRecoil > 0 ? planRecoil : undefined,
        minStable: planStable > 0 ? planStable : undefined,
        minControl: planControl > 0 ? planControl : undefined,
      });
      return result;
    } catch (e: any) {
      setPlanError(String(e?.message || e));
      return [];
    }
  }, [gun, data, planRange, planRecoil, planStable, planControl]);

  // 把 optimizer 方案映射到 builder 槽位并应用
  function applyPlan(build: any) {
    const sel: Record<string, string> = {};
    for (const [slotKey, accId] of Object.entries(build.selection)) {
      const optIds = new Set((data.attachments[slotKey]?.items || []).map((a) => String(a.id)));
      const target = slots.find((s) => s.candidateIds.some((id) => optIds.has(id)));
      if (target) sel[target.id] = String(accId);
    }
    setSelected(sel);
  }

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
        <div className="flex-1" />
        {!gunFull && (
          <span className="text-xs text-slate-500">
            {loadError ? `数据加载失败: ${loadError}` : "数据加载中..."}
          </span>
        )}
      </div>

      {/* 方案过滤 */}
      <div className="panel flex flex-wrap items-center gap-4 p-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Sparkle size={14} /> 生成方案
        </span>
        {possibleRanges.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <Target size={13} />
            射程
            <select value={planRange} onChange={(e) => setPlanRange(Number(e.target.value))}
              className="input px-2 py-1.5 text-sm">
              <option value={0}>全部（基础{gun?.stats.shootDistance}）</option>
              {possibleRanges.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        )}
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          <Fire size={13} />后坐力≥
          <input type="number" value={planRecoil} onChange={(e) => setPlanRecoil(Number(e.target.value))}
            className="input w-14 px-2 py-1.5 text-center text-sm" />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck size={13} />稳定≥
          <input type="number" value={planStable} onChange={(e) => setPlanStable(Number(e.target.value))}
            className="input w-14 px-2 py-1.5 text-center text-sm" />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          <Speedometer size={13} />操控≥
          <input type="number" value={planControl} onChange={(e) => setPlanControl(Number(e.target.value))}
            className="input w-14 px-2 py-1.5 text-center text-sm" />
        </label>
        <span className="text-xs text-slate-600">共 {plans.length} 个方案</span>
      </div>

      {gun && gunData ? (
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          {/* 左列：配置区 */}
          <div className="flex-1 space-y-5">
          {/* 槽位选择表格 */}
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
                    if (candidates.length === 0) return null; // 无可选配件则隐藏该槽位
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
                                  className="flex w-[96px] shrink-0 flex-col items-center rounded-lg px-1.5 pb-1.5 pt-2 text-center transition hover:brightness-110"
                                  style={{
                                    border: `1px solid ${isSel ? "var(--accent)" : "var(--border)"}`,
                                    background: isSel ? "var(--accent-soft)" : "var(--surface-1)",
                                    height: 136,
                                    overflow: "hidden",
                                    boxSizing: "border-box",
                                  }}
                                  title={part.name}
                                >
                                  <span className="relative mb-1 flex items-center justify-center rounded-md"
                                    style={{ background: "var(--surface-3)", width: 36, height: 36, margin: "0 auto 4px auto" }}>
                                    <img
                                      src={part.iconUrl}
                                      alt=""
                                      style={{ width: 28, height: 28, objectFit: "contain", display: "block" }}
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
                                    <div style={{ width: "100%", marginTop: 2, overflow: "hidden", height: 39 }}>
                                      {sum.map((s, si) => (
                                        <div
                                          key={si}
                                          style={{ display: "block", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10, lineHeight: 1.3, color: s.includes("+") ? "var(--red)" : "var(--green)" }}
                                        >
                                          {s}
                                        </div>
                                      ))}
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
                            style={{ color: up ? "var(--red)" : "var(--green)", background: up ? "var(--red-soft)" : "var(--green-soft)" }}>
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
                          background: up ? "linear-gradient(90deg, #ef4444, #f87171)" : "linear-gradient(90deg, #10b981, #34d399)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-center justify-between border-t pt-4 text-xs text-slate-500"
              style={{ borderColor: "var(--border)" }}>
              <span>烽火地带模式</span>
              <span className="flex items-center gap-1">
                <Coin size={13} />
                <span className="num">{formatPrice(totalPrice)}</span>
              </span>
            </div>
          </div>
          </div>{/* 左列结束 */}

          {/* 右列：方案列表 */}
          <div className="panel w-full overflow-hidden lg:w-[340px] lg:shrink-0">
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">改枪方案</h2>
              <span className="text-xs text-slate-600">{plans.length} 个</span>            </div>
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: "var(--surface-2)" }}>
                    <th className="table-head text-center">射程</th>
                    <th className="table-head text-center">总价</th>
                    <th className="table-head text-center">属性点</th>
                    <th className="table-head text-center">性价比</th>
                    <th className="table-head text-center">应用</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.slice(0, 40).map((b, i) => (
                    <tr key={i} className="row-hover">
                      <td className="table-cell num text-center text-sky-400">{b.totalRange}</td>
                      <td className="table-cell num text-center" style={{ color: "var(--accent)" }}>{formatPrice(b.totalPrice)}</td>
                      <td className="table-cell num text-center font-bold" style={{ color: "var(--green)" }}>{b.totalPoints}</td>
                      <td className="table-cell num text-center text-xs text-slate-400">{(b.valueScore || 0).toFixed(0)}</td>
                      <td className="table-cell text-center">
                        <button
                          onClick={() => applyPlan(b)}
                          className="rounded px-2 py-1 text-xs font-medium text-black transition hover:brightness-110"
                          style={{ background: "var(--accent)" }}
                        >
                          应用
                        </button>
                      </td>
                    </tr>
                  ))}
                  {plans.length === 0 && (
                    <tr><td colSpan={5} className="table-cell py-8 text-center text-xs text-slate-600">
                      {planError ? `生成出错: ${planError}` : "没有符合条件的方案，调整过滤条件"}
                    </td></tr>
                  )}
                </tbody>
              </table>
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
