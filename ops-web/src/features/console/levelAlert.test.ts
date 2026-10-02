import { describe, expect, it } from 'vitest';
import { levelAlert, parseClockInput } from './clock';

const s = (sort: number, remainingSec: number, isRunning = true) => ({
  sort,
  remainingSec,
  isRunning,
});

describe('levelAlert', () => {
  it('첫 틱은 조용하다(새로고침마다 울리지 않게)', () => {
    expect(levelAlert(null, s(3, 30))).toBeNull();
  });

  it('61초 → 60초로 넘어갈 때 한 번 1분 경고', () => {
    expect(levelAlert(s(1, 61), s(1, 60))).toBe('oneMinute');
    expect(levelAlert(s(1, 60), s(1, 59))).toBeNull();
  });

  it('틱이 건너뛰어도(백그라운드 탭) 경계를 넘으면 울린다', () => {
    expect(levelAlert(s(1, 90), s(1, 20))).toBe('oneMinute');
  });

  it('진행 중 00:00 이 되면 시간 종료 알림 한 번(이후 0 이 이어져도 조용)', () => {
    expect(levelAlert(s(1, 1), s(1, 0))).toBe('timeUp');
    expect(levelAlert(s(1, 0), s(1, 0))).toBeNull();
  });

  it('61초에서 바로 0 으로 건너뛰면(백그라운드) 시간 종료가 1분 경고보다 우선', () => {
    expect(levelAlert(s(1, 61), s(1, 0))).toBe('timeUp');
  });

  it('레벨이 바뀌면 전환 알림', () => {
    expect(levelAlert(s(1, 1), s(2, 1200))).toBe('levelChange');
  });

  it('일시정지 중에는 레벨을 옮겨도 울리지 않는다', () => {
    expect(levelAlert(s(1, 500, false), s(2, 1200, false))).toBeNull();
  });

  it('일시정지 상태에서 재개해 60초 이하로 시작해도 1분 경고는 다시 울리지 않는다', () => {
    expect(levelAlert(s(1, 50, false), s(1, 50))).toBeNull();
  });

  it('+1분 보정으로 60초 위로 올라갔다 다시 내려오면 다시 울린다', () => {
    expect(levelAlert(s(1, 110), s(1, 60))).toBe('oneMinute');
  });
});

describe('parseClockInput', () => {
  it.each([
    ['12:30', 750],
    ['2:05', 125],
    ['12', 720],
    ['0:00', 0],
    [' 99:59 ', 5999],
    ['05：10', 310],
  ])('%s → %d초', (raw, sec) => {
    expect(parseClockInput(raw)).toBe(sec);
  });

  it.each(['', '12:60', '1:5', '100', '1:2:3', '-1', 'abc', '12:3a'])('%s 는 거절', (raw) => {
    expect(parseClockInput(raw)).toBeNull();
  });
});
