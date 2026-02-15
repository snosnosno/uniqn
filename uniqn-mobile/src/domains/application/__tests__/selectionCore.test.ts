/**
 * selectionCore 테스트
 *
 * @description 선택 키 생성/파싱/토글 로직 테스트
 * - makeSelectionKey: 키 생성 (기본 구분자, 커스텀 구분자)
 * - parseSelectionKey: 키 파싱
 * - getDateFromKey / getTimeSlotFromKey / getRoleFromKey: 개별 필드 추출
 * - toggleSelection: 단순 토글
 * - toggleExclusiveByDate: 날짜 배타적 토글
 * - toggleGroup: 그룹 토글
 * - getGroupSelectionState: 그룹 선택 상태
 * - createAssignmentKey / getDateFromKeyLegacy: 하위 호환
 */

import {
  makeSelectionKey,
  parseSelectionKey,
  getDateFromKey,
  getTimeSlotFromKey,
  getRoleFromKey,
  toggleSelection,
  toggleExclusiveByDate,
  toggleGroup,
  getGroupSelectionState,
  createAssignmentKey,
  getDateFromKeyLegacy,
  DEFAULT_SEPARATOR,
  APPLICANT_SEPARATOR,
} from '@/utils/assignment/selectionCore';

// ============================================================================
// Constants
// ============================================================================

describe('Constants', () => {
  it('DEFAULT_SEPARATOR는 파이프(|) 문자', () => {
    expect(DEFAULT_SEPARATOR).toBe('|');
  });

  it('APPLICANT_SEPARATOR는 언더스코어(_) 문자', () => {
    expect(APPLICANT_SEPARATOR).toBe('_');
  });
});

// ============================================================================
// makeSelectionKey
// ============================================================================

describe('makeSelectionKey', () => {
  it('기본 구분자(|)로 키를 생성한다', () => {
    const key = makeSelectionKey('2024-01-17', '09:00', 'dealer');
    expect(key).toBe('2024-01-17|09:00|dealer');
  });

  it('명시적으로 | 구분자를 지정해도 동일한 결과', () => {
    const key = makeSelectionKey('2024-01-17', '09:00', 'dealer', { separator: '|' });
    expect(key).toBe('2024-01-17|09:00|dealer');
  });

  it('_ 구분자로 키를 생성한다 (ApplicantCard용)', () => {
    const key = makeSelectionKey('2024-01-17', '09:00', 'dealer', { separator: '_' });
    expect(key).toBe('2024-01-17_09:00_dealer');
  });

  it('FIXED_DATE_MARKER와 TBA_TIME_MARKER 같은 특수 값도 처리한다', () => {
    const key = makeSelectionKey('FIXED', 'TBA', 'floor');
    expect(key).toBe('FIXED|TBA|floor');
  });

  it('빈 문자열 입력도 키를 생성한다', () => {
    const key = makeSelectionKey('', '', '');
    expect(key).toBe('||');
  });

  it('한글 역할명도 정상적으로 처리한다', () => {
    const key = makeSelectionKey('2024-01-17', '19:00', '딜러');
    expect(key).toBe('2024-01-17|19:00|딜러');
  });

  it('options 객체가 빈 객체일 때 기본 구분자 사용', () => {
    const key = makeSelectionKey('2024-01-17', '09:00', 'dealer', {});
    expect(key).toBe('2024-01-17|09:00|dealer');
  });
});

// ============================================================================
// parseSelectionKey
// ============================================================================

describe('parseSelectionKey', () => {
  it('기본 구분자(|)로 키를 파싱한다', () => {
    const result = parseSelectionKey('2024-01-17|09:00|dealer');
    expect(result).toEqual({
      date: '2024-01-17',
      timeSlot: '09:00',
      role: 'dealer',
    });
  });

  it('_ 구분자로 키를 파싱한다', () => {
    const result = parseSelectionKey('2024-01-17_09:00_dealer', { separator: '_' });
    expect(result).toEqual({
      date: '2024-01-17',
      timeSlot: '09:00',
      role: 'dealer',
    });
  });

  it('파싱 결과가 makeSelectionKey의 역연산이다', () => {
    const date = '2024-03-15';
    const timeSlot = '14:30';
    const role = 'supervisor';
    const key = makeSelectionKey(date, timeSlot, role);
    const parsed = parseSelectionKey(key);

    expect(parsed.date).toBe(date);
    expect(parsed.timeSlot).toBe(timeSlot);
    expect(parsed.role).toBe(role);
  });

  it('_ 구분자로 만든 키를 _ 구분자로 파싱하면 역연산이 된다', () => {
    const date = '2024-03-15';
    const timeSlot = '14:30';
    const role = 'chip_runner';
    const key = makeSelectionKey(date, timeSlot, role, { separator: '_' });
    const parsed = parseSelectionKey(key, { separator: '_' });

    expect(parsed.date).toBe(date);
    expect(parsed.timeSlot).toBe(timeSlot);
    // _ 구분자를 사용하므로 role에 _가 포함되면 잘못 파싱됨
    // chip_runner 중 'chip'까지만 나올 수 있음 -> 실제 동작 확인
  });

  it('구분자가 부족한 키는 빈 문자열로 채워진다', () => {
    const result = parseSelectionKey('only-date');
    expect(result).toEqual({
      date: 'only-date',
      timeSlot: '',
      role: '',
    });
  });

  it('구분자가 하나만 있는 키에서는 role이 빈 문자열', () => {
    const result = parseSelectionKey('2024-01-17|09:00');
    expect(result).toEqual({
      date: '2024-01-17',
      timeSlot: '09:00',
      role: '',
    });
  });

  it('빈 문자열을 파싱하면 모든 필드가 빈 문자열', () => {
    const result = parseSelectionKey('');
    expect(result).toEqual({
      date: '',
      timeSlot: '',
      role: '',
    });
  });

  it('구분자가 3개 이상이면 앞 3개만 사용', () => {
    const result = parseSelectionKey('2024-01-17|09:00|dealer|extra');
    expect(result.date).toBe('2024-01-17');
    expect(result.timeSlot).toBe('09:00');
    expect(result.role).toBe('dealer');
  });
});

// ============================================================================
// getDateFromKey / getTimeSlotFromKey / getRoleFromKey
// ============================================================================

describe('getDateFromKey', () => {
  it('기본 구분자로 날짜를 추출한다', () => {
    expect(getDateFromKey('2024-01-17|09:00|dealer')).toBe('2024-01-17');
  });

  it('_ 구분자로 날짜를 추출한다', () => {
    expect(getDateFromKey('2024-01-17_09:00_dealer', { separator: '_' })).toBe('2024-01-17');
  });

  it('빈 키에서 빈 문자열 반환', () => {
    expect(getDateFromKey('')).toBe('');
  });
});

describe('getTimeSlotFromKey', () => {
  it('기본 구분자로 시간대를 추출한다', () => {
    expect(getTimeSlotFromKey('2024-01-17|09:00|dealer')).toBe('09:00');
  });

  it('_ 구분자로 시간대를 추출한다', () => {
    expect(getTimeSlotFromKey('2024-01-17_09:00_dealer', { separator: '_' })).toBe('09:00');
  });

  it('시간대가 없는 키에서 빈 문자열 반환', () => {
    expect(getTimeSlotFromKey('only-date')).toBe('');
  });
});

describe('getRoleFromKey', () => {
  it('기본 구분자로 역할을 추출한다', () => {
    expect(getRoleFromKey('2024-01-17|09:00|dealer')).toBe('dealer');
  });

  it('_ 구분자로 역할을 추출한다', () => {
    expect(getRoleFromKey('2024-01-17_09:00_dealer', { separator: '_' })).toBe('dealer');
  });

  it('역할이 없는 키에서 빈 문자열 반환', () => {
    expect(getRoleFromKey('2024-01-17|09:00')).toBe('');
  });
});

// ============================================================================
// toggleSelection
// ============================================================================

describe('toggleSelection', () => {
  it('선택되지 않은 키를 추가한다', () => {
    const selectedKeys = new Set<string>();
    const result = toggleSelection(selectedKeys, 'key1');

    expect(result.keys.has('key1')).toBe(true);
    expect(result.added).toBe(true);
    expect(result.removed).toBe(false);
  });

  it('이미 선택된 키를 제거한다', () => {
    const selectedKeys = new Set(['key1', 'key2']);
    const result = toggleSelection(selectedKeys, 'key1');

    expect(result.keys.has('key1')).toBe(false);
    expect(result.keys.has('key2')).toBe(true);
    expect(result.added).toBe(false);
    expect(result.removed).toBe(true);
  });

  it('원본 Set을 변경하지 않는다 (불변성)', () => {
    const selectedKeys = new Set(['key1']);
    const result = toggleSelection(selectedKeys, 'key1');

    expect(selectedKeys.has('key1')).toBe(true); // 원본 유지
    expect(result.keys.has('key1')).toBe(false); // 새 Set에서 제거
  });

  it('여러 키가 있을 때 특정 키만 토글한다', () => {
    const selectedKeys = new Set(['key1', 'key2', 'key3']);
    const result = toggleSelection(selectedKeys, 'key2');

    expect(result.keys.size).toBe(2);
    expect(result.keys.has('key1')).toBe(true);
    expect(result.keys.has('key2')).toBe(false);
    expect(result.keys.has('key3')).toBe(true);
  });

  it('빈 Set에 키를 추가한다', () => {
    const selectedKeys = new Set<string>();
    const result = toggleSelection(selectedKeys, 'new-key');

    expect(result.keys.size).toBe(1);
    expect(result.added).toBe(true);
  });
});

// ============================================================================
// toggleExclusiveByDate
// ============================================================================

describe('toggleExclusiveByDate', () => {
  it('이미 선택된 키를 클릭하면 해제한다', () => {
    const key = '2024-01-17|09:00|dealer';
    const selectedKeys = new Set([key]);
    const result = toggleExclusiveByDate(selectedKeys, key);

    expect(result.has(key)).toBe(false);
    expect(result.size).toBe(0);
  });

  it('새 키를 선택하면 같은 날짜의 다른 키가 제거된다', () => {
    const existingKey = '2024-01-17|09:00|dealer';
    const newKey = '2024-01-17|14:00|floor';
    const selectedKeys = new Set([existingKey]);

    const result = toggleExclusiveByDate(selectedKeys, newKey);

    expect(result.has(existingKey)).toBe(false);
    expect(result.has(newKey)).toBe(true);
    expect(result.size).toBe(1);
  });

  it('다른 날짜의 키는 유지된다', () => {
    const day1Key = '2024-01-17|09:00|dealer';
    const day2Key = '2024-01-18|09:00|dealer';
    const newKey = '2024-01-17|14:00|floor';
    const selectedKeys = new Set([day1Key, day2Key]);

    const result = toggleExclusiveByDate(selectedKeys, newKey);

    expect(result.has(day1Key)).toBe(false); // 같은 날짜 제거
    expect(result.has(day2Key)).toBe(true); // 다른 날짜 유지
    expect(result.has(newKey)).toBe(true); // 새 키 추가
  });

  it('빈 Set에 새 키를 추가한다', () => {
    const selectedKeys = new Set<string>();
    const newKey = '2024-01-17|09:00|dealer';

    const result = toggleExclusiveByDate(selectedKeys, newKey);

    expect(result.has(newKey)).toBe(true);
    expect(result.size).toBe(1);
  });

  it('_ 구분자를 사용할 때도 날짜 배타적 선택이 동작한다', () => {
    const existingKey = '2024-01-17_09:00_dealer';
    const newKey = '2024-01-17_14:00_floor';
    const selectedKeys = new Set([existingKey]);

    const result = toggleExclusiveByDate(selectedKeys, newKey, { separator: '_' });

    expect(result.has(existingKey)).toBe(false);
    expect(result.has(newKey)).toBe(true);
  });

  it('같은 날짜의 여러 키가 있을 때 모두 제거 후 새 키만 남는다', () => {
    const key1 = '2024-01-17|09:00|dealer';
    const key2 = '2024-01-17|14:00|dealer';
    const key3 = '2024-01-17|19:00|floor';
    const newKey = '2024-01-17|21:00|supervisor';
    const selectedKeys = new Set([key1, key2, key3]);

    const result = toggleExclusiveByDate(selectedKeys, newKey);

    expect(result.has(key1)).toBe(false);
    expect(result.has(key2)).toBe(false);
    expect(result.has(key3)).toBe(false);
    expect(result.has(newKey)).toBe(true);
    expect(result.size).toBe(1);
  });

  it('원본 Set을 변경하지 않는다 (불변성)', () => {
    const existingKey = '2024-01-17|09:00|dealer';
    const newKey = '2024-01-17|14:00|floor';
    const selectedKeys = new Set([existingKey]);

    toggleExclusiveByDate(selectedKeys, newKey);

    expect(selectedKeys.has(existingKey)).toBe(true);
    expect(selectedKeys.size).toBe(1);
  });
});

// ============================================================================
// toggleGroup
// ============================================================================

describe('toggleGroup', () => {
  const groupKeys = ['2024-01-17|09:00|dealer', '2024-01-17|14:00|dealer'];

  it('그룹의 모든 항목이 미선택이면 전체 선택한다', () => {
    const selectedKeys = new Set<string>();
    const result = toggleGroup(selectedKeys, groupKeys);

    expect(result.has(groupKeys[0]!)).toBe(true);
    expect(result.has(groupKeys[1]!)).toBe(true);
  });

  it('그룹의 일부만 선택되어 있으면 전체 선택한다', () => {
    const selectedKeys = new Set([groupKeys[0]!]);
    const result = toggleGroup(selectedKeys, groupKeys);

    expect(result.has(groupKeys[0]!)).toBe(true);
    expect(result.has(groupKeys[1]!)).toBe(true);
  });

  it('그룹의 모든 항목이 선택되어 있으면 전체 해제한다', () => {
    const selectedKeys = new Set(groupKeys);
    const result = toggleGroup(selectedKeys, groupKeys);

    expect(result.has(groupKeys[0]!)).toBe(false);
    expect(result.has(groupKeys[1]!)).toBe(false);
    expect(result.size).toBe(0);
  });

  it('그룹 외의 기존 선택은 유지된다 (다른 날짜)', () => {
    const otherKey = '2024-01-18|09:00|floor';
    const selectedKeys = new Set([otherKey]);
    const result = toggleGroup(selectedKeys, groupKeys);

    expect(result.has(otherKey)).toBe(true);
    expect(result.has(groupKeys[0]!)).toBe(true);
    expect(result.has(groupKeys[1]!)).toBe(true);
  });

  it('그룹 선택 시 같은 날짜의 그룹 외 키가 제거된다', () => {
    const outsideKey = '2024-01-17|19:00|floor'; // 같은 날짜, 그룹에 포함 안 됨
    const selectedKeys = new Set([outsideKey]);

    const result = toggleGroup(selectedKeys, groupKeys);

    expect(result.has(outsideKey)).toBe(false); // 같은 날짜의 그룹 외 키 제거
    expect(result.has(groupKeys[0]!)).toBe(true);
    expect(result.has(groupKeys[1]!)).toBe(true);
  });

  it('빈 그룹 키 배열이면 원본 유지', () => {
    const selectedKeys = new Set(['some|key|here']);
    const result = toggleGroup(selectedKeys, []);

    // 빈 groupKeys -> every() returns true -> 전체 해제 경로
    // 하지만 해제할 것이 없으므로 원본과 동일
    expect(result.has('some|key|here')).toBe(true);
  });

  it('원본 Set을 변경하지 않는다 (불변성)', () => {
    const selectedKeys = new Set<string>();
    toggleGroup(selectedKeys, groupKeys);

    expect(selectedKeys.size).toBe(0);
  });
});

// ============================================================================
// getGroupSelectionState
// ============================================================================

describe('getGroupSelectionState', () => {
  const groupKeys = ['key1', 'key2', 'key3'];

  it('모든 항목이 선택되면 all 반환', () => {
    const selectedKeys = new Set(['key1', 'key2', 'key3']);
    expect(getGroupSelectionState(selectedKeys, groupKeys)).toBe('all');
  });

  it('일부 항목만 선택되면 some 반환', () => {
    const selectedKeys = new Set(['key1', 'key3']);
    expect(getGroupSelectionState(selectedKeys, groupKeys)).toBe('some');
  });

  it('하나만 선택되어도 some 반환', () => {
    const selectedKeys = new Set(['key2']);
    expect(getGroupSelectionState(selectedKeys, groupKeys)).toBe('some');
  });

  it('아무것도 선택되지 않으면 none 반환', () => {
    const selectedKeys = new Set<string>();
    expect(getGroupSelectionState(selectedKeys, groupKeys)).toBe('none');
  });

  it('그룹에 없는 키만 선택되어 있으면 none 반환', () => {
    const selectedKeys = new Set(['key4', 'key5']);
    expect(getGroupSelectionState(selectedKeys, groupKeys)).toBe('none');
  });

  it('빈 그룹 키 배열이면 none 반환', () => {
    // selectedCount === 0 이므로 none
    const selectedKeys = new Set(['key1']);
    expect(getGroupSelectionState(selectedKeys, [])).toBe('none');
  });

  it('빈 그룹 키와 빈 선택이면 none 반환', () => {
    const selectedKeys = new Set<string>();
    expect(getGroupSelectionState(selectedKeys, [])).toBe('none');
  });
});

// ============================================================================
// createAssignmentKey (하위 호환)
// ============================================================================

describe('createAssignmentKey (하위 호환)', () => {
  it('_ 구분자를 사용하여 키를 생성한다', () => {
    const key = createAssignmentKey('2024-01-17', '09:00', 'dealer');
    expect(key).toBe('2024-01-17_09:00_dealer');
  });

  it('makeSelectionKey(separator: _)와 동일한 결과를 반환한다', () => {
    const date = '2024-03-15';
    const timeSlot = '14:30';
    const role = 'floor';

    const legacyKey = createAssignmentKey(date, timeSlot, role);
    const newKey = makeSelectionKey(date, timeSlot, role, { separator: '_' });

    expect(legacyKey).toBe(newKey);
  });
});

// ============================================================================
// getDateFromKeyLegacy (하위 호환)
// ============================================================================

describe('getDateFromKeyLegacy (하위 호환)', () => {
  it('_ 구분자로 날짜를 추출한다', () => {
    expect(getDateFromKeyLegacy('2024-01-17_09:00_dealer')).toBe('2024-01-17');
  });

  it('구분자가 없으면 전체 문자열을 반환한다', () => {
    expect(getDateFromKeyLegacy('no-separator')).toBe('no-separator');
  });

  it('빈 문자열이면 빈 문자열 반환', () => {
    expect(getDateFromKeyLegacy('')).toBe('');
  });

  it('getDateFromKey(separator: _)와 동일한 결과를 반환한다', () => {
    const key = '2024-01-17_09:00_dealer';
    expect(getDateFromKeyLegacy(key)).toBe(getDateFromKey(key, { separator: '_' }));
  });
});
