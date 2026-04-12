import { STATUS } from '@/constants';
import type { ApplicationStatus } from '@/types';

export type StatusAction =
  | 'APPLY'
  | 'CONFIRM'
  | 'REJECT'
  | 'CANCEL'
  | 'REQUEST_CANCEL'
  | 'APPROVE_CANCEL'
  | 'REJECT_CANCEL';

export interface TransitionResult {
  allowed: boolean;
  nextStatus?: ApplicationStatus;
  reason?: string;
}

export interface StatusMetadata {
  label: string;
  labelEn: string;
  color: string;
  bgColor: string;
  description: string;
  isFinal: boolean;
  canStaffCancel: boolean;
  canStaffRequestCancel: boolean;
}

const TRANSITION_TABLE: Record<
  ApplicationStatus,
  Partial<Record<StatusAction, ApplicationStatus>>
> = {
  applied: {
    CONFIRM: STATUS.APPLICATION.CONFIRMED,
    REJECT: STATUS.APPLICATION.REJECTED,
    CANCEL: STATUS.APPLICATION.CANCELLED,
  },
  confirmed: {
    REQUEST_CANCEL: STATUS.APPLICATION.CANCELLATION_PENDING,
  },
  rejected: {},
  cancelled: {},
  completed: {},
  cancellation_pending: {
    APPROVE_CANCEL: STATUS.APPLICATION.CANCELLED,
    REJECT_CANCEL: STATUS.APPLICATION.CONFIRMED,
  },
};

const STATUS_METADATA: Record<ApplicationStatus, StatusMetadata> = {
  applied: {
    label: '지원 완료',
    labelEn: 'Applied',
    color: '#D4AF37',
    bgColor: '#DBEAFE',
    description: '지원이 완료되었고 구인자의 검토를 기다리고 있습니다.',
    isFinal: false,
    canStaffCancel: true,
    canStaffRequestCancel: false,
  },
  confirmed: {
    label: '확정',
    labelEn: 'Confirmed',
    color: '#10B981',
    bgColor: '#D1FAE5',
    description: '지원이 확정되었습니다.',
    isFinal: false,
    canStaffCancel: false,
    canStaffRequestCancel: true,
  },
  rejected: {
    label: '거절',
    labelEn: 'Rejected',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    description: '지원이 거절되었습니다.',
    isFinal: true,
    canStaffCancel: false,
    canStaffRequestCancel: false,
  },
  cancelled: {
    label: '취소',
    labelEn: 'Cancelled',
    color: '#9A9078',
    bgColor: '#EDEBE6',
    description: '지원이 취소되었습니다.',
    isFinal: true,
    canStaffCancel: false,
    canStaffRequestCancel: false,
  },
  completed: {
    label: '완료',
    labelEn: 'Completed',
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
    description: '근무가 완료되었습니다.',
    isFinal: true,
    canStaffCancel: false,
    canStaffRequestCancel: false,
  },
  cancellation_pending: {
    label: '취소 요청 중',
    labelEn: 'Cancellation Pending',
    color: '#F97316',
    bgColor: '#FFEDD5',
    description: '취소 요청이 제출되었고 검토를 기다리고 있습니다.',
    isFinal: false,
    canStaffCancel: false,
    canStaffRequestCancel: false,
  },
};

export class ApplicationStatusMachine {
  canTransition(currentStatus: ApplicationStatus, action: StatusAction): TransitionResult {
    const transitions = TRANSITION_TABLE[currentStatus];
    const nextStatus = transitions?.[action];

    if (!nextStatus) {
      return {
        allowed: false,
        reason: this.getDisallowedReason(currentStatus, action),
      };
    }

    return {
      allowed: true,
      nextStatus,
    };
  }

  transition(currentStatus: ApplicationStatus, action: StatusAction): ApplicationStatus {
    const result = this.canTransition(currentStatus, action);

    if (!result.allowed || !result.nextStatus) {
      throw new Error(result.reason ?? `Invalid transition: ${currentStatus} -> ${action}`);
    }

    return result.nextStatus;
  }

  getAvailableActions(currentStatus: ApplicationStatus): StatusAction[] {
    const transitions = TRANSITION_TABLE[currentStatus];
    return Object.keys(transitions ?? {}) as StatusAction[];
  }

  getAvailableStaffActions(currentStatus: ApplicationStatus): StatusAction[] {
    const metadata = STATUS_METADATA[currentStatus];
    const actions: StatusAction[] = [];

    if (metadata.canStaffCancel) {
      actions.push('CANCEL');
    }
    if (metadata.canStaffRequestCancel) {
      actions.push('REQUEST_CANCEL');
    }

    return actions;
  }

  getAvailableEmployerActions(currentStatus: ApplicationStatus): StatusAction[] {
    const employerActions: StatusAction[] = [
      'CONFIRM',
      'REJECT',
      'APPROVE_CANCEL',
      'REJECT_CANCEL',
    ];

    return this.getAvailableActions(currentStatus).filter((action) =>
      employerActions.includes(action)
    );
  }

  getStatusMetadata(status: ApplicationStatus): StatusMetadata {
    return STATUS_METADATA[status];
  }

  isFinalStatus(status: ApplicationStatus): boolean {
    return STATUS_METADATA[status].isFinal;
  }

  canStaffDirectCancel(status: ApplicationStatus): boolean {
    return STATUS_METADATA[status].canStaffCancel;
  }

  canStaffRequestCancel(status: ApplicationStatus): boolean {
    return STATUS_METADATA[status].canStaffRequestCancel;
  }

  private getDisallowedReason(status: ApplicationStatus, action: StatusAction): string {
    const metadata = STATUS_METADATA[status];

    if (metadata.isFinal) {
      return `이미 ${metadata.label} 상태입니다.`;
    }

    switch (action) {
      case 'CANCEL':
        if (status === STATUS.APPLICATION.CONFIRMED) {
          return '확정된 지원은 직접 취소할 수 없습니다. 취소 요청을 이용해 주세요.';
        }
        return `${metadata.label} 상태에서는 취소할 수 없습니다.`;
      case 'REQUEST_CANCEL':
        return `${metadata.label} 상태에서는 취소 요청을 할 수 없습니다.`;
      case 'CONFIRM':
      case 'REJECT':
        return `${metadata.label} 상태에서는 확정 또는 거절할 수 없습니다.`;
      case 'APPROVE_CANCEL':
      case 'REJECT_CANCEL':
        return '취소 요청 대기 중인 지원서가 아닙니다.';
      default:
        return `${metadata.label} 상태에서는 이 작업을 수행할 수 없습니다.`;
    }
  }
}

export const applicationStatusMachine = new ApplicationStatusMachine();
