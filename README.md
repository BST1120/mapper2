# Iwara Mapper（MVP v1.2）

配置マッパー＋休憩管理＋タイムバー（7:00〜19:00）を、Firebase Firestore同期で動かすNext.jsアプリです。

## 開発（ローカル）

```bash
npm ci
npm run dev
```

`http://localhost:3000` を開くと、既定テナントへリダイレクトします。

## 環境変数

`.env.local` を作成して設定します。

```bash
NEXT_PUBLIC_DEFAULT_TENANT_ID=demo
```

※ Firebase設定（`NEXT_PUBLIC_FIREBASE_*` 等）やPIN検証用Cloud Functionsは、次のフェーズで追加します。

## ルーティング（MVP）

- `/{tenant}/mapper?date=YYYY-MM-DD`
- `/{tenant}/dashboard?date=...`
- `/{tenant}/timeline?date=...`
- `/{tenant}/history?date=...`
- `/{tenant}/staff`
- `/{tenant}/import?date=...`
- `/{tenant}/settings`
