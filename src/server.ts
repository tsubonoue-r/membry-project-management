/**
 * Webアプリケーションサーバー
 * ExpressでRESTful APIとWebページを提供
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { Project, ProjectPhase, TaskStatus, TaskPriority, Member, MemberSkill } from './types/index.js';
import { PhaseManager } from './workflows/phase-manager.js';
import { TaskDecomposer } from './services/task-decomposer.js';
import { ProjectDashboard } from './dashboard/project-dashboard.js';
import { MemberManager } from './services/member-manager.js';
import { LarkClient } from './api/lark-client.js';

// 環境変数読み込み
dotenv.config();

// __dirnameの代替（ESM対応）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア設定
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// データストア（簡易版 - 後でDB化）
const projects = new Map<string, Project>();
let projectCounter = 1;

// サービスの初期化
const phaseManager = new PhaseManager({
  autoTransition: true,
  requireApproval: false,
  approvers: {},
});

const decomposer = new TaskDecomposer();
const dashboard = new ProjectDashboard(phaseManager);

// Larkクライアント（オプション）
let larkClient: LarkClient | undefined;
let memberManager: MemberManager;

if (process.env.LARK_APP_ID && process.env.LARK_APP_SECRET) {
  larkClient = new LarkClient(
    process.env.LARK_APP_ID,
    process.env.LARK_APP_SECRET,
    {
      enabled: !!process.env.LARK_GROUP_ID,
      groupId: process.env.LARK_GROUP_ID,
      notifyOnTaskCreated: true,
      notifyOnTaskCompleted: true,
      notifyOnTaskBlocked: true,
      notifyOnDeadlineApproaching: true,
      deadlineWarningDays: 3,
    }
  );
  memberManager = new MemberManager(larkClient);
} else {
  memberManager = new MemberManager();
}

// デモプロジェクトを初期化
function initializeDemoProject() {
  const demoProject: Project = {
    id: 'demo-001',
    name: '新オフィスビル建設プロジェクト',
    description: '東京都内の10階建てオフィスビル建設プロジェクト',
    status: 'active',
    startDate: new Date('2025-01-15'),
    targetEndDate: new Date('2025-07-15'),
    phases: {
      [ProjectPhase.SALES]: {
        phase: ProjectPhase.SALES,
        name: '営業',
        status: TaskStatus.COMPLETED,
        startDate: new Date('2025-01-15'),
        endDate: new Date('2025-02-01'),
        progress: 100,
        tasks: [],
        responsible: '山田太郎',
      },
      [ProjectPhase.DESIGN]: {
        phase: ProjectPhase.DESIGN,
        name: '設計',
        status: TaskStatus.IN_PROGRESS,
        startDate: new Date('2025-02-01'),
        progress: 70,
        tasks: [],
        responsible: '佐藤花子',
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

  // タスク生成
  demoProject.tasks = phaseManager.generateStandardTasks(demoProject);
  demoProject.tasks = demoProject.tasks.map(task => decomposer.decomposeTask(task, 3));

  // 進捗シミュレーション
  demoProject.tasks.forEach(task => {
    if (task.phase === ProjectPhase.SALES) {
      task.status = TaskStatus.COMPLETED;
      task.progress = 100;
      task.assignee = '山田太郎';
      task.completedDate = new Date('2025-02-01');
      task.subtasks.forEach(subtask => {
        subtask.status = TaskStatus.COMPLETED;
        subtask.progress = 100;
        subtask.assignee = '山田太郎';
      });
    } else if (task.phase === ProjectPhase.DESIGN) {
      const designTasks = demoProject.tasks.filter(t => t.phase === ProjectPhase.DESIGN);
      const index = designTasks.indexOf(task);
      if (index < 3) {
        task.status = TaskStatus.COMPLETED;
        task.progress = 100;
        task.assignee = '佐藤花子';
        task.subtasks.forEach(subtask => {
          subtask.status = TaskStatus.COMPLETED;
          subtask.progress = 100;
          subtask.assignee = '佐藤花子';
        });
      } else if (index === 3) {
        task.status = TaskStatus.IN_PROGRESS;
        task.progress = 50;
        task.assignee = '佐藤花子';
      }
    }

    // 期限設定
    const daysFromStart = {
      [ProjectPhase.SALES]: 15,
      [ProjectPhase.DESIGN]: 60,
      [ProjectPhase.MANUFACTURING]: 120,
      [ProjectPhase.CONSTRUCTION]: 180,
    }[task.phase];
    task.dueDate = new Date(demoProject.startDate.getTime() + daysFromStart * 24 * 60 * 60 * 1000);
  });

  projects.set(demoProject.id, demoProject);
  return demoProject;
}

// 初期データ読み込み
initializeDemoProject();

// =====================================
// API エンドポイント
// =====================================

// プロジェクト一覧取得
app.get('/api/projects', (req: Request, res: Response) => {
  const projectList = Array.from(projects.values()).map(project => ({
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: project.startDate,
    targetEndDate: project.targetEndDate,
    overallProgress: phaseManager.calculateOverallProgress(project),
  }));
  res.json(projectList);
});

// プロジェクト詳細取得
app.get('/api/projects/:id', (req: Request, res: Response) => {
  const project = projects.get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const stats = dashboard.generateStats(project);
  res.json({
    project,
    stats,
  });
});

// プロジェクト作成
app.post('/api/projects', (req: Request, res: Response) => {
  const { name, description, targetEndDate } = req.body;

  const projectId = `proj-${String(projectCounter++).padStart(3, '0')}`;
  const newProject: Project = {
    id: projectId,
    name,
    description,
    status: 'active',
    startDate: new Date(),
    targetEndDate: new Date(targetEndDate),
    phases: {
      [ProjectPhase.SALES]: {
        phase: ProjectPhase.SALES,
        name: '営業',
        status: TaskStatus.NOT_STARTED,
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
    tasks: phaseManager.generateStandardTasks({ ...newProject, tasks: [] }),
  };

  projects.set(projectId, newProject);
  res.status(201).json(newProject);
});

// タスク一覧取得
app.get('/api/projects/:id/tasks', (req: Request, res: Response) => {
  const project = projects.get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.json(project.tasks);
});

// タスク更新
app.put('/api/projects/:projectId/tasks/:taskId', (req: Request, res: Response) => {
  const project = projects.get(req.params.projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const taskIndex = project.tasks.findIndex(t => t.id === req.params.taskId);
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // タスク更新
  project.tasks[taskIndex] = {
    ...project.tasks[taskIndex],
    ...req.body,
  };

  // フェーズ進捗の再計算
  Object.values(project.phases).forEach(phase => {
    const updatedPhase = phaseManager.updatePhaseStatus(phase, project.tasks);
    project.phases[updatedPhase.phase] = updatedPhase;
  });

  res.json(project.tasks[taskIndex]);
});

// ダッシュボードデータ取得
app.get('/api/projects/:id/dashboard', (req: Request, res: Response) => {
  const project = projects.get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const stats = dashboard.generateStats(project);
  res.json(stats);
});

// ガントチャートHTML取得
app.get('/api/projects/:id/gantt', (req: Request, res: Response) => {
  const project = projects.get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const stats = dashboard.generateStats(project);
  const html = dashboard.generateHtmlDashboard(stats, project);
  res.send(html);
});

// メンバー一覧取得
app.get('/api/members', async (req: Request, res: Response) => {
  try {
    const members = memberManager.getAllMembers();
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get members' });
  }
});

// Larkからメンバー同期
app.post('/api/members/sync', async (req: Request, res: Response) => {
  try {
    if (!larkClient) {
      return res.status(400).json({ error: 'Lark client not configured' });
    }

    const members = await memberManager.syncMembersFromLark();
    res.json({ success: true, count: members.length, members });
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync members from Lark' });
  }
});

// =====================================
// Webページルーティング
// =====================================

// トップページ
app.get('/', (req: Request, res: Response) => {
  res.redirect('/projects');
});

// プロジェクト一覧ページ
app.get('/projects', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// プロジェクト詳細ページ
app.get('/projects/:id', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/project.html'));
});

// ヘルスチェック
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    projects: projects.size,
    larkEnabled: !!larkClient,
  });
});

// エラーハンドリング
app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// サーバー起動
app.listen(PORT, () => {
  console.log('🚀 Membry Project Management Server 起動');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📊 プロジェクト数: ${projects.size}`);
  console.log(`👥 Lark連携: ${larkClient ? '有効' : '無効'}`);
  console.log('');
  console.log('利用可能なページ:');
  console.log(`  - http://localhost:${PORT}/projects - プロジェクト一覧`);
  console.log(`  - http://localhost:${PORT}/api/projects - API エンドポイント`);
  console.log('');
});

export default app;
