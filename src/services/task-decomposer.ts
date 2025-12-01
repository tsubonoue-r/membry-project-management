import { Task, TaskStatus, TaskPriority, ProjectPhase } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * タスク分解サービス
 * 大きなタスクを小さなサブタスクに自動分解
 */
export class TaskDecomposer {
  /**
   * タスクを自動分解
   */
  decomposeTask(parentTask: Task, depth: number = 3): Task {
    // 既にサブタスクがある場合はスキップ
    if (parentTask.subtasks.length > 0) {
      return parentTask;
    }

    const subtasks = this.generateSubtasks(parentTask, depth);

    return {
      ...parentTask,
      subtasks,
      progress: this.calculateProgress(subtasks),
    };
  }

  /**
   * サブタスクを生成
   */
  private generateSubtasks(parentTask: Task, maxSubtasks: number): Task[] {
    const subtasks: Task[] = [];

    // フェーズに応じたサブタスク生成ロジック
    const subtaskTemplates = this.getSubtaskTemplates(parentTask);

    subtaskTemplates.slice(0, maxSubtasks).forEach((template, index) => {
      const subtask: Task = {
        id: `${parentTask.id}-sub-${index + 1}`,
        title: template.title,
        description: template.description,
        phase: parentTask.phase,
        status: TaskStatus.NOT_STARTED,
        priority: this.derivePriority(parentTask.priority, index, subtaskTemplates.length),
        dependencies: index > 0 ? [`${parentTask.id}-sub-${index}`] : [],
        subtasks: [],
        progress: 0,
        estimatedHours: template.estimatedHours,
        tags: [...parentTask.tags, 'subtask'],
      };

      subtasks.push(subtask);
    });

    return subtasks;
  }

  /**
   * フェーズとタスク名に基づいてサブタスクテンプレートを取得
   */
  private getSubtaskTemplates(parentTask: Task): Array<{
    title: string;
    description: string;
    estimatedHours?: number;
  }> {
    const phase = parentTask.phase;
    const title = parentTask.title;

    // 一般的なサブタスクパターン
    const commonTemplates = [
      {
        title: `${title} - 計画策定`,
        description: '作業計画とスケジュールの策定',
        estimatedHours: (parentTask.estimatedHours || 8) * 0.1,
      },
      {
        title: `${title} - 実行`,
        description: '実際の作業実施',
        estimatedHours: (parentTask.estimatedHours || 8) * 0.7,
      },
      {
        title: `${title} - レビュー・検証`,
        description: '成果物のレビューと品質検証',
        estimatedHours: (parentTask.estimatedHours || 8) * 0.15,
      },
      {
        title: `${title} - 完了報告`,
        description: '作業完了報告と成果物の提出',
        estimatedHours: (parentTask.estimatedHours || 8) * 0.05,
      },
    ];

    // フェーズ特有のサブタスクパターン
    const phaseSpecificTemplates = this.getPhaseSpecificTemplates(phase, title, parentTask);

    return phaseSpecificTemplates.length > 0 ? phaseSpecificTemplates : commonTemplates;
  }

  /**
   * フェーズ特有のサブタスクテンプレート
   */
  private getPhaseSpecificTemplates(
    phase: ProjectPhase,
    title: string,
    parentTask: Task
  ): Array<{ title: string; description: string; estimatedHours?: number }> {
    const templates: Record<
      ProjectPhase,
      Record<string, Array<{ title: string; description: string; estimatedHours?: number }>>
    > = {
      [ProjectPhase.SALES]: {
        顧客ヒアリング: [
          { title: '事前情報収集', description: '顧客情報の調査', estimatedHours: 1 },
          { title: 'ヒアリング実施', description: '顧客へのヒアリング', estimatedHours: 2 },
          { title: '議事録作成', description: 'ヒアリング内容の記録', estimatedHours: 1 },
        ],
        見積書作成: [
          { title: '原価計算', description: '材料費と人件費の算出', estimatedHours: 3 },
          { title: '利益率設定', description: '適切な利益率の設定', estimatedHours: 1 },
          { title: '見積書ドラフト', description: '見積書の初稿作成', estimatedHours: 2 },
          { title: '上司レビュー', description: '見積内容の承認取得', estimatedHours: 1 },
          { title: '見積書送付', description: '顧客への見積書送付', estimatedHours: 1 },
        ],
      },
      [ProjectPhase.DESIGN]: {
        基本設計: [
          { title: '要件整理', description: '顧客要件の整理と分析', estimatedHours: 8 },
          { title: 'コンセプト策定', description: '設計コンセプトの決定', estimatedHours: 12 },
          { title: '基本仕様書作成', description: '基本仕様書のドラフト', estimatedHours: 16 },
          { title: '顧客レビュー', description: '顧客への説明と承認', estimatedHours: 4 },
        ],
        詳細設計: [
          { title: '詳細仕様策定', description: '詳細な仕様の決定', estimatedHours: 24 },
          { title: '設計計算', description: '必要な計算と検証', estimatedHours: 16 },
          { title: '仕様書作成', description: '詳細仕様書の作成', estimatedHours: 32 },
          { title: '技術レビュー', description: '技術的妥当性の検証', estimatedHours: 8 },
        ],
      },
      [ProjectPhase.MANUFACTURING]: {
        製造実行: [
          { title: '材料準備', description: '必要材料の準備と確認', estimatedHours: 8 },
          { title: '加工作業', description: '部品の加工', estimatedHours: 80 },
          { title: '組立作業', description: '部品の組立', estimatedHours: 40 },
          { title: '調整作業', description: '機能調整と最適化', estimatedHours: 24 },
          { title: '試運転', description: '動作確認と試運転', estimatedHours: 8 },
        ],
        品質検査: [
          { title: '外観検査', description: '外観の検査', estimatedHours: 2 },
          { title: '寸法検査', description: '寸法の測定と検査', estimatedHours: 4 },
          { title: '機能検査', description: '機能と性能の検査', estimatedHours: 6 },
          { title: '検査記録作成', description: '検査結果の記録', estimatedHours: 2 },
          { title: '不具合対応', description: '不具合の修正対応', estimatedHours: 2 },
        ],
      },
      [ProjectPhase.CONSTRUCTION]: {
        施工実行: [
          { title: '施工準備', description: '現場の準備作業', estimatedHours: 16 },
          { title: '基礎工事', description: '基礎部分の施工', estimatedHours: 40 },
          { title: '本体施工', description: 'メイン部分の施工', estimatedHours: 100 },
          { title: '仕上げ工事', description: '仕上げ作業', estimatedHours: 32 },
          { title: '清掃', description: '現場の清掃', estimatedHours: 8 },
          { title: '施工写真記録', description: '施工過程の写真記録', estimatedHours: 4 },
        ],
        最終検査: [
          { title: '施工品質確認', description: '施工品質の確認', estimatedHours: 3 },
          { title: '安全性確認', description: '安全性の検査', estimatedHours: 2 },
          { title: '機能テスト', description: '機能の動作確認', estimatedHours: 2 },
          { title: '検査報告書作成', description: '検査結果のまとめ', estimatedHours: 1 },
        ],
      },
    };

    return templates[phase]?.[title] || [];
  }

  /**
   * サブタスクの優先度を決定
   */
  private derivePriority(
    parentPriority: TaskPriority,
    index: number,
    total: number
  ): TaskPriority {
    // 親タスクがクリティカルな場合、すべてのサブタスクもクリティカル
    if (parentPriority === TaskPriority.CRITICAL) {
      return TaskPriority.CRITICAL;
    }

    // 最初のサブタスクは親と同じ優先度
    if (index === 0) {
      return parentPriority;
    }

    // 最後のサブタスク（完了報告など）は優先度を下げる
    if (index === total - 1) {
      return TaskPriority.LOW;
    }

    return parentPriority;
  }

  /**
   * サブタスクから親タスクの進捗を計算
   */
  calculateProgress(subtasks: Task[]): number {
    if (subtasks.length === 0) {
      return 0;
    }

    const totalProgress = subtasks.reduce((sum, task) => sum + task.progress, 0);
    return Math.round(totalProgress / subtasks.length);
  }

  /**
   * サブタスクのステータスから親タスクのステータスを更新
   */
  updateParentStatus(parentTask: Task): Task {
    if (parentTask.subtasks.length === 0) {
      return parentTask;
    }

    const allCompleted = parentTask.subtasks.every(
      t => t.status === TaskStatus.COMPLETED
    );
    const anyInProgress = parentTask.subtasks.some(
      t => t.status === TaskStatus.IN_PROGRESS
    );
    const anyBlocked = parentTask.subtasks.some(t => t.status === TaskStatus.BLOCKED);

    let newStatus = parentTask.status;

    if (allCompleted) {
      newStatus = TaskStatus.COMPLETED;
    } else if (anyBlocked) {
      newStatus = TaskStatus.BLOCKED;
    } else if (anyInProgress) {
      newStatus = TaskStatus.IN_PROGRESS;
    }

    const progress = this.calculateProgress(parentTask.subtasks);

    return {
      ...parentTask,
      status: newStatus,
      progress,
    };
  }

  /**
   * タスク階層を再帰的に分解
   */
  decomposeRecursively(task: Task, maxDepth: number, currentDepth: number = 0): Task {
    if (currentDepth >= maxDepth) {
      return task;
    }

    const decomposed = this.decomposeTask(task);

    decomposed.subtasks = decomposed.subtasks.map(subtask =>
      this.decomposeRecursively(subtask, maxDepth, currentDepth + 1)
    );

    return decomposed;
  }
}
