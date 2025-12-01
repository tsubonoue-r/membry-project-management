import {
  Project,
  Task,
  ProjectPhase,
  TaskStatus,
  TaskPriority,
  DashboardStats,
} from '../types/index.js';
import { PhaseManager } from '../workflows/phase-manager.js';

/**
 * プロジェクトダッシュボード
 * 進捗状況の可視化と統計情報の提供
 */
export class ProjectDashboard {
  private phaseManager: PhaseManager;

  constructor(phaseManager: PhaseManager) {
    this.phaseManager = phaseManager;
  }

  /**
   * ダッシュボード統計情報を生成
   */
  generateStats(project: Project): DashboardStats {
    const tasks = project.tasks;

    return {
      projectId: project.id,
      totalTasks: tasks.length,
      completedTasks: this.countTasksByStatus(tasks, TaskStatus.COMPLETED),
      inProgressTasks: this.countTasksByStatus(tasks, TaskStatus.IN_PROGRESS),
      blockedTasks: this.countTasksByStatus(tasks, TaskStatus.BLOCKED),
      overallProgress: this.phaseManager.calculateOverallProgress(project),
      phaseProgress: this.calculatePhaseProgress(project),
      upcomingDeadlines: this.getUpcomingDeadlines(tasks, 7),
      criticalTasks: this.getCriticalTasks(tasks),
      resourceUtilization: this.calculateResourceUtilization(tasks),
    };
  }

  /**
   * ステータス別にタスクをカウント
   */
  private countTasksByStatus(tasks: Task[], status: TaskStatus): number {
    return tasks.filter(t => t.status === status).length;
  }

  /**
   * 各フェーズの進捗を計算
   */
  private calculatePhaseProgress(project: Project): Record<ProjectPhase, number> {
    const progress: Record<ProjectPhase, number> = {
      [ProjectPhase.SALES]: 0,
      [ProjectPhase.DESIGN]: 0,
      [ProjectPhase.MANUFACTURING]: 0,
      [ProjectPhase.CONSTRUCTION]: 0,
    };

    for (const phase of Object.values(ProjectPhase)) {
      progress[phase] = this.phaseManager.calculatePhaseProgress(phase, project.tasks);
    }

    return progress;
  }

  /**
   * 期限が近いタスクを取得
   */
  private getUpcomingDeadlines(tasks: Task[], days: number): Task[] {
    const now = Date.now();
    const threshold = now + days * 24 * 60 * 60 * 1000;

    return tasks
      .filter(t => {
        if (!t.dueDate || t.status === TaskStatus.COMPLETED) {
          return false;
        }
        const dueTime = t.dueDate.getTime();
        return dueTime >= now && dueTime <= threshold;
      })
      .sort((a, b) => {
        const aTime = a.dueDate?.getTime() || 0;
        const bTime = b.dueDate?.getTime() || 0;
        return aTime - bTime;
      });
  }

  /**
   * クリティカルなタスクを取得
   */
  private getCriticalTasks(tasks: Task[]): Task[] {
    return tasks.filter(
      t =>
        t.priority === TaskPriority.CRITICAL &&
        t.status !== TaskStatus.COMPLETED &&
        t.status !== TaskStatus.CANCELLED
    );
  }

  /**
   * リソース使用率を計算
   */
  private calculateResourceUtilization(tasks: Task[]): DashboardStats['resourceUtilization'] {
    const utilization: DashboardStats['resourceUtilization'] = {};

    tasks.forEach(task => {
      if (!task.assignee) {
        return;
      }

      if (!utilization[task.assignee]) {
        utilization[task.assignee] = {
          totalTasks: 0,
          completedTasks: 0,
          estimatedHours: 0,
          actualHours: 0,
        };
      }

      utilization[task.assignee].totalTasks++;

      if (task.status === TaskStatus.COMPLETED) {
        utilization[task.assignee].completedTasks++;
      }

      utilization[task.assignee].estimatedHours += task.estimatedHours || 0;
      utilization[task.assignee].actualHours += task.actualHours || 0;
    });

    return utilization;
  }

  /**
   * テキストベースのダッシュボードを生成
   */
  generateTextDashboard(stats: DashboardStats, project: Project): string {
    const lines: string[] = [];

    lines.push('━'.repeat(60));
    lines.push(`📊 プロジェクトダッシュボード: ${project.name}`);
    lines.push('━'.repeat(60));
    lines.push('');

    // 全体進捗
    lines.push('【全体進捗】');
    lines.push(this.createProgressBar(stats.overallProgress));
    lines.push(`  進捗率: ${stats.overallProgress}%`);
    lines.push(`  完了タスク: ${stats.completedTasks}/${stats.totalTasks}`);
    lines.push(`  進行中: ${stats.inProgressTasks} | ブロック: ${stats.blockedTasks}`);
    lines.push('');

    // フェーズ別進捗
    lines.push('【フェーズ別進捗】');
    for (const phase of Object.values(ProjectPhase)) {
      const phaseName = PhaseManager.getPhaseNameJa(phase);
      const progress = stats.phaseProgress[phase];
      const phaseInfo = project.phases[phase];

      lines.push(`  ${this.getPhaseEmoji(phase)} ${phaseName}`);
      lines.push(`  ${this.createProgressBar(progress, 40)}`);
      lines.push(`  進捗: ${progress}% | ステータス: ${this.getStatusText(phaseInfo.status)}`);
      lines.push('');
    }

    // 期限が近いタスク
    if (stats.upcomingDeadlines.length > 0) {
      lines.push('【期限接近タスク（7日以内）】');
      stats.upcomingDeadlines.slice(0, 5).forEach(task => {
        const days = task.dueDate
          ? Math.ceil((task.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 0;
        lines.push(`  ⏰ ${task.title}`);
        lines.push(`     期限: ${task.dueDate?.toLocaleDateString('ja-JP')} (残り${days}日)`);
        lines.push(`     担当: ${task.assignee || '未割当'}`);
      });
      lines.push('');
    }

    // クリティカルタスク
    if (stats.criticalTasks.length > 0) {
      lines.push('【🚨 クリティカルタスク】');
      stats.criticalTasks.forEach(task => {
        lines.push(`  🔴 ${task.title}`);
        lines.push(`     フェーズ: ${PhaseManager.getPhaseNameJa(task.phase)}`);
        lines.push(`     ステータス: ${this.getStatusText(task.status)}`);
        lines.push(`     担当: ${task.assignee || '未割当'}`);
      });
      lines.push('');
    }

    // リソース使用率
    lines.push('【リソース使用状況】');
    Object.entries(stats.resourceUtilization).forEach(([assignee, util]) => {
      const completionRate = util.totalTasks > 0
        ? Math.round((util.completedTasks / util.totalTasks) * 100)
        : 0;

      lines.push(`  👤 ${assignee}`);
      lines.push(`     タスク: ${util.completedTasks}/${util.totalTasks} 完了 (${completionRate}%)`);
      lines.push(`     工数: 実績 ${util.actualHours}h / 見積 ${util.estimatedHours}h`);
    });

    lines.push('');
    lines.push('━'.repeat(60));

    return lines.join('\n');
  }

  /**
   * プログレスバーを生成
   */
  private createProgressBar(progress: number, length: number = 50): string {
    const filled = Math.round((progress / 100) * length);
    const empty = length - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `  [${bar}]`;
  }

  /**
   * フェーズに対応する絵文字を取得
   */
  private getPhaseEmoji(phase: ProjectPhase): string {
    const emojis: Record<ProjectPhase, string> = {
      [ProjectPhase.SALES]: '💼',
      [ProjectPhase.DESIGN]: '📐',
      [ProjectPhase.MANUFACTURING]: '🏭',
      [ProjectPhase.CONSTRUCTION]: '🏗️',
    };
    return emojis[phase];
  }

  /**
   * ステータスのテキスト表現を取得
   */
  private getStatusText(status: TaskStatus): string {
    const texts: Record<TaskStatus, string> = {
      [TaskStatus.NOT_STARTED]: '未着手',
      [TaskStatus.IN_PROGRESS]: '進行中',
      [TaskStatus.BLOCKED]: 'ブロック',
      [TaskStatus.COMPLETED]: '完了',
      [TaskStatus.CANCELLED]: 'キャンセル',
    };
    return texts[status];
  }

  /**
   * JSON形式でダッシュボードデータをエクスポート
   */
  exportJson(stats: DashboardStats, project: Project): string {
    return JSON.stringify(
      {
        projectName: project.name,
        projectId: project.id,
        generatedAt: new Date().toISOString(),
        stats,
        phases: Object.fromEntries(
          Object.entries(project.phases).map(([key, phase]) => [
            key,
            {
              name: PhaseManager.getPhaseNameJa(phase.phase),
              status: this.getStatusText(phase.status),
              progress: phase.progress,
              startDate: phase.startDate,
              endDate: phase.endDate,
            },
          ])
        ),
      },
      null,
      2
    );
  }

  /**
   * HTML形式でダッシュボードを生成
   */
  generateHtmlDashboard(stats: DashboardStats, project: Project): string {
    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.name} - プロジェクトダッシュボード</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        h1, h2 {
            color: #333;
        }
        .card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .progress-bar {
            width: 100%;
            height: 30px;
            background: #e0e0e0;
            border-radius: 15px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #4CAF50, #8BC34A);
            transition: width 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
        }
        .phase-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }
        .phase-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
        }
        .task-list {
            list-style: none;
            padding: 0;
        }
        .task-item {
            background: #f9f9f9;
            padding: 15px;
            margin: 10px 0;
            border-left: 4px solid #4CAF50;
            border-radius: 4px;
        }
        .critical {
            border-left-color: #f44336;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat-box {
            background: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #4CAF50;
        }
        .stat-label {
            color: #666;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <h1>📊 ${project.name}</h1>
    <p>生成日時: ${new Date().toLocaleString('ja-JP')}</p>

    <div class="stats-grid">
        <div class="stat-box">
            <div class="stat-value">${stats.overallProgress}%</div>
            <div class="stat-label">全体進捗</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${stats.completedTasks}</div>
            <div class="stat-label">完了タスク</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${stats.inProgressTasks}</div>
            <div class="stat-label">進行中</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${stats.blockedTasks}</div>
            <div class="stat-label">ブロック</div>
        </div>
    </div>

    <div class="card">
        <h2>全体進捗</h2>
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${stats.overallProgress}%">
                ${stats.overallProgress}%
            </div>
        </div>
    </div>

    <h2>フェーズ別進捗</h2>
    <div class="phase-grid">
        ${Object.values(ProjectPhase)
          .map(
            phase => `
            <div class="phase-card">
                <h3>${this.getPhaseEmoji(phase)} ${PhaseManager.getPhaseNameJa(phase)}</h3>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${stats.phaseProgress[phase]}%">
                        ${stats.phaseProgress[phase]}%
                    </div>
                </div>
                <p>ステータス: ${this.getStatusText(project.phases[phase].status)}</p>
            </div>
        `
          )
          .join('')}
    </div>

    ${
      stats.criticalTasks.length > 0
        ? `
    <div class="card">
        <h2>🚨 クリティカルタスク</h2>
        <ul class="task-list">
            ${stats.criticalTasks
              .map(
                task => `
                <li class="task-item critical">
                    <strong>${task.title}</strong><br>
                    フェーズ: ${PhaseManager.getPhaseNameJa(task.phase)} |
                    担当: ${task.assignee || '未割当'}
                </li>
            `
              )
              .join('')}
        </ul>
    </div>
    `
        : ''
    }

    ${
      stats.upcomingDeadlines.length > 0
        ? `
    <div class="card">
        <h2>⏰ 期限接近タスク</h2>
        <ul class="task-list">
            ${stats.upcomingDeadlines
              .map(
                task => `
                <li class="task-item">
                    <strong>${task.title}</strong><br>
                    期限: ${task.dueDate?.toLocaleDateString('ja-JP')} |
                    担当: ${task.assignee || '未割当'}
                </li>
            `
              )
              .join('')}
        </ul>
    </div>
    `
        : ''
    }

    <div class="card">
        <h2>👥 リソース使用状況</h2>
        ${Object.entries(stats.resourceUtilization)
          .map(
            ([assignee, util]) => `
            <div style="margin: 20px 0;">
                <h3>${assignee}</h3>
                <p>完了率: ${Math.round((util.completedTasks / util.totalTasks) * 100)}%
                   (${util.completedTasks}/${util.totalTasks})</p>
                <p>工数: 実績 ${util.actualHours}h / 見積 ${util.estimatedHours}h</p>
                <div class="progress-bar">
                    <div class="progress-fill"
                         style="width: ${Math.round((util.completedTasks / util.totalTasks) * 100)}%">
                        ${Math.round((util.completedTasks / util.totalTasks) * 100)}%
                    </div>
                </div>
            </div>
        `
          )
          .join('')}
    </div>
</body>
</html>
    `.trim();
  }
}
