/**
 * privacyWarning — 개인정보 입력 경고(설계 §7)
 *
 * 경고만 한다(전송은 막지 않는다). 오탐보다 미탐이 덜 나쁘지만, 흔한 숫자(시급·날짜)에는
 * 울리지 않아야 경고가 무시되지 않는다.
 */
import { detectPrivacyRisk } from '../privacyWarning';

describe('detectPrivacyRisk', () => {
  it.each([['010-1234-5678'], ['01012345678'], ['연락 주세요 010 1234 5678'], ['011-123-4567']])(
    '휴대폰 번호 "%s" → phone',
    (text) => {
      expect(detectPrivacyRisk(text)).toBe('phone');
    }
  );

  it.each([
    ['국민은행 123456-78-901234'],
    ['신한 110-123-456789 로 보내주세요'],
    ['카카오뱅크 3333-01-2345678'],
    ['계좌 1002-123-456789'],
  ])('계좌 "%s" → account', (text) => {
    expect(detectPrivacyRisk(text)).toBe('account');
  });

  it.each([
    ['안녕하세요 내일 몇 시까지 가면 될까요?'],
    ['시급 15000원이에요'],
    ['9/26 14:00~22:00 근무'],
    ['딜러 3명 필요합니다'],
    [''],
  ])('일반 문장 "%s" → null', (text) => {
    expect(detectPrivacyRisk(text)).toBeNull();
  });
});
