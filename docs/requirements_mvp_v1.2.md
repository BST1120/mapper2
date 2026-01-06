# 実装仕様書（MVP v1.2）保育園 職員配置マッパー＋休憩管理＋タイムバー

最終更新: 2026-01-05  
ステータス: 確定（ユーザー承認済）

---

## 0. 前提（固定）
- **開園時間**: 7:00〜19:00
- **勤務形態（固定）**
  - A 7:00-16:00 / B 7:30-16:30 / C 8:00-17:00 / D 8:30-17:30 / E 9:00-18:00 / F 10:00-19:00
- **休憩**: 2枠（15+30 / 30+30）。1時間は2枠消費で表現
- **退勤30分前以降は休憩開始不可**
- **権限**: 管理者のみ編集、主任は閲覧のみ（ログインなし／管理者用の秘密URLで編集を付与）
- **同時接続**: 最大3台想定
- **データ保持**: 原則無期限（無料枠制約に備え、後でアーカイブ拡張）

---

## 1. 推奨アーキテクチャ（無料枠で成立）
- **フロント**: Next.js（React）+ TypeScript（PWA対応）
- **DB/同期/オフライン**: Firebase Firestore（Webオフライン永続化ON）
- **編集権限**: **管理者用の秘密URL**で編集モード（完全無料のためサーバ検証は行わない）
- **ホスティング**: Vercel もしくは Firebase Hosting（無料枠）

> 注意: 秘密URL方式は「URLを知っている人が編集できる」方式（セキュリティは運用で担保）。完全無料を優先するためのトレードオフ。

---

## 2. 画面・ルーティング（実装単位）
共通: メニューで遷移。日付切替あり（既定=今日）。

- `/(tenant)/mapper?date=YYYY-MM-DD`
  - **配置マッパー**（D&D、編集ロック、勤務/休憩バッジ、勤務終了グレー）
- `/(tenant)/dashboard?date=...`
  - **当日ダッシュボード**（総出勤、エリア別人数、休憩消化率、休憩中人数）
- `/(tenant)/timeline?date=...`
  - **タイムバー**（7:00〜19:00、個人バー＋人数推移＋手薄ハイライト）
- `/(tenant)/history?date=...`
  - **履歴**（移動/休憩/ロック/取込）
- `/(tenant)/staff`
  - **職員マスタ**（登録/編集/無効化）
- `/(tenant)/import?date=...`
  - **Excel取込**（当日出勤生成）
- `/(tenant)/settings`
  - **園設定**（最低人数しきい値、PIN変更、エリア名/並び等）

管理者（編集）用:
- `/(tenant)/admin/(editKey)/mapper`
  - **配置マッパー（編集）**

---

## 3. UI仕様（実装可能な形）

### 3.1 マッパー（`/mapper`）
- **背景**: 園内図画像（PNG/JPG）を表示（Storage or URL）
- **エリア表示**: エリアごとに枠（カード）を重ねる
- **職員アイコン**
  - 表示名: **苗字**、重複時は **苗字＋名の頭文字（ローマ字1文字）**（例: 佐藤T）
  - バッジ:
    - 勤務種別（A-F / fixed）
    - 休憩残（例: `休2` → `休1` → `休0`）
    - 休憩中（休憩エリア所属で表現してもOK）
  - **勤務終了後**: グレー表示（見た目のみ、MVPでは操作制御不要）
- **D&D**
  - 管理者編集モードのみ有効
  - ドロップ先エリアに所属変更→即時同期
- **自動整列（ぐりっと収まる）**
  - 各エリア内はCSS Gridで固定セル（例: 48px）に配置し、順に詰める（座標管理しない）
- **編集ロック**
  - ロックON時は管理者端末でもD&D無効
  - ロック状態を画面上部に表示

### 3.2 タイムバー（`/timeline`）
- 横軸: 7:00〜19:00（**15分刻み**）
- 上段: **勤務中人数推移**（バー/折れ線どちらでも）
- 下段: 職員ごとに勤務棒（開始〜終了）
- **手薄ハイライト**
  - 園設定 `minStaffThreshold` を下回るスロットは背景色を変える
- MVPの休憩反映:
  - 初期は「休憩中でも勤務中カウント」でOK（後で“休憩は除外/中抜き”拡張可能）

### 3.3 ダッシュボード（`/dashboard`）
- **総出勤人数**: `DailyShift`の件数
- **エリア別人数**: 当日配置の `areaId` ごとに集計
- **休憩消化率**: `消化枠数合計 / 必要枠数合計`
- **今休憩中人数**: `areaId == "break"` の人数

### 3.4 履歴（`/history`）
- フィルタ: イベント種別、職員、時間帯
- 表示: 時刻 / イベント / 対象職員 / from→to / 操作者（端末ID）

---

## 4. データモデル（Firestore・マルチ園対応）

### 4.1 コレクション構造（推奨）
- `tenants/{tenantId}`
  - `name`
  - `timezone`（例: Asia/Tokyo）
  - `mapImageUrl`
  - `minStaffThreshold`（手薄しきい値）
  - `pinHash`（※クライアントから読めないようルールで禁止）
  - `createdAt`
- `tenants/{tenantId}/areas/{areaId}`
  - `name`（ねずみ 等）
  - `order`（表示順）
  - `type`（room/outdoor/admin/free/break）
- `tenants/{tenantId}/staff/{staffId}`
  - `lastName` / `firstName`（表示名生成用）
  - `displayName`（生成結果を保存してもOK）
  - `workTypeDefault`（A-F or fixed）
  - `fixedStart` / `fixedEnd`（fixedのみ）
  - `breakPattern`（`15_30` / `30_30`）
  - `active`（在籍）
- `tenants/{tenantId}/days/{YYYY-MM-DD}/shifts/{staffId}`
  - `startAt`（timestamp）
  - `endAt`（timestamp）
  - `workType`（A-F/fixed）
  - `breakSlots`: `[{minutes:15, used:boolean, startedAt?, endedAt?}, {minutes:30,...}]` 等
  - `source`（excel/manual）
- `tenants/{tenantId}/days/{YYYY-MM-DD}/assignments/{staffId}`
  - `areaId`（現在地）
  - `version`（競合検知用int）
  - `updatedAt`
  - `updatedByDeviceId`
- `tenants/{tenantId}/days/{YYYY-MM-DD}/state`
  - `editLocked`（boolean）
  - `lockedAt`
  - `lockedByDeviceId`
- `tenants/{tenantId}/days/{YYYY-MM-DD}/auditLogs/{logId}`
  - `timestamp`
  - `type`（move/break_start/break_end/lock/unlock/import）
  - `staffId?`
  - `fromAreaId?` / `toAreaId?`
  - `deviceId`
  - `meta`（任意）
- `tenants/{tenantId}/editSessions/{sessionId}`
  - `deviceId`
  - `expiresAt`
  - `createdAt`

---

## 5. PIN（ログイン無し）で「管理者だけ編集」を成立させる仕様

### 5.1 端末識別
- `deviceId`: 初回起動時にUUID生成してlocalStorage永続化

### 5.2 PIN検証フロー
- UIでPIN入力 → Cloud Functions Callable `verifyPin(tenantId, pin, deviceId)`
- 成功: `editSessions/{sessionId}` をサーバ側（Admin SDK）で作成し、`sessionId` を返す
- クライアントは `sessionId` をlocalStorageに保存（期限切れで再入力）

### 5.3 Firestoreセキュリティルール（概念）
- 閲覧（read）: 原則OK（園URLを知っている人は見られる）
- 書き込み（write）:
  - `days/*/assignments/*` と `days/*/state` と `auditLogs` は
    - `editLocked == false`
    - `validSession(tenantId, sessionId, deviceId, now < expiresAt)` が成立
- `pinHash` はクライアントread禁止

---

## 6. 競合警告（同じ職員を同時に動かした時）
- `assignments/{staffId}.version` をインクリメント
- 移動時はFirestore **transaction** で:
  - 現versionを読み、クライアントが認識しているversionと一致なら更新（`version+1`）
  - 不一致なら更新せず失敗→UIで「他端末が先に移動しました」警告＋最新位置へリフレッシュ
- オフライン時:
  - 変更はローカルキューに入り、復帰時にtransaction失敗しうる → 同様に警告表示

---

## 7. オフライン要件（管理者端末だけ動けば良い）
- Firestoreのオフライン永続化をON（IndexedDB）
- オフライン中:
  - 管理者端末は編集操作を許可（ローカル反映）
  - 「オフライン」バナー表示
- 復帰後:
  - サーバ同期・競合検知・警告

---

## 8. 休憩仕様（実装手順）
- 休憩開始ボタン（管理者のみ）
  - 対象職員の `shift.breakSlots` から `used=false` の最初の枠を1つ `used=true` に
  - その時刻が `endAt - 30min` 以降なら**開始不可**
  - 配置を `areaId="break"` に変更
  - `auditLogs` に `break_start` を記録
- 休憩終了ボタン（任意）
  - `breakSlots[n].endedAt` 記録、必要なら前エリアへ戻す（MVPでは「手動で戻す」でも可）
  - `auditLogs` に `break_end`

---

## 9. Excel取込（実装要件）

### 9.1 入力フォーマット（前提）
- 1行目: 日付見出し（例: `2026/01/05` 等）
- 1列目: 氏名
- セル: 勤務コード（A〜F）または固定シフト識別（空は休み）

### 9.2 実装
- ブラウザで `.xlsx` を読み取り（例: SheetJS）
- 取込日 `date` の列を特定し、氏名×セル値を走査
- 氏名→職員マスタの照合（表示名生成に必要）
- `days/{date}/shifts/{staffId}` を upsert
  - A-Fは固定時刻へ展開
  - fixedはスタッフマスタの時刻を採用
- エラー一覧（UIで確認・修正して再実行）
  - 職員未登録、未知コード、日付列がない

---

## 10. タイムバー算出（15分刻み）
- 7:00〜19:00を15分スロットに分割（48スロット）
- `勤務中` 判定: `slotTime >= startAt && slotTime < endAt`
- `count[slot] = 勤務中職員数`
- `count[slot] < minStaffThreshold` のスロットを手薄としてハイライト

---

## 11. MVP受入テスト（実装チェックリスト）
- **PIN**: PIN成功で編集でき、PINなしで編集できない
- **ロック**: ロックONで編集不可、OFFで編集可（全端末同期）
- **同期**: 端末Aの移動が端末Bに反映
- **競合**: 同じ職員を同時移動→片方に競合警告
- **勤務**: 勤務終了後グレー表示
- **休憩**: 休憩開始で休憩エリアへ移動、枠が減る、退勤30分前以降は開始不可
- **ダッシュボード**: 4指標が当日データから表示される
- **履歴**: 移動/休憩/ロック/取込が履歴に残る
- **Excel**: 勤務表から当日出勤者が生成される
- **タイムバー**: 7:00〜19:00で個人バー＋人数推移＋手薄ハイライトが表示される
- **オフライン**: 管理者端末がオフラインでも操作でき、復帰後同期される（競合時警告）

