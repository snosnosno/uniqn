import React, { useState, useCallback, useMemo } from 'react';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { JobPosting } from '../../types/jobPosting';
import { RoleSalaryConfig } from '../../types/payroll';
import { formatCurrency } from '../../i18n-helpers';
import { logger } from '../../utils/logger';

interface RoleSalarySettingsProps {
  roles: string[];
  jobPosting: JobPosting | null;
  onUpdate: (roleSalaries: RoleSalaryConfig) => void;
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

  // 급여 유형 한글 라벨
  const getSalaryTypeLabel = useCallback((type: string) => {
    const labels: Record<string, string> = {
      hourly: '시급',
      daily: '일급',
      monthly: '월급',
      other: '기타'
    };
    return labels[type] || type;
  }, []);

  // 역할별 급여 변경 핸들러
  const handleSalaryChange = useCallback((
    role: string,
    field: 'salaryType' | 'salaryAmount',
    value: string | number
  ) => {
    const currentConfig = salaryConfig[role] || { salaryType: 'hourly' as const, salaryAmount: 15000 };
    
    const newConfig: RoleSalaryConfig = {
      ...salaryConfig,
      [role]: {
        ...currentConfig,
        [field]: field === 'salaryAmount' ? parseFloat(value.toString()) || 0 : value
      } as RoleSalaryConfig[string]
    };
    
    setSalaryConfig(newConfig);
    onUpdate(newConfig);
    
    logger.info(`역할별 급여 변경: ${role} - ${field} = ${value}`, {
      component: 'RoleSalarySettings',
      operation: 'updateSalary'
    });
  }, [salaryConfig, onUpdate]);

  // 모든 역할에 같은 설정 적용
  const handleApplyToAll = useCallback((templateRole: string) => {
    const template = salaryConfig[templateRole];
    if (!template) return;

    const newConfig: RoleSalaryConfig = {};
    roles.forEach(role => {
      newConfig[role] = {
        salaryType: template.salaryType,
        salaryAmount: template.salaryAmount
      };
    });

    setSalaryConfig(newConfig);
    onUpdate(newConfig);

    logger.info(`모든 역할에 급여 설정 적용: ${templateRole}`, {
      component: 'RoleSalarySettings',
      operation: 'applyToAll'
    });
  }, [salaryConfig, roles, onUpdate]);

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* 헤더 */}
      <div className="px-6 py-4 border-b">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Cog6ToothIcon className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-medium text-gray-900">역할별 급여 설정</h3>
            <span className="text-sm text-gray-500">
              ({roles.length}개 역할)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isExpanded && (
              <span className="text-sm text-gray-500">
                {Object.values(salaryConfig).some(config => config.salaryType !== 'hourly') 
                  ? '개별 설정됨' 
                  : '기본 설정'
                }
              </span>
            )}
            <svg
              className={`w-5 h-5 transform transition-transform ${
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

      {/* 역할별 급여 설정 */}
      {isExpanded && (
        <div className="p-6">
          <div className="space-y-6">
            {roles.map(role => (
              <div key={role} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-sm font-medium text-gray-900">{role}</h4>
                  <button
                    onClick={() => handleApplyToAll(role)}
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    모든 역할에 적용
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* 급여 유형 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      급여 유형
                    </label>
                    <select
                      value={salaryConfig[role]?.salaryType || 'hourly'}
                      onChange={(e) => handleSalaryChange(role, 'salaryType', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="hourly">시급</option>
                      <option value="daily">일급</option>
                      <option value="monthly">월급</option>
                      <option value="other">기타</option>
                    </select>
                  </div>

                  {/* 급여 금액 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      급여 금액
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={salaryConfig[role]?.salaryAmount || 0}
                        onChange={(e) => handleSalaryChange(role, 'salaryAmount', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                        원
                      </span>
                    </div>
                  </div>
                </div>

                {/* 예상 급여 미리보기 */}
                <div className="mt-3 p-2 bg-white rounded border">
                  <div className="text-xs text-gray-500">
                    {getSalaryTypeLabel(salaryConfig[role]?.salaryType || 'hourly')} 기준
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    {formatCurrency(salaryConfig[role]?.salaryAmount || 0, 'KRW', 'ko')}
                    {salaryConfig[role]?.salaryType === 'hourly' && '/시간'}
                    {salaryConfig[role]?.salaryType === 'daily' && '/일'}
                    {salaryConfig[role]?.salaryType === 'monthly' && '/월'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 안내 메시지 */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  급여 설정 안내
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>역할별로 다른 급여 유형과 금액을 설정할 수 있습니다</li>
                    <li>설정 변경 시 정산 금액이 실시간으로 재계산됩니다</li>
                    <li>'모든 역할에 적용' 버튼으로 일괄 설정이 가능합니다</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleSalarySettings;