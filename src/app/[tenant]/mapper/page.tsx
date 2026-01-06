import { MapperGrid } from "./ui";
import { MapperPageClient } from "./uiClient";

export default function MapperPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">マッパー</h2>
      <p className="text-sm text-zinc-600">
        指定のグリッド配置（さる→…→ねずみ、園庭レイアウト）でエリアを表示します。
        ここは<strong>閲覧用URL</strong>です。編集は「秘密URL（管理者用URL）」側で行います（実装中）。
      </p>
      <MapperPageClient fallback={<MapperGrid />} />
    </div>
  );
}

