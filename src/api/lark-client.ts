import * as lark from '@larksuiteoapi/node-sdk';
import { Task, LarkNotificationConfig } from '../types/index.js';

/**
 * Lark APIクライアント
 * Lark（飛書）との連携を管理
 */
export class LarkClient {
  private client: lark.Client;
  private config: LarkNotificationConfig;

  constructor(appId: string, appSecret: string, config: LarkNotificationConfig) {
    this.client = new lark.Client({
      appId,
      appSecret,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Feishu,
    });
    this.config = config;
  }

  /**
   * タスクをLarkに作成
   */
  async createTask(task: Task): Promise<string> {
    try {
      const response = await this.client.task.v1.task.create({
        data: {
          summary: task.title,
          description: task.description,
          due: task.dueDate ? {
            timestamp: Math.floor(task.dueDate.getTime() / 1000).toString(),
          } : undefined,
          members: task.assigneeId ? [{
            id: task.assigneeId,
            type: 'user',
            role: 'assignee',
          }] : [],
          custom_fields: [
            {
              guid: 'phase',
              text_value: task.phase,
            },
            {
              guid: 'priority',
              text_value: task.priority,
            },
          ],
        },
      });

      if (response.code === 0 && response.data?.task?.guid) {
        return response.data.task.guid;
      }

      throw new Error(`Failed to create Lark task: ${response.msg}`);
    } catch (error) {
      console.error('Error creating Lark task:', error);
      throw error;
    }
  }

  /**
   * タスク更新通知を送信
   */
  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    try {
      await this.client.task.v1.task.patch({
        path: { task_guid: taskId },
        data: {
          summary: updates.title,
          description: updates.description,
          due: updates.dueDate ? {
            timestamp: Math.floor(updates.dueDate.getTime() / 1000).toString(),
          } : undefined,
        },
      });
    } catch (error) {
      console.error('Error updating Lark task:', error);
      throw error;
    }
  }

  /**
   * グループチャットに通知を送信
   */
  async sendNotification(message: string, chatId?: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const targetChatId = chatId || this.config.groupId;

      if (!targetChatId) {
        console.warn('No chat ID configured for notification');
        return;
      }

      await this.client.im.v1.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: targetChatId,
          msg_type: 'text',
          content: JSON.stringify({ text: message }),
        },
      });
    } catch (error) {
      console.error('Error sending Lark notification:', error);
      throw error;
    }
  }

  /**
   * タスク完了通知
   */
  async notifyTaskCompleted(task: Task): Promise<void> {
    if (!this.config.notifyOnTaskCompleted) {
      return;
    }

    const message = `✅ タスク完了: ${task.title}\nフェーズ: ${task.phase}\n担当者: ${task.assignee || '未割当'}`;
    await this.sendNotification(message);
  }

  /**
   * タスクブロック通知
   */
  async notifyTaskBlocked(task: Task, reason: string): Promise<void> {
    if (!this.config.notifyOnTaskBlocked) {
      return;
    }

    const message = `🚫 タスクブロック: ${task.title}\n理由: ${reason}\nフェーズ: ${task.phase}\n担当者: ${task.assignee || '未割当'}`;
    await this.sendNotification(message);
  }

  /**
   * 期限接近通知
   */
  async notifyDeadlineApproaching(task: Task): Promise<void> {
    if (!this.config.notifyOnDeadlineApproaching || !task.dueDate) {
      return;
    }

    const daysUntilDue = Math.ceil(
      (task.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilDue <= this.config.deadlineWarningDays && daysUntilDue > 0) {
      const message = `⏰ 期限接近: ${task.title}\n残り${daysUntilDue}日\n期限: ${task.dueDate.toLocaleDateString('ja-JP')}\n担当者: ${task.assignee || '未割当'}`;
      await this.sendNotification(message);
    }
  }

  /**
   * リッチテキストカードで進捗レポートを送信
   */
  async sendProgressReport(
    projectName: string,
    stats: {
      phase: string;
      totalTasks: number;
      completedTasks: number;
      progress: number;
    }[]
  ): Promise<void> {
    if (!this.config.enabled || !this.config.groupId) {
      return;
    }

    const elements = stats.map(stat => ({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**${stat.phase}**: ${stat.completedTasks}/${stat.totalTasks} 完了 (${stat.progress}%)`,
      },
    }));

    const card = {
      header: {
        title: {
          tag: 'plain_text',
          content: `📊 ${projectName} 進捗レポート`,
        },
      },
      elements,
    };

    try {
      await this.client.im.v1.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: this.config.groupId,
          msg_type: 'interactive',
          content: JSON.stringify(card),
        },
      });
    } catch (error) {
      console.error('Error sending progress report:', error);
      throw error;
    }
  }

  /**
   * ユーザー情報を取得
   */
  async getUserInfo(userId: string): Promise<{ name: string; email: string }> {
    try {
      const response = await this.client.contact.v3.user.get({
        path: { user_id: userId },
      });

      if (response.code === 0 && response.data?.user) {
        return {
          name: response.data.user.name || '',
          email: response.data.user.email || '',
        };
      }

      throw new Error(`Failed to get user info: ${response.msg}`);
    } catch (error) {
      console.error('Error getting user info:', error);
      throw error;
    }
  }

  /**
   * 部署のメンバーリストを取得
   */
  async getDepartmentMembers(departmentId: string): Promise<Array<{
    userId: string;
    name: string;
    email: string;
    department?: string;
    title?: string;
    avatarUrl?: string;
  }>> {
    try {
      const response = await this.client.contact.v3.user.list({
        params: {
          department_id: departmentId,
          page_size: 50,
        },
      });

      if (response.code === 0 && response.data?.items) {
        return response.data.items.map(user => ({
          userId: user.user_id || '',
          name: user.name || '',
          email: user.email || '',
          department: user.department_ids?.[0],
          title: user.job_title || '',
          avatarUrl: user.avatar?.avatar_origin || '',
        }));
      }

      throw new Error(`Failed to get department members: ${response.msg}`);
    } catch (error) {
      console.error('Error getting department members:', error);
      throw error;
    }
  }

  /**
   * 全メンバーリストを取得
   */
  async getAllMembers(): Promise<Array<{
    userId: string;
    name: string;
    email: string;
    department?: string;
    title?: string;
    avatarUrl?: string;
  }>> {
    try {
      const allMembers: Array<{
        userId: string;
        name: string;
        email: string;
        department?: string;
        title?: string;
        avatarUrl?: string;
      }> = [];

      let pageToken: string | undefined = undefined;

      // ページネーションで全ユーザーを取得
      do {
        const response = await this.client.contact.v3.user.list({
          params: {
            page_size: 50,
            page_token: pageToken,
          },
        });

        if (response.code === 0 && response.data?.items) {
          const members = response.data.items.map(user => ({
            userId: user.user_id || '',
            name: user.name || '',
            email: user.email || '',
            department: user.department_ids?.[0],
            title: user.job_title || '',
            avatarUrl: user.avatar?.avatar_origin || '',
          }));

          allMembers.push(...members);
          pageToken = response.data.page_token;
        } else {
          break;
        }
      } while (pageToken);

      return allMembers;
    } catch (error) {
      console.error('Error getting all members:', error);
      throw error;
    }
  }

  /**
   * ユーザーIDから詳細情報を取得
   */
  async getMemberDetails(userId: string): Promise<{
    userId: string;
    name: string;
    email: string;
    department?: string;
    title?: string;
    avatarUrl?: string;
    mobile?: string;
  }> {
    try {
      const response = await this.client.contact.v3.user.get({
        path: { user_id: userId },
      });

      if (response.code === 0 && response.data?.user) {
        const user = response.data.user;
        return {
          userId: user.user_id || '',
          name: user.name || '',
          email: user.email || '',
          department: user.department_ids?.[0],
          title: user.job_title || '',
          avatarUrl: user.avatar?.avatar_origin || '',
          mobile: user.mobile || '',
        };
      }

      throw new Error(`Failed to get member details: ${response.msg}`);
    } catch (error) {
      console.error('Error getting member details:', error);
      throw error;
    }
  }
}
