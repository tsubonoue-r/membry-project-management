/**
 * プロジェクトフェーズの定義
 */
export enum ProjectPhase {
  SALES = 'sales',           // 営業
  DESIGN = 'design',         // 設計
  MANUFACTURING = 'manufacturing', // 製造
  CONSTRUCTION = 'construction'    // 施工
}

/**
 * タスクステータス
 */
export enum TaskStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

/**
 * タスク優先度
 */
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * タスク定義
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  phase: ProjectPhase;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  assigneeId?: string;
  startDate?: Date;
  dueDate?: Date;
  completedDate?: Date;
  dependencies: string[]; // 依存タスクのID
  subtasks: Task[];
  progress: number; // 0-100
  estimatedHours?: number;
  actualHours?: number;
  tags: string[];
  larkMessageId?: string; // Lark内のメッセージID
  larkTaskId?: string;    // Larkタスク管理のID
}

/**
 * プロジェクト定義
 */
export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  phases: {
    [key in ProjectPhase]: PhaseInfo;
  };
  tasks: Task[];
  startDate: Date;
  targetEndDate: Date;
  actualEndDate?: Date;
  larkGroupId?: string; // Larkグループチャット ID
}

/**
 * フェーズ情報
 */
export interface PhaseInfo {
  phase: ProjectPhase;
  name: string;
  status: TaskStatus;
  startDate?: Date;
  endDate?: Date;
  progress: number; // 0-100
  tasks: string[]; // Task IDs
  responsible?: string; // 責任者
}

/**
 * ダッシュボード統計情報
 */
export interface DashboardStats {
  projectId: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  overallProgress: number;
  phaseProgress: {
    [key in ProjectPhase]: number;
  };
  upcomingDeadlines: Task[];
  criticalTasks: Task[];
  resourceUtilization: {
    [assignee: string]: {
      totalTasks: number;
      completedTasks: number;
      estimatedHours: number;
      actualHours: number;
    };
  };
}

/**
 * Lark通知設定
 */
export interface LarkNotificationConfig {
  enabled: boolean;
  webhookUrl?: string;
  groupId?: string;
  notifyOnTaskCreated: boolean;
  notifyOnTaskCompleted: boolean;
  notifyOnTaskBlocked: boolean;
  notifyOnDeadlineApproaching: boolean;
  deadlineWarningDays: number; // 期限の何日前に通知するか
}

/**
 * ワークフロー設定
 */
export interface WorkflowConfig {
  autoTransition: boolean; // 自動フェーズ遷移
  requireApproval: boolean; // 承認必須
  approvers: {
    [key in ProjectPhase]?: string[]; // フェーズごとの承認者
  };
}
