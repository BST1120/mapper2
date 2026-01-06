import { MapperGrid } from "./ui";

export default function MapperPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">マッパー</h2>
      <p className="text-sm text-zinc-600">
        指定のグリッド配置（さる→…→ねずみ、園庭レイアウト）でエリアを表示します。
        職員表示・D&Dは次フェーズで実装します。
      </p>
      <MapperGrid />
    </div>
  );
}

