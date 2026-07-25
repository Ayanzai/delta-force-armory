import Link from "next/link";
import { getData, getGunTypes, formatPrice } from "@/lib/data";

export default function Home() {
  const data = getData();
  const types = getGunTypes();
  
  const totalGuns = data.guns.length;
  const totalAttachments = Object.values(data.attachments).reduce(
    (sum, cat) => sum + cat.items.length, 0
  );

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center py-12">
        <h1 className="text-4xl font-bold mb-4">
          三角洲行动 <span className="text-sky-400">军械库</span>
        </h1>
        <p className="text-slate-400 text-lg">
          全面查询所有枪械与配件属性、价格数据
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-sky-400">{totalGuns}</div>
          <div className="text-slate-400 mt-1">种枪械</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-green-400">{totalAttachments}</div>
          <div className="text-slate-400 mt-1">种配件</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-purple-400">{Object.keys(data.attachments).length}</div>
          <div className="text-slate-400 mt-1">种配件类型</div>
        </div>
      </div>

      {/* Gun Types */}
      <section>
        <h2 className="text-xl font-semibold mb-4">枪械分类</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {types.map((type) => {
            const count = data.guns.filter((g) => g.type === type).length;
            return (
              <Link
                key={type}
                href={`/guns?type=${encodeURIComponent(type)}`}
                className="bg-slate-800 hover:bg-slate-700 rounded-xl p-4 transition text-center"
              >
                <div className="font-medium">{type}</div>
                <div className="text-sm text-slate-400">{count} 把</div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Attachment Types */}
      <section>
        <h2 className="text-xl font-semibold mb-4">配件分类</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(data.attachments).map(([key, cat]) => (
            <Link
              key={key}
              href={`/attachments#${key}`}
              className="bg-slate-800 hover:bg-slate-700 rounded-xl p-4 transition text-center"
            >
              <div className="font-medium">{cat.name}</div>
              <div className="text-sm text-slate-400">{cat.items.length} 个</div>
            </Link>
          ))}
        </div>
      </section>

      {/* New Guns Quick List */}
      <section>
        <h2 className="text-xl font-semibold mb-4">热门枪械</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.guns.slice(0, 12).map((gun) => (
            <Link
              key={gun.id}
              href={`/guns/${gun.id}`}
              className="bg-slate-800 hover:bg-slate-700 rounded-xl p-4 flex items-center gap-4 transition"
            >
              <img
                src={gun.pic}
                alt={gun.name}
                className="w-12 h-12 object-contain"
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{gun.name}</div>
                <div className="text-xs text-slate-400">{gun.type}</div>
              </div>
              <div className="text-right text-sm">
                <div className="text-yellow-400">{formatPrice(gun.price)}</div>
                <div className="text-xs text-slate-500">哈夫币</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
