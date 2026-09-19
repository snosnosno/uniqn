/**
 * 실패 문구 팩토리 — 축 고정 계약 테스트
 *
 * @description 문구 감사(2026-08-24 P1-2)에서 "불러오기 실패" 한 상황이 39가지 변이로
 * 흩어져 있었다. 변이의 원인은 4개 축(동사·종결어미·마침표·후속안내)이 호출부마다 제각각
 * 흔들린 것 — 문자열 상수 나열로는 축이 다시 갈라지므로 **함수**로 고정한다.
 *
 * 이 테스트는 문구의 예쁨이 아니라 **축이 하나로 유지되는지**를 지킨다.
 */
import { loadFailed, notFound, saveFailed, RETRY_HINT } from '@/constants/messages';

describe('loadFailed — 불러오기 실패', () => {
  it('대상에 맞는 조사를 붙인다', () => {
    expect(loadFailed('공고')).toBe('공고를 불러오지 못했어요');
    expect(loadFailed('정산 내역')).toBe('정산 내역을 불러오지 못했어요');
  });

  it('후속 안내는 옵션이며, 붙일 때 한 칸 띄운 한 문장으로 잇는다', () => {
    expect(loadFailed('스케줄', { retry: true })).toBe(
      '스케줄을 불러오지 못했어요. 잠시 후 다시 시도해주세요'
    );
  });
});

describe('notFound — 대상 없음', () => {
  it('대상에 맞는 조사를 붙인다', () => {
    expect(notFound('공고')).toBe('공고를 찾을 수 없어요');
    expect(notFound('근무 기록')).toBe('근무 기록을 찾을 수 없어요');
  });
});

describe('saveFailed — 저장 실패', () => {
  it('대상에 맞는 조사를 붙인다', () => {
    expect(saveFailed('정산')).toBe('정산을 저장하지 못했어요');
    expect(saveFailed('공고')).toBe('공고를 저장하지 못했어요');
  });
});

describe('축 고정', () => {
  const all = [
    loadFailed('공고'),
    loadFailed('공고', { retry: true }),
    notFound('공고'),
    saveFailed('공고'),
  ];

  it('종결어미가 전부 해요체다', () => {
    for (const m of all) {
      expect(m).toMatch(/했어요|없어요|시도해주세요$/);
    }
  });

  it('문장 끝에 마침표를 붙이지 않는다 — 토스트·인라인 문구가 주 소비처다', () => {
    for (const m of all) {
      expect(m.endsWith('.')).toBe(false);
    }
  });

  it('후속 안내 문구는 단일 소스에서만 온다', () => {
    expect(loadFailed('공고', { retry: true })).toContain(RETRY_HINT);
  });
});
