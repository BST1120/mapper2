import { AdminImportClient } from "./uiClient";

export default function AdminImportPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">取込（Excel／管理者）</h2>
      <p className="text-sm text-zinc-600">
        .xlsx の勤務表から当日の <code>shifts</code> を作成/更新します。
      </p>
      <AdminImportClient />
    </div>
  );
}

