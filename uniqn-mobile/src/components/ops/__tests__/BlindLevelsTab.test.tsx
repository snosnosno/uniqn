/**
 * BlindLevelsTab — LEVELS 탭(블라인드 구조) 폴리시 테스트.
 * 검증: (1) 프리셋 미적용 초기 라벨이 중립("프리셋 선택")으로 표시(사용자 정의 오독 방지),
 * (2) 레벨 100개 상한 — "+ 레벨 추가" 가드 토스트(무한 추가 방지).
 * 훅·리스트·자식 시트/폼은 전량 스텁(레포 관례).
 */
import { render, fireEvent } from '@testing-library/react-native';
import { useOpsBlindLevels } from '@/hooks/ops';
import { useToastStore } from '@/stores/toastStore';
import { BlindLevelsTab } from '../BlindLevelsTab';

jest.mock('@/hooks/ops', () => ({
  useOpsBlindLevels: jest.fn(() => ({ blindLevels: [], isLoading: false })),
  useOpsClock: jest.fn(() => ({ clock: null })),
  useSetBlindLevels: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
}));
jest.mock('../BlindPresetSheet', () => ({ BlindPresetSheet: () => null }));
jest.mock('../BlindLevelForm', () => ({ BlindLevelForm: () => null }));
jest.mock('@/components/ui/AppFlashList', () => ({ AppFlashList: () => null }));
jest.mock('@/components/ui/Modal', () => ({ ConfirmModal: () => null }));
jest.mock('@/stores/toastStore', () => ({
  useToastStore: {
    getState: jest.fn(() => ({ warning: jest.fn(), success: jest.fn(), error: jest.fn() })),
  },
}));

const lvl = (level: number) => ({
  level,
  smallBlind: 100,
  bigBlind: 200,
  ante: 0,
  durationSec: 1200,
  isBreak: false,
});

describe('BlindLevelsTab', () => {
  beforeEach(() => {
    (useOpsBlindLevels as jest.Mock).mockReturnValue({ blindLevels: [], isLoading: false });
  });

  it('프리셋 미적용 초기 상태 — 중립 라벨 "프리셋 선택"(사용자 정의 오독 방지)', () => {
    const { getByText, queryByText } = render(<BlindLevelsTab tournamentId="t1" />);
    expect(getByText('프리셋 선택')).toBeTruthy();
    expect(queryByText(/사용자 정의/)).toBeNull();
  });

  it('레벨 100개 상한 — "+ 레벨 추가" 시 토스트 안내, 폼 미개방', () => {
    const warning = jest.fn();
    (useToastStore.getState as jest.Mock).mockReturnValue({
      warning,
      success: jest.fn(),
      error: jest.fn(),
    });
    const full = Array.from({ length: 100 }, (_, i) => lvl(i + 1));
    (useOpsBlindLevels as jest.Mock).mockReturnValue({ blindLevels: full, isLoading: false });

    const { getByText } = render(<BlindLevelsTab tournamentId="t1" />);
    fireEvent.press(getByText('+ 레벨 추가'));

    expect(warning).toHaveBeenCalledWith(expect.stringContaining('100'));
    // 폼이 열렸다면 버튼 텍스트가 "닫기"로 바뀐다 — 가드 시 그대로 "+ 레벨 추가".
    expect(getByText('+ 레벨 추가')).toBeTruthy();
  });
});
