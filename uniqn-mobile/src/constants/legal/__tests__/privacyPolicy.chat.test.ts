/**
 * 개인정보처리방침 v1.3 — 앱 내 채팅 조항 (S5-a, 공개 ON 선행조건)
 *
 * 서버 정책과 문구가 어긋나면 방침이 거짓이 된다. 서버 값의 출처:
 *   · 보존 1년 = 설계 D5 · S5-b purge 크론
 *   · 탈퇴 = permanently_delete_user 익명화(마이그 20260925230000)
 *   · 신고 증거 1년 = 설계 D12
 */
import { PRIVACY_POLICY } from '../privacyPolicy';

function section(prefix: string): string {
  const found = PRIVACY_POLICY.sections.find((s) => s.title.startsWith(prefix));
  if (!found) throw new Error(`${prefix} 조항 없음`);
  return found.body;
}

describe('개인정보처리방침 — 앱 내 채팅', () => {
  it('버전 1.3 으로 올리고 게시일·시행일을 적는다', () => {
    expect(PRIVACY_POLICY.version).toBe('1.3');
    expect(PRIVACY_POLICY.publishDate).toBe('2026-09-25');
    expect(PRIVACY_POLICY.effectiveDate).toBe('2026-09-25');
  });

  it('제1조 수집 항목에 채팅 메시지·사진(부가정보 제거)을 적는다', () => {
    const body = section('제1조');
    expect(body).toContain('채팅 메시지 내용');
    expect(body).toContain('사진 속 부가정보는 앱과 서버에서 제거');
  });

  it('제2조 이용 목적에 채팅 전달·신고 처리를 적는다', () => {
    expect(section('제2조')).toContain('5. 앱 내 채팅');
  });

  it('제3조 보유 기간 = 마지막 메시지 후 1년 · 탈퇴 시 삭제 · 신고 증거 처리 후 1년', () => {
    const body = section('제3조');
    expect(body).toContain('마지막 메시지로부터 1년 후 파기');
    expect(body).toContain("발신자를 '탈퇴한 사용자'로 표시");
    expect(body).toContain('신고 처리 완료 후 1년 보관 후 파기');
  });

  it('제4조(제3자 제공)는 이번 개정에서 바꾸지 않는다 — 재동의 대상 여부는 법무 확인 사항', () => {
    expect(section('제4조')).not.toContain('채팅');
  });
});
