export default function ImportPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">取込（Excel）</h2>
      <p className="text-sm text-zinc-600">
        ここは閲覧用です。取込は管理者用（秘密URL）で行います。
      </p>
      <div className="rounded-xl border bg-white p-4 text-sm text-zinc-600">
        管理者URL: <code>/{`{tenant}`}/admin/{`{editKey}`}/import</code>
      </div>
    </div>
  );
}

