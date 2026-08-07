/**
 * 정산 진입점이 `editedBy` 를 시트에 넘기는가 (머지 리뷰 LOW).
 *
 * 세 진입점 중 근무표(`VenueDayPanel:403`)만 넘기고 있었다. 안 넘기면 패치에 `editedBy` 키가
 * 아예 빠지는데, 서버는 값을 `auth.uid()` 로 덮어쓰되 **키가 없으면 퇴근 시각을 쓸 때만
 * `edited_by` 를 세우는 비대칭**이 남는다(`ConfirmedStaffRepository.ts:382` 주석).
 * 결과: 출근만 고친 저장은 "누가 고쳤는지"가 기록되지 않는다.
 */
import { render } from '@testing-library/react-native';
import React from 'react';
import { SettlementModals } from '../SettlementModals';

const mockEditSheetProps = jest.fn();

jest.mock('@/components/workLogEdit', () => ({
  WorkLogEditSheet: (props: Record<string, unknown>) => {
    mockEditSheetProps(props);
    return null;
  },
}));

jest.mock('@/stores/authStore', () => ({
  useUser: () => ({ uid: 'user-actor-1' }),
}));

jest.mock('@/components/employer', () => ({
  ReportModal: () => null,
  SettlementDetailModal: () => null,
  SettlementEditModal: () => null,
  SettlementSettingsModal: () => null,
  SettlementRevertModal: () => null,
}));

jest.mock('@/components/ui/Modal', () => ({
  ConfirmModal: () => null,
}));

const WORK_LOG = {
  id: 'wl-1',
  staffName: '김딜러',
  date: '2026-08-10',
  role: 'dealer',
  status: 'scheduled',
  payrollStatus: null,
  timeSlot: '18:00',
  checkInTime: null,
  checkOutTime: null,
};

function renderModals() {
  mockEditSheetProps.mockClear();
  return render(
    <SettlementModals
      // 이 컴포넌트는 모달 6종을 한꺼번에 렌더하므로 `useSettlementModals` 반환 **전체 형태**가
      // 필요하다. 하나씩 채우면 다음 필드에서 또 막힌다 — 소스가 참조하는 키를 전부 넣는다.
      modals={
        {
          isEditModalVisible: true,
          selectedWorkLog: WORK_LOG,
          closeEditModal: jest.fn(),

          showReportModal: false,
          closeReportModal: jest.fn(),
          isSubmittingReport: false,
          selectedStaff: null,

          isDetailModalVisible: false,
          closeDetailModal: jest.fn(),
          selectedWorkLogForDetail: null,
          selectedGroupForDetail: null,
          openEditAmountFromDetail: jest.fn(),
          openEditTimeFromDetail: jest.fn(),
          openRevertFromDetail: jest.fn(),

          isEditAmountModalVisible: false,
          closeEditAmountModal: jest.fn(),
          selectedWorkLogForEdit: null,

          isSettingsModalVisible: false,
          closeSettingsModal: jest.fn(),

          isRevertModalVisible: false,
          closeRevertModal: jest.fn(),
          selectedWorkLogForRevert: null,

          settleConfirm: { visible: false },
          closeSettleConfirm: jest.fn(),
          handleDateChange: jest.fn(),
        } as never
      }
      jobPostingId="jp-1"
      posting={null as never}
      postingSettlement={null as never}
      rolesForList={[] as never}
      // 상세 모달이 부모에서 급여를 계산하므로 이 픽스처가 없으면 렌더 자체가 죽는다.
      salaryConfig={{ defaultSalary: { type: 'hourly', amount: 0 }, allowances: {} } as never}
      filledByRole={{} as never}
      isReverting={false}
      onRevertSettlement={jest.fn()}
      onReportSubmit={jest.fn()}
      onSettleFromDetail={jest.fn()}
      onConfirmSettle={jest.fn()}
      onSaveAmountEdit={jest.fn()}
      onSaveSettings={jest.fn()}
    />
  );
}

describe('SettlementModals — editedBy 전달', () => {
  it('🔴 근무 수정 시트에 현재 사용자 uid 를 editedBy 로 넘긴다', () => {
    renderModals();

    expect(mockEditSheetProps).toHaveBeenCalled();
    const props = mockEditSheetProps.mock.calls[0]![0] as { editedBy?: string };
    expect(props.editedBy).toBe('user-actor-1');
  });
});
