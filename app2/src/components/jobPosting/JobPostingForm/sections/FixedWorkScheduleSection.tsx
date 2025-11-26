import React, { memo, useCallback, useMemo } from 'react';
import type { FixedWorkScheduleSectionProps } from '@/types/jobPosting';
import { STAFF_ROLES } from '@/types/jobPosting';
import { isNextDayWork } from '@/utils/jobPosting/jobPostingHelpers';

/**
 * 고정공고 근무일정 입력 섹션
 *
 * Props Grouping 패턴: data, handlers, validation
 *
 * @component
 * @example
 * ```tsx
 * <FixedWorkScheduleSection
 *   data={{ workSchedule, requiredRolesWithCount }}
 *   handlers={{ onWorkScheduleChange, onRolesChange }}
 * />
 * ```
 */
const FixedWorkScheduleSection: React.FC<FixedWorkScheduleSectionProps> = memo(
  ({ data, handlers, validation: _validation }) => {
    // ========== 익일 근무 여부 체크 ==========
    const isNextDay = useMemo(() => {
      return isNextDayWork(data.workSchedule.startTime, data.workSchedule.endTime);
    }, [data.workSchedule.startTime, data.workSchedule.endTime]);

    // ========== 근무일정 핸들러 (T011-T013) ==========

    const handleDaysChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDays = parseInt(e.target.value, 10);
        handlers.onWorkScheduleChange({
          ...data.workSchedule,
          daysPerWeek: newDays,
        });
      },
      [data.workSchedule, handlers]
    );

    const handleStartTimeChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        handlers.onWorkScheduleChange({
          ...data.workSchedule,
          startTime: e.target.value,
        });
      },
      [data.workSchedule, handlers]
    );

    const handleEndTimeChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        handlers.onWorkScheduleChange({
          ...data.workSchedule,
          endTime: e.target.value,
        });
      },
      [data.workSchedule, handlers]
    );

    // ========== 역할 관리 핸들러 (T018-T021) ==========

    const handleAddRole = useCallback(() => {
      const newRole: { id: string; role: string; count: number } = {
        id: Date.now().toString(),
        role: '딜러',
        count: 1,
      };
      handlers.onRolesChange([...data.requiredRolesWithCount, newRole]);
    }, [data.requiredRolesWithCount, handlers]);

    const handleUpdateRole = useCallback(
      (index: number, updated: { id: string; role: string; count: number }) => {
        handlers.onRolesChange(
          data.requiredRolesWithCount.map((item, i) => (i === index ? updated : item))
        );
      },
      [data.requiredRolesWithCount, handlers]
    );

    const handleRemoveRole = useCallback(
      (index: number) => {
        handlers.onRolesChange(data.requiredRolesWithCount.filter((_, i) => i !== index));
      },
      [data.requiredRolesWithCount, handlers]
    );

    return (
      <section className="space-y-6 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        {/* T014: 섹션 헤더 */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">근무 일정</h3>

        {/* T014: 근무일정 입력 그리드 레이아웃 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* T011: 주 출근일수 입력 */}
          <div className="space-y-2">
            <label
              htmlFor="daysPerWeek"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              주 출근일수
            </label>
            <input
              type="number"
              id="daysPerWeek"
              name="daysPerWeek"
              min="1"
              max="7"
              required
              value={data.workSchedule.daysPerWeek}
              onChange={handleDaysChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                         bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
            />
          </div>

          {/* T012: 시작시간 입력 */}
          <div className="space-y-2">
            <label
              htmlFor="startTime"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              시작시간
            </label>
            <input
              type="time"
              id="startTime"
              name="startTime"
              required
              value={data.workSchedule.startTime}
              onChange={handleStartTimeChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                         bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600
                         [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>

          {/* T013: 종료시간 입력 */}
          <div className="space-y-2">
            <label
              htmlFor="endTime"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              종료시간
            </label>
            <input
              type="time"
              id="endTime"
              name="endTime"
              required
              value={data.workSchedule.endTime}
              onChange={handleEndTimeChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                         bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600
                         [color-scheme:light] dark:[color-scheme:dark]"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              * 익일 새벽 시간도 입력 가능합니다 (예: 02:00)
            </p>
          </div>
        </div>

        {/* 익일 근무 표시 */}
        {isNextDay && (
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-300 flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                익일 근무로 인식됩니다:{' '}
                <strong>
                  {data.workSchedule.startTime} ~ 익일 {data.workSchedule.endTime}
                </strong>
              </span>
            </p>
          </div>
        )}

        {/* T022: 역할 목록 섹션 */}
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-md font-medium text-gray-800 dark:text-gray-200">
            필요 역할 및 인원
          </h4>

          {/* T022: 역할 목록 렌더링 */}
          <div className="space-y-3">
            {data.requiredRolesWithCount.map((role, index) => (
              <RoleInputRow
                key={role.id}
                role={role}
                index={index}
                onUpdate={handleUpdateRole}
                onRemove={handleRemoveRole}
              />
            ))}
          </div>

          {/* T018: 역할 추가 버튼 */}
          <button
            type="button"
            onClick={handleAddRole}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md
                       hover:bg-blue-700 dark:hover:bg-blue-800
                       focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
          >
            + 역할 추가
          </button>

          {/* T022: 빈 상태 메시지 (에러 스타일) */}
          {data.requiredRolesWithCount.length === 0 && (
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">
              ⚠️ 최소 1개 이상의 역할을 추가해주세요 (필수)
            </p>
          )}
        </div>
      </section>
    );
  }
);

FixedWorkScheduleSection.displayName = 'FixedWorkScheduleSection';

// ========== T019: RoleInputRow 서브 컴포넌트 ==========

interface RoleInputRowProps {
  role: { id: string; role: string; count: number; customRole?: string };
  index: number;
  onUpdate: (
    index: number,
    updated: { id: string; role: string; count: number; customRole?: string }
  ) => void;
  onRemove: (index: number) => void;
}

/**
 * 개별 역할 입력 행 컴포넌트
 *
 * @component
 */
const RoleInputRow: React.FC<RoleInputRowProps> = memo(({ role, index, onUpdate, onRemove }) => {
  const handleRoleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newRole = e.target.value;
      onUpdate(index, {
        ...role,
        role: newRole,
        customRole: newRole === '기타' ? role.customRole || '' : undefined,
      });
    },
    [index, role, onUpdate]
  );

  const handleCustomRoleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(index, { ...role, customRole: e.target.value });
    },
    [index, role, onUpdate]
  );

  const handleCountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(index, { ...role, count: parseInt(e.target.value, 10) });
    },
    [index, role, onUpdate]
  );

  const isCustomRole = role.role === '기타';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        {/* 역할 선택 드롭다운 */}
        <select
          value={role.role}
          onChange={handleRoleChange}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
        >
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        {/* 인원수 입력 */}
        <input
          type="number"
          min="1"
          required
          value={role.count}
          onChange={handleCountChange}
          className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
        />

        {/* 삭제 버튼 */}
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="px-3 py-2 bg-red-600 dark:bg-red-700 text-white rounded-md
                       hover:bg-red-700 dark:hover:bg-red-800
                       focus:ring-2 focus:ring-red-500 dark:focus:ring-red-600"
        >
          삭제
        </button>
      </div>

      {/* 기타 선택 시 직접 입력 필드 */}
      {isCustomRole && (
        <input
          type="text"
          placeholder="역할명을 직접 입력하세요"
          value={role.customRole || ''}
          onChange={handleCustomRoleChange}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600
                       ml-0"
        />
      )}
    </div>
  );
});

RoleInputRow.displayName = 'RoleInputRow';

export default FixedWorkScheduleSection;
