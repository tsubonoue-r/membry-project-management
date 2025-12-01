/**
 * デモプロジェクト
 * システムの動作確認用サンプル
 */

import { Project, ProjectPhase, TaskStatus, TaskPriority, Member, MemberSkill } from '../types/index.js';
import { PhaseManager } from '../workflows/phase-manager.js';
import { TaskDecomposer } from '../services/task-decomposer.js';
import { ProjectDashboard } from '../dashboard/project-dashboard.js';
import { MemberManager } from '../services/member-manager.js';
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

// デモメンバーの作成
function createDemoMembers(): Member[] {
  return [
    {
      id: 'member-001',
      name: '山田太郎',
      email: 'yamada@example.com',
      department: '営業部',
      title: '営業マネージャー',
      skills: [MemberSkill.SALES, MemberSkill.PROJECT_MANAGEMENT],
      availability: 40,
      currentLoad: 0,
      assignedTasks: [],
      larkUserId: 'lark-001',
      avatarUrl: 'https://example.com/avatar1.jpg',
    },
    {
      id: 'member-002',
      name: '佐藤花子',
      email: 'sato@example.com',
      department: '設計部',
      title: '設計エンジニア',
      skills: [MemberSkill.DESIGN, MemberSkill.QUALITY_ASSURANCE],
      availability: 40,
      currentLoad: 0,
      assignedTasks: [],
      larkUserId: 'lark-002',
      avatarUrl: 'https://example.com/avatar2.jpg',
    },
    {
      id: 'member-003',
      name: '鈴木一郎',
      email: 'suzuki@example.com',
      department: '製造部',
      title: '製造エンジニア',
      skills: [MemberSkill.MANUFACTURING, MemberSkill.QUALITY_ASSURANCE],
      availability: 40,
      currentLoad: 0,
      assignedTasks: [],
      larkUserId: 'lark-003',
      avatarUrl: 'https://example.com/avatar3.jpg',
    },
    {
      id: 'member-004',
      name: '田中次郎',
      email: 'tanaka@example.com',
      department: '施工部',
      title: '施工マネージャー',
      skills: [MemberSkill.CONSTRUCTION, MemberSkill.PROJECT_MANAGEMENT],
      availability: 40,
      currentLoad: 0,
      assignedTasks: [],
      larkUserId: 'lark-004',
      avatarUrl: 'https://example.com/avatar4.jpg',
    },
    {
      id: 'member-005',
      name: '高橋美咲',
      email: 'takahashi@example.com',
      department: '品質保証部',
      title: 'QAスペシャリスト',
      skills: [MemberSkill.QUALITY_ASSURANCE, MemberSkill.PROJECT_MANAGEMENT],
      availability: 40,
      currentLoad: 0,
      assignedTasks: [],
      larkUserId: 'lark-005',
      avatarUrl: 'https://example.com/avatar5.jpg',
    },
  ];
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

  // メンバー管理の初期化
  console.log('👥 メンバー管理システムを初期化中...');
  const memberManager = new MemberManager();

  // デモメンバーを追加
  const demoMembers = createDemoMembers();
  demoMembers.forEach(member => memberManager.addMember(member));
  console.log(`✅ ${demoMembers.length}人のメンバーを登録しました\n`);

  // メンバー一覧を表示
  console.log('📋 登録メンバー:');
  memberManager.getAllMembers().forEach(member => {
    const skillNames = member.skills.map(s => {
      const skillMap: Record<MemberSkill, string> = {
        [MemberSkill.SALES]: '営業',
        [MemberSkill.DESIGN]: '設計',
        [MemberSkill.MANUFACTURING]: '製造',
        [MemberSkill.CONSTRUCTION]: '施工',
        [MemberSkill.PROJECT_MANAGEMENT]: 'PM',
        [MemberSkill.QUALITY_ASSURANCE]: '品質保証',
      };
      return skillMap[s];
    }).join(', ');
    console.log(`  - ${member.name} (${member.department}) - スキル: ${skillNames}`);
  });
  console.log('');

  // 未割り当てタスクに対する推奨メンバーを表示（最初の3タスクのみ）
  console.log('🎯 タスク割り当て推奨（サンプル）:');
  const unassignedTasks = project.tasks.filter(t => !t.assignee).slice(0, 3);
  unassignedTasks.forEach(task => {
    const recommendations = memberManager.recommendMembersForTask(task, 3);
    console.log(`\n  タスク: ${task.title} (${PhaseManager.getPhaseNameJa(task.phase)})`);
    recommendations.forEach((rec, index) => {
      console.log(`    ${index + 1}. ${rec.member.name} - スコア: ${rec.score}/100`);
      console.log(`       理由: ${rec.reason}`);
      console.log(`       完了予想: ${rec.estimatedCompletion.toLocaleDateString('ja-JP')}`);
    });
  });
  console.log('');

  // 自動負荷分散を実行
  console.log('⚖️  タスクの自動負荷分散を実行中...');
  const assignments = memberManager.balanceLoad(project.tasks);
  console.log(`✅ ${assignments.size}人のメンバーにタスクを割り当てました\n`);

  // 各メンバーの負荷状況を表示
  console.log('📊 メンバー負荷状況:');
  memberManager.getAllMembers().forEach(member => {
    const utilizationRate = member.availability > 0
      ? Math.round((member.currentLoad / member.availability) * 100)
      : 0;
    const filledBars = Math.min(20, Math.floor(utilizationRate / 5));
    const emptyBars = Math.max(0, 20 - filledBars);
    const loadBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);
    const warningIcon = utilizationRate >= 100 ? ' ⚠️ ' : '';
    console.log(`  ${member.name}: [${loadBar}] ${utilizationRate}%${warningIcon} (${member.currentLoad}h/${member.availability}h)`);
    console.log(`    割当タスク数: ${member.assignedTasks.length}`);
  });
  console.log('');

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
