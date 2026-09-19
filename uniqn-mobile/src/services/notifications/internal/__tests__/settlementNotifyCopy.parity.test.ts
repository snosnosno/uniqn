/**
 * 정산 알림 문구 정본 패리티 — DB 3곳 · 클라 2곳이 같은 말을 하는지 텍스트로 대조한다.
 *
 * 🔑 **왜 텍스트 대조인가.** 이 문구의 정본은 DB 함수 안의 문자열 리터럴이다.
 *    - `notify_on_work_log_update` Case 3 (단건 정산 확정)
 *    - `notify_on_work_log_update` Case 3-B (확정 취소)
 *    - `bulk_settle_work_logs` 의 배치 INSERT (일괄 정산 — Case 3 과 **내용이 같아야 한다**)
 *    앱은 이 문자열을 실행해 볼 수 없고, `push_batching.test.sql` 은 **건수와 우선순위만**
 *    단언하고 문구는 보지 않는다. 그래서 셋 중 하나만 고쳐도 **아무 것도 빨개지지 않는다** —
 *    스태프 절반은 새 문구를, 절반은 옛 문구를 받는 상태가 조용히 성립한다.
 *
 * 🔴 지키는 계약: **앱은 돈을 보내지 않는다.** 확정되는 것은 금액이지 지급이 아니다.
 *    `정산이 완료되었습니다. 지급액: N원` 은 받는 사람이 송금 보증으로 읽는다(구인자 IA 웨이브 #492
 *    가 구인자 화면에서 지급 워크플로우를 걷어낸 것과 같은 이유).
 *
 * ⚠️ 이 테스트는 문구가 **무엇인지** 고정하지 않는다 — 문구를 바꾸는 것은 자유다.
 *    고정하는 것은 **다섯 곳이 함께 움직인다**는 것뿐이다.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { createNotificationMessage } from '@/constants/notificationTemplates';
import { NotificationType } from '@/types/notification';

const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const MIGRATION = 'supabase/migrations/20260915122335_settlement_notify_copy_no_payment_claim.sql';
const NORMALIZER = 'src/services/notifications/internal/notificationMessageNormalizer.ts';
/**
 * 🔴 6번째 정본. `notificationService.test.ts` 가 FCM 영문 페이로드의 정규화 결과를
 *    **완전 일치(toEqual)** 로 단언한다 — 문구를 바꾸면 이 파일이 깨진다.
 *
 * 이 파일을 여기 넣은 이유: 처음 문구를 바꿨을 때 이 테스트를 놓쳤고, 로컬에서 고른
 * '영향권' 패턴(`notificationMessageNormalizer`)이 **파일명이 달라 매칭되지 않아**
 * CI 에서야 빨개졌다. 정본 목록을 사람 기억이 아니라 이 파일에 둔다.
 */
const CONSUMER_TEST = 'src/services/notifications/__tests__/notificationService.test.ts';

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

const sqlRaw = readSource(MIGRATION);
const normalizer = readSource(NORMALIZER);
const consumerTest = readSource(CONSUMER_TEST);

/**
 * 주석(`--`)을 뺀 실행 SQL.
 *
 * 마이그레이션 헤더는 **무엇을 왜 바꿨는지** 설명하느라 옛 문구를 그대로 인용한다. 그 인용까지
 * "잔재"로 세면 문서를 잘 쓸수록 테스트가 빨개진다 — 판정 대상은 실행되는 문자열뿐이다.
 * (plpgsql 본문 안의 `--` 주석도 같이 걸러진다. 문자열 리터럴 안의 `--` 는 이 두 함수에 없다.)
 */
const sql = sqlRaw
  .split('\n')
  .map((line) => (line.trimStart().startsWith('--') ? '' : line))
  .join('\n');

/** `'''%s'' <본문>'` / `'<본문>'` 양쪽에서 공통 본문만 뽑는다. */
function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('정산 알림 문구 — 정본 패리티', () => {
  describe('DB: 확정 알림은 Case 3 과 일괄 경로가 같은 말을 한다', () => {
    // 제목없음 변형 1개(Case 3) + 1개(bulk) = 2, 제목있음 변형도 각 1개 = 2.
    const bodyNoTitle =
      '정산 금액이 %s원으로 확정되었습니다. 실제 지급은 사장님과 정한 방법으로 이루어집니다.';
    const bodyWithTitle = `'''%s'' ${bodyNoTitle}`;

    it('제목 없는 본문이 정확히 2곳(트리거 Case 3 · bulk)에 있다', () => {
      expect(occurrences(sql, `format('${bodyNoTitle}'`)).toBe(2);
    });

    it('공고 제목이 붙는 본문도 정확히 2곳에 있다', () => {
      expect(occurrences(sql, `format(${bodyWithTitle}'`)).toBe(2);
    });

    it('알림 제목 `정산 금액 확정` 이 정확히 2곳에 있다', () => {
      // Case 3-B 의 `정산 금액 확정 취소` 가 부분일치로 딸려오지 않도록 리터럴 종결까지 본다.
      expect(occurrences(sql, "'정산 금액 확정',")).toBe(2);
    });
  });

  describe('DB: 옛 문구가 남아 있지 않다', () => {
    it.each([
      ['정산이 완료되었습니다. 지급액'],
      ["'정산 완료',"],
      ["'지급 완료 취소',"],
      ['정산 지급 완료가 취소되어'],
    ])('`%s` 가 새 마이그레이션에 없다', (legacy) => {
      expect(sql).not.toContain(legacy);
    });
  });

  describe('DB: 바꾸면 안 되는 축은 그대로다', () => {
    it.each([
      ["'settlement_completed',", 2], // 트리거 Case 3 + bulk
      ["'settlement_reverted',", 1],
      ["'/schedule',", 6], // 이 두 함수가 만드는 모든 알림의 링크
    ])('%s 가 %d 곳 유지된다', (token, count) => {
      expect(occurrences(sql, token as string)).toBe(count);
    });

    it('확정/취소 알림의 data 키가 유지된다', () => {
      for (const key of ["'payrollAmount'", "'jobPostingTitle'", "'workLogId'"]) {
        expect(sql).toContain(key);
      }
    });
  });

  describe('클라 사본이 DB 와 같은 말을 한다', () => {
    const SETTLED_CORE = '정산 금액이';
    const SETTLED_TAIL = '실제 지급은 사장님과 정한 방법으로 이루어집니다.';
    const REVERTED_CORE = '정산 금액 확정';

    // 템플릿 객체를 직접 까지 않고 소비 경로(`createNotificationMessage`)를 거친다 —
    // title·body 는 `string | (data) => string` 유니온이라, 직접 호출하면 테스트가
    // 둘 중 한 형태만 상정하게 된다.
    const SAMPLE = { jobTitle: '토요일 딜러 4명', amount: '160,000' };

    it('notificationTemplates — 확정 알림', () => {
      const { title, body } = createNotificationMessage(
        NotificationType.SETTLEMENT_COMPLETED,
        SAMPLE
      );
      expect(title).toContain(REVERTED_CORE);
      expect(body).toContain(SETTLED_CORE);
      expect(body).toContain(SETTLED_TAIL);
      expect(body).not.toContain('정산이 완료되었습니다');
    });

    it('notificationTemplates — 확정 취소 알림', () => {
      const { title, body } = createNotificationMessage(
        NotificationType.SETTLEMENT_REVERTED,
        SAMPLE
      );
      expect(title).toBe('정산 금액 확정 취소');
      expect(body).toContain('정산 금액 확정(160,000원)이 취소되어');
      expect(body).not.toContain('지급 완료');
    });

    it('notificationMessageNormalizer — 확정 알림 문구가 DB 와 같은 꼬리를 쓴다', () => {
      expect(normalizer).toContain(SETTLED_TAIL);
      expect(normalizer).toContain("title: '정산 금액 확정'");
      expect(normalizer).not.toContain('정산이 완료되었습니다');
    });

    it('🔴 notificationService.test 의 완전일치 단언도 같은 문구를 쓴다(6번째 정본)', () => {
      // 이 테스트가 처음 문구 교체에서 누락돼 CI 에서만 빨개졌다. 정본 목록에 편입한다.
      expect(consumerTest).toContain(SETTLED_TAIL);
      expect(consumerTest).toContain("title: '정산 금액 확정'");
      expect(consumerTest).not.toContain('정산이 완료되었습니다');
    });
  });
});
