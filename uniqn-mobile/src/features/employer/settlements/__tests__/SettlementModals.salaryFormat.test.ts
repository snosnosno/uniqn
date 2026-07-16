/**
 * 급여 표기 중복 제거(8-2) — 정산 확인 모달 금액 문구 출력 불변 회귀.
 *
 * SettlementModals 는 정산 금액을 `${amount.toLocaleString()}원` 으로 표기했다.
 * 이를 공용 `formatNumber(amount) + '원'` 로 교체해도 문구가 바이트 단위로
 * 동일함을 증명한다. 아래 기대 문자열은 교체 전 출력을 기록한 값(원화 정수).
 */

import { formatNumber } from '@/utils/formatters';

describe('정산 확인 모달 금액 문구 (출력 불변)', () => {
  it('일괄 정산 예상 금액 문구', () => {
    const count = 3;
    const amount = 1234567;
    const message = `${count}건의 근무를 정산하시겠습니까?\n예상 금액: ${formatNumber(amount)}원`;
    expect(message).toBe('3건의 근무를 정산하시겠습니까?\n예상 금액: 1,234,567원');
  });

  it('단건 정산 금액 문구', () => {
    const amount = 90000;
    const message = `이 스태프의 근무를 정산하시겠습니까?\n정산 금액: ${formatNumber(amount)}원`;
    expect(message).toBe('이 스태프의 근무를 정산하시겠습니까?\n정산 금액: 90,000원');
  });

  it('교체 전 표기(.toLocaleString())와 교체 후(formatNumber) 원화 정수 도메인 등가', () => {
    for (const amount of [0, 15000, 53000, 100000, 1234567, 500000]) {
      expect(`${formatNumber(amount)}원`).toBe(`${amount.toLocaleString()}원`);
    }
  });
});
