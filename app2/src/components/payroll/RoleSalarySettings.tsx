import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { JobPosting } from '../../types/jobPosting';
import { RoleSalaryConfig } from '../../types/payroll';
import { logger } from '../../utils/logger';

interface RoleSalarySettingsProps {
  roles: string[];
  jobPosting: JobPosting | null;
  onUpdate: (roleSalaries: RoleSalaryConfig) => Promise<void>;
  className?: string;
}

const RoleSalarySettings: React.FC<RoleSalarySettingsProps> = ({
  roles,
  jobPosting,
  onUpdate,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 초기 급여 설정 로드
  const initialSalaryConfig = useMemo((): RoleSalaryConfig => {
    const config: RoleSalaryConfig = {};
    
    roles.forEach(role => {
      if (jobPosting?.useRoleSalary && jobPosting.roleSalaries?.[role]) {
        // 공고에서 역할별 급여가 설정된 경우
        const roleSalary = jobPosting.roleSalaries[role];
        if (roleSalary) {
          config[role] = {
            salaryType: roleSalary.salaryType === 'negotiable' ? 'other' : roleSalary.salaryType as 'hourly' | 'daily' | 'monthly' | 'other',
            salaryAmount: parseFloat(roleSalary.salaryAmount) || 0,
            ...(roleSalary.customRoleName && { customRoleName: roleSalary.customRoleName })
          };
        } else {
          // roleSalary가 undefined인 경우 기본값으로 처리
          const baseSalaryType = jobPosting?.salaryType || 'hourly';
          config[role] = {
            salaryType: baseSalaryType === 'negotiable' ? 'other' : baseSalaryType as 'hourly' | 'daily' | 'monthly' | 'other',
            salaryAmount: parseFloat(jobPosting?.salaryAmount || '0') || 15000
          };
        }
      } else {
        // 기본 급여 설정 사용
        const baseSalaryType = jobPosting?.salaryType || 'hourly';
        config[role] = {
          salaryType: baseSalaryType === 'negotiable' ? 'other' : baseSalaryType as 'hourly' | 'daily' | 'monthly' | 'other',
          salaryAmount: parseFloat(jobPosting?.salaryAmount || '0') || 15000
        };
      }
    });
    
    return config;
  }, [roles, jobPosting]);

  const [salaryConfig, setSalaryConfig] = useState<RoleSalaryConfig>(initialSalaryConfig);
  const [tempSalaryConfig, setTempSalaryConfig] = useState<RoleSalaryConfig>(initialSalaryConfig);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // initialSalaryConfig 변경 시 tempSalaryConfig 동기화
  useEffect(() => {
    setTempSalaryConfig(initialSalaryConfig);
    setSalaryConfig(initialSalaryConfig);
  }, [initialSalaryConfig]);

  // 급여 유형 한글 라벨 - 향후 UI에서 사용 예정
  // const getSalaryTypeLabel = useCallback((type: string) => {
  //   const labels: Record<string, string> = {
  //     hourly: '시급',
  //     daily: '일급',
  //     monthly: '월급',
  //     other: '기타'
  //   };
  //   return labels[type] || type;
  // }, []);

  // 역할별 급여 변경 핸들러 (임시 상태만 변경)
  const handleSalaryChange = useCallback((
    role: string,
    field: 'salaryType' | 'salaryAmount',
    value: string | number
  ) => {
    const currentConfig = tempSalaryConfig[role] || { salaryType: 'hourly' as const, salaryAmount: 15000 };

    const newConfig: RoleSalaryConfig = {
      ...tempSalaryConfig,
      [role]: {
        ...currentConfig,
        [field]: field === 'salaryAmount' ? parseFloat(value.toString()) || 0 : value
      } as RoleSalaryConfig[string]
    };

    setTempSalaryConfig(newConfig);
    setHasChanges(true);

    logger.info(`역할별 급여 변경 (임시): ${role} - ${field} = ${value}`, {
      component: 'RoleSalarySettings',
      operation: 'updateSalary'
    });
  }, [tempSalaryConfig]);

  // 모든 역할에 같은 설정 적용 (임시 상태만 변경)
  const handleApplyToAll = useCallback((templateRole: string) => {
    const template = tempSalaryConfig[templateRole];
    if (!template) return;

    const newConfig: RoleSalaryConfig = {};
    roles.forEach(role => {
      newConfig[role] = {
        salaryType: template.salaryType,
        salaryAmount: template.salaryAmount
      };
    });

    setTempSalaryConfig(newConfig);
    setHasChanges(true);

    logger.info(`모든 역할에 급여 설정 적용 (임시): ${templateRole}`, {
      component: 'RoleSalarySettings',
      operation: 'applyToAll'
    });
  }, [tempSalaryConfig, roles]);

  // 적용 버튼 핸들러
  const handleApply = useCallback(async () => {
    setIsSaving(true);
    try {
      await onUpdate(tempSalaryConfig);
      setSalaryConfig(tempSalaryConfig);
      setHasChanges(false);

      logger.info('급여 설정 적용', {
        component: 'RoleSalarySettings',
        operation: 'apply',
        data: tempSalaryConfig
      });
    } catch (error) {
      logger.error('급여 설정 적용 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'RoleSalarySettings'
      });
    } finally {
      setIsSaving(false);
    }
  }, [tempSalaryConfig, onUpdate]);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}>
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Cog6ToothIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">급여 설정</h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({roles.length}개)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isExpanded && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {Object.values(salaryConfig).some(config => config.salaryType !== 'hourly')
                  ? '개별 설정됨'
                  : '기본 설정'
                }
              </span>
            )}
            <svg
              className={`w-5 h-5 text-gray-900 dark:text-gray-100 transform transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" />
            </svg>
          </div>
        </button>
      </div>

      {/* 급여 설정 */}
      {isExpanded && (
        <div className="p-6">
          <div className="space-y-6">
            {roles.map(role => (
              <div key={role} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{role}</h4>
                  <button
                    onClick={() => handleApplyToAll(role)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                  >
                    모든 역할에 적용
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* 급여 유형 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      급여 유형
                    </label>
                    <select
                      value={tempSalaryConfig[role]?.salaryType || 'hourly'}
                      onChange={(e) => handleSalaryChange(role, 'salaryType', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="hourly">시급</option>
                      <option value="daily">일급</option>
                      <option value="monthly">월급</option>
                      <option value="other">기타</option>
                    </select>
                  </div>

                  {/* 급여 금액 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      급여 금액
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={tempSalaryConfig[role]?.salaryAmount || 0}
                        onChange={(e) => handleSalaryChange(role, 'salaryAmount', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400">
                        원
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 안내 메시지 */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  급여 설정 안내
                </h3>
                <div className="mt-2 text-sm text-blue-700 dark:text-blue-400">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>역할별로 다른 급여 유형과 금액을 설정할 수 있습니다</li>
                    <li>'적용하기' 버튼을 눌러야 정산 금액이 재계산됩니다</li>
                    <li>'모든 역할에 적용' 버튼으로 일괄 설정이 가능합니다</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* 적용 버튼 */}
          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleApply}
              disabled={!hasChanges || isSaving}
              className="px-6 py-2 bg-indigo-600 dark:bg-indigo-700 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSaving ? '저장 중...' : '적용하기'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleSalarySettings;