import { deriveOvernightPreview } from '../overnightPreview';

describe('deriveOvernightPreview', () => {
  it('종료가 시작보다 이르면 익일로 해석하고 duration을 넘겨 계산한다', () => {
    const r = deriveOvernightPreview('18:00', '02:00');
    expect(r.valid).toBe(true);
    expect(r.isNextDay).toBe(true);
    expect(r.isEqual).toBe(false);
    expect(r.durationMinutes).toBe(8 * 60);
    expect(r.durationLabel).toBe('8시간');
  });

  it('같은 날 정상 구간은 익일이 아니다', () => {
    const r = deriveOvernightPreview('09:00', '17:30');
    expect(r.isNextDay).toBe(false);
    expect(r.durationMinutes).toBe(8 * 60 + 30);
    expect(r.durationLabel).toBe('8시간 30분');
  });

  it('시작과 종료가 같으면 isEqual=true(검증 오류 대상)', () => {
    const r = deriveOvernightPreview('18:00', '18:00');
    expect(r.isEqual).toBe(true);
  });

  it('시작==종료는 duration을 산정하지 않는다(24시간 누출 회귀 방어)', () => {
    const r = deriveOvernightPreview('18:00', '18:00');
    expect(r.durationMinutes).toBe(0);
    expect(r.durationLabel).toBe('-');
    expect(r.isNextDay).toBe(false);
  });

  it('24+ 명시 표기(42:00)는 isEqual이 아니라 익일이다', () => {
    const r = deriveOvernightPreview('18:00', '42:00');
    expect(r.isEqual).toBe(false);
    expect(r.isNextDay).toBe(true);
  });

  it('24+ 표기(25:00)는 이미 익일로 본다', () => {
    const r = deriveOvernightPreview('18:00', '25:00');
    expect(r.isNextDay).toBe(true);
    expect(r.durationMinutes).toBe(7 * 60);
  });

  it('형식이 잘못되면 valid=false', () => {
    expect(deriveOvernightPreview('보류', '02:00').valid).toBe(false);
  });
});
