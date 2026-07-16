/**
 * 금액 포맷 — impeccable v2 §19
 *
 * 사용 구분:
 * - 리스트/컬럼(수치 정확성 우선): `formatCurrency(amount)` → "₩1,234,567"
 * - 설명문 축약(읽기 편의): `formatCurrencyCompact(amount)` → "10만원" / "5만 3,000원"
 *
 * 기존 `src/utils/settlement/formatters.formatCurrency` 는 본 모듈의 formatCurrency 를
 * 재수출하므로 동일하게 "₩1,234,567" 를 출력한다. 신규 코드는 본 모듈에서 직접 import.
 */

const koKR = new Intl.NumberFormat('ko-KR');

/**
 * 리스트·수치 컬럼용 원화 표기. "₩1,234,567".
 * 음수·null·undefined는 "₩0" 으로 치환.
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '₩0';
  }
  const safe = Math.trunc(amount);
  return `₩${koKR.format(safe)}`;
}

/**
 * 설명문·본문용 축약 표기. 만 단위 한글화.
 * - 10000 미만: "N,NNN원"
 * - 만 단위 이상, 나머지 없음: "N만원"
 * - 만 단위 이상, 나머지 있음: "N만 M,MMM원"
 */
export function formatCurrencyCompact(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '0원';
  }
  const safe = Math.trunc(amount);
  if (Math.abs(safe) < 10000) {
    return `${koKR.format(safe)}원`;
  }
  const man = Math.trunc(safe / 10000);
  const remainder = safe - man * 10000;
  if (remainder === 0) {
    return `${koKR.format(man)}만원`;
  }
  return `${koKR.format(man)}만 ${koKR.format(remainder)}원`;
}

/**
 * 단순 구분자 표시(원기호 없음).
 * 입력 필드·오디오 낭독·엑셀 export 등 통화 기호가 오히려 불편한 맥락용.
 */
export function formatNumber(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '0';
  }
  return koKR.format(amount);
}
