import { AdminSettingsClient } from "./uiClient";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">設定（管理者）</h2>
      <p className="text-sm text-zinc-600">
        完全無料運用のため、初期データ作成はこの画面から行います。
      </p>
      <AdminSettingsClient />
    </div>
  );
}

