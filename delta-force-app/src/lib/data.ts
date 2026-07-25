import rawData from './delta_force_data.json';

export interface GunStat {
  meatHarm: number;
  shootDistance: number;
  recoil: number;
  control: number;
  stable: number;
  hipShot: number;
  armorHarm: number;
  fireSpeed: number;
  capacity: number;
  fireMode: string;
  muzzleVelocity: number;
  soundDistance: number;
  caliber: string;
}

export interface Gun {
  id: number;
  name: string;
  type: string;
  typeKey: string;
  grade: number;
  weight: string;
  desc: string;
  pic: string;
  stats: GunStat;
  ammo: number[];
  accessorySlots: string[];
  price: number | null;
  priceCurve: { [key: string]: number | null | undefined };
}

export interface AttachmentStat {
  recoil?: number;
  controlSpeed?: number;
  controlStable?: number;
  hipShot?: number;
  shotDistancePercent?: number;
  quickSeparate?: number;
  extraBullet?: number;
}

export interface Attachment {
  id: number;
  name: string;
  type: string;
  typeKey: string;
  grade: number;
  weight: string;
  pic: string;
  price?: number | null;
  priceCurve?: Record<string, number | null>;
  stats: AttachmentStat;
  effectText: {
    advantage: string[];
    disadvantage: string[];
  };
}

export interface AttachmentCategory {
  name: string;
  items: Attachment[];
}

export interface AllData {
  guns: Gun[];
  attachments: Record<string, AttachmentCategory>;
}

export function getData(): AllData {
  return rawData as AllData;
}

export function getGunByID(id: number): Gun | undefined {
  return rawData.guns.find((g: Gun) => g.id === id);
}

export function getGunByName(name: string): Gun | undefined {
  return rawData.guns.find((g: Gun) => g.name === name);
}

export function getGunTypes(): string[] {
  const types = new Set(rawData.guns.map((g: Gun) => g.type));
  return Array.from(types);
}

export function getGunsByType(type: string): Gun[] {
  return rawData.guns.filter((g: Gun) => g.type === type);
}

export function getAttachmentTypeKeys(): string[] {
  return Object.keys(rawData.attachments);
}

export function formatPrice(price: number | null | undefined): string {
  if (price == null) return '—';
  return price.toLocaleString('zh-CN');
}

export function getGradeColor(grade: number): string {
  const colors = ['', '#94a3b8', '#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444'];
  return colors[grade] || '#94a3b8';
}

export function getGradeLabel(grade: number): string {
  const labels = ['基础', '普通', '高级', '精良', '史诗', '传说', '神话'];
  return labels[grade] || '未知';
}
