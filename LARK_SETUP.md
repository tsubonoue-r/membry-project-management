# 🚀 Larkアプリセットアップガイド

このガイドでは、Lark（飛書）アプリを設定してプロジェクト管理システムと連携する方法を説明します。

## ステップ 1: Lark Developer Consoleにアクセス

1. [Lark Developer Console](https://open.feishu.cn/) にアクセス
2. Larkアカウントでログイン（アカウントがない場合は作成）

## ステップ 2: アプリの作成

1. 「アプリを作成」をクリック
2. アプリ情報を入力：
   - **アプリ名**: `Membry Project Management`
   - **アプリの説明**: `営業・設計・製造・施工プロジェクト管理システム`
   - **アイコン**: お好みのアイコンをアップロード

3. 「作成」をクリック

## ステップ 3: 権限の設定

アプリに必要な権限を付与します：

### メッセージング権限
- ✅ `im:message` - メッセージ送信
- ✅ `im:message.group_at_msg:readonly` - グループメッセージ読み取り
- ✅ `im:message:send_as_bot` - Bot としてメッセージ送信
- ✅ `im:chat` - チャット管理

### タスク管理権限
- ✅ `task:task` - タスク作成・更新
- ✅ `task:task:readonly` - タスク読み取り

### ユーザー情報権限
- ✅ `contact:user.base` - ユーザー基本情報読み取り
- ✅ `contact:user.employee_id:readonly` - 従業員ID読み取り

### イベント購読
以下のイベントを購読します：
- `im.message.receive_v1` - メッセージ受信
- `task.task.updated_v1` - タスク更新
- `task.task.commented_v1` - タスクコメント

## ステップ 4: 認証情報の取得

1. アプリ管理画面で「認証情報」タブを開く
2. 以下の情報をコピー：
   - **App ID** (例: `cli_a1b2c3d4e5f6g7h8`)
   - **App Secret** (例: `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p`)

## ステップ 5: 環境変数の設定

プロジェクトの `.env` ファイルに認証情報を設定します：

```bash
# Lark App Credentials
LARK_APP_ID=cli_a1b2c3d4e5f6g7h8
LARK_APP_SECRET=1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p

# Lark Group Chat ID (通知先)
LARK_GROUP_ID=oc_1a2b3c4d5e6f7g8h
```

## ステップ 6: グループチャットIDの取得

通知を送信するグループチャットのIDを取得します：

### 方法1: チャットリンクから取得
1. Larkでグループチャットを開く
2. チャット設定 → 「リンクを共有」をクリック
3. URLに含まれる `oc_` で始まるIDをコピー
   - 例: `https://example.feishu.cn/wiki/oc_1a2b3c4d5e6f7g8h`
   - グループID: `oc_1a2b3c4d5e6f7g8h`

### 方法2: APIで取得
```typescript
import { LarkClient } from './src/api/lark-client.js';

const larkClient = new LarkClient(
  process.env.LARK_APP_ID!,
  process.env.LARK_APP_SECRET!,
  { enabled: false }
);

// グループリストを取得
const groups = await larkClient.client.im.v1.chat.list();
console.log(groups);
```

## ステップ 7: Webhookの設定（オプション）

リアルタイム通知を受け取る場合：

1. アプリ管理画面で「イベント購読」タブを開く
2. 「Request URL」を設定：
   ```
   https://your-domain.com/webhook/lark
   ```
3. 「検証トークン」をコピーして `.env` に追加：
   ```bash
   LARK_VERIFICATION_TOKEN=your_verification_token
   LARK_ENCRYPT_KEY=your_encrypt_key
   ```

## ステップ 8: アプリの公開

1. アプリ管理画面で「バージョン管理」タブを開く
2. 「新しいバージョンを作成」をクリック
3. バージョン情報を入力して「提出」
4. 承認を待つ（通常1-2営業日）

## ステップ 9: テスト

システムが正しく動作するかテストします：

```bash
# デモプロジェクトを実行
npm run demo

# Lark通知のテスト
npm run test:lark
```

## トラブルシューティング

### エラー: "App not found"
- App IDが正しいか確認
- アプリが正しく作成されているか確認

### エラー: "Invalid signature"
- App Secretが正しいか確認
- `.env` ファイルの形式が正しいか確認

### 通知が届かない
- グループチャットIDが正しいか確認
- アプリがグループに追加されているか確認
- 権限が正しく設定されているか確認

## 参考リンク

- [Lark Open Platform ドキュメント](https://open.feishu.cn/document/home/index)
- [Lark API リファレンス](https://open.feishu.cn/document/server-docs/api-call-guide/api-quick-start)
- [Node SDK GitHub](https://github.com/larksuite/node-sdk)

---

セットアップで問題が発生した場合は、Issue を作成してください。
