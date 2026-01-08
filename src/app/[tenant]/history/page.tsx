import { HistoryClient } from "./uiClient";

export default function HistoryPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">履歴</h2>
      <p className="text-sm text-zinc-600">
        職員移動 / 休憩 / ロック / 取込 の履歴を確認します。
      </p>
      <HistoryClient />
    </div>
  );
}

