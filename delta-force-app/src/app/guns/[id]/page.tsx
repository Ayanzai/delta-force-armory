import { getData } from "@/lib/data";
import GunDetailClient from "./GunDetailClient";

export function generateStaticParams() {
  const data = getData();
  return data.guns.map((gun) => ({
    id: String(gun.id),
  }));
}

export default function GunDetailPage({ params }: { params: { id: string } }) {
  const data = getData();
  const gun = data.guns.find((g) => g.id === Number(params.id));
  
  if (!gun) {
    return <div className="text-center text-slate-500 py-12">未找到该枪械</div>;
  }

  return <GunDetailClient gun={gun} />;
}
