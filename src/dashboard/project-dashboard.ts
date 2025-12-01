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
   * ガントチャート用のタイムライン計算
   */
  private calculateGanttTimeline(project: Project): {
    startDate: Date;
    endDate: Date;
    totalDays: number;
    tasks: Array<{
      task: Task;
      startOffset: number;
      duration: number;
      dependencies: string[];
    }>;
  } {
    // プロジェクト全体の開始日と終了日を計算
    let minDate = project.startDate;
    let maxDate = project.targetEndDate;

    project.tasks.forEach(task => {
      if (task.startDate && task.startDate < minDate) {
        minDate = task.startDate;
      }
      if (task.dueDate && task.dueDate > maxDate) {
        maxDate = task.dueDate;
      }
    });

    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));

    const taskData = project.tasks.map(task => {
      const taskStart = task.startDate || project.startDate;
      const taskEnd = task.dueDate || new Date(taskStart.getTime() + 7 * 24 * 60 * 60 * 1000); // デフォルト7日

      const startOffset = Math.ceil((taskStart.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
      const duration = Math.ceil((taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24));

      return {
        task,
        startOffset: Math.max(0, startOffset),
        duration: Math.max(1, duration),
        dependencies: task.dependencies || [],
      };
    });

    return {
      startDate: minDate,
      endDate: maxDate,
      totalDays,
      tasks: taskData,
    };
  }

  /**
   * フェーズの色を取得
   */
  private getPhaseColor(phase: ProjectPhase): string {
    const colors: Record<ProjectPhase, string> = {
      [ProjectPhase.SALES]: '#3498db',
      [ProjectPhase.DESIGN]: '#9b59b6',
      [ProjectPhase.MANUFACTURING]: '#e74c3c',
      [ProjectPhase.CONSTRUCTION]: '#f39c12',
    };
    return colors[phase];
  }

  /**
   * ガントチャートHTMLを生成
   */
  generateGanttChart(project: Project): string {
    const timeline = this.calculateGanttTimeline(project);
    const dayWidth = 30; // 1日あたりのピクセル幅
    const rowHeight = 40; // 1タスクあたりの高さ
    const chartWidth = timeline.totalDays * dayWidth;

    // 月ごとのヘッダーを生成
    const monthHeaders: string[] = [];
    let currentDate = new Date(timeline.startDate);
    let currentMonth = currentDate.getMonth();
    let monthStartDay = 0;

    for (let day = 0; day <= timeline.totalDays; day++) {
      const checkDate = new Date(timeline.startDate.getTime() + day * 24 * 60 * 60 * 1000);
      if (checkDate.getMonth() !== currentMonth) {
        const monthWidth = (day - monthStartDay) * dayWidth;
        const monthName = `${currentDate.getFullYear()}/${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        monthHeaders.push(`<div class="month-header" style="width: ${monthWidth}px;">${monthName}</div>`);

        currentMonth = checkDate.getMonth();
        currentDate = checkDate;
        monthStartDay = day;
      }
    }

    // 最後の月を追加
    const lastMonthWidth = (timeline.totalDays - monthStartDay) * dayWidth;
    const lastMonthName = `${currentDate.getFullYear()}/${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    monthHeaders.push(`<div class="month-header" style="width: ${lastMonthWidth}px;">${lastMonthName}</div>`);

    // タスクバーを生成
    const taskBars = timeline.tasks.map((item, index) => {
      const barLeft = item.startOffset * dayWidth;
      const barWidth = item.duration * dayWidth;
      const barTop = index * rowHeight;
      const color = this.getPhaseColor(item.task.phase);
      const progressWidth = (barWidth * item.task.progress) / 100;

      const statusIcon = item.task.status === TaskStatus.COMPLETED ? '✓' :
                         item.task.status === TaskStatus.IN_PROGRESS ? '▶' :
                         item.task.status === TaskStatus.BLOCKED ? '⚠' : '';

      return `
        <div class="gantt-row" style="height: ${rowHeight}px;">
          <div class="task-label">
            <span class="task-status">${statusIcon}</span>
            ${item.task.title}
            <span class="task-assignee">${item.task.assignee || '未割当'}</span>
          </div>
          <div class="task-bar-container">
            <div class="task-bar"
                 style="left: ${barLeft}px; width: ${barWidth}px; top: ${barTop}px; background-color: ${color};"
                 data-task-id="${item.task.id}"
                 title="${item.task.title}\n開始: ${item.task.startDate?.toLocaleDateString('ja-JP') || 'N/A'}\n期限: ${item.task.dueDate?.toLocaleDateString('ja-JP') || 'N/A'}\n進捗: ${item.task.progress}%">
              <div class="task-progress" style="width: ${progressWidth}px;"></div>
              <span class="task-bar-text">${item.task.progress}%</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="gantt-container">
        <div class="gantt-header">
          <div class="gantt-timeline-header">
            ${monthHeaders.join('')}
          </div>
        </div>
        <div class="gantt-body">
          <div class="gantt-chart" style="width: ${chartWidth}px;">
            ${taskBars}
            <svg class="gantt-dependencies" width="${chartWidth}" height="${timeline.tasks.length * rowHeight}">
              ${this.generateDependencyLines(timeline, dayWidth, rowHeight)}
            </svg>
          </div>
        </div>
        <div class="gantt-legend">
          <div class="legend-item">
            <span class="legend-color" style="background: ${this.getPhaseColor(ProjectPhase.SALES)}"></span>
            ${PhaseManager.getPhaseNameJa(ProjectPhase.SALES)}
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: ${this.getPhaseColor(ProjectPhase.DESIGN)}"></span>
            ${PhaseManager.getPhaseNameJa(ProjectPhase.DESIGN)}
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: ${this.getPhaseColor(ProjectPhase.MANUFACTURING)}"></span>
            ${PhaseManager.getPhaseNameJa(ProjectPhase.MANUFACTURING)}
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: ${this.getPhaseColor(ProjectPhase.CONSTRUCTION)}"></span>
            ${PhaseManager.getPhaseNameJa(ProjectPhase.CONSTRUCTION)}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 依存関係の矢印を生成
   */
  private generateDependencyLines(
    timeline: ReturnType<typeof this.calculateGanttTimeline>,
    dayWidth: number,
    rowHeight: number
  ): string {
    const lines: string[] = [];

    timeline.tasks.forEach((item, index) => {
      item.dependencies.forEach(depId => {
        const depIndex = timeline.tasks.findIndex(t => t.task.id === depId);
        if (depIndex === -1) return;

        const depTask = timeline.tasks[depIndex];

        // 依存元タスクの終了位置
        const x1 = (depTask.startOffset + depTask.duration) * dayWidth;
        const y1 = depIndex * rowHeight + rowHeight / 2;

        // 依存先タスクの開始位置
        const x2 = item.startOffset * dayWidth;
        const y2 = index * rowHeight + rowHeight / 2;

        // 矢印のパス
        lines.push(`
          <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"
                stroke-dasharray="5,5" opacity="0.6"/>
        `);
      });
    });

    return `
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
          <polygon points="0 0, 10 3, 0 6" fill="#666" />
        </marker>
      </defs>
      ${lines.join('')}
    `;
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

        /* ガントチャートスタイル */
        .gantt-container {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow-x: auto;
        }
        .gantt-header {
            margin-bottom: 10px;
        }
        .gantt-timeline-header {
            display: flex;
            border-bottom: 2px solid #ddd;
            margin-bottom: 10px;
        }
        .month-header {
            text-align: center;
            padding: 10px;
            font-weight: bold;
            border-right: 1px solid #ddd;
            background: #f5f5f5;
        }
        .gantt-body {
            position: relative;
            overflow-x: auto;
        }
        .gantt-chart {
            position: relative;
            min-height: 400px;
        }
        .gantt-row {
            position: relative;
            border-bottom: 1px solid #eee;
            display: flex;
        }
        .task-label {
            position: absolute;
            left: -300px;
            width: 280px;
            padding: 10px;
            font-size: 12px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            background: white;
            z-index: 10;
        }
        .task-status {
            margin-right: 5px;
            font-weight: bold;
        }
        .task-assignee {
            font-size: 10px;
            color: #999;
            margin-left: 5px;
        }
        .task-bar-container {
            position: relative;
            width: 100%;
            height: 100%;
        }
        .task-bar {
            position: absolute;
            height: 30px;
            border-radius: 4px;
            cursor: pointer;
            transition: transform 0.2s;
            display: flex;
            align-items: center;
            padding: 0 5px;
            margin-top: 5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .task-bar:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        .task-progress {
            position: absolute;
            left: 0;
            top: 0;
            height: 100%;
            background: rgba(255,255,255,0.3);
            border-radius: 4px 0 0 4px;
        }
        .task-bar-text {
            position: relative;
            color: white;
            font-size: 11px;
            font-weight: bold;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            z-index: 1;
        }
        .gantt-dependencies {
            position: absolute;
            top: 0;
            left: 0;
            pointer-events: none;
        }
        .gantt-legend {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .legend-color {
            width: 20px;
            height: 20px;
            border-radius: 4px;
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

    <div class="card">
        <h2>📅 ガントチャート</h2>
        <div style="margin-left: 300px; overflow-x: auto;">
            ${this.generateGanttChart(project)}
        </div>
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
