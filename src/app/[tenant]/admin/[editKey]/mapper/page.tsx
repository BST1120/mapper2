import { MapperGridSkeleton } from "../../../mapper/ui";
import { AdminMapperClient } from "./uiClient";

export default function AdminMapperPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">マッパー（管理者）</h2>
      <p className="text-sm text-zinc-600">
        ここは<strong>秘密URL</strong>でアクセスする管理者用画面です（配置移動・休憩・欠勤・当日の勤務形態変更ができます）。
      </p>
      <AdminMapperClient fallback={<MapperGridSkeleton />} />
    </div>
  );
}

