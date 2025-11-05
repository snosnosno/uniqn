/**
 * BasicInfoTab Component
 *
 * Feature: 001-schedule-modal-split
 * Created: 2025-11-05
 * Purpose: 일정 기본 정보 탭 - 일정 정보, 장소, 시간, 상태, 급여 정보 표시
 */

import React from 'react';
import { BasicInfoTabProps } from '../types';
import { getSnapshotOrFallback } from '../../../../../utils/scheduleSnapshot';
import { parseTimeToString } from '../../../../../utils/workLogMapper';

/**
 * BasicInfoTab - 일정 기본 정보 표시 컴포넌트
 *
 * @param schedule - 일정 데이터
 * @param jobPosting - JobPosting 데이터 (null이면 스냅샷 사용)
 * @param onUpdate - 필드 업데이트 핸들러 (향후 편집 기능용, 현재 미사용)
 * @param isReadOnly - 읽기 전용 모드 (현재 항상 true)
 */
const BasicInfoTab: React.FC<BasicInfoTabProps> = ({
  schedule,
  jobPosting,
  isReadOnly: _isReadOnly
}) => {
  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  // 역할명 한글 라벨
  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      dealer: '딜러',
      floor: '플로어',
      manager: '매니저',
      staff: '스태프'
    };
    return labels[role] || role;
  };

  // 급여 유형 한글 라벨
  const getSalaryTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      hourly: '시급',
      daily: '일급',
      monthly: '월급',
      other: '기타'
    };
    return labels[type] || type;
  };

  // 상태별 표시 정보
  const getTypeDisplay = () => {
    switch (schedule.type) {
      case 'applied':
        return {
          text: '지원중',
          color: 'text-yellow-600 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30'
        };
      case 'confirmed':
        return {
          text: '확정',
          color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20'
        };
      case 'completed':
        return {
          text: '완료',
          color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/20'
        };
      case 'cancelled':
        return {
          text: '취소',
          color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20'
        };
      default:
        return {
          text: schedule.type,
          color: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700'
        };
    }
  };

  const typeDisplay = getTypeDisplay();

  // 급여 정보 추출 (스냅샷 우선)
  const snapshotSalary = schedule.snapshotData?.salary;
  const useRoleSalary = snapshotSalary?.useRoleSalary ?? jobPosting?.useRoleSalary;
  const roleSalaries = snapshotSalary?.roleSalaries || jobPosting?.roleSalaries;
  const salaryType = snapshotSalary?.type || jobPosting?.salaryType || 'hourly';
  const effectiveRole = schedule.role || 'staff';

  // 급여 금액 계산
  let baseSalary = 10000; // 기본값
  if (useRoleSalary && effectiveRole && roleSalaries?.[effectiveRole]) {
    const roleInfo = roleSalaries[effectiveRole];
    if (roleInfo && typeof roleInfo === 'object' && 'salaryAmount' in roleInfo) {
      baseSalary = parseInt(roleInfo.salaryAmount, 10) || 10000;
    } else if (typeof roleInfo === 'number') {
      baseSalary = roleInfo;
    }
  } else if (jobPosting?.salaryAmount) {
    baseSalary = parseInt(jobPosting.salaryAmount, 10);
  } else if (snapshotSalary && 'amount' in snapshotSalary) {
    baseSalary = snapshotSalary.amount;
  }

  // 근무 시간 계산 (간단 버전)
  let totalHours = 0;
  const startTime = schedule.startTime;
  const endTime = schedule.endTime;
  if (startTime && endTime) {
    const parseTime = (time: string | { toDate: () => Date } | null | undefined): number => {
      // Timestamp 타입 처리
      if (time && typeof time === 'object' && 'toDate' in time) {
        const date = time.toDate();
        return date.getHours() + date.getMinutes() / 60;
      }
      // 문자열 타입 처리
      if (typeof time === 'string') {
        const parts = time.split(':');
        const hours = parseInt(parts[0] || '0', 10);
        const minutes = parseInt(parts[1] || '0', 10);
        return hours + minutes / 60;
      }
      return 0;
    };
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    totalHours = end > start ? end - start : 0;
  }

  const basePay = totalHours * baseSalary;

  // 세금 계산
  const taxSettings = schedule.snapshotData?.taxSettings || jobPosting?.taxSettings;
  let tax = 0;
  let taxRate: number | undefined;
  let afterTaxAmount = basePay;

  if (taxSettings?.enabled) {
    if (taxSettings.taxRate !== undefined && taxSettings.taxRate > 0) {
      taxRate = taxSettings.taxRate;
      tax = Math.round(basePay * (taxRate / 100));
    } else if (taxSettings.taxAmount !== undefined && taxSettings.taxAmount > 0) {
      tax = taxSettings.taxAmount;
    }
    afterTaxAmount = basePay - tax;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">기본 정보</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">공고:</span>
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {schedule.snapshotData?.title || jobPosting?.title || schedule.eventName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">역할:</span>
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {getRoleLabel(effectiveRole || '미정')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">날짜:</span>
              <span className="text-sm text-gray-900 dark:text-gray-100">{formatDate(schedule.date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">장소:</span>
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {getSnapshotOrFallback(schedule, jobPosting).location()}
              </span>
            </div>
            {(() => {
              const detailedAddress = getSnapshotOrFallback(schedule, jobPosting).detailedAddress();
              return detailedAddress && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">상세주소:</span>
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {detailedAddress}
                  </span>
                </div>
              );
            })()}
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">근무시간:</span>
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {(() => {
                  const effectiveStartTime = schedule.startTime;
                  const effectiveEndTime = schedule.endTime;

                  if (effectiveStartTime && effectiveEndTime) {
                    const startTimeStr = parseTimeToString(effectiveStartTime) || '미정';
                    const endTimeStr = parseTimeToString(effectiveEndTime) || '미정';
                    return `${startTimeStr} - ${endTimeStr}`;
                  }

                  return '미정';
                })()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">상태:</span>
              <span className={`text-sm px-2 py-1 rounded-full ${typeDisplay.color}`}>
                {typeDisplay.text}
              </span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">급여 정보</h4>
          <div className="space-y-2">
            {/* 급여 설정 소스 표시 (스냅샷 우선) */}
            {(() => {
              if (useRoleSalary && effectiveRole && roleSalaries?.[effectiveRole]) {
                return (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">설정:</span>
                    <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">역할별 급여</span>
                  </div>
                );
              } else if (salaryType) {
                return (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">설정:</span>
                    <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">공고 기본급여</span>
                  </div>
                );
              } else {
                return (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">설정:</span>
                    <span className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded">시스템 기본값</span>
                  </div>
                );
              }
            })()}
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">급여 유형:</span>
              <span className="text-sm text-gray-900 dark:text-gray-100">{getSalaryTypeLabel(salaryType)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {salaryType === 'hourly' ? '시급:' :
                 salaryType === 'daily' ? '일급:' :
                 salaryType === 'monthly' ? '월급:' : '급여:'}
              </span>
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {baseSalary.toLocaleString('ko-KR')}원
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">예상 기본급:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {basePay.toLocaleString('ko-KR')}원
              </span>
            </div>
            {tax > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">세금:</span>
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {taxRate !== undefined && taxRate > 0
                    ? `${taxRate}%`
                    : '고정 세금'}
                </span>
              </div>
            )}
            {/* 정산 금액은 스냅샷 사용 시 표시하지 않음 */}
            {!schedule.snapshotData && schedule.payrollAmount && schedule.payrollAmount !== basePay && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">정산 금액:</span>
                <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  {schedule.payrollAmount.toLocaleString('ko-KR')}원
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">근무 요약</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">1</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">근무일수</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{totalHours.toFixed(1)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">근무시간</div>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
              {basePay.toLocaleString('ko-KR')}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">총 지급액</div>
          </div>
          {afterTaxAmount > 0 && tax > 0 ? (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {afterTaxAmount.toLocaleString('ko-KR')}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">세후 급여</div>
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {(schedule.payrollAmount || basePay).toLocaleString('ko-KR')}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">세후 급여</div>
            </div>
          )}
        </div>
      </div>

      {/* 메모 */}
      {schedule.notes && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">메모</h4>
          <p className="text-sm text-gray-600 dark:text-gray-300">{schedule.notes}</p>
        </div>
      )}
    </div>
  );
};

// React.memo로 래핑하여 불필요한 리렌더링 방지
export default React.memo(BasicInfoTab);
