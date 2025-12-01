import {
  Member,
  MemberSkill,
  Team,
  Task,
  TaskAssignmentRecommendation,
  ProjectPhase,
  TaskPriority,
} from '../types/index.js';
import { LarkClient } from '../api/lark-client.js';

/**
 * メンバー管理サービス
 * Larkから取得したメンバー情報の管理とタスク割り当て最適化
 */
export class MemberManager {
  private members: Map<string, Member> = new Map();
  private teams: Map<string, Team> = new Map();
  private larkClient?: LarkClient;

  constructor(larkClient?: LarkClient) {
    this.larkClient = larkClient;
  }

  /**
   * Larkからメンバー情報を同期
   */
  async syncMembersFromLark(): Promise<Member[]> {
    if (!this.larkClient) {
      throw new Error('Lark client is not configured');
    }

    const larkMembers = await this.larkClient.getAllMembers();

    const members = larkMembers.map(larkMember => {
      const member: Member = {
        id: larkMember.userId,
        name: larkMember.name,
        email: larkMember.email,
        department: larkMember.department,
        title: larkMember.title,
        skills: this.inferSkillsFromTitle(larkMember.title),
        availability: 40, // デフォルト：週40時間
        currentLoad: 0,
        assignedTasks: [],
        larkUserId: larkMember.userId,
        avatarUrl: larkMember.avatarUrl,
      };

      this.members.set(member.id, member);
      return member;
    });

    return members;
  }

  /**
   * 役職からスキルを推論
   */
  private inferSkillsFromTitle(title?: string): MemberSkill[] {
    if (!title) {
      return [];
    }

    const skills: MemberSkill[] = [];
    const lowerTitle = title.toLowerCase();

    // 営業関連
    if (lowerTitle.includes('営業') || lowerTitle.includes('sales')) {
      skills.push(MemberSkill.SALES);
    }

    // 設計関連
    if (
      lowerTitle.includes('設計') ||
      lowerTitle.includes('デザイン') ||
      lowerTitle.includes('design') ||
      lowerTitle.includes('architect')
    ) {
      skills.push(MemberSkill.DESIGN);
    }

    // 製造関連
    if (
      lowerTitle.includes('製造') ||
      lowerTitle.includes('生産') ||
      lowerTitle.includes('manufacturing') ||
      lowerTitle.includes('engineer')
    ) {
      skills.push(MemberSkill.MANUFACTURING);
    }

    // 施工関連
    if (
      lowerTitle.includes('施工') ||
      lowerTitle.includes('建設') ||
      lowerTitle.includes('construction')
    ) {
      skills.push(MemberSkill.CONSTRUCTION);
    }

    // プロジェクト管理
    if (
      lowerTitle.includes('pm') ||
      lowerTitle.includes('プロジェクトマネージャー') ||
      lowerTitle.includes('project manager') ||
      lowerTitle.includes('マネージャー')
    ) {
      skills.push(MemberSkill.PROJECT_MANAGEMENT);
    }

    // 品質保証
    if (
      lowerTitle.includes('qa') ||
      lowerTitle.includes('品質') ||
      lowerTitle.includes('quality')
    ) {
      skills.push(MemberSkill.QUALITY_ASSURANCE);
    }

    return skills;
  }

  /**
   * メンバーを追加
   */
  addMember(member: Member): void {
    this.members.set(member.id, member);
  }

  /**
   * メンバーを取得
   */
  getMember(memberId: string): Member | undefined {
    return this.members.get(memberId);
  }

  /**
   * 全メンバーを取得
   */
  getAllMembers(): Member[] {
    return Array.from(this.members.values());
  }

  /**
   * スキルでメンバーをフィルタ
   */
  getMembersBySkill(skill: MemberSkill): Member[] {
    return this.getAllMembers().filter(member => member.skills.includes(skill));
  }

  /**
   * メンバーのスキルを更新
   */
  updateMemberSkills(memberId: string, skills: MemberSkill[]): void {
    const member = this.members.get(memberId);
    if (member) {
      member.skills = skills;
    }
  }

  /**
   * メンバーの稼働可能時間を更新
   */
  updateMemberAvailability(memberId: string, hours: number): void {
    const member = this.members.get(memberId);
    if (member) {
      member.availability = hours;
    }
  }

  /**
   * タスクをメンバーにアサイン
   */
  assignTaskToMember(memberId: string, task: Task): void {
    const member = this.members.get(memberId);
    if (member) {
      member.assignedTasks.push(task.id);
      member.currentLoad += task.estimatedHours || 0;
      task.assignee = member.name;
      task.assigneeId = member.id;
    }
  }

  /**
   * タスクのアサインを解除
   */
  unassignTaskFromMember(memberId: string, taskId: string, estimatedHours: number = 0): void {
    const member = this.members.get(memberId);
    if (member) {
      member.assignedTasks = member.assignedTasks.filter(id => id !== taskId);
      member.currentLoad -= estimatedHours;
      if (member.currentLoad < 0) {
        member.currentLoad = 0;
      }
    }
  }

  /**
   * タスクに最適なメンバーを推奨
   */
  recommendMembersForTask(task: Task, topN: number = 3): TaskAssignmentRecommendation[] {
    const recommendations: TaskAssignmentRecommendation[] = [];

    // フェーズに必要なスキルをマッピング
    const requiredSkills = this.getRequiredSkillsForPhase(task.phase);

    for (const member of this.getAllMembers()) {
      const score = this.calculateAssignmentScore(member, task, requiredSkills);

      if (score > 0) {
        // 完了予想日を計算
        const estimatedCompletion = this.estimateCompletionDate(
          member,
          task.estimatedHours || 0
        );

        recommendations.push({
          member,
          score,
          reason: this.generateRecommendationReason(member, task, score, requiredSkills),
          estimatedCompletion,
        });
      }
    }

    // スコアでソート
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations.slice(0, topN);
  }

  /**
   * フェーズに必要なスキルを取得
   */
  private getRequiredSkillsForPhase(phase: ProjectPhase): MemberSkill[] {
    const skillMap: Record<ProjectPhase, MemberSkill[]> = {
      [ProjectPhase.SALES]: [MemberSkill.SALES, MemberSkill.PROJECT_MANAGEMENT],
      [ProjectPhase.DESIGN]: [MemberSkill.DESIGN, MemberSkill.QUALITY_ASSURANCE],
      [ProjectPhase.MANUFACTURING]: [MemberSkill.MANUFACTURING, MemberSkill.QUALITY_ASSURANCE],
      [ProjectPhase.CONSTRUCTION]: [MemberSkill.CONSTRUCTION, MemberSkill.QUALITY_ASSURANCE],
    };

    return skillMap[phase] || [];
  }

  /**
   * アサインメントスコアを計算（0-100）
   */
  private calculateAssignmentScore(
    member: Member,
    task: Task,
    requiredSkills: MemberSkill[]
  ): number {
    let score = 0;

    // スキルマッチング（50点）
    const matchingSkills = member.skills.filter(skill => requiredSkills.includes(skill));
    score += (matchingSkills.length / requiredSkills.length) * 50;

    // 負荷状況（30点）
    const loadRatio = member.currentLoad / member.availability;
    if (loadRatio < 0.7) {
      score += 30; // 余裕あり
    } else if (loadRatio < 0.9) {
      score += 20; // やや余裕あり
    } else if (loadRatio < 1.0) {
      score += 10; // ほぼ満杯
    }
    // 1.0以上（オーバーロード）は0点

    // 優先度マッチング（20点）
    if (task.priority === TaskPriority.CRITICAL) {
      // クリティカルタスクは経験豊富なメンバーを優先
      if (member.skills.length >= 3) {
        score += 20;
      } else if (member.skills.length >= 2) {
        score += 10;
      }
    } else {
      // 通常タスクは負荷の少ないメンバーを優先
      score += Math.max(0, 20 - loadRatio * 20);
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * 推奨理由を生成
   */
  private generateRecommendationReason(
    member: Member,
    task: Task,
    score: number,
    requiredSkills: MemberSkill[]
  ): string {
    const reasons: string[] = [];

    // スキルマッチング
    const matchingSkills = member.skills.filter(skill => requiredSkills.includes(skill));
    if (matchingSkills.length > 0) {
      const skillNames = matchingSkills.map(s => this.getSkillName(s)).join('、');
      reasons.push(`必要なスキル（${skillNames}）を保有`);
    }

    // 負荷状況
    const loadRatio = member.currentLoad / member.availability;
    if (loadRatio < 0.7) {
      reasons.push('作業負荷に余裕あり');
    } else if (loadRatio >= 1.0) {
      reasons.push('⚠️ すでに満杯（オーバーロード）');
    }

    // 経験
    if (member.skills.length >= 3) {
      reasons.push('幅広いスキルセット');
    }

    return reasons.join('、');
  }

  /**
   * スキル名を日本語で取得
   */
  private getSkillName(skill: MemberSkill): string {
    const names: Record<MemberSkill, string> = {
      [MemberSkill.SALES]: '営業',
      [MemberSkill.DESIGN]: '設計',
      [MemberSkill.MANUFACTURING]: '製造',
      [MemberSkill.CONSTRUCTION]: '施工',
      [MemberSkill.PROJECT_MANAGEMENT]: 'PM',
      [MemberSkill.QUALITY_ASSURANCE]: '品質保証',
    };

    return names[skill] || skill;
  }

  /**
   * 完了予想日を計算
   */
  private estimateCompletionDate(member: Member, estimatedHours: number): Date {
    const hoursPerWeek = member.availability - member.currentLoad;
    const weeksRequired = estimatedHours / Math.max(1, hoursPerWeek);
    const daysRequired = Math.ceil(weeksRequired * 7);

    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + daysRequired);

    return completionDate;
  }

  /**
   * チームを作成
   */
  createTeam(team: Team): void {
    this.teams.set(team.id, team);
  }

  /**
   * チームにメンバーを追加
   */
  addMemberToTeam(teamId: string, memberId: string): void {
    const team = this.teams.get(teamId);
    const member = this.members.get(memberId);

    if (team && member) {
      if (!team.members.find(m => m.id === memberId)) {
        team.members.push(member);
      }
    }
  }

  /**
   * チームのメンバー負荷を計算
   */
  getTeamLoadSummary(teamId: string): {
    totalAvailability: number;
    totalLoad: number;
    utilizationRate: number;
    members: Array<{
      name: string;
      availability: number;
      load: number;
      utilizationRate: number;
    }>;
  } {
    const team = this.teams.get(teamId);

    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    const totalAvailability = team.members.reduce((sum, m) => sum + m.availability, 0);
    const totalLoad = team.members.reduce((sum, m) => sum + m.currentLoad, 0);

    return {
      totalAvailability,
      totalLoad,
      utilizationRate: totalAvailability > 0 ? totalLoad / totalAvailability : 0,
      members: team.members.map(member => ({
        name: member.name,
        availability: member.availability,
        load: member.currentLoad,
        utilizationRate: member.availability > 0 ? member.currentLoad / member.availability : 0,
      })),
    };
  }

  /**
   * 負荷の自動バランシング
   */
  balanceLoad(tasks: Task[]): Map<string, string[]> {
    // タスクをアサインされていないものとアサイン済みのものに分ける
    const unassignedTasks = tasks.filter(t => !t.assignee);
    const assignments = new Map<string, string[]>();

    // 各タスクに最適なメンバーを割り当て
    for (const task of unassignedTasks) {
      const recommendations = this.recommendMembersForTask(task, 1);

      if (recommendations.length > 0) {
        const bestMember = recommendations[0].member;
        this.assignTaskToMember(bestMember.id, task);

        if (!assignments.has(bestMember.id)) {
          assignments.set(bestMember.id, []);
        }
        assignments.get(bestMember.id)!.push(task.id);
      }
    }

    return assignments;
  }
}
