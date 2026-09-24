/**
 * privacyWarning — 채팅 입력의 개인정보(연락처·계좌) 감지
 *
 * 설계 §7: **경고만** 한다. 전송은 막지 않는다(사용자가 의도적으로 보낼 수 있다).
 * 시급·날짜·인원수 같은 흔한 숫자에 울리면 경고가 무시되므로 패턴을 좁게 둔다.
 */

export type PrivacyRisk = 'phone' | 'account';

/** 휴대폰: 010/011/016~019 + 3~4자리 + 4자리 (구분자는 -·공백·없음) */
const PHONE_PATTERN = /01[016-9][-\s]?\d{3,4}[-\s]?\d{4}/;

/** 은행명 또는 '계좌' 뒤 30자 안에 숫자 묶음 3개 이상(총 10자리 이상)이 오는 경우 */
const BANK_HINT =
  /(은행|뱅크|계좌|국민|신한|우리|하나|농협|기업|카카오|토스|새마을|우체국|신협|수협)/;
const ACCOUNT_DIGITS = /\d{2,6}-\d{2,6}-\d{2,8}/;

export function detectPrivacyRisk(text: string): PrivacyRisk | null {
  if (!text) return null;
  if (PHONE_PATTERN.test(text)) return 'phone';

  const hint = BANK_HINT.exec(text);
  if (hint) {
    const tail = text.slice(hint.index, hint.index + hint[0].length + 30);
    const digits = ACCOUNT_DIGITS.exec(tail);
    if (digits && digits[0].replace(/-/g, '').length >= 10) return 'account';
  }
  return null;
}

/** 경고 문구(입력창 아래 표시) */
export const PRIVACY_WARNING_MESSAGES: Record<PrivacyRisk, string> = {
  phone: '전화번호를 보내려는 것 같아요. 개인 연락처는 꼭 필요할 때만 알려 주세요.',
  account: '계좌번호를 보내려는 것 같아요. 입금·송금 요청이라면 한 번 더 확인해 주세요.',
};
