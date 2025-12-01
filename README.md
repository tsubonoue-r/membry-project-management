# 📊 Membry Project Management System

Larkベースの営業・設計・製造・施工プロジェクト管理システム

## 🌟 特徴

- **4フェーズワークフロー**: 営業 → 設計 → 製造 → 施工の完全な管理
- **自動タスク分解**: 大きなタスクを小さなサブタスクに自動分解
- **Lark統合**: Lark（飛書）と完全に統合され、通知とタスク管理を実現
- **進捗可視化**: リアルタイムの進捗ダッシュボード（テキスト/HTML）
- **依存関係管理**: タスク間の依存関係とクリティカルパスの自動計算
- **リソース追跡**: メンバーごとのタスク割り当てと工数管理

## 📁 プロジェクト構造

```
membry-project-management/
├── src/
│   ├── api/              # Lark API連携
│   │   └── lark-client.ts
│   ├── services/         # ビジネスロジック
│   │   └── task-decomposer.ts
│   ├── workflows/        # ワークフロー管理
│   │   └── phase-manager.ts
│   ├── dashboard/        # 進捗可視化
│   │   └── project-dashboard.ts
│   ├── types/            # 型定義
│   │   └── index.ts
│   └── index.ts          # エントリーポイント
├── .env                  # 環境設定
├── package.json
├── tsconfig.json
└── README.md
```

## 🚀 セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env`ファイルを作成し、以下を設定：

```env
# GitHub Personal Access Token
GITHUB_TOKEN=your_github_token_here

# Lark App Credentials
LARK_APP_ID=your_lark_app_id
LARK_APP_SECRET=your_lark_app_secret

# Lark Group Chat ID (通知先)
LARK_GROUP_ID=your_group_chat_id

# Repository
REPOSITORY=your-org/your-repo
```

### 3. Larkアプリの設定

1. [Lark Developer Console](https://open.feishu.cn/)にアクセス
2. 新しいアプリを作成
3. 必要な権限を付与：
   - `im:message` - メッセージ送信
   - `im:message.group_at_msg:readonly` - グループメッセージ読み取り
   - `task:task` - タスク管理
   - `contact:user.base` - ユーザー情報
4. App ID と App Secret を取得
5. `.env`ファイルに設定

## 💻 使用方法

### プロジェクトの作成

```typescript
import { Project, ProjectPhase, TaskStatus } from './src/types/index.js';
import { PhaseManager } from './src/workflows/phase-manager.js';
import { TaskDecomposer } from './src/services/task-decomposer.js';
import { ProjectDashboard } from './src/dashboard/project-dashboard.js';
import { LarkClient } from './src/api/lark-client.js';

// プロジェクトの初期化
const project: Project = {
  id: 'proj-001',
  name: '新オフィスビル建設プロジェクト',
  description: '東京都内の新オフィスビル建設',
  status: 'active',
  startDate: new Date(),
  targetEndDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180日後
  phases: {
    [ProjectPhase.SALES]: {
      phase: ProjectPhase.SALES,
      name: '営業',
      status: TaskStatus.IN_PROGRESS,
      progress: 0,
      tasks: [],
    },
    [ProjectPhase.DESIGN]: {
      phase: ProjectPhase.DESIGN,
      name: '設計',
      status: TaskStatus.NOT_STARTED,
      progress: 0,
      tasks: [],
    },
    [ProjectPhase.MANUFACTURING]: {
      phase: ProjectPhase.MANUFACTURING,
      name: '製造',
      status: TaskStatus.NOT_STARTED,
      progress: 0,
      tasks: [],
    },
    [ProjectPhase.CONSTRUCTION]: {
      phase: ProjectPhase.CONSTRUCTION,
      name: '施工',
      status: TaskStatus.NOT_STARTED,
      progress: 0,
      tasks: [],
    },
  },
  tasks: [],
};

// 標準タスクの生成
const phaseManager = new PhaseManager({
  autoTransition: true,
  requireApproval: true,
  approvers: {
    [ProjectPhase.DESIGN]: ['manager@example.com'],
    [ProjectPhase.MANUFACTURING]: ['director@example.com'],
    [ProjectPhase.CONSTRUCTION]: ['pm@example.com'],
  },
});

project.tasks = phaseManager.generateStandardTasks(project);

// タスクの分解
const decomposer = new TaskDecomposer();
project.tasks = project.tasks.map(task => decomposer.decomposeTask(task));

// ダッシュボードの表示
const dashboard = new ProjectDashboard(phaseManager);
const stats = dashboard.generateStats(project);
console.log(dashboard.generateTextDashboard(stats, project));
```

### Lark通知の送信

```typescript
const larkClient = new LarkClient(
  process.env.LARK_APP_ID!,
  process.env.LARK_APP_SECRET!,
  {
    enabled: true,
    groupId: process.env.LARK_GROUP_ID,
    notifyOnTaskCreated: true,
    notifyOnTaskCompleted: true,
    notifyOnTaskBlocked: true,
    notifyOnDeadlineApproaching: true,
    deadlineWarningDays: 3,
  }
);

// タスク完了通知
await larkClient.notifyTaskCompleted(task);

// 進捗レポート送信
await larkClient.sendProgressReport(project.name, [
  { phase: '営業', totalTasks: 5, completedTasks: 5, progress: 100 },
  { phase: '設計', totalTasks: 5, completedTasks: 2, progress: 40 },
  { phase: '製造', totalTasks: 5, completedTasks: 0, progress: 0 },
  { phase: '施工', totalTasks: 6, completedTasks: 0, progress: 0 },
]);
```

### HTMLダッシュボードの生成

```typescript
const htmlDashboard = dashboard.generateHtmlDashboard(stats, project);
fs.writeFileSync('dashboard.html', htmlDashboard);
```

## 📋 4つのフェーズ

### 💼 営業フェーズ
- 顧客ヒアリング
- 見積書作成
- プレゼンテーション
- 契約締結
- キックオフミーティング

### 📐 設計フェーズ
- 基本設計
- 詳細設計
- 図面作成
- 設計レビュー
- 設計承認

### 🏭 製造フェーズ
- 材料調達
- 製造計画
- 製造実行
- 品質検査
- 梱包・出荷準備

### 🏗️ 施工フェーズ
- 現場準備
- 施工実行
- 中間検査
- 最終検査
- 引き渡し
- アフターフォロー

## 🔄 ワークフロー

各フェーズは自動的に次のフェーズに遷移します：

```
営業 → 設計 → 製造 → 施工
```

- **自動遷移**: すべてのタスクが完了すると自動的に次のフェーズへ
- **承認フロー**: 設定により、フェーズ遷移時に承認が必要
- **依存関係**: 前のフェーズのタスクが完了するまで、次のフェーズは開始不可

## 📊 ダッシュボード機能

### テキストダッシュボード
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 プロジェクトダッシュボード: 新オフィスビル建設プロジェクト
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【全体進捗】
  [████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]
  進捗率: 45%
  完了タスク: 9/21
  進行中: 5 | ブロック: 0

【フェーズ別進捗】
  💼 営業
  [████████████████████████████████████████] 100%
  進捗: 100% | ステータス: 完了

  📐 設計
  [████████████████████░░░░░░░░░░░░░░░░░░░░] 40%
  進捗: 40% | ステータス: 進行中
```

### HTMLダッシュボード
- グラフィカルなプログレスバー
- フェーズカード表示
- クリティカルタスクのハイライト
- リソース使用状況の可視化

## 🔧 開発

### ビルド
```bash
npm run build
```

### 開発モード
```bash
npm run dev
```

### 型チェック
```bash
npm run typecheck
```

### テスト
```bash
npm test
```

## 📝 ライセンス

MIT

## 🤝 コントリビューション

Issue #2 の要件に基づいて実装されました。

プルリクエスト歓迎！

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
