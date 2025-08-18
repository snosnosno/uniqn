import React, { useState, useEffect } from 'react';
import { PersonMigrationService } from '../../services/PersonMigrationService';
import { useToast } from '../../hooks/useToast';
import LoadingSpinner from '../../components/LoadingSpinner';
import { logger } from '../../utils/logger';

/**
 * 데이터 마이그레이션 관리 페이지
 * staff + applicants → persons 통합
 */
const MigrationPage: React.FC = () => {
  const { showSuccess, showError, showInfo } = useToast();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    isCompleted: boolean;
    staffCount: number;
    applicantCount: number;
    personCount: number;
  } | null>(null);
  
  const [migrationResult, setMigrationResult] = useState<{
    success: boolean;
    personsCreated: number;
    duplicatesFound: number;
    errors: string[];
  } | null>(null);

  // 마이그레이션 상태 확인
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const result = await PersonMigrationService.checkMigrationStatus();
      setStatus(result);
      logger.info('마이그레이션 상태 확인', { 
        component: 'MigrationPage',
        data: result 
      });
    } catch (error) {
      logger.error('상태 확인 실패', error as Error, { 
        component: 'MigrationPage' 
      });
      showError('마이그레이션 상태 확인 실패');
    } finally {
      setLoading(false);
    }
  };

  // Dry Run 실행
  const handleDryRun = async () => {
    try {
      setLoading(true);
      showInfo('Dry Run 시작 - 실제 데이터는 변경되지 않습니다');
      
      const result = await PersonMigrationService.migrate({
        dryRun: true,
        backup: false
      });
      
      setMigrationResult(result);
      
      if (result.success) {
        showSuccess(`Dry Run 완료: ${result.personsCreated}명 생성 예정, ${result.duplicatesFound}개 중복 발견`);
      } else {
        showError('Dry Run 실패: ' + result.errors.join(', '));
      }
    } catch (error) {
      logger.error('Dry Run 실패', error as Error, { 
        component: 'MigrationPage' 
      });
      showError('Dry Run 실행 중 오류 발생');
    } finally {
      setLoading(false);
    }
  };

  // 실제 마이그레이션 실행
  const handleMigrate = async () => {
    if (!window.confirm('정말로 마이그레이션을 실행하시겠습니까?\n\n기존 데이터는 백업되며, 문제 발생 시 롤백 가능합니다.')) {
      return;
    }

    try {
      setLoading(true);
      showInfo('마이그레이션 시작...');
      
      // 1. 마이그레이션 실행
      const result = await PersonMigrationService.migrate({
        dryRun: false,
        backup: true
      });
      
      setMigrationResult(result);
      
      if (!result.success) {
        throw new Error(result.errors.join(', '));
      }
      
      // 2. 참조 업데이트
      showInfo('참조 업데이트 중...');
      const refResult = await PersonMigrationService.updateReferences();
      
      if (refResult.errors.length > 0) {
        showError('참조 업데이트 중 일부 오류: ' + refResult.errors.join(', '));
      }
      
      // 3. 상태 재확인
      await checkStatus();
      
      showSuccess(`마이그레이션 완료!\n- ${result.personsCreated}명 생성\n- ${result.duplicatesFound}개 중복 처리\n- ${refResult.workLogsUpdated}개 workLogs 업데이트\n- ${refResult.applicationsUpdated}개 applications 업데이트`);
      
    } catch (error) {
      logger.error('마이그레이션 실패', error as Error, { 
        component: 'MigrationPage' 
      });
      showError('마이그레이션 실패: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 롤백 실행
  const handleRollback = async () => {
    const backupDate = prompt('백업 날짜를 입력하세요 (YYYY-MM-DD):');
    if (!backupDate) return;
    
    if (!window.confirm(`정말로 ${backupDate} 백업으로 롤백하시겠습니까?`)) {
      return;
    }

    try {
      setLoading(true);
      showInfo('롤백 시작...');
      
      const success = await PersonMigrationService.rollback(backupDate);
      
      if (success) {
        showSuccess('롤백 완료');
        await checkStatus();
      } else {
        showError('롤백 실패');
      }
    } catch (error) {
      logger.error('롤백 실패', error as Error, { 
        component: 'MigrationPage' 
      });
      showError('롤백 중 오류 발생');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="처리 중..." />;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">데이터 마이그레이션 관리</h1>
      
      {/* 현재 상태 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">현재 상태</h2>
        
        {status && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>마이그레이션 상태:</span>
              <span className={`font-bold ${status.isCompleted ? 'text-green-600' : 'text-yellow-600'}`}>
                {status.isCompleted ? '완료' : '미완료'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Staff 수:</span>
              <span>{status.staffCount}명</span>
            </div>
            <div className="flex justify-between">
              <span>Applicants 수:</span>
              <span>{status.applicantCount}명</span>
            </div>
            <div className="flex justify-between">
              <span>Persons 수:</span>
              <span className="font-bold">{status.personCount}명</span>
            </div>
          </div>
        )}
        
        <button
          onClick={checkStatus}
          className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
          disabled={loading}
        >
          상태 새로고침
        </button>
      </div>

      {/* 마이그레이션 결과 */}
      {migrationResult && (
        <div className={`rounded-lg shadow p-6 mb-6 ${
          migrationResult.success ? 'bg-green-50' : 'bg-red-50'
        }`}>
          <h2 className="text-lg font-semibold mb-4">
            {migrationResult.success ? '✅ 마이그레이션 결과' : '❌ 마이그레이션 실패'}
          </h2>
          
          <div className="space-y-2">
            <p>생성된 Person: {migrationResult.personsCreated}명</p>
            <p>발견된 중복: {migrationResult.duplicatesFound}개</p>
            
            {migrationResult.errors.length > 0 && (
              <div className="mt-4">
                <p className="font-semibold text-red-600">오류:</p>
                <ul className="list-disc list-inside">
                  {migrationResult.errors.map((error, index) => (
                    <li key={index} className="text-red-600">{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 액션 버튼들 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">마이그레이션 작업</h2>
        
        <div className="space-y-4">
          {/* Dry Run */}
          <div>
            <button
              onClick={handleDryRun}
              className="px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
              disabled={loading || status?.isCompleted}
            >
              Dry Run (테스트 실행)
            </button>
            <p className="text-sm text-gray-600 mt-1">
              실제 데이터를 변경하지 않고 마이그레이션 시뮬레이션
            </p>
          </div>

          {/* 실제 마이그레이션 */}
          <div>
            <button
              onClick={handleMigrate}
              className="px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
              disabled={loading || status?.isCompleted}
            >
              마이그레이션 실행
            </button>
            <p className="text-sm text-gray-600 mt-1">
              staff + applicants → persons 통합 (백업 포함)
            </p>
          </div>

          {/* 롤백 */}
          <div>
            <button
              onClick={handleRollback}
              className="px-6 py-3 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400"
              disabled={loading}
            >
              롤백 (복원)
            </button>
            <p className="text-sm text-gray-600 mt-1">
              문제 발생 시 이전 상태로 복원
            </p>
          </div>
        </div>
      </div>

      {/* 안내 사항 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">📌 안내 사항</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>마이그레이션 전 반드시 Dry Run으로 테스트하세요</li>
          <li>자동으로 백업이 생성되며, 날짜별로 관리됩니다</li>
          <li>중복된 전화번호는 자동으로 'both' 타입으로 처리됩니다</li>
          <li>workLogs와 applications의 참조가 자동 업데이트됩니다</li>
          <li>문제 발생 시 롤백으로 즉시 복원 가능합니다</li>
        </ul>
      </div>
    </div>
  );
};

export default MigrationPage;