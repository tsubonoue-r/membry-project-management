import {
  Project,
  ProjectPhase,
  PhaseInfo,
  Task,
  TaskStatus,
  TaskPriority,
  WorkflowConfig,
} from '../types/index.js';

/**
 * フェーズ管理システム
 * 営業→設計→製造→施工のワークフローを管理
 */
export class PhaseManager {
  private config: WorkflowConfig;

  // フェーズの順序定義
  private static readonly PHASE_ORDER = [
    ProjectPhase.SALES,
    ProjectPhase.DESIGN,
    ProjectPhase.MANUFACTURING,
    ProjectPhase.CONSTRUCTION,
  ];

  // 各フェーズの標準タスクテンプレート
  private static readonly PHASE_TEMPLATES: Record<
    ProjectPhase,
    { name: string; description: string; estimatedHours?: number }[]
  > = {
    [ProjectPhase.SALES]: [
      { name: '顧客ヒアリング', description: '要件と予算の確認', estimatedHours: 4 },
      { name: '見積書作成', description: '詳細見積もりの作成', estimatedHours: 8 },
      { name: 'プレゼンテーション', description: '提案資料の作成と提示', estimatedHours: 6 },
      { name: '契約締結', description: '契約書の作成と締結', estimatedHours: 4 },
      { name: 'キックオフミーティング', description: 'プロジェクト開始会議', estimatedHours: 2 },
    ],
    [ProjectPhase.DESIGN]: [
      { name: '基本設計', description: '全体構想と基本仕様の策定', estimatedHours: 40 },
      { name: '詳細設計', description: '詳細仕様書の作成', estimatedHours: 80 },
      { name: '図面作成', description: '設計図面の作成', estimatedHours: 60 },
      { name: '設計レビュー', description: '社内レビューと顧客確認', estimatedHours: 8 },
      { name: '設計承認', description: '最終設計の承認取得', estimatedHours: 4 },
    ],
    [ProjectPhase.MANUFACTURING]: [
      { name: '材料調達', description: '必要材料の発注と手配', estimatedHours: 16 },
      { name: '製造計画', description: '製造スケジュールと工程計画', estimatedHours: 8 },
      { name: '製造実行', description: '実際の製造作業', estimatedHours: 160 },
      { name: '品質検査', description: '中間検査と最終検査', estimatedHours: 16 },
      { name: '梱包・出荷準備', description: '完成品の梱包と出荷手配', estimatedHours: 8 },
    ],
    [ProjectPhase.CONSTRUCTION]: [
      { name: '現場準備', description: '施工に必要な準備作業', estimatedHours: 16 },
      { name: '施工実行', description: '実際の施工作業', estimatedHours: 200 },
      { name: '中間検査', description: '施工中の品質確認', estimatedHours: 8 },
      { name: '最終検査', description: '完成後の総合検査', estimatedHours: 8 },
      { name: '引き渡し', description: '顧客への引き渡しと説明', estimatedHours: 4 },
      { name: 'アフターフォロー', description: '施工後のサポート対応', estimatedHours: 8 },
    ],
  };

  constructor(config: WorkflowConfig) {
    this.config = config;
  }

  /**
   * プロジェクトに標準タスクを自動生成
   */
  generateStandardTasks(project: Project): Task[] {
    const tasks: Task[] = [];

    for (const phase of PhaseManager.PHASE_ORDER) {
      const templates = PhaseManager.PHASE_TEMPLATES[phase];
      const phaseInfo = project.phases[phase];

      templates.forEach((template, index) => {
        const task: Task = {
          id: `${project.id}-${phase}-${index + 1}`,
          title: template.name,
          description: template.description,
          phase,
          status: TaskStatus.NOT_STARTED,
          priority: TaskPriority.MEDIUM,
          dependencies: [],
          subtasks: [],
          progress: 0,
          estimatedHours: template.estimatedHours,
          tags: [phase],
        };

        // 前のタスクへの依存関係を設定
        if (index > 0) {
          task.dependencies.push(`${project.id}-${phase}-${index}`);
        }

        // 前のフェーズの最後のタスクへの依存関係
        if (phase !== ProjectPhase.SALES) {
          const prevPhaseIndex = PhaseManager.PHASE_ORDER.indexOf(phase) - 1;
          const prevPhase = PhaseManager.PHASE_ORDER[prevPhaseIndex];
          const prevPhaseTasks = PhaseManager.PHASE_TEMPLATES[prevPhase];
          const lastPrevPhaseTaskId = `${project.id}-${prevPhase}-${prevPhaseTasks.length}`;
          task.dependencies.push(lastPrevPhaseTaskId);
        }

        tasks.push(task);
      });
    }

    return tasks;
  }

  /**
   * フェーズの進捗を計算
   */
  calculatePhaseProgress(phase: ProjectPhase, tasks: Task[]): number {
    const phaseTasks = tasks.filter(t => t.phase === phase);

    if (phaseTasks.length === 0) {
      return 0;
    }

    const totalProgress = phaseTasks.reduce((sum, task) => sum + task.progress, 0);
    return Math.round(totalProgress / phaseTasks.length);
  }

  /**
   * フェーズステータスを更新
   */
  updatePhaseStatus(phaseInfo: PhaseInfo, tasks: Task[]): PhaseInfo {
    const progress = this.calculatePhaseProgress(phaseInfo.phase, tasks);
    const phaseTasks = tasks.filter(t => t.phase === phaseInfo.phase);

    let status: TaskStatus = TaskStatus.NOT_STARTED;

    if (phaseTasks.every(t => t.status === TaskStatus.COMPLETED)) {
      status = TaskStatus.COMPLETED;
    } else if (phaseTasks.some(t => t.status === TaskStatus.IN_PROGRESS)) {
      status = TaskStatus.IN_PROGRESS;
    } else if (phaseTasks.some(t => t.status === TaskStatus.BLOCKED)) {
      status = TaskStatus.BLOCKED;
    } else if (phaseTasks.some(t => t.status === TaskStatus.COMPLETED)) {
      status = TaskStatus.IN_PROGRESS;
    }

    return {
      ...phaseInfo,
      progress,
      status,
    };
  }

  /**
   * 次のフェーズに遷移可能か判定
   */
  canTransitionToNextPhase(currentPhase: ProjectPhase, tasks: Task[]): boolean {
    const phaseTasks = tasks.filter(t => t.phase === currentPhase);

    // すべてのタスクが完了している必要がある
    return phaseTasks.every(t => t.status === TaskStatus.COMPLETED);
  }

  /**
   * 次のフェーズに自動遷移
   */
  async transitionToNextPhase(
    project: Project,
    currentPhase: ProjectPhase,
    onApprovalRequired?: (phase: ProjectPhase, approvers: string[]) => Promise<boolean>
  ): Promise<{ success: boolean; nextPhase?: ProjectPhase; message: string }> {
    const currentIndex = PhaseManager.PHASE_ORDER.indexOf(currentPhase);

    // 最後のフェーズか確認
    if (currentIndex === PhaseManager.PHASE_ORDER.length - 1) {
      return {
        success: false,
        message: '既に最終フェーズです',
      };
    }

    // 遷移可能か確認
    if (!this.canTransitionToNextPhase(currentPhase, project.tasks)) {
      return {
        success: false,
        message: '現在のフェーズの全タスクが完了していません',
      };
    }

    const nextPhase = PhaseManager.PHASE_ORDER[currentIndex + 1];

    // 承認が必要な場合
    if (this.config.requireApproval && this.config.approvers?.[nextPhase]) {
      const approvers = this.config.approvers[nextPhase];

      if (onApprovalRequired) {
        const approved = await onApprovalRequired(nextPhase, approvers);

        if (!approved) {
          return {
            success: false,
            message: `${nextPhase}フェーズへの遷移が承認されませんでした`,
          };
        }
      }
    }

    // フェーズを遷移
    project.phases[nextPhase].startDate = new Date();

    return {
      success: true,
      nextPhase,
      message: `${currentPhase}から${nextPhase}へ遷移しました`,
    };
  }

  /**
   * フェーズ名を日本語で取得
   */
  static getPhaseNameJa(phase: ProjectPhase): string {
    const names: Record<ProjectPhase, string> = {
      [ProjectPhase.SALES]: '営業',
      [ProjectPhase.DESIGN]: '設計',
      [ProjectPhase.MANUFACTURING]: '製造',
      [ProjectPhase.CONSTRUCTION]: '施工',
    };
    return names[phase];
  }

  /**
   * プロジェクト全体の進捗を計算
   */
  calculateOverallProgress(project: Project): number {
    const phaseProgresses = Object.values(project.phases).map(p => p.progress);

    if (phaseProgresses.length === 0) {
      return 0;
    }

    return Math.round(
      phaseProgresses.reduce((sum, progress) => sum + progress, 0) / phaseProgresses.length
    );
  }

  /**
   * クリティカルパスを計算（依存関係から最長経路を特定）
   */
  calculateCriticalPath(tasks: Task[]): Task[] {
    const criticalTasks: Task[] = [];
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    // 依存関係のない最初のタスクから開始
    const rootTasks = tasks.filter(t => t.dependencies.length === 0);

    for (const rootTask of rootTasks) {
      const path = this.findLongestPath(rootTask, taskMap);
      if (path.length > criticalTasks.length) {
        criticalTasks.length = 0;
        criticalTasks.push(...path);
      }
    }

    return criticalTasks;
  }

  /**
   * 最長パスを再帰的に検索
   */
  private findLongestPath(task: Task, taskMap: Map<string, Task>): Task[] {
    const dependentTasks = Array.from(taskMap.values()).filter(t =>
      t.dependencies.includes(task.id)
    );

    if (dependentTasks.length === 0) {
      return [task];
    }

    let longestPath: Task[] = [];

    for (const depTask of dependentTasks) {
      const path = this.findLongestPath(depTask, taskMap);
      if (path.length > longestPath.length) {
        longestPath = path;
      }
    }

    return [task, ...longestPath];
  }
}
