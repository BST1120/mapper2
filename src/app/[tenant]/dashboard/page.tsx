export default function DashboardPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">ダッシュボード</h2>
      <p className="text-sm text-zinc-600">
        総出勤人数 / エリア別人数 / 休憩消化率 / 休憩中人数（実装中）
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "総出勤人数", value: "-" },
          { label: "休憩消化率", value: "-" },
          { label: "休憩中人数", value: "-" },
          { label: "手薄時間", value: "-" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border bg-white p-4">
            <div className="text-sm text-zinc-600">{k.label}</div>
            <div className="mt-1 text-2xl font-semibold">{k.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-white p-4 text-sm text-zinc-600">
        ここにエリア別人数の一覧が入ります。
      </div>
    </div>
  );
}

