/**
 * U4: 구인자 등록 신청 거부 입력 스키마 검증
 *
 * reject reason 자유 텍스트가 XSS 패턴을 차단하는지 + optional 동작 검증.
 */

import {
  employerApplicationRejectReasonSchema,
  rejectEmployerApplicationSchema,
} from '../employerApplication.schema';

describe('employerApplicationRejectReasonSchema', () => {
  it('정상 사유를 통과시킨다', () => {
    const result = employerApplicationRejectReasonSchema.safeParse('서류가 불충분합니다');
    expect(result.success).toBe(true);
  });

  it('미지정(undefined)을 허용한다', () => {
    const result = employerApplicationRejectReasonSchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it('XSS 스크립트 태그를 거부한다', () => {
    const result = employerApplicationRejectReasonSchema.safeParse('<script>alert(1)</script>');
    expect(result.success).toBe(false);
  });

  it('javascript: 프로토콜을 거부한다', () => {
    const result = employerApplicationRejectReasonSchema.safeParse('javascript:alert(1)');
    expect(result.success).toBe(false);
  });

  it('500자 초과를 거부한다', () => {
    const result = employerApplicationRejectReasonSchema.safeParse('가'.repeat(501));
    expect(result.success).toBe(false);
  });
});

describe('rejectEmployerApplicationSchema', () => {
  it('applicationId + 정상 reason + category 를 통과시킨다', () => {
    const result = rejectEmployerApplicationSchema.safeParse({
      applicationId: 'app-1',
      reason: '중복 신청입니다',
      category: 'duplicate',
    });
    expect(result.success).toBe(true);
  });

  it('reason/category 미지정을 허용한다 (applicationId 만)', () => {
    const result = rejectEmployerApplicationSchema.safeParse({ applicationId: 'app-1' });
    expect(result.success).toBe(true);
  });

  it('applicationId 누락을 거부한다', () => {
    const result = rejectEmployerApplicationSchema.safeParse({ reason: '사유' });
    expect(result.success).toBe(false);
  });

  it('reason 에 XSS 가 있으면 거부한다', () => {
    const result = rejectEmployerApplicationSchema.safeParse({
      applicationId: 'app-1',
      reason: '<img src=x onerror=alert(1)>',
    });
    expect(result.success).toBe(false);
  });

  it('잘못된 category 를 거부한다', () => {
    const result = rejectEmployerApplicationSchema.safeParse({
      applicationId: 'app-1',
      category: 'invalid_category',
    });
    expect(result.success).toBe(false);
  });
});
