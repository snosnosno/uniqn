/**
 * gridWriteService — 근무표 쓰기 변이의 Service 경계.
 *
 * 아키텍처(Presentation → Hooks → Service → Repository) 준수: 그리드 쓰기 변이는 Repository
 * 직접호출이 아니라 이 Service 를 경유한다. (읽기 전용 TanStack 조회만 Repository 직접호출 허용.)
 * 현재는 얇은 위임이지만, 향후 변이 전후 오케스트레이션(권한/낙관 무효화/감사)의 단일 지점이 된다.
 * 날짜 정규화(E5)·색상 화이트리스트·메모 XSS 검증은 RPC/레포 경계가 담당(여기서 중복하지 않는다).
 */
import { workScheduleRepository } from '@/repositories/workSchedule';
import {
  workLogRepository,
  jobPostingRepository,
  type UpdateSlotInput,
  type SetVenueRoleSalaryInput,
  type UpdateVenueContainerInput,
} from '@/repositories';
import { cancelConfirmedStaffConfirmation } from '@/services/work/confirmedStaffService';
import { ValidationError, ERROR_CODES } from '@/errors';
import { xssValidation } from '@/utils/security';
import type { VenueContainer } from '@/domains/workSchedule';
import type { DeleteConfirmedStaffInput } from '@/types';

/**
 * 지점 단가표 customRole 자유입력 길이 상한 — RPC set_venue_role_salary 의 서버 규약(≤50자)과 동일.
 * 클라를 서버보다 엄하게 두지 않아야(기존 저장된 30~50자 customRole 재저장 데드엔드 방지) 값을 맞춘다.
 */
const MAX_VENUE_CUSTOM_ROLE_LENGTH = 50;

/** 운영처 날짜별 목표인원(soft-target) 저장. 날짜 정규화(E5)·권한은 RPC(레포 경계)가 담당. */
export function setVenueSoftTarget(venueId: string, date: string, count: number): Promise<void> {
  return workScheduleRepository.setVenueSoftTarget(venueId, date, count);
}

/**
 * 지점 역할별 단가 upsert/삭제(salary:null=삭제). 권한·정규화는 RPC(레포 경계)가 담당하되,
 * customRole 자유입력의 XSS·길이 검증은 3표면(AddSlotSheet JIT·VenueSettingsSheet·venue-settlements)
 * 공용 경계인 이 Service 에서 선차단한다(RPC 미도달 fail-closed). 슬롯 저장 경로(addSlotPayload)의
 * assertSafeText 관용구(xssValidation + SECURITY_XSS_DETECTED)와 동일 함수·에러 타입 재사용.
 */
export function setVenueRoleSalary(venueId: string, input: SetVenueRoleSalaryInput): Promise<void> {
  const trimmedCustom = input.customRole?.trim();
  if (trimmedCustom) {
    if (trimmedCustom.length > MAX_VENUE_CUSTOM_ROLE_LENGTH) {
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        field: 'customRole',
        userMessage: `역할명은 ${MAX_VENUE_CUSTOM_ROLE_LENGTH}자를 초과할 수 없습니다.`,
      });
    }
    if (!xssValidation(trimmedCustom)) {
      throw new ValidationError(ERROR_CODES.SECURITY_XSS_DETECTED, {
        category: 'security',
        severity: 'medium',
        userMessage: '역할명에 허용되지 않는 문자가 포함되어 있습니다',
      });
    }
  }
  return workScheduleRepository.setVenueRoleSalary(venueId, input);
}

/** 배치 슬롯 편집(시간·역할·색상·메모). 색상 화이트리스트·메모 XSS 검증은 레포 경계가 담당. */
export function updateSlot(workLogId: string, input: UpdateSlotInput): Promise<void> {
  return workLogRepository.updateSlot(workLogId, input);
}

/**
 * 배치 슬롯 빼기. 직접추가분(applicationId 없음)=remove_direct_staff, 지원확정분=확정해제 RPC —
 * 이 분기는 confirmedStaffService.cancelConfirmedStaffConfirmation 이 담당(removeDirectStaff
 * 직접 호출 금지: 공고 스팬 슬롯에서 NOT_DIRECT_STAFF). 권한 게이트는 RPC 경계.
 */
export function deleteSlot(input: DeleteConfirmedStaffInput): Promise<void> {
  return cancelConfirmedStaffConfirmation(input);
}

/**
 * 운영처 컨테이너 생성(get-or-create, 멱등). 이름 XSS 검증(S1)·워크스페이스 권한 게이트는
 * 레포/RPC 경계가 담당. v1 은 kind='dated' 고정(날짜 기반 그리드 전제).
 */
export function createVenueContainer(workspaceId: string, name: string): Promise<VenueContainer> {
  return jobPostingRepository.getOrCreateVenueContainer(workspaceId, { name, kind: 'dated' });
}

/** 지점 프로필 각 필드의 길이 상한 — RPC 서버 규약과 동일하게 맞춘다(클라를 서버보다 엄히 두지 않음). */
const MAX_VENUE_NAME_LENGTH = 50;
const MAX_VENUE_PHONE_LENGTH = 25;
const MAX_VENUE_DESCRIPTION_LENGTH = 500;
const MAX_VENUE_PLACE_NAME_LENGTH = 100;

/** 자유입력 텍스트의 XSS·길이 선차단(RPC 미도달 fail-closed). setVenueRoleSalary 관용구 재사용. */
function assertVenueText(value: string, field: string, max: number, label: string): void {
  if (value.length > max) {
    throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
      field,
      userMessage: `${label}은(는) ${max}자를 초과할 수 없습니다.`,
    });
  }
  if (value.length > 0 && !xssValidation(value)) {
    throw new ValidationError(ERROR_CODES.SECURITY_XSS_DETECTED, {
      category: 'security',
      severity: 'medium',
      userMessage: `${label}에 허용되지 않는 문자가 포함되어 있습니다`,
    });
  }
}

/**
 * 지점 프로필(이름·장소명·연락처·소개) 수정. 권한 게이트·23505 변환은 RPC 경계가 담당하고,
 * 자유입력의 XSS·길이만 여기서 선차단한다.
 *
 * ⚠️ 부분 갱신 의미론을 여기서 훼손하지 말 것 — undefined 는 "미변경", 빈 문자열은 "제거"다.
 *   이 프로젝트의 관용구인 null→undefined 정규화를 적용하면 사용자가 필드를 비운 행위가
 *   조용히 "안 바꿈"이 된다(에러 0으로 실패한다).
 */
export function updateVenueContainer(
  containerId: string,
  input: UpdateVenueContainerInput
): Promise<void> {
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (trimmed.length === 0) {
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        field: 'name',
        userMessage: '지점명을 입력해주세요.',
      });
    }
    assertVenueText(input.name, 'name', MAX_VENUE_NAME_LENGTH, '지점명');
  }
  if (input.contactPhone !== undefined) {
    assertVenueText(input.contactPhone, 'contactPhone', MAX_VENUE_PHONE_LENGTH, '연락처');
  }
  if (input.description !== undefined) {
    assertVenueText(input.description, 'description', MAX_VENUE_DESCRIPTION_LENGTH, '지점 소개');
  }
  if (input.location?.name !== undefined) {
    assertVenueText(input.location.name, 'location', MAX_VENUE_PLACE_NAME_LENGTH, '장소명');
  }
  return jobPostingRepository.updateVenueContainer(containerId, input);
}
