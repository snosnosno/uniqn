/**
 * 프리셋 이름 스키마 SSOT 테스트.
 * 저장·이름변경 두 경로가 같은 규칙을 쓰는지가 핵심 — 규칙 자체를 여기서 잠근다.
 */
import {
  TEMPLATE_NAME_MAX_LENGTH,
  isDuplicateTemplateName,
  suggestUniqueTemplateName,
  templateNameSchema,
} from '../jobTemplate.schema';

describe('templateNameSchema', () => {
  it('앞뒤 공백을 제거한 값을 돌려준다', () => {
    const parsed = templateNameSchema.safeParse('  주말 딜러  ');
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toBe('주말 딜러');
  });

  it('trim 후 2자 미만이면 거부한다 (공백만 입력 포함)', () => {
    expect(templateNameSchema.safeParse('가').success).toBe(false);
    expect(templateNameSchema.safeParse('   ').success).toBe(false);
  });

  it('50자 초과면 거부한다', () => {
    expect(templateNameSchema.safeParse('가'.repeat(TEMPLATE_NAME_MAX_LENGTH)).success).toBe(true);
    expect(templateNameSchema.safeParse('가'.repeat(TEMPLATE_NAME_MAX_LENGTH + 1)).success).toBe(
      false
    );
  });

  it('XSS 패턴을 거부한다 (저장 경로가 무검증이던 회귀 방지)', () => {
    expect(templateNameSchema.safeParse('<script>alert(1)</script>').success).toBe(false);
  });
});

describe('isDuplicateTemplateName', () => {
  const templates = [
    { id: 't1', name: '주말 딜러' },
    { id: 't2', name: '평일 플로어' },
  ];

  it('대소문자·앞뒤 공백을 무시하고 중복으로 본다', () => {
    expect(isDuplicateTemplateName('  주말 딜러 ', templates)).toBe(true);
    expect(isDuplicateTemplateName('WEEKEND', [{ id: 'x', name: 'weekend' }])).toBe(true);
  });

  it('자기 자신은 중복이 아니다 (이름변경에서 현재 이름 유지)', () => {
    expect(isDuplicateTemplateName('주말 딜러', templates, 't1')).toBe(false);
    expect(isDuplicateTemplateName('주말 딜러', templates, 't2')).toBe(true);
  });

  it('없는 이름은 중복이 아니다', () => {
    expect(isDuplicateTemplateName('신규 프리셋', templates)).toBe(false);
  });
});

describe('suggestUniqueTemplateName', () => {
  it('중복이 아니면 trim 한 원래 이름을 그대로 돌려준다', () => {
    expect(suggestUniqueTemplateName(' 신규 ', [{ id: 't1', name: '주말 딜러' }])).toBe('신규');
  });

  it('중복이면 " (2)" 를 붙인다', () => {
    expect(suggestUniqueTemplateName('주말 딜러', [{ id: 't1', name: '주말 딜러' }])).toBe(
      '주말 딜러 (2)'
    );
  });

  it('(2) 도 이미 있으면 (3) 으로 넘어간다', () => {
    const templates = [
      { id: 't1', name: '주말 딜러' },
      { id: 't2', name: '주말 딜러 (2)' },
    ];
    expect(suggestUniqueTemplateName('주말 딜러', templates)).toBe('주말 딜러 (3)');
  });

  it('이미 (2) 가 붙은 이름을 다시 제안해도 "(2) (2)" 가 되지 않는다', () => {
    const templates = [
      { id: 't1', name: '주말 딜러' },
      { id: 't2', name: '주말 딜러 (2)' },
    ];
    expect(suggestUniqueTemplateName('주말 딜러 (2)', templates)).toBe('주말 딜러 (3)');
  });

  it('제안 결과는 항상 스키마 상한을 통과한다 (긴 이름도 저장 가능해야 한다)', () => {
    const longName = '가'.repeat(TEMPLATE_NAME_MAX_LENGTH);
    const suggestion = suggestUniqueTemplateName(longName, [{ id: 't1', name: longName }]);
    expect(suggestion).not.toBe(longName);
    expect(templateNameSchema.safeParse(suggestion).success).toBe(true);
  });
});
