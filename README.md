## mapper2

保育園の「職員配置マッパー／休憩管理／タイムバー」MVP（v1.2）。

仕様書:
- `docs/requirements_mvp_v1.2.md`
- `docs/implementation_roadmap_checklist.md`

## Getting Started

### 1) 環境変数（Firebase）を設定

`.env.example` を参考に、リポジトリ直下へ `.env.local` を作成して値を設定してください。

例:

```bash
cp .env.example .env.local
```

`.env.local` に以下を設定します:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`（任意）
- `NEXT_PUBLIC_TENANT_ID`（例: `iwara` など。後でFirestore上の `tenantId` と一致させる）

### 2) Firebase側の設定（初回のみ）

- Authentication: **Anonymous（匿名）** を有効化
- Firestore Database: 作成（開発中はテストモードでOK）

### 3) 開発サーバ起動

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

起動後、画面上部に `Firebase: connected (device id: ...)` が表示されれば接続成功です。

### スクリプト

- `npm run dev`: 開発
- `npm run build`: ビルド
- `npm run start`: 起動
- `npm run lint`: lint

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
