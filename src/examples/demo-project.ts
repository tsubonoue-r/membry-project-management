/**
 * デモプロジェクト
 * システムの動作確認用サンプル
 */

import { Project, ProjectPhase, TaskStatus, TaskPriority } from '../types/index.js';
import { PhaseManager } from '../workflows/phase-manager.js';
import { TaskDecomposer } from '../services/task-decomposer.js';
import { ProjectDashboard } from '../dashboard/project-dashboard.js';
import * as fs from 'fs';

// デモプロジェクトの作成
function createDemoProject(): Project {
  const project: Project = {
    id: 'demo-001',
    name: '新オフィスビル建設プロジェクト',
    description: '東京都内の10階建てオフィスビル建設プロジェクト',
    status: 'active',
    startDate: new Date('2025-01-15'),
    targetEndDate: new Date('2025-07-15'), // 6ヶ月後
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
        progress: 60,
        tasks: [],
        responsible: '佐藤花子',
      },
      [ProjectPhase.MANUFACTURING]: {
        phase: ProjectPhase.MANUFACTURING,
        name: '製造',
        status: TaskStatus.NOT_STARTED,
        progress: 0,
        tasks: [],
        responsible: '鈴木一郎',
      },
      [ProjectPhase.CONSTRUCTION]: {
        phase: ProjectPhase.CONSTRUCTION,
        name: '施工',
        status: TaskStatus.NOT_STARTED,
        progress: 0,
        tasks: [],
        responsible: '田中次郎',
      },
    },
    tasks: [],
  };

  return project;
}

// メイン実行
async function main() {
  console.log('🏗️  デモプロジェクト管理システム起動\n');

  // フェーズマネージャーの初期化
  const phaseManager = new PhaseManager({
    autoTransition: true,
    requireApproval: true,
    approvers: {
      [ProjectPhase.DESIGN]: ['manager@example.com'],
      [ProjectPhase.MANUFACTURING]: ['director@example.com'],
      [ProjectPhase.CONSTRUCTION]: ['pm@example.com'],
    },
  });

  // プロジェクトの作成
  const project = createDemoProject();

  // 標準タスクの生成
  console.log('📋 標準タスクを生成中...');
  project.tasks = phaseManager.generateStandardTasks(project);
  console.log(`✅ ${project.tasks.length}個のタスクを生成しました\n`);

  // タスクの分解
  console.log('🔍 タスクを詳細化中...');
  const decomposer = new TaskDecomposer();
  project.tasks = project.tasks.map(task => decomposer.decomposeTask(task, 3));

  const totalSubtasks = project.tasks.reduce((sum, task) => sum + task.subtasks.length, 0);
  console.log(`✅ ${totalSubtasks}個のサブタスクを生成しました\n`);

  // 進捗をシミュレート（営業フェーズは完了、設計フェーズは進行中）
  project.tasks.forEach(task => {
    if (task.phase === ProjectPhase.SALES) {
      task.status = TaskStatus.COMPLETED;
      task.progress = 100;
      task.assignee = '山田太郎';
      task.completedDate = new Date('2025-02-01');

      // サブタスクも完了にする
      task.subtasks.forEach(subtask => {
        subtask.status = TaskStatus.COMPLETED;
        subtask.progress = 100;
        subtask.assignee = '山田太郎';
      });
    } else if (task.phase === ProjectPhase.DESIGN) {
      const designTasks = project.tasks.filter(t => t.phase === ProjectPhase.DESIGN);
      const index = designTasks.indexOf(task);

      if (index < 3) {
        // 最初の3つのタスクは完了
        task.status = TaskStatus.COMPLETED;
        task.progress = 100;
        task.assignee = '佐藤花子';
        task.subtasks.forEach(subtask => {
          subtask.status = TaskStatus.COMPLETED;
          subtask.progress = 100;
          subtask.assignee = '佐藤花子';
        });
      } else if (index === 3) {
        // 4つ目は進行中
        task.status = TaskStatus.IN_PROGRESS;
        task.progress = 50;
        task.assignee = '佐藤花子';
        task.subtasks.forEach((subtask, subIndex) => {
          if (subIndex < 2) {
            subtask.status = TaskStatus.COMPLETED;
            subtask.progress = 100;
            subtask.assignee = '佐藤花子';
          } else {
            subtask.status = TaskStatus.IN_PROGRESS;
            subtask.progress = 30;
            subtask.assignee = '佐藤花子';
          }
        });
      } else {
        // 残りは未着手
        task.status = TaskStatus.NOT_STARTED;
        task.assignee = '佐藤花子';
      }
    }

    // 期限を設定
    const daysFromStart = {
      [ProjectPhase.SALES]: 15,
      [ProjectPhase.DESIGN]: 60,
      [ProjectPhase.MANUFACTURING]: 120,
      [ProjectPhase.CONSTRUCTION]: 180,
    }[task.phase];

    task.dueDate = new Date(project.startDate.getTime() + daysFromStart * 24 * 60 * 60 * 1000);
  });

  // フェーズステータスの更新
  Object.values(project.phases).forEach(phase => {
    const updatedPhase = phaseManager.updatePhaseStatus(phase, project.tasks);
    project.phases[updatedPhase.phase] = updatedPhase;
  });

  // ダッシュボードの生成
  console.log('📊 ダッシュボードを生成中...\n');
  const dashboard = new ProjectDashboard(phaseManager);
  const stats = dashboard.generateStats(project);

  // テキストダッシュボードの表示
  console.log(dashboard.generateTextDashboard(stats, project));

  // HTMLダッシュボードの生成
  console.log('\n💾 HTMLダッシュボードを生成中...');
  const htmlDashboard = dashboard.generateHtmlDashboard(stats, project);
  fs.writeFileSync('dashboard.html', htmlDashboard);
  console.log('✅ dashboard.html を生成しました');

  // JSONデータのエクスポート
  console.log('\n💾 JSONデータをエクスポート中...');
  const jsonData = dashboard.exportJson(stats, project);
  fs.writeFileSync('project-data.json', jsonData);
  console.log('✅ project-data.json を生成しました');

  // クリティカルパスの計算
  console.log('\n🎯 クリティカルパスを計算中...');
  const criticalPath = phaseManager.calculateCriticalPath(project.tasks);
  console.log(`✅ クリティカルパス: ${criticalPath.length}タスク`);
  console.log('主要タスク:');
  criticalPath.slice(0, 5).forEach(task => {
    console.log(`  - ${task.title} (${PhaseManager.getPhaseNameJa(task.phase)})`);
  });

  console.log('\n🎉 デモプロジェクトの実行が完了しました！');
  console.log('\n生成されたファイル:');
  console.log('  - dashboard.html - ブラウザで開いて進捗を確認');
  console.log('  - project-data.json - プロジェクトデータ（JSON）');
}

// 実行
main().catch(console.error);
