import { employerIntroSchema } from '../user.schema';

describe('employerIntroSchema', () => {
  const valid = '강남 일대 홀덤펍과 OO포커 대회 딜러를 주로 모집합니다';

  it('accepts a valid 10~300 char intro', () => {
    expect(employerIntroSchema.parse(valid)).toBe(valid);
  });

  it('trims surrounding whitespace', () => {
    expect(employerIntroSchema.parse(`  ${valid}  `)).toBe(valid);
  });

  it('rejects intro shorter than 10 chars (after trim)', () => {
    expect(() => employerIntroSchema.parse('짧은글')).toThrow();
  });

  it('rejects whitespace-only intro', () => {
    expect(() => employerIntroSchema.parse('          ')).toThrow();
  });

  it('rejects intro longer than 300 chars', () => {
    expect(() => employerIntroSchema.parse('가'.repeat(301))).toThrow();
  });

  it('rejects intro containing XSS payload', () => {
    expect(() =>
      employerIntroSchema.parse('주로 모집합니다 <script>alert(1)</script> 지역')
    ).toThrow();
  });
});
