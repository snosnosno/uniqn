/**
 * OpsRegistrationCutoffCard — 레이트 등록 자동 마감 설정(모바일).
 *
 * 고정하는 계약:
 *  1. 고를 레벨이 없고 저장된 설정도 없으면 자리를 차지하지 않는다(블라인드 미설정·마지막 레벨).
 *  2. 선택지는 **지금 레벨부터, 마지막 순번 제외** — 서버가 거부하는 값을 화면이 내놓지 않는다.
 *  3. 고르는 것과 적용이 나뉜다 — 고르기만 해서는 요청이 나가지 않는다.
 *  4. 등록이 닫힌 동안에는 새 기준을 못 넣고 해제만 된다(열면 서버가 지우므로).
 */
import { render, fireEvent } from '@testing-library/react-native';
import { useOpsBlindLevels, useOpsClock } from '@/hooks/ops';
import { OpsRegistrationCutoffCard, cutoffStatusText } from '../OpsRegistrationCutoffCard';

const mockMutate = jest.fn();
jest.mock('@/hooks/ops', () => ({
  useOpsBlindLevels: jest.fn(),
  useOpsClock: jest.fn(),
  useSetRegistrationCutoff: jest.fn(() => ({ mutate: mockMutate, isPending: false })),
}));

// SheetModal 실물 대신 children+footer 통과 스텁(레포 관례).
jest.mock('@/components/ui', () => ({
  SheetModal: ({ visible, children, footer }: any) => {
    const { View } = require('react-native');
    return visible ? (
      <View>
        {children}
        {footer}
      </View>
    ) : null;
  },
}));

// 레벨 1 · 레벨 2 · 휴식 · 레벨 3 · 레벨 4
const levels = [
  { sort: 1, level: 1, isBreak: false },
  { sort: 2, level: 2, isBreak: false },
  { sort: 3, level: 2, isBreak: true },
  { sort: 4, level: 3, isBreak: false },
  { sort: 5, level: 4, isBreak: false },
];

const tournament = (over: Record<string, unknown> = {}) =>
  ({ id: 't1', registrationOpen: true, registrationCloseAfterSort: null, ...over }) as any;

function setup(currentSort = 1, blindLevels: unknown[] = levels) {
  (useOpsBlindLevels as jest.Mock).mockReturnValue({ blindLevels });
  (useOpsClock as jest.Mock).mockReturnValue({ clock: { currentLevelSort: currentSort } });
}

beforeEach(() => {
  mockMutate.mockReset();
});

describe('OpsRegistrationCutoffCard', () => {
  it('블라인드 구조가 없으면 렌더하지 않는다', () => {
    setup(1, []);
    const { toJSON } = render(<OpsRegistrationCutoffCard tournament={tournament()} />);
    expect(toJSON()).toBeNull();
  });

  it('설정 전: 사용 안 함 + 안내 문구', () => {
    setup();
    const { getByText } = render(<OpsRegistrationCutoffCard tournament={tournament()} />);
    expect(getByText('사용 안 함 ▾')).toBeTruthy();
    expect(getByText('레벨이나 휴식이 끝날 때 등록을 자동으로 닫을 수 있어요.')).toBeTruthy();
  });

  it('선택지는 지금 레벨부터, 마지막 순번은 뺀다', () => {
    setup(2);
    const { getByText, getByLabelText, queryByLabelText } = render(
      <OpsRegistrationCutoffCard tournament={tournament()} />
    );
    fireEvent.press(getByText('사용 안 함 ▾'));

    expect(queryByLabelText('레벨 1 종료 시')).toBeNull(); // 이미 지난 레벨
    expect(getByLabelText('레벨 2 종료 시')).toBeTruthy();
    expect(getByLabelText('레벨 2 뒤 휴식 종료 시')).toBeTruthy();
    expect(getByLabelText('레벨 3 종료 시')).toBeTruthy();
    expect(queryByLabelText('레벨 4 종료 시')).toBeNull(); // 마지막 — 넘어갈 곳이 없다
  });

  it('고르기만 해서는 요청이 나가지 않고, 적용을 눌러야 그 순번으로 나간다', () => {
    setup();
    const { getByText, getByLabelText } = render(
      <OpsRegistrationCutoffCard tournament={tournament()} />
    );
    fireEvent.press(getByText('사용 안 함 ▾'));
    fireEvent.press(getByLabelText('레벨 2 뒤 휴식 종료 시'));
    expect(mockMutate).not.toHaveBeenCalled();

    fireEvent.press(getByLabelText('자동 마감 적용'));
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0][0]).toBe(3);
  });

  it('바꾼 것이 없으면 적용이 막힌다', () => {
    setup();
    const { getByText, getByLabelText } = render(
      <OpsRegistrationCutoffCard tournament={tournament({ registrationCloseAfterSort: 3 })} />
    );
    fireEvent.press(getByText('레벨 2 뒤 휴식 종료 시 ▾'));
    fireEvent.press(getByLabelText('자동 마감 적용'));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('해제는 null 로 나간다', () => {
    setup();
    const { getByText, getByLabelText } = render(
      <OpsRegistrationCutoffCard tournament={tournament({ registrationCloseAfterSort: 3 })} />
    );
    fireEvent.press(getByText('레벨 2 뒤 휴식 종료 시 ▾'));
    fireEvent.press(getByLabelText('사용 안 함'));
    fireEvent.press(getByLabelText('자동 마감 적용'));
    expect(mockMutate.mock.calls[0][0]).toBeNull();
  });

  it('등록이 닫힌 동안에는 새 기준을 넣을 수 없다 — 열면 서버가 지운다', () => {
    setup();
    const { getByText, getByLabelText } = render(
      <OpsRegistrationCutoffCard tournament={tournament({ registrationOpen: false })} />
    );
    fireEvent.press(getByText('사용 안 함 ▾'));
    fireEvent.press(getByLabelText('레벨 2 종료 시'));
    expect(
      getByText('등록이 닫혀 있어요. 먼저 등록을 연 뒤 자동 마감을 설정해 주세요.')
    ).toBeTruthy();
    fireEvent.press(getByLabelText('자동 마감 적용'));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('기준이 이미 지나 자동 마감됐으면 그렇게 말하고, 지난 기준도 선택지에 남긴다', () => {
    setup(4);
    const { getByText, getByLabelText } = render(
      <OpsRegistrationCutoffCard
        tournament={tournament({ registrationOpen: false, registrationCloseAfterSort: 2 })}
      />
    );
    expect(
      getByText('레벨 2 종료로 등록이 자동 마감됐어요. 다시 열면 자동 마감 설정은 해제돼요.')
    ).toBeTruthy();
    fireEvent.press(getByText('레벨 2 종료 시 ▾'));
    expect(getByLabelText('레벨 2 종료 시')).toBeTruthy();
  });
});

describe('cutoffStatusText', () => {
  it('기준 레벨이 구조에서 사라졌으면 다시 고르라고 한다', () => {
    expect(cutoffStatusText({ kind: 'orphan' }, true)).toBe(
      '기준으로 잡은 레벨이 블라인드 구조에서 없어졌어요. 다시 골라 주세요.'
    );
  });
});
