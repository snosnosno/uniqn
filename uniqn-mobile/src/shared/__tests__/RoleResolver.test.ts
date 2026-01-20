/**
 * RoleResolver 테스트
 *
 * @description Phase 4 - 역할 처리 통합
 * 사용자 역할(UserRole)과 직무 역할(StaffRole) 처리 테스트
 */

import { RoleResolver } from '../role/RoleResolver';
import type { UserRole } from '@/types';

describe('RoleResolver', () => {
  // ==========================================================================
  // normalizeUserRole: 문자열 → UserRole 정규화
  // ==========================================================================
  describe('normalizeUserRole', () => {
    it.each([
      ['admin', 'admin'],
      ['ADMIN', 'admin'],
      ['Admin', 'admin'],
      ['employer', 'employer'],
      ['EMPLOYER', 'employer'],
      ['Employer', 'employer'],
      ['staff', 'staff'],
      ['STAFF', 'staff'],
      ['Staff', 'staff'],
    ] as const)('문자열 %s → UserRole %s', (input, expected) => {
      expect(RoleResolver.normalizeUserRole(input)).toBe(expected);
    });

    it('하위 호환성: manager → employer', () => {
      expect(RoleResolver.normalizeUserRole('manager')).toBe('employer');
      expect(RoleResolver.normalizeUserRole('Manager')).toBe('employer');
      expect(RoleResolver.normalizeUserRole('MANAGER')).toBe('employer');
    });

    it('공백 트림 처리', () => {
      expect(RoleResolver.normalizeUserRole('  admin  ')).toBe('admin');
      expect(RoleResolver.normalizeUserRole('\temployer\n')).toBe('employer');
    });

    it('null/undefined → null', () => {
      expect(RoleResolver.normalizeUserRole(null)).toBeNull();
      expect(RoleResolver.normalizeUserRole(undefined)).toBeNull();
    });

    it('빈 문자열 → null', () => {
      expect(RoleResolver.normalizeUserRole('')).toBeNull();
      expect(RoleResolver.normalizeUserRole('   ')).toBeNull();
    });

    it('유효하지 않은 역할 → null', () => {
      expect(RoleResolver.normalizeUserRole('invalid')).toBeNull();
      expect(RoleResolver.normalizeUserRole('superuser')).toBeNull();
      expect(RoleResolver.normalizeUserRole('user')).toBeNull();
    });
  });

  // ==========================================================================
  // hasPermission: 권한 계층 체크
  // ==========================================================================
  describe('hasPermission', () => {
    // 정확히 같은 역할
    it.each([
      ['admin', 'admin', true],
      ['employer', 'employer', true],
      ['staff', 'staff', true],
    ] as const)('%s는 %s 권한 있음', (userRole, required, expected) => {
      expect(RoleResolver.hasPermission(userRole, required as UserRole)).toBe(expected);
    });

    // 상위 역할 → 하위 권한 접근 가능
    it.each([
      ['admin', 'employer', true],
      ['admin', 'staff', true],
      ['employer', 'staff', true],
    ] as const)('%s는 %s 권한 있음 (상위)', (userRole, required, expected) => {
      expect(RoleResolver.hasPermission(userRole, required as UserRole)).toBe(expected);
    });

    // 하위 역할 → 상위 권한 접근 불가
    it.each([
      ['employer', 'admin', false],
      ['staff', 'admin', false],
      ['staff', 'employer', false],
    ] as const)('%s는 %s 권한 없음 (하위)', (userRole, required, expected) => {
      expect(RoleResolver.hasPermission(userRole, required as UserRole)).toBe(expected);
    });

    // null/undefined 처리
    it('null 역할 → false', () => {
      expect(RoleResolver.hasPermission(null, 'staff')).toBe(false);
      expect(RoleResolver.hasPermission(undefined, 'staff')).toBe(false);
    });

    // 문자열 정규화 후 체크
    it('문자열 역할도 정규화하여 처리', () => {
      expect(RoleResolver.hasPermission('ADMIN', 'employer')).toBe(true);
      expect(RoleResolver.hasPermission('Manager', 'employer')).toBe(true); // manager → employer
      expect(RoleResolver.hasPermission('Staff', 'admin')).toBe(false);
    });

    it('유효하지 않은 역할 → false', () => {
      expect(RoleResolver.hasPermission('invalid', 'staff')).toBe(false);
    });
  });

  // ==========================================================================
  // requireAdmin: admin 권한 필수 확인 (에러 발생)
  // ==========================================================================
  describe('requireAdmin', () => {
    it('admin 역할이면 에러 없음', () => {
      expect(() => RoleResolver.requireAdmin('admin')).not.toThrow();
    });

    it('employer 역할이면 PermissionError 발생', () => {
      expect(() => RoleResolver.requireAdmin('employer')).toThrow();
    });

    it('staff 역할이면 PermissionError 발생', () => {
      expect(() => RoleResolver.requireAdmin('staff')).toThrow();
    });

    it('null/undefined이면 PermissionError 발생', () => {
      expect(() => RoleResolver.requireAdmin(null)).toThrow();
      expect(() => RoleResolver.requireAdmin(undefined)).toThrow();
    });

    it('에러 메시지에 권한 정보 포함', () => {
      try {
        RoleResolver.requireAdmin('staff');
        fail('에러가 발생해야 합니다');
      } catch (error) {
        expect((error as { userMessage?: string }).userMessage).toBe(
          '관리자 권한이 필요합니다'
        );
      }
    });
  });

  // ==========================================================================
  // requireRole: 특정 역할 이상 권한 필수 확인
  // ==========================================================================
  describe('requireRole', () => {
    it('staff 이상 역할이면 에러 없음', () => {
      expect(() => RoleResolver.requireRole('staff', 'staff')).not.toThrow();
      expect(() => RoleResolver.requireRole('employer', 'staff')).not.toThrow();
      expect(() => RoleResolver.requireRole('admin', 'staff')).not.toThrow();
    });

    it('employer 이상 역할이면 에러 없음', () => {
      expect(() => RoleResolver.requireRole('employer', 'employer')).not.toThrow();
      expect(() => RoleResolver.requireRole('admin', 'employer')).not.toThrow();
    });

    it('권한 부족하면 PermissionError 발생', () => {
      expect(() => RoleResolver.requireRole('staff', 'employer')).toThrow();
      expect(() => RoleResolver.requireRole('staff', 'admin')).toThrow();
      expect(() => RoleResolver.requireRole('employer', 'admin')).toThrow();
    });
  });

  // ==========================================================================
  // getStaffRoleDisplayName: 직무 역할 표시명
  // ==========================================================================
  describe('getStaffRoleDisplayName', () => {
    it.each([
      ['dealer', '딜러'],
      ['floor', '플로어'],
      ['serving', '서빙'],
      ['manager', '매니저'],
      ['chiprunner', '칩러너'],
    ] as const)('직무 %s → 표시명 %s', (roleId, expected) => {
      expect(RoleResolver.getStaffRoleDisplayName(roleId)).toBe(expected);
    });

    it('other + customRole이면 customRole 반환', () => {
      expect(RoleResolver.getStaffRoleDisplayName('other', '조명 담당')).toBe('조명 담당');
      expect(RoleResolver.getStaffRoleDisplayName('other', '보안 요원')).toBe('보안 요원');
    });

    it('other + customRole 없으면 ROLE_LABELS의 기타 반환', () => {
      expect(RoleResolver.getStaffRoleDisplayName('other')).toBe('기타');
    });

    it('알 수 없는 역할은 그대로 반환', () => {
      expect(RoleResolver.getStaffRoleDisplayName('unknown_role')).toBe('unknown_role');
    });
  });

  // ==========================================================================
  // resolveStaffRoles: 여러 필드에서 역할 추출 및 정규화
  // ==========================================================================
  describe('resolveStaffRoles', () => {
    it('role (단일) 필드 처리', () => {
      const result = RoleResolver.resolveStaffRoles({ role: 'dealer' });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        roleId: 'dealer',
        displayName: '딜러',
        isCustom: false,
      });
    });

    it('roles (배열) 필드 처리', () => {
      const result = RoleResolver.resolveStaffRoles({ roles: ['dealer', 'floor'] });
      expect(result).toHaveLength(2);
      expect(result[0].roleId).toBe('dealer');
      expect(result[1].roleId).toBe('floor');
    });

    it('roleIds (배열) 필드 처리', () => {
      const result = RoleResolver.resolveStaffRoles({ roleIds: ['manager', 'chiprunner'] });
      expect(result).toHaveLength(2);
      expect(result[0].roleId).toBe('manager');
      expect(result[1].roleId).toBe('chiprunner');
    });

    it('customRole 처리', () => {
      const result = RoleResolver.resolveStaffRoles({
        role: 'other',
        customRole: '조명 담당',
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        roleId: 'other',
        displayName: '조명 담당',
        isCustom: true,
      });
    });

    it('우선순위: roleIds > roles > role', () => {
      const result = RoleResolver.resolveStaffRoles({
        role: 'dealer',
        roles: ['floor'],
        roleIds: ['manager'],
      });
      expect(result).toHaveLength(1);
      expect(result[0].roleId).toBe('manager');
    });

    it('빈 입력 → 빈 배열', () => {
      expect(RoleResolver.resolveStaffRoles({})).toEqual([]);
      expect(RoleResolver.resolveStaffRoles({ role: null })).toEqual([]);
      expect(RoleResolver.resolveStaffRoles({ roles: [] })).toEqual([]);
    });

    it('중복 역할 제거', () => {
      const result = RoleResolver.resolveStaffRoles({
        roles: ['dealer', 'dealer', 'floor', 'floor'],
      });
      expect(result).toHaveLength(2);
    });
  });

  // ==========================================================================
  // fromAssignment: Assignment 객체에서 역할 추출
  // ==========================================================================
  describe('fromAssignment', () => {
    it('roleId 단일 필드', () => {
      const result = RoleResolver.fromAssignment({ roleId: 'dealer' });
      expect(result).toHaveLength(1);
      expect(result[0].roleId).toBe('dealer');
    });

    it('roleIds 배열 필드', () => {
      const result = RoleResolver.fromAssignment({
        roleIds: ['dealer', 'floor'],
      });
      expect(result).toHaveLength(2);
    });

    it('customRole 처리', () => {
      const result = RoleResolver.fromAssignment({
        roleId: 'other',
        customRole: '보안 요원',
      });
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('보안 요원');
      expect(result[0].isCustom).toBe(true);
    });

    it('빈 assignment → 빈 배열', () => {
      expect(RoleResolver.fromAssignment({})).toEqual([]);
      expect(RoleResolver.fromAssignment(null as unknown as object)).toEqual([]);
    });
  });

  // ==========================================================================
  // getUserRoleDisplayName: 사용자 역할 표시명
  // ==========================================================================
  describe('getUserRoleDisplayName', () => {
    it.each([
      ['admin', '관리자'],
      ['employer', '구인자'],
      ['staff', '스태프'],
    ] as const)('UserRole %s → 표시명 %s', (role, expected) => {
      expect(RoleResolver.getUserRoleDisplayName(role)).toBe(expected);
    });

    it('null/undefined → 빈 문자열', () => {
      expect(RoleResolver.getUserRoleDisplayName(null)).toBe('');
      expect(RoleResolver.getUserRoleDisplayName(undefined)).toBe('');
    });
  });

  // ==========================================================================
  // isValidUserRole: UserRole 유효성 검사
  // ==========================================================================
  describe('isValidUserRole', () => {
    it.each(['admin', 'employer', 'staff'])('%s는 유효한 UserRole', (role) => {
      expect(RoleResolver.isValidUserRole(role)).toBe(true);
    });

    it.each(['invalid', 'superuser', '', null, undefined])(
      '%s는 유효하지 않은 UserRole',
      (role) => {
        expect(RoleResolver.isValidUserRole(role as string | null | undefined)).toBe(false);
      }
    );

    it('정규화 후 유효성 검사 (대소문자 무관)', () => {
      expect(RoleResolver.isValidUserRole('ADMIN')).toBe(true);
      expect(RoleResolver.isValidUserRole('Employer')).toBe(true);
      expect(RoleResolver.isValidUserRole('Manager')).toBe(true); // → employer
    });
  });
});
