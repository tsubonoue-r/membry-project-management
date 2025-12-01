/**
 * Lark API接続テスト
 * 環境変数の設定後にこのスクリプトを実行してLark連携をテストします
 */

import * as dotenv from 'dotenv';
import { LarkClient } from '../api/lark-client.js';
import { MemberManager } from '../services/member-manager.js';
import { LarkNotificationConfig } from '../types/index.js';

// 環境変数を読み込み
dotenv.config();

async function testLarkConnection() {
  console.log('🧪 Lark API接続テスト開始\n');

  // 環境変数のチェック
  const appId = process.env.LARK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET;
  const groupId = process.env.LARK_GROUP_ID;

  if (!appId || !appSecret) {
    console.error('❌ エラー: LARK_APP_ID と LARK_APP_SECRET を .env ファイルに設定してください');
    console.log('\n📝 設定方法:');
    console.log('1. .env.example を .env にコピー');
    console.log('2. Lark Developer Console (https://open.feishu.cn/) でアプリを作成');
    console.log('3. App ID と App Secret を .env に設定');
    console.log('\n詳細は LARK_SETUP.md を参照してください');
    process.exit(1);
  }

  console.log('✅ 環境変数の読み込み成功');
  console.log(`   App ID: ${appId.substring(0, 10)}...`);
  console.log(`   Group ID: ${groupId || '未設定'}\n`);

  // Larkクライアントの初期化
  const notificationConfig: LarkNotificationConfig = {
    enabled: !!groupId,
    groupId: groupId,
    notifyOnTaskCreated: true,
    notifyOnTaskCompleted: true,
    notifyOnTaskBlocked: true,
    notifyOnDeadlineApproaching: true,
    deadlineWarningDays: 3,
  };

  const larkClient = new LarkClient(appId, appSecret, notificationConfig);
  console.log('✅ Larkクライアントの初期化成功\n');

  // テスト1: メンバー一覧取得
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 テスト1: メンバー一覧の取得');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const members = await larkClient.getAllMembers();
    console.log(`✅ メンバー取得成功: ${members.length}人\n`);

    if (members.length > 0) {
      console.log('取得したメンバー（最初の5人）:');
      members.slice(0, 5).forEach((member, index) => {
        console.log(`  ${index + 1}. ${member.name}`);
        console.log(`     Email: ${member.email}`);
        console.log(`     部署: ${member.department || 'N/A'}`);
        console.log(`     役職: ${member.title || 'N/A'}`);
        console.log('');
      });

      // メンバーマネージャーでスキル推論テスト
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎯 テスト2: スキル推論');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const memberManager = new MemberManager(larkClient);
      const syncedMembers = await memberManager.syncMembersFromLark();

      console.log(`✅ メンバー同期成功: ${syncedMembers.length}人\n`);

      syncedMembers.slice(0, 5).forEach((member, index) => {
        const skillNames = member.skills.map(s => {
          const skillMap: Record<string, string> = {
            sales: '営業',
            design: '設計',
            manufacturing: '製造',
            construction: '施工',
            project_management: 'PM',
            quality_assurance: '品質保証',
          };
          return skillMap[s] || s;
        }).join(', ');

        console.log(`  ${index + 1}. ${member.name}`);
        console.log(`     役職: ${member.title || 'N/A'}`);
        console.log(`     推論されたスキル: ${skillNames || 'なし'}`);
        console.log(`     稼働可能時間: ${member.availability}h/週`);
        console.log('');
      });
    } else {
      console.log('⚠️  メンバーが見つかりませんでした');
      console.log('   Larkアプリに適切な権限が設定されているか確認してください');
    }
  } catch (error) {
    console.error('❌ メンバー取得エラー:', error);
    console.log('\n💡 トラブルシューティング:');
    console.log('1. App ID と App Secret が正しいか確認');
    console.log('2. Larkアプリに contact:user.base 権限があるか確認');
    console.log('3. アプリが公開されているか確認');
  }

  // テスト3: 通知送信（Group IDが設定されている場合のみ）
  if (groupId) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📢 テスト3: グループ通知の送信');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const testMessage = '🧪 Membry Project Management\n接続テスト成功！\n\nシステムが正常に動作しています。';
      await larkClient.sendNotification(testMessage);
      console.log('✅ 通知送信成功');
      console.log(`   グループID: ${groupId}`);
      console.log('   Larkグループチャットを確認してください\n');
    } catch (error) {
      console.error('❌ 通知送信エラー:', error);
      console.log('\n💡 トラブルシューティング:');
      console.log('1. Group ID が正しいか確認');
      console.log('2. アプリがグループチャットに追加されているか確認');
      console.log('3. im:message 権限があるか確認');
    }
  } else {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏭️  テスト3: 通知送信テストをスキップ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('LARK_GROUP_ID が設定されていません');
    console.log('通知機能をテストするには、.env に LARK_GROUP_ID を追加してください\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 Lark APIテスト完了');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// エラーハンドリング付きで実行
testLarkConnection().catch(error => {
  console.error('\n❌ テスト実行中にエラーが発生しました:');
  console.error(error);
  process.exit(1);
});
