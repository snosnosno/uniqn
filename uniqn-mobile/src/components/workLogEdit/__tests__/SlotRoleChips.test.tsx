/**
 * SlotRoleChips — D7(마감 표기하되 차단하지 않음) 계약 테스트
 *
 * 🔴 이 스위트의 존재 이유는 **선의의 차단을 막는 것**이다. 마감 역할을 `disabled` 로 만드는 것은
 *    직관적이지만 사용자 결정 D7 위반이다 — 대회 당일 급구처럼 "정원 초과인 걸 알면서 지금
 *    넣어야 하는" 상황이 실재한다. 표기는 남기고 결정은 사람에게 넘긴다.
 *
 * 🔑 마감 판정은 `selectPostingRoleAvailability` 하나로만 한다. `RoleChangeModal.tsx:159-165`
 *    가 쓰던 그 함수라, 같은 데이터에서 두 화면의 판정이 갈릴 수 없다. 그 함수는
 *    `remaining = count - filled` 를 계산하므로 **정원(`JobPosting`)과 실확정(`filledByRole`)이
 *    둘 다** 있어야 마감을 알 수 있다. 하나라도 없으면 표기를 생략한다(설계 §3-2-b 폴백).
 *
 * ⚠️ 선택 상태를 `accessibilityState.selected` 로 단언하지 않는다 — react-native-web 0.21.2 가
 *    처리하지 않는다. 선택 표식(체크)의 렌더 여부로 본다.
 */
import { render, screen, fireEvent } from '@testing-library/react-native';

import type { JobPosting } from '@/types';

import { SlotRoleChips } from '../SlotRoleChips';

interface FixtureRole {
  id: string;
  role: string;
  count: number;
  customRole?: string;
}

/**
 * 마감 판정에 필요한 최소 공고. `roleAvailability.hydrate.test.ts` 의 픽스처를 축약했다 —
 * 정원은 `schedule.requirements[].timeSlots[].roles[].count` 에서만 나온다.
 */
function createPosting(roles: FixtureRole[]): JobPosting {
  return {
    id: 'job-1',
    schemaVersion: 3,
    title: '역할 칩 테스트',
    status: 'active',
    ownerId: 'owner-1',
    ownerName: 'Owner',
    workDate: '2026-08-10',
    workDates: ['2026-08-10'],
    totalPositions: roles.reduce((sum, role) => sum + role.count, 0),
    filledPositions: 0,
    location: { name: 'Seoul', district: 'Gangnam', detailedAddress: '101' },
    schedule: {
      kind: 'dated',
      primaryDate: '2026-08-10',
      allDates: ['2026-08-10'],
      requirements: [
        {
          date: '2026-08-10',
          timeSlots: [{ id: 'slot-1', startTime: '18:00', roles }],
        },
      ],
    },
    roleCatalog: [],
    compensation: { mode: 'shared', defaultSalary: { type: 'hourly', amount: 20000 } },
    questions: { items: [] },
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  } as JobPosting;
}

/** 플로어 정원 1명짜리 공고 — 마감 케이스의 기준 픽스처. */
const FLOOR_ONE = createPosting([
  { id: 'dealer-1', role: 'dealer', count: 2 },
  { id: 'floor-1', role: 'floor', count: 1 },
]);

describe('SlotRoleChips — D7: 마감은 표기만, 선택은 허용', () => {
  it('🔴 마감된 역할도 선택할 수 있다 (D7 — 차단하지 않는다)', () => {
    const onChange = jest.fn();
    render(
      <SlotRoleChips
        value="dealer"
        onChange={onChange}
        jobPosting={FLOOR_ONE}
        filledByRole={{ floor: 1 }}
      />
    );

    fireEvent.press(screen.getByLabelText('역할 플로어 (마감)'));

    expect(onChange).toHaveBeenCalledWith('floor');
  });

  it('마감된 역할에 "(마감)" 을 병기한다', () => {
    render(
      <SlotRoleChips
        value="dealer"
        onChange={jest.fn()}
        jobPosting={FLOOR_ONE}
        filledByRole={{ floor: 1 }}
      />
    );

    expect(screen.getByLabelText('역할 플로어 (마감)')).toBeTruthy();
    // 라벨만이 아니라 **눈에도** 보여야 한다 — 색만으로 상태를 말하지 않는다.
    // ⚠️ 반드시 정규식으로 본다. RNTL 의 toHaveTextContent 는 문자열 인자를 **완전일치**로
    //    판정해서, '(마감)' 을 넘기면 칩 전체 텍스트('👔 플로어(마감)')와 달라 항상 실패하고
    //    아래 not 단언은 반대로 **항상 통과**하는 빈 가드가 된다(2026-08-06 실측).
    expect(screen.getByTestId('role-chip-floor')).toHaveTextContent(/\(마감\)/);
  });

  it('정원이 넘쳐도(초과 확정) 마감으로만 표기하고 선택은 열어 둔다', () => {
    const onChange = jest.fn();
    render(
      <SlotRoleChips
        value="dealer"
        onChange={onChange}
        jobPosting={FLOOR_ONE}
        filledByRole={{ floor: 3 }}
      />
    );

    fireEvent.press(screen.getByLabelText('역할 플로어 (마감)'));

    expect(onChange).toHaveBeenCalledWith('floor');
  });

  it('정원이 남아 있으면(정원 2 · 확정 1) 표기하지 않는다', () => {
    // 🔴 브리프가 틀렸던 바로 그 축이다. `filled` 값이 **있다는 것만으로** 마감으로 읽으면
    //    안 된다 — 마감은 `remaining = count - filled` 가 0 일 때뿐이다.
    render(
      <SlotRoleChips
        value="floor"
        onChange={jest.fn()}
        jobPosting={FLOOR_ONE}
        filledByRole={{ dealer: 1 }}
      />
    );

    // 딜러 정원 2 · 확정 1 → 여유 1
    expect(screen.getByLabelText('역할 딜러')).toBeTruthy();
    expect(screen.getByTestId('role-chip-dealer')).not.toHaveTextContent(/마감/);
  });

  it('filledByRole 이 없으면 마감 표기를 생략한다', () => {
    render(<SlotRoleChips value="dealer" onChange={jest.fn()} jobPosting={FLOOR_ONE} />);

    expect(screen.getByLabelText('역할 플로어')).toBeTruthy();
  });

  it('jobPosting 이 없으면 filledByRole 이 있어도 마감 표기를 생략한다 (= 근무표 경로)', () => {
    // 정원을 모르면 마감을 알 수 없다. RoleChangeModal 의 현행 폴백과 같은 동작이다.
    // 🔑 근무표(VenueDayPanel)가 실제로 이 경우다 — 하루치 슬롯이 행마다 다른 공고에 걸려 있고
    //    컨테이너 직속 배치는 대응 공고 자체가 없다. **결함이 아니라 설계 §3-2-b 의 의도**다.
    render(<SlotRoleChips value="dealer" onChange={jest.fn()} filledByRole={{ floor: 99 }} />);

    expect(screen.getByLabelText('역할 플로어')).toBeTruthy();
  });

  it('공고에 없는 역할은 마감으로 보지 않는다', () => {
    // 정원 항목이 없는 역할(서빙)은 remaining 을 계산할 근거가 없다 — 0 으로 단정하면
    // 공고에 안 적힌 역할 전부가 마감으로 보인다.
    render(
      <SlotRoleChips
        value="dealer"
        onChange={jest.fn()}
        jobPosting={FLOOR_ONE}
        filledByRole={{ floor: 1 }}
      />
    );

    expect(screen.getByLabelText('역할 서빙')).toBeTruthy();
  });
});

describe('SlotRoleChips — 역할 목록과 선택', () => {
  it('StaffRole 6종을 모두 렌더한다', () => {
    render(<SlotRoleChips value="dealer" onChange={jest.fn()} />);

    ['딜러', '플로어', '서빙', '매니저', '직원', '기타'].forEach((name) => {
      expect(screen.getByLabelText(`역할 ${name}`)).toBeTruthy();
    });
  });

  it('선택된 칩에만 선택 표식이 보인다', () => {
    render(<SlotRoleChips value="floor" onChange={jest.fn()} />);

    expect(screen.getByTestId('role-chip-selected-floor')).toBeTruthy();
    expect(screen.queryByTestId('role-chip-selected-dealer')).toBeNull();
  });

  it('이미 선택된 칩을 다시 눌러도 같은 값으로 통지한다', () => {
    const onChange = jest.fn();
    render(<SlotRoleChips value="dealer" onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('역할 딜러'));

    expect(onChange).toHaveBeenCalledWith('dealer');
  });

  it('readOnly 면 눌러도 통지하지 않는다', () => {
    const onChange = jest.fn();
    render(<SlotRoleChips value="dealer" onChange={onChange} readOnly />);

    fireEvent.press(screen.getByLabelText('역할 플로어'));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('SlotRoleChips — other 는 customRole 과 짝이라 칩 하나로 대응하지 않는다', () => {
  it('공고의 other:<customRole> 정원이 차도 "기타" 칩에는 표기하지 않는다', () => {
    // 공고가 '기타' 를 자유문자로 여러 개 둘 수 있어(other:플로어장 / other:주차) 칩 하나가
    // 어느 항목을 뜻하는지 정해지지 않는다. 임의로 하나에 붙이면 오표기다.
    const posting = createPosting([
      { id: 'other-1', role: 'other', customRole: '플로어장', count: 1 },
    ]);
    render(
      <SlotRoleChips
        value="dealer"
        onChange={jest.fn()}
        jobPosting={posting}
        filledByRole={{ 'other:플로어장': 1 }}
      />
    );

    expect(screen.getByLabelText('역할 기타')).toBeTruthy();
  });

  it('customRole 없는 other 정원이 차면 "기타" 칩에 표기한다', () => {
    // 이름 없는 other 항목의 역할키는 'other:'(빈 custom) 이고, 칩 키 'other' 와 1:1 로 만난다.
    const posting = createPosting([{ id: 'other-1', role: 'other', count: 1 }]);
    render(
      <SlotRoleChips
        value="dealer"
        onChange={jest.fn()}
        jobPosting={posting}
        filledByRole={{ 'other:': 1 }}
      />
    );

    expect(screen.getByLabelText('역할 기타 (마감)')).toBeTruthy();
  });
});
