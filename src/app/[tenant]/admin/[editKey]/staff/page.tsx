import { AdminStaffClient } from "./uiClient";

export default function AdminStaffPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">職員（管理者）</h2>
      <p className="text-sm text-zinc-600">
        職員マスタに「勤務形態コード（A〜M, G1等）」を紐づけます。
      </p>
      <AdminStaffClient />
    </div>
  );
}

