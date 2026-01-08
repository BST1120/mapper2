import { DashboardClient } from "./uiClient";

export default function DashboardPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">ダッシュボード</h2>
      <p className="text-sm text-zinc-600">
        総出勤人数 / エリア別人数 / 休憩消化率 / 休憩中人数
      </p>
      <DashboardClient />
    </div>
  );
}

