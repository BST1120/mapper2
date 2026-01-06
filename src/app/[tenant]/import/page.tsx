export default function ImportPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">取込（Excel）</h2>
      <p className="text-sm text-zinc-600">
        勤務表（.xlsx）から当日の出勤者と勤務形態を生成します（実装中）。
      </p>
      <div className="rounded-xl border bg-white p-4 text-sm text-zinc-600">
        ここにファイルアップロード、日付選択、エラー一覧が入ります。
      </div>
    </div>
  );
}

