/**
 * postingSlotTimeChange — 시간 일괄 변경 묶음 축이 서버 RPC 축과 어긋나지 않는지 지킨다.
 *
 * 🔴 이 파일이 지키는 것은 "화면이 한 묶음으로 보여준 집합 = 서버가 받는 집합" 이다.
 *    갈리면 서버가 `SLOT_MISMATCH` 로 전체를 거부해 사용자에겐 이유 없이 안 되는 화면이 된다.
 *    서버 축: (jobPostingId, date, _posting_role_key, _posting_slot_key) + 소프트 취소 제외.
 */
import {
  UNDECIDED_SLOT_KEY,
  buildSlotTimeChangeGroups,
  countAtDestination,
  workLogRoleKey,
  workLogSlotKey,
} from '../postingSlotTimeChange';
import type { VenueDaySlot } from '@/repositories/interfaces/IWorkScheduleRepository';

function slot(overrides: Partial<VenueDaySlot> & { workLogId: string }): VenueDaySlot {
  return {
    staffId: `staff-${overrides.workLogId}`,
    staffName: `이름${overrides.workLogId}`,
    staffNickname: null,
    staffPhotoUrl: null,
    role: 'dealer',
    customRole: null,
    timeSlot: '18:00',
    status: 'scheduled',
    jobPostingId: 'jp-1',
    isContainer: false,
    color: null,
    notes: null,
    ...overrides,
  };
}

describe('workLogRoleKey — 서버 _posting_role_key 동치', () => {
  it('customRole 이 있으면 role 과 무관하게 other:<custom> 이다', () => {
    // 🔴 roleHydrateKey 와 갈리는 지점. 그쪽은 role==='other' 일 때만 커스텀을 본다.
    expect(workLogRoleKey('dealer', '바리스타')).toBe('other:바리스타');
    expect(workLogRoleKey('other', '바리스타')).toBe('other:바리스타');
  });

  it('customRole 이 비었으면 other 는 콜론만 붙고 나머지는 역할 원본이다', () => {
    expect(workLogRoleKey('other', null)).toBe('other:');
    expect(workLogRoleKey('other', '   ')).toBe('other:');
    expect(workLogRoleKey('dealer', null)).toBe('dealer');
  });
});

describe('workLogSlotKey — 서버 _posting_slot_key 동치', () => {
  it('미정 센티널 4종을 한 키로 접는다 (R0 #409)', () => {
    // 접히지 않으면 같은 슬롯이 여러 묶음으로 쪼개져 정원 판정과 축이 갈린다.
    for (const raw of [null, undefined, '', '미정', 'NEGOTIABLE']) {
      expect(workLogSlotKey(raw)).toBe(UNDECIDED_SLOT_KEY);
    }
  });

  it('범위 문자열은 시작 시각으로 접힌다 (레거시 하위호환)', () => {
    expect(workLogSlotKey('18:30 - 03:00')).toBe('18:30');
    expect(workLogSlotKey('18:30~03:00')).toBe('18:30');
  });

  it('단일 시각은 항등이다', () => {
    expect(workLogSlotKey('09:00')).toBe('09:00');
  });
});

describe('buildSlotTimeChangeGroups', () => {
  it('같은 공고·역할·시각만 한 묶음으로 접는다', () => {
    const groups = buildSlotTimeChangeGroups([
      slot({ workLogId: 'a' }),
      slot({ workLogId: 'b' }),
      slot({ workLogId: 'c', role: 'floor' }),
      slot({ workLogId: 'd', timeSlot: '19:00' }),
    ]);

    expect(groups.map((g) => `${g.slotKey}/${g.roleKey}/${g.members.length}`)).toEqual([
      '18:00/dealer/2',
      '18:00/floor/1',
      '19:00/dealer/1',
    ]);
  });

  it('🔴 다른 공고의 배치는 섞이지 않는다', () => {
    // 근무표 하루 목록은 venue 스팬이라 여러 공고가 섞여 있다. 공고를 축에서 빼면
    // 서버가 공고 하나만 받으므로 나머지가 전부 축 밖으로 떨어져 전체 거부된다.
    const groups = buildSlotTimeChangeGroups([
      slot({ workLogId: 'a', jobPostingId: 'jp-1' }),
      slot({ workLogId: 'b', jobPostingId: 'jp-2' }),
    ]);

    expect(groups).toHaveLength(2);
    expect(new Set(groups.map((g) => g.jobPostingId))).toEqual(new Set(['jp-1', 'jp-2']));
  });

  it('🔴 취소·노쇼는 후보에서 빠진다 (소프트 취소 필터)', () => {
    // 넣으면 서버 축과 갈려 SLOT_MISMATCH 가 되고, 통과했다면 취소자에게 알림이 갔을 것이다.
    const groups = buildSlotTimeChangeGroups([
      slot({ workLogId: 'a' }),
      slot({ workLogId: 'x', status: 'cancelled' }),
      slot({ workLogId: 'y', status: 'no_show' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.members.map((m) => m.workLogId)).toEqual(['a']);
  });

  it('미정 묶음은 목록 맨 뒤로 간다', () => {
    const groups = buildSlotTimeChangeGroups([
      slot({ workLogId: 'u', timeSlot: null }),
      slot({ workLogId: 'a', timeSlot: '09:00' }),
      slot({ workLogId: 'b', timeSlot: '18:00' }),
    ]);

    expect(groups.map((g) => g.slotKey)).toEqual(['09:00', '18:00', UNDECIDED_SLOT_KEY]);
    expect(groups[2]!.displayTimeSlot).toBeNull();
  });

  it('배치가 없으면 빈 목록이다', () => {
    expect(buildSlotTimeChangeGroups([])).toEqual([]);
  });

  it('원본 배열을 변형하지 않는다', () => {
    const slots = [slot({ workLogId: 'a' }), slot({ workLogId: 'b' })];
    const snapshot = JSON.stringify(slots);
    buildSlotTimeChangeGroups(slots);
    expect(JSON.stringify(slots)).toBe(snapshot);
  });
});

describe('countAtDestination', () => {
  const slots = [
    slot({ workLogId: 'a', timeSlot: '19:00' }),
    slot({ workLogId: 'b', timeSlot: '19:00' }),
    slot({ workLogId: 'x', timeSlot: '19:00', status: 'cancelled' }),
    slot({ workLogId: 'c', timeSlot: '19:00', role: 'floor' }),
    slot({ workLogId: 'd', timeSlot: '19:00', jobPostingId: 'jp-2' }),
  ];

  it('같은 공고·역할·시각의 활성 인원만 센다', () => {
    expect(
      countAtDestination(slots, { jobPostingId: 'jp-1', roleKey: 'dealer', slotKey: '19:00' })
    ).toBe(2);
  });

  it('아직 아무도 없는 시각은 0 이다 (슬롯 신설 경로)', () => {
    expect(
      countAtDestination(slots, { jobPostingId: 'jp-1', roleKey: 'dealer', slotKey: '09:00' })
    ).toBe(0);
  });
});
