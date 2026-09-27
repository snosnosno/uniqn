/**
 * 구인자 신청 거절 문구 패리티 — DB 트리거와 앱이 같은 말을 하는지 텍스트로 대조한다.
 *
 * 🔑 거절 푸시·알림함 행은 DB 트리거 `notify_employer_application_change()` 가 직접 쓴다.
 *    앱은 그 문자열을 실행해 볼 수 없어, 한쪽 라벨만 고치면 신청자 화면과 푸시가 다른 말을 해도
 *    아무 것도 빨개지지 않는다(예전엔 푸시에 영어 코드 `사유: dummy` 가 그대로 찍혔다).
 *
 * ⚠️ 문구가 **무엇인지** 고정하지 않는다 — 고정하는 것은 **함께 움직인다**는 것뿐이다.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  EMPLOYER_REJECTION_CATEGORY_LABELS,
  getEmployerRejectionCategoryLabel,
} from '@/constants/employerApplication';
import { createNotificationMessage } from '@/constants/notificationTemplates';
import { NotificationType } from '@/types/notification';

const ROOT = join(__dirname, '..', '..', '..');
const MIGRATION = 'supabase/migrations/20260927100000_employer_app_rejected_copy.sql';

const migrationSql = readFileSync(join(ROOT, MIGRATION), 'utf8');

describe('구인자 신청 거절 문구 — DB 트리거 ↔ 앱', () => {
  it('DB CHECK 4값이 모두 라벨을 가진다', () => {
    expect(Object.keys(EMPLOYER_REJECTION_CATEGORY_LABELS).sort()).toEqual(
      ['duplicate', 'dummy', 'identity_mismatch', 'other'].sort()
    );
  });

  it.each(Object.entries(EMPLOYER_REJECTION_CATEGORY_LABELS))(
    '%s 라벨이 트리거 본문과 같은 문자열이다',
    (category, label) => {
      expect(migrationSql).toContain(`WHEN '${category}' THEN ' 사유: ${label}'`);
    }
  );

  it('앱 템플릿의 제목·본문이 트리거와 같은 말을 한다', () => {
    const message = createNotificationMessage(NotificationType.EMPLOYER_APP_REJECTED, {
      rejectionCategory: 'dummy',
    });

    expect(migrationSql).toContain(`'${message.title}'`);
    expect(message.body).toBe('구인자 신청이 거절되었습니다. 사유: 실사용 확인이 어려운 계정');
    expect(migrationSql).toContain("'구인자 신청이 거절되었습니다.'");
  });

  it('모르는 사유 코드는 영어 코드 대신 기타로 접는다', () => {
    expect(getEmployerRejectionCategoryLabel('unknown_code')).toBe('기타');
  });
});
