import type { Gun, AllData, Attachment } from "./data";
import gunAttachments from "./gun_attachments.json";

// ============ 配件兼容性（来自 moligod.com 真实游戏数据）============
// gun_attachments.json: gunId -> { allowedPartIds: [配件objectID...] }
const COMPAT = gunAttachments as Record<
  string,
  { gunId: string; gunName: string; allowedPartIds: string[]; partNames: Record<string, string> }
>;

export function isCompatible(gun: Gun, accId: number): boolean {
  const compat = COMPAT[String(gun.id)];
  if (!compat) return true; // 无数据时默认兼容
  return compat.allowedPartIds.includes(String(accId));
}

// ============ 属性点计算（排除腰射 hipShot 和射程 shotDistancePercent）============
export function calcPoints(stats: any): number {
  let t = 0;
  if (stats?.recoil) t += Math.abs(stats.recoil);
  if (stats?.controlSpeed) t += Math.abs(stats.controlSpeed);
  if (stats?.controlStable) t += Math.abs(stats.controlStable);
  if (stats?.extraBullet) t += Math.abs(stats.extraBullet);
  return t;
}

export function calcPointsDetail(stats: any): { label: string; val: number }[] {
  const out: { label: string; val: number }[] = [];
  if (stats?.recoil) out.push({ label: "后坐力", val: Math.abs(stats.recoil) });
  if (stats?.controlSpeed) out.push({ label: "操控速度", val: Math.abs(stats.controlSpeed) });
  if (stats?.controlStable) out.push({ label: "据枪稳定", val: Math.abs(stats.controlStable) });
  if (stats?.extraBullet) out.push({ label: "弹容", val: Math.abs(stats.extraBullet) });
  return out;
}

// 计算配件射程加成百分比（枪管/枪口的 shotDistancePercent）
export function calcRangePercent(stats: any): number {
  return stats?.shotDistancePercent || 0;
}

// 计算一个方案的最终射程 = 枪械基础射程 × (1 + Σ射程加成%)
export function calcTotalRange(baseRange: number, parts: { acc: Attachment }[]): number {
  const pct = parts.reduce((sum, p) => sum + calcRangePercent(p.acc.stats), 0);
  return Math.round(baseRange * (1 + pct / 100));
}

// ============ 槽位映射 ============
const SLOT_MAP: Record<string, string> = {
  "2": "accMuzzle", "4": "accBarrel", "6": "accScope",
  "10": "accForeGrip", "11": "accBackGrip", "17": "accMagazine",
  "19": "accStock", "20": "accStock", "32": "accFunctional",
  "34": "accHandGuard", "35": "accHandGuard",
};

export const SLOT_NAMES: Record<string, string> = {
  accMuzzle: "枪口", accBarrel: "枪管", accScope: "瞄具",
  accForeGrip: "前握把", accBackGrip: "后握把", accMagazine: "弹匣",
  accStock: "枪托", accFunctional: "功能配件", accHandGuard: "护木",
};

export interface SlotOption {
  slotKey: string;
  slotName: string;
  items: Attachment[];
}

export function getGunSlots(gun: Gun, data: AllData): SlotOption[] {
  const keys = [...new Set(gun.accessorySlots.map((s) => SLOT_MAP[s]).filter(Boolean))];
  return keys.map((k) => ({
    slotKey: k,
    slotName: SLOT_NAMES[k] || k,
    items: data.attachments[k]?.items.filter((a) => isCompatible(gun, a.id)) || [],
  }));
}

// ============ 组合优化（分组背包 DP）============
export interface OptimizedBuild {
  totalPrice: number;
  totalPoints: number;
  valueScore: number;      // 价格/点数，越小越划算
  totalRange: number;      // 最终射程（基础射程×射程加成）
  filledSlots: number;
  selection: Record<string, number>; // slotKey -> accId
  parts: { slotKey: string; acc: Attachment }[];
}

const GRANULARITY = 1000;   // 价格离散粒度：1000 哈夫币
const MAX_PRICE = 400000;   // 最大考虑价格：40w
const NUM_BUCKETS = MAX_PRICE / GRANULARITY; // 400 桶

interface DPState {
  points: number;
  sel: Record<string, number>;
  cost: number;
}

export function optimizeGun(gun: Gun, data: AllData): OptimizedBuild[] {
  const slots = getGunSlots(gun, data);
  if (slots.length === 0) return [];

  // dp[c] = 总价 ≤ c*GRANULARITY 时的最大属性点组合
  const dp: (DPState | null)[] = new Array(NUM_BUCKETS + 1).fill(null);
  dp[0] = { points: 0, sel: {}, cost: 0 };

  for (const slot of slots) {
    // 组内候选：所有兼容配件（含"空槽"：价格0点数0）
    const candidates: { id: number | null; price: number; points: number }[] = [{ id: null, price: 0, points: 0 }];
    for (const acc of slot.items) {
      if (acc.price == null) continue;
      const pts = calcPoints(acc.stats);
      if (pts <= 0) continue; // 无属性点加成的不选
      candidates.push({ id: acc.id, price: Math.round(acc.price / GRANULARITY), points: pts });
    }
    if (candidates.length === 1) continue; // 只有空槽可选

    // 01背包式分组转移（c 从高到低）
    for (let c = NUM_BUCKETS; c >= 0; c--) {
      const prev = dp[c];
      if (!prev) continue;
      for (const cand of candidates) {
        const nc = c + cand.price;
        if (nc > NUM_BUCKETS) continue;
        const np = prev.points + cand.points;
        const target = dp[nc];
        if (!target || np > target.points) {
          const newSel = { ...prev.sel };
          if (cand.id !== null) newSel[slot.slotKey] = cand.id;
          dp[nc] = { points: np, sel: newSel, cost: nc * GRANULARITY };
        }
      }
    }
  }

  // 收集所有非空方案
  const builds: OptimizedBuild[] = [];
  for (const state of dp) {
    if (!state || state.points === 0) continue;
    const parts: { slotKey: string; acc: Attachment }[] = [];
    for (const [sk, accId] of Object.entries(state.sel)) {
      const slot = slots.find((s) => s.slotKey === sk);
      const acc = slot?.items.find((a) => a.id === accId);
      if (acc) parts.push({ slotKey: sk, acc });
    }
    builds.push({
      totalPrice: state.cost,
      totalPoints: state.points,
      valueScore: state.cost / state.points,
      totalRange: calcTotalRange(gun.stats.shootDistance, parts),
      filledSlots: parts.length,
      selection: state.sel,
      parts,
    });
  }

  // 帕累托去重：只保留非支配方案（不存在另一个方案 价格≤ 且 点数≥）
  builds.sort((a, b) => a.totalPrice - b.totalPrice);
  const pareto: OptimizedBuild[] = [];
  let maxPoints = -1;
  for (const b of builds) {
    if (b.totalPoints > maxPoints) {
      pareto.push(b);
      maxPoints = b.totalPoints;
    }
  }

  // 按性价比排序（价格/点数 升序）
  pareto.sort((a, b) => a.valueScore - b.valueScore);
  return pareto;
}

// ============ 射程相关 ============

// 枚举该枪所有可能的射程值（通过枪管/枪口等射程加成配件的组合）
export function getPossibleRanges(gun: Gun, data: AllData): number[] {
  const slots = getGunSlots(gun, data);
  const base = gun.stats.shootDistance;

  // 找出有射程加成的槽位
  const rangeSlots = slots.filter((s) => s.items.some((a) => calcRangePercent(a.stats) > 0));

  // 用 BFS 枚举所有射程加成组合
  const pctSet = new Set<number>([0]);
  for (const slot of rangeSlots) {
    const pcts = [0, ...slot.items.map((a) => calcRangePercent(a.stats)).filter((p) => p > 0)];
    const newSet = new Set<number>();
    for (const cur of pctSet) {
      for (const p of pcts) {
        newSet.add(Math.min(cur + p, 100));
      }
    }
    pctSet.clear();
    for (const v of newSet) pctSet.add(v);
  }

  const ranges = [...pctSet].map((p) => Math.round(base * (1 + p / 100)));
  return [...new Set(ranges)].sort((a, b) => a - b);
}

// 带射程约束的优化：找出射程 ≥ minRange 的所有帕累托方案
export function optimizeForRange(gun: Gun, data: AllData, minRange: number): OptimizedBuild[] {
  const slots = getGunSlots(gun, data);
  if (slots.length === 0) return [];
  const base = gun.stats.shootDistance;
  const needPct = Math.max(0, Math.ceil((minRange / base - 1) * 100)); // 需要的最小总加成%

  const GR = 1000;
  const NB = MAX_PRICE / GR;
  const PCT_MAX = 60;

  // dp[c][p] = 价格 ≤ c、射程加成 = p 时的最大属性点组合
  const dp: (DPState | null)[][] = Array.from({ length: NB + 1 }, () => new Array(PCT_MAX + 1).fill(null));
  dp[0][0] = { points: 0, sel: {}, cost: 0 };

  for (const slot of slots) {
    const candidates: { id: number | null; price: number; points: number; pct: number }[] = [
      { id: null, price: 0, points: 0, pct: 0 },
    ];
    for (const acc of slot.items) {
      if (acc.price == null) continue;
      const pts = calcPoints(acc.stats);
      if (pts <= 0) continue;
      candidates.push({
        id: acc.id,
        price: Math.round(acc.price / GR),
        points: pts,
        pct: Math.round(calcRangePercent(acc.stats)),
      });
    }
    if (candidates.length === 1) continue;

    for (let c = NB; c >= 0; c--) {
      for (let p = PCT_MAX; p >= 0; p--) {
        const prev = dp[c][p];
        if (!prev) continue;
        for (const cand of candidates) {
          const nc = c + cand.price;
          const np = p + cand.pct;
          if (nc > NB || np > PCT_MAX) continue;
          const npts = prev.points + cand.points;
          const target = dp[nc][np];
          if (!target || npts > target.points) {
            const newSel = { ...prev.sel };
            if (cand.id !== null) newSel[slot.slotKey] = cand.id;
            dp[nc][np] = { points: npts, sel: newSel, cost: nc * GR };
          }
        }
      }
    }
  }

  // 收集射程加成 ≥ needPct 的方案
  const builds: OptimizedBuild[] = [];
  for (let c = 0; c <= NB; c++) {
    for (let p = needPct; p <= PCT_MAX; p++) {
      const st = dp[c][p];
      if (!st || st.points === 0) continue;
      const parts: { slotKey: string; acc: Attachment }[] = [];
      for (const [sk, accId] of Object.entries(st.sel)) {
        const slot = slots.find((s) => s.slotKey === sk);
        const acc = slot?.items.find((a) => a.id === accId);
        if (acc) parts.push({ slotKey: sk, acc });
      }
      builds.push({
        totalPrice: st.cost,
        totalPoints: st.points,
        valueScore: st.cost / st.points,
        totalRange: calcTotalRange(base, parts),
        filledSlots: parts.length,
        selection: st.sel,
        parts,
      });
    }
  }

  // 帕累托去重
  builds.sort((a, b) => a.totalPrice - b.totalPrice);
  const pareto: OptimizedBuild[] = [];
  let maxPoints = -1;
  for (const b of builds) {
    if (b.totalPoints > maxPoints) {
      pareto.push(b);
      maxPoints = b.totalPoints;
    }
  }
  pareto.sort((a, b) => a.valueScore - b.valueScore);
  return pareto;
}
