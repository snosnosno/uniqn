/**
 * isTimeTBD — "출근 예정 시각이 아직 정해지지 않았다" 판정의 단일 근거.
 *
 * 🔴 이 테스트의 존재 이유: 판정이 6갈래로 흩어져 있어 **같은 값을 서로 다르게 읽었다**.
 *    (`WorkTimeDisplay` 는 'NEGOTIABLE' 만, `postingSurfaceModel` 은 로컬 '협의' 라벨,
 *     `slotCapacity` 는 '' 폴백, `ScheduleConverter` 는 3중 비교…)
 *    수렴 기준은 **서버**다 — `_normalize_time_slot`·`_posting_slot_key` 가 흡수하는 센티널 집합과
 *    정확히 같은 값을 true 로 봐야 클라와 서버의 슬롯 키가 갈리지 않는다.
 *
 * 서버 실측(prod, R0 적용 후 직접 프로브):
 *   _normalize_time_slot: NULL·''·'미정'·'NEGOTIABLE' → NULL / '18:30 - 03:00' → '18:30' / '9:00' → '09:00'
 *   _posting_slot_key   : NULL·''·'미정'·'NEGOTIABLE' → '미정'
 */
import { FIXED_TIME_MARKER, TBA_TIME_MARKER } from '@/types/assignment';

import { isTimeTBD } from '../isTimeTBD';

describe('isTimeTBD', () => {
  describe('미정으로 판정하는 값 (서버 센티널 집합과 동일)', () => {
    it.each([null, undefined, '', '   ', TBA_TIME_MARKER, FIXED_TIME_MARKER])(
      '%p 는 미정이다',
      (value) => {
        expect(isTimeTBD(value)).toBe(true);
      }
    );

    // ⚠️ ASCII 공백은 서버 `btrim` 과 같고, 탭·개행 등은 **클라가 더 관대**하다(의도적).
    //    상세 근거는 isTimeTBD.ts 주석 참조 — 이 방향의 어긋남은 안전한 쪽이다.
    it('앞뒤 공백이 붙은 센티널도 미정이다', () => {
      expect(isTimeTBD(' 미정 ')).toBe(true);
      expect(isTimeTBD('\tNEGOTIABLE\n')).toBe(true);
    });
  });

  describe('미정이 아닌 값', () => {
    it.each(['09:00', '9:00', '18:30', '00:00', '23:59'])('시각 %s 는 미정이 아니다', (value) => {
      expect(isTimeTBD(value)).toBe(false);
    });

    it('범위형 레거시는 미정이 아니다 — 시작 시각이라는 정보를 갖고 있다', () => {
      expect(isTimeTBD('18:30 - 03:00')).toBe(false);
      expect(isTimeTBD('14:00~22:00')).toBe(false);
    });

    it('해석 불가 자유텍스트는 미정으로 삼키지 않는다 — 사람이 적어둔 정보를 지우면 안 된다', () => {
      // 서버 _normalize_time_slot 도 이런 값을 NULL 로 접지 않고 원문 그대로 통과시킨다
      // (기존 CHECK 이 계속 잡게 하려는 의도 — 방어를 추가만 하고 제거하지 않는다).
      expect(isTimeTBD('협의')).toBe(false);
      expect(isTimeTBD('저녁쯤')).toBe(false);
      expect(isTimeTBD('- 18:00')).toBe(false);
    });

    it('대소문자가 다른 NEGOTIABLE 은 미정이 아니다 — 서버가 흡수하지 않는 값이다', () => {
      // 🔑 여기서 관용을 넓히면 클라만 미정으로 접고 서버는 그대로 둬서 슬롯 키가 갈린다.
      expect(isTimeTBD('negotiable')).toBe(false);
    });
  });
});
