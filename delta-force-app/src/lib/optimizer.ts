import type { Gun, AllData, Attachment } from "./data";

// ============ 配件兼容性过滤 ============
// 注意：长前缀在前（SCARH 在 CAR/AR 前，AKM 在 AK 前），避免子串误伤
const GUN_FAMILIES: Record<string, string[]> = {
  "K416A8": ["K416"],
  "K416": ["K416"],
  "SCARH": ["SCAR-H"],
  "SMG45": ["SMG-45"],
  "SR25": ["SR-25"],
  "SG552": ["SG552"],
  "M1014": ["M1014"],
  "AKS-74U": ["AKS-74U"],
  "AKS74U": ["AKS-74U"],
  "AKS": ["AKS-74U"],
  "AKM": ["AKM"],
  "AK12": ["AK-12"],
  "AK545": ["AK-12"],
  "AK762": ["AKM"],
  "M16A4": ["M16A4"],
  "M16": ["M16A4"],
  "M14": ["M14"],
  "M700": ["M700"],
  "M249": ["M249"],
  "M870": ["M870"],
  "MP5": ["MP5"],
  "MP7": ["MP7"],
  "AUG": ["AUG"],
  "AWM": ["AWM"],
  "SKS": ["SKS"],
  "SVD": ["SVD"],
  "SV98": ["SV-98"],
  "VSS": ["VSS"],
  "ASh": ["ASh-12"],
  "Vector": ["Vector"],
  "R93": ["R93"],
  "UZI": ["UZI"],
  "PKM": ["PKM"],
  "S12K": ["S12K"],
  "PSG": ["PSG-1"],
  "Mini": ["Mini-14"],
  "P90": ["P90"],
  "QBZ": ["QBZ95-1"],
  "G3": ["G3"],
  "G18": ["G18"],
  "PTR": ["PTR-32"],
  "M9": ["G17", "G18", "QSZ92G", "93R"],
  "霰弹": ["M1014", "S12K", "M870"],
  "左轮": [".357左轮"],
  "野牛": ["野牛"],
  "沙鹰": ["沙漠之鹰"],
  "勇士": ["勇士"],
  "93R": ["93R"],
  "G系": ["G17", "G18", "QSZ92G", "93R"],
  // 通用前缀（放最后）
  "AR": ["M4A1", "K416", "M7", "M16A4", "CAR-15"],
  "AK": ["AK-12", "AKM", "AKS-74U", "PTR-32"],
  "CAR15": ["CAR-15"],
  "CAR": ["CAR-15"],
};

export function isCompatible(gunName: string, accName: string): boolean {
  for (const [prefix, guns] of Object.entries(GUN_FAMILIES)) {
    if (accName.includes(prefix)) {
      return guns.some((g) => gunName.includes(g));
    }
  }
  return true;
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
    items: data.attachments[k]?.items.filter((a) => isCompatible(gun.name, a.name)) || [],
  }));
}

// ============ 组合优化（分组背包 DP）============
export interface OptimizedBuild {
  totalPrice: number;
  totalPoints: number;
  valueScore: number;      // 价格/点数，越小越划算
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
