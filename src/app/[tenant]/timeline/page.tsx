import { TimelineClient } from "./uiClient";

export default function TimelinePage() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">タイムバー</h2>
      <p className="text-sm text-zinc-600">
        7:00〜19:00（15分刻み）で勤務時間を可視化します。
      </p>
      <TimelineClient />
    </div>
  );
}

