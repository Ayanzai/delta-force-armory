import { Suspense } from "react";
import GunsContent from "./GunsContent";

export default function GunsPage() {
  return (
    <Suspense fallback={<div className="text-center text-slate-500 py-12">加载中...</div>}>
      <GunsContent />
    </Suspense>
  );
}
