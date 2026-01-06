import Link from "next/link";

export default function Home() {
  const tenantId = process.env.NEXT_PUBLIC_TENANT_ID || "iwara";

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">mapper2</h1>
      <p className="mt-2 text-zinc-600">
        保育園の「職員配置マッパー／休憩管理／タイムバー」MVP（v1.2）
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link
          className="rounded-xl border bg-white p-4 hover:bg-zinc-50"
          href={`/${tenantId}/mapper`}
        >
          <div className="font-medium">マッパー</div>
          <div className="text-sm text-zinc-600">
            職員をドラッグ&ドロップで配置（実装中）
          </div>
        </Link>

        <Link
          className="rounded-xl border bg-white p-4 hover:bg-zinc-50"
          href={`/${tenantId}/timeline`}
        >
          <div className="font-medium">タイムバー</div>
          <div className="text-sm text-zinc-600">
            7:00-19:00の勤務可視化（実装中）
          </div>
        </Link>

        <Link
          className="rounded-xl border bg-white p-4 hover:bg-zinc-50"
          href={`/${tenantId}/dashboard`}
        >
          <div className="font-medium">ダッシュボード</div>
          <div className="text-sm text-zinc-600">
            総人数・エリア別・休憩など（実装中）
          </div>
        </Link>

        <Link
          className="rounded-xl border bg-white p-4 hover:bg-zinc-50"
          href={`/${tenantId}/history`}
        >
          <div className="font-medium">履歴</div>
          <div className="text-sm text-zinc-600">移動/休憩/ロック（実装中）</div>
        </Link>
      </div>

      <div className="mt-8 rounded-xl border bg-white p-4 text-sm text-zinc-600">
        <div className="font-medium text-zinc-800">設定</div>
        <div className="mt-1">
          `NEXT_PUBLIC_TENANT_ID` が未設定の場合は <code>iwara</code>{" "}
          を使います。
        </div>
      </div>
    </div>
  );
}
