/**
 * RoleSalaryManager - 역할별 차등 급여 관리 UI
 *
 * @see app2/src/types/jobPosting/salaryProps.ts
 */

import React from 'react';
import { Select } from '../../../../common/Select';
import Input from '../../../../ui/Input';
import Button from '../../../../ui/Button';
import { PREDEFINED_ROLES, getRoleDisplayName } from '../../../../../utils/jobPosting/jobPostingHelpers';

interface RoleSalaryManagerProps {
  roleSalaries: {
    [role: string]: {
      salaryType: string;
      salaryAmount: string;
      customRoleName?: string;
    };
  };
  onAddRole: (role: string) => void;
  onRemoveRole: (role: string | number) => void;
  onRoleSalaryChange: (role: string | number, type: string, amount: number) => void;
}

const RoleSalaryManager: React.FC<RoleSalaryManagerProps> = ({
  roleSalaries,
  onAddRole,
  onRemoveRole,
  onRoleSalaryChange
}) => {
  return (
    <div className="space-y-3 border rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        각 역할별로 급여를 설정하세요.
      </div>

      {/* 역할별 급여 목록 */}
      {Object.entries(roleSalaries).map(([role, salary]) => (
        <div key={role} className="grid grid-cols-12 gap-2 items-center bg-white dark:bg-gray-800 p-3 rounded-lg">
          {/* 역할 선택 */}
          <div className="col-span-4">
            <Select
              value={role}
              onChange={(value) => {
                // 역할 변경 로직 (간단히 처리)
              }}
              options={PREDEFINED_ROLES.map(r => ({
                value: r,
                label: getRoleDisplayName(r)
              }))}
            />
          </div>

          {/* 급여 타입 */}
          <div className="col-span-3">
            <Select
              value={salary.salaryType}
              onChange={(value) => {
                const amount = parseInt(salary.salaryAmount, 10) || 0;
                onRoleSalaryChange(role, value, amount);
              }}
              options={[
                { value: 'hourly', label: '시급' },
                { value: 'daily', label: '일급' },
                { value: 'monthly', label: '월급' },
                { value: 'negotiable', label: '협의' }
              ]}
            />
          </div>

          {/* 급여 금액 */}
          <div className="col-span-3">
            {salary.salaryType === 'negotiable' ? (
              <div className="text-gray-500 dark:text-gray-400 text-sm py-2">
                급여 협의
              </div>
            ) : (
              <Input
                type="text"
                value={salary.salaryAmount}
                onChange={(e) => {
                  const numValue = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
                  onRoleSalaryChange(role, salary.salaryType, numValue);
                }}
                placeholder="20000"
              />
            )}
          </div>

          {/* 삭제 버튼 */}
          <div className="col-span-2 flex justify-end">
            <Button
              onClick={() => onRemoveRole(role)}
              variant="secondary"
              size="sm"
            >
              삭제
            </Button>
          </div>
        </div>
      ))}

      {/* 역할 추가 버튼 */}
      <Button
        onClick={() => onAddRole('dealer')}
        variant="secondary"
        size="sm"
        className="mt-2"
      >
        + 역할 추가
      </Button>
    </div>
  );
};

export default RoleSalaryManager;
