import {
  UNKNOWN_TIME_KEY,
  roleHydrateKey,
  slotHydrateKey,
  timeSlotKey,
} from '@/domains/schedule/postingHydrateKeys';

/**
 * 🔴 `timeSlotKey` 는 서버 `_posting_slot_key` 의 클라이언트 동치다.
 *    두 구현이 한 입력에서라도 갈리면 정원 조회가 0행을 내고, 화면에는 **에러 없이** 확정 인원이
 *    `0/N` 으로 뜬다(스태프 카드 + 사장 공고 관리 화면). 그래서 아래 기대값은 취향이 아니라
 *    **prod 실측값**이다:
 *      _posting_slot_key(NULL|''|'미정'|'NEGOTIABLE') = '미정'
 *      _posting_slot_key('18:30 - 03:00')            = '18:30'
 *      _normalize_time_slot('9:00')                  = '09:00'   ← 저장 정본화(0패딩)
 *      _normalize_time_slot('협의')                   = '협의'    ← 해석 불가는 원문 유지
 */
describe('timeSlotKey — 서버 _posting_slot_key 동치', () => {
  it.each([null, undefined, '', '   ', '미정', 'NEGOTIABLE', ' NEGOTIABLE '])(
    '센티널 %p 는 미정 키로 접힌다',
    (raw) => {
      expect(timeSlotKey(raw)).toBe(UNKNOWN_TIME_KEY);
    }
  );

  it('범위형은 시작시각만 남긴다', () => {
    expect(timeSlotKey('18:30 - 03:00')).toBe('18:30');
    expect(timeSlotKey('14:00~22:00')).toBe('14:00');
  });

  // 서버가 저장 시점에 0패딩하므로 서버가 돌려주는 키는 항상 'HH:MM' 이다.
  // 클라가 공고의 '9:00' 을 그대로 쓰면 두 키가 영영 만나지 못한다.
  it('비패딩 시각은 0패딩해 서버 저장 형태와 맞춘다', () => {
    expect(timeSlotKey('9:00')).toBe('09:00');
    expect(timeSlotKey('9:05 - 18:00')).toBe('09:05');
    expect(timeSlotKey('09:00')).toBe('09:00');
    expect(timeSlotKey('23:59')).toBe('23:59');
  });

  // 사람이 적어둔 값을 키 계산이 조용히 바꾸면 안 된다 — 서버도 원문을 그대로 통과시킨다.
  it('해석 불가 자유텍스트는 원문 그대로 둔다', () => {
    expect(timeSlotKey('협의')).toBe('협의');
    expect(timeSlotKey('저녁쯤')).toBe('저녁쯤');
  });

  // 구분자만 남는 값은 시작 시각이 '' 이 된다 — 키를 '' 로 두면 서로 다른 슬롯이 한 칸에 뭉친다.
  // ⚠️ 이 입력에서 서버는 원문을 그대로 두므로(`_posting_slot_key('-')` = `'-'`) 클라와 갈린다.
  //    도달 경로가 없어(work_logs CHECK 이 저장을 막는다) 현재 동작을 그대로 핀만 해 둔다.
  it('구분자만 남는 값은 미정 폴백으로 떨어진다 (빈 키 금지)', () => {
    expect(timeSlotKey('-')).toBe(UNKNOWN_TIME_KEY);
    expect(timeSlotKey('~')).toBe(UNKNOWN_TIME_KEY);
  });
});

describe('slotHydrateKey', () => {
  it('TBA(시간 미정) 슬롯은 "미정" 키', () => {
    expect(slotHydrateKey({ isTimeToBeAnnounced: true, startTime: '19:00' })).toBe('미정');
    expect(UNKNOWN_TIME_KEY).toBe('미정');
  });

  it('range 문자열("14:00~22:00")은 시작시각만 추출', () => {
    expect(slotHydrateKey({ startTime: '14:00~22:00' })).toBe('14:00');
  });

  it('discrete HH:MM 값은 항등', () => {
    expect(slotHydrateKey({ startTime: '19:00' })).toBe('19:00');
  });

  it('빈 startTime 은 "미정" 폴백', () => {
    expect(slotHydrateKey({ startTime: '' })).toBe('미정');
    expect(slotHydrateKey({ startTime: null })).toBe('미정');
    expect(slotHydrateKey({})).toBe('미정');
  });

  // 🔴 MMKV 오프라인 캐시·레거시 공고 jsonb 에 옛 센티널이 남는다. 여기서 안 접으면
  //    'NEGOTIABLE' 키로 조회해 확정 인원이 에러 없이 0/N 이 된다.
  it('레거시 센티널 startTime 도 "미정" 키로 접는다', () => {
    expect(slotHydrateKey({ startTime: 'NEGOTIABLE' })).toBe('미정');
    expect(slotHydrateKey({ startTime: '미정' })).toBe('미정');
  });

  it('startTime 이 없고 time(range)만 있으면 time 에서 추출 (postingSurfaceModel 셰이프 보존)', () => {
    expect(slotHydrateKey({ time: '10:00~18:00' })).toBe('10:00');
  });
});

describe('roleHydrateKey', () => {
  it('other 역할은 custom 유무와 무관하게 "other:" 접두', () => {
    // postingSurfaceModel 셰이프
    expect(roleHydrateKey({ role: 'other', customRole: '조명' })).toBe('other:조명');
    expect(roleHydrateKey({ role: 'other' })).toBe('other:');
    // AssignmentSelector 셰이프
    expect(roleHydrateKey({ roleId: 'other', customName: '조명' })).toBe('other:조명');
    expect(roleHydrateKey({ roleId: 'other' })).toBe('other:');
  });

  it('일반 역할은 역할 id 그대로', () => {
    expect(roleHydrateKey({ role: 'dealer' })).toBe('dealer');
    expect(roleHydrateKey({ roleId: 'dealer' })).toBe('dealer');
  });

  it('role 이 없고 name 만 있으면 name 폴백 (postingSurfaceModel 셰이프 보존)', () => {
    expect(roleHydrateKey({ name: 'floor' })).toBe('floor');
  });
});
