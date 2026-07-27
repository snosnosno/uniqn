/**
 * 대타 구인 글 자동 게시 기본값 — 반드시 OFF (W1-10 / CANCEL-12).
 *
 * @description 게시판은 실명 공개 공간이다. 기본 ON 은 "사장에게만 말한다"고 믿는 사용자의
 *   사적 사유를 본인 동의 없이 공개하는 것과 같았다. 기본값은 **네 층**에 흩어져 있어
 *   (UI useState · UI 리셋 · zod default · 타입 optional) UI 만 고치면 필드 생략 경로로
 *   여전히 true 가 들어온다 — 최종 결정자인 zod default 를 여기서 못박는다.
 */
import { cancellationRequestSchema } from '../application.schema';

describe('cancellationRequestSchema.wantsSubstitutePost', () => {
  it('필드를 생략하면 게시하지 않는다 (기본 OFF)', () => {
    const parsed = cancellationRequestSchema.parse({
      applicationId: 'app-1',
      reason: '개인 사정으로 참석이 어렵습니다',
    });

    expect(parsed.wantsSubstitutePost).toBe(false);
  });

  it('사용자가 명시적으로 켜면 true 로 통과한다', () => {
    const parsed = cancellationRequestSchema.parse({
      applicationId: 'app-1',
      reason: '개인 사정으로 참석이 어렵습니다',
      wantsSubstitutePost: true,
    });

    expect(parsed.wantsSubstitutePost).toBe(true);
  });
});
