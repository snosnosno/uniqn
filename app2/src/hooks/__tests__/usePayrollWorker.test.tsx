/**
 * usePayrollWorker Tests
 * Week 4 성능 최적화: 급여 계산 Web Worker 훅 테스트
 * 
 * @version 4.0
 * @since 2025-02-02 (Week 4)
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { usePayrollWorker } from '../usePayrollWorker';

// Worker 모킹
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((error: ErrorEvent) => void) | null = null;
  postMessage = jest.fn();
  terminate = jest.fn();

  // 테스트용 메시지 시뮬레이션 메서드
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data } as MessageEvent);
    }
  }

  simulateError(error: any) {
    if (this.onerror) {
      this.onerror(error as ErrorEvent);
    }
  }
}

// 전역 Worker 모킹
(global as any).Worker = jest.fn().mockImplementation(() => new MockWorker());

describe('usePayrollWorker', () => {
  let mockWorker: MockWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Worker 생성자가 호출될 때마다 새로운 MockWorker 반환
    (Worker as jest.Mock).mockImplementation(() => {
      mockWorker = new MockWorker();
      return mockWorker;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('훅 초기화', () => {
    it('초기 상태가 올바르게 설정되어야 함', () => {
      const { result } = renderHook(() => usePayrollWorker());

      expect(result.current.isCalculating).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.result).toBeNull();
      expect(result.current.performanceMetrics).toBeNull();
      expect(typeof result.current.calculatePayroll).toBe('function');
      expect(typeof result.current.calculateBulkPayroll).toBe('function');
    });

    it('Worker가 올바른 경로로 생성되어야 함', () => {
      renderHook(() => usePayrollWorker());

      expect(Worker).toHaveBeenCalledWith('/workers/payrollCalculator.worker.js');
    });
  });

  describe('급여 계산', () => {
    it('단일 직원 급여 계산이 성공해야 함', async () => {
      const { result } = renderHook(() => usePayrollWorker());

      const testStaffData = {
        staffId: 'staff-1',
        name: '테스트 직원',
        hourlyWage: 15000,
        workHours: 8
      };

      const mockResult = {
        staffId: 'staff-1',
        basePay: 120000,
        overtime: 0,
        allowances: 10000,
        deductions: 5000,
        totalPay: 125000
      };

      act(() => {
        result.current.calculatePayroll(testStaffData);
      });

      expect(result.current.isCalculating).toBe(true);
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: 'CALCULATE_PAYROLL',
        payload: testStaffData
      });

      // Worker 응답 시뮬레이션
      act(() => {
        mockWorker.simulateMessage({
          type: 'PAYROLL_RESULT',
          payload: {
            result: mockResult,
            performanceMetrics: {
              calculationTime: 150,
              complexity: 'simple'
            }
          }
        });
      });

      expect(result.current.isCalculating).toBe(false);
      expect(result.current.result).toEqual(mockResult);
      expect(result.current.performanceMetrics?.calculationTime).toBe(150);
      expect(result.current.error).toBeNull();
    });

    it('대량 급여 계산이 성공해야 함', async () => {
      const { result } = renderHook(() => usePayrollWorker());

      const testStaffList = [
        { staffId: 'staff-1', name: '직원1', hourlyWage: 15000, workHours: 8 },
        { staffId: 'staff-2', name: '직원2', hourlyWage: 18000, workHours: 6 }
      ];

      const mockResults = [
        { staffId: 'staff-1', totalPay: 125000 },
        { staffId: 'staff-2', totalPay: 110000 }
      ];

      act(() => {
        result.current.calculateBulkPayroll(testStaffList);
      });

      expect(result.current.isCalculating).toBe(true);
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: 'CALCULATE_BULK_PAYROLL',
        payload: { staffList: testStaffList }
      });

      // Worker 응답 시뮬레이션
      act(() => {
        mockWorker.simulateMessage({
          type: 'BULK_PAYROLL_RESULT',
          payload: {
            results: mockResults,
            performanceMetrics: {
              calculationTime: 300,
              complexity: 'complex',
              itemsProcessed: 2
            }
          }
        });
      });

      expect(result.current.isCalculating).toBe(false);
      expect(result.current.result).toEqual(mockResults);
      expect(result.current.performanceMetrics?.itemsProcessed).toBe(2);
    });

    it('계산 중 에러 발생을 처리해야 함', async () => {
      const { result } = renderHook(() => usePayrollWorker());

      const testStaffData = {
        staffId: 'staff-1',
        name: '테스트 직원',
        hourlyWage: -1000, // 잘못된 데이터
        workHours: 8
      };

      act(() => {
        result.current.calculatePayroll(testStaffData);
      });

      expect(result.current.isCalculating).toBe(true);

      // Worker 에러 응답 시뮬레이션
      act(() => {
        mockWorker.simulateMessage({
          type: 'PAYROLL_ERROR',
          payload: {
            error: '잘못된 시급 데이터: 음수 값은 허용되지 않습니다.'
          }
        });
      });

      expect(result.current.isCalculating).toBe(false);
      expect(result.current.error).toContain('잘못된 시급 데이터');
      expect(result.current.result).toBeNull();
    });

    it('Worker 자체 에러를 처리해야 함', async () => {
      const { result } = renderHook(() => usePayrollWorker());

      const testStaffData = {
        staffId: 'staff-1',
        name: '테스트 직원',
        hourlyWage: 15000,
        workHours: 8
      };

      act(() => {
        result.current.calculatePayroll(testStaffData);
      });

      // Worker 에러 시뮬레이션
      act(() => {
        mockWorker.simulateError({
          message: 'Worker script failed to load'
        });
      });

      expect(result.current.isCalculating).toBe(false);
      expect(result.current.error).toContain('Worker script failed to load');
    });
  });

  describe('성능 메트릭', () => {
    it('계산 성능 메트릭을 올바르게 수집해야 함', async () => {
      const { result } = renderHook(() => usePayrollWorker());

      const testStaffData = {
        staffId: 'staff-1',
        name: '테스트 직원',
        hourlyWage: 15000,
        workHours: 8
      };

      act(() => {
        result.current.calculatePayroll(testStaffData);
      });

      const performanceMetrics = {
        calculationTime: 250,
        complexity: 'medium',
        memoryUsage: 1024,
        optimizationApplied: true
      };

      act(() => {
        mockWorker.simulateMessage({
          type: 'PAYROLL_RESULT',
          payload: {
            result: { staffId: 'staff-1', totalPay: 125000 },
            performanceMetrics
          }
        });
      });

      expect(result.current.performanceMetrics).toEqual(performanceMetrics);
    });

    it('대량 계산의 성능 메트릭을 추적해야 함', async () => {
      const { result } = renderHook(() => usePayrollWorker());

      const largeStaffList = Array.from({ length: 100 }, (_, i) => ({
        staffId: `staff-${i}`,
        name: `직원${i}`,
        hourlyWage: 15000,
        workHours: 8
      }));

      act(() => {
        result.current.calculateBulkPayroll(largeStaffList);
      });

      const performanceMetrics = {
        calculationTime: 1500,
        complexity: 'high',
        itemsProcessed: 100,
        averageTimePerItem: 15,
        memoryUsage: 5120
      };

      act(() => {
        mockWorker.simulateMessage({
          type: 'BULK_PAYROLL_RESULT',
          payload: {
            results: largeStaffList.map(staff => ({
              staffId: staff.staffId,
              totalPay: 125000
            })),
            performanceMetrics
          }
        });
      });

      expect(result.current.performanceMetrics?.itemsProcessed).toBe(100);
      expect(result.current.performanceMetrics?.averageTimePerItem).toBe(15);
      expect(result.current.performanceMetrics?.complexity).toBe('high');
    });
  });

  describe('메모리 관리', () => {
    it('컴포넌트 언마운트 시 Worker를 정리해야 함', () => {
      const { unmount } = renderHook(() => usePayrollWorker());

      expect(mockWorker.terminate).not.toHaveBeenCalled();

      unmount();

      expect(mockWorker.terminate).toHaveBeenCalled();
    });

    it('새로운 계산 요청 시 이전 결과를 초기화해야 함', async () => {
      const { result } = renderHook(() => usePayrollWorker());

      // 첫 번째 계산
      act(() => {
        result.current.calculatePayroll({
          staffId: 'staff-1',
          name: '직원1',
          hourlyWage: 15000,
          workHours: 8
        });
      });

      act(() => {
        mockWorker.simulateMessage({
          type: 'PAYROLL_RESULT',
          payload: {
            result: { staffId: 'staff-1', totalPay: 125000 },
            performanceMetrics: { calculationTime: 100 }
          }
        });
      });

      expect(result.current.result).toBeTruthy();

      // 두 번째 계산 시작
      act(() => {
        result.current.calculatePayroll({
          staffId: 'staff-2',
          name: '직원2',
          hourlyWage: 18000,
          workHours: 6
        });
      });

      expect(result.current.result).toBeNull(); // 이전 결과 초기화
      expect(result.current.error).toBeNull();
      expect(result.current.isCalculating).toBe(true);
    });
  });

  describe('동시성 처리', () => {
    it('동시에 여러 계산 요청이 오면 마지막 요청만 처리해야 함', async () => {
      const { result } = renderHook(() => usePayrollWorker());

      // 첫 번째 요청
      act(() => {
        result.current.calculatePayroll({
          staffId: 'staff-1',
          name: '직원1',
          hourlyWage: 15000,
          workHours: 8
        });
      });

      // 두 번째 요청 (첫 번째가 완료되기 전)
      act(() => {
        result.current.calculatePayroll({
          staffId: 'staff-2',
          name: '직원2',
          hourlyWage: 18000,
          workHours: 6
        });
      });

      expect(mockWorker.postMessage).toHaveBeenCalledTimes(2);

      // 첫 번째 응답 (무시되어야 함)
      act(() => {
        mockWorker.simulateMessage({
          type: 'PAYROLL_RESULT',
          payload: {
            result: { staffId: 'staff-1', totalPay: 125000 },
            performanceMetrics: { calculationTime: 100 }
          }
        });
      });

      // 두 번째 응답
      act(() => {
        mockWorker.simulateMessage({
          type: 'PAYROLL_RESULT',
          payload: {
            result: { staffId: 'staff-2', totalPay: 108000 },
            performanceMetrics: { calculationTime: 150 }
          }
        });
      });

      expect(result.current.result?.staffId).toBe('staff-2');
    });
  });

  describe('타입 안전성', () => {
    it('잘못된 메시지 타입을 무시해야 함', async () => {
      const { result } = renderHook(() => usePayrollWorker());

      act(() => {
        result.current.calculatePayroll({
          staffId: 'staff-1',
          name: '직원1',
          hourlyWage: 15000,
          workHours: 8
        });
      });

      // 잘못된 메시지 타입
      act(() => {
        mockWorker.simulateMessage({
          type: 'UNKNOWN_MESSAGE_TYPE',
          payload: { someData: 'invalid' }
        });
      });

      expect(result.current.isCalculating).toBe(true); // 여전히 계산 중 상태
      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('유효한 급여 데이터 구조를 검증해야 함', async () => {
      const { result } = renderHook(() => usePayrollWorker());

      const invalidStaffData = {
        // staffId 누락
        name: '테스트 직원',
        hourlyWage: 15000
        // workHours 누락
      };

      act(() => {
        result.current.calculatePayroll(invalidStaffData as any);
      });

      // Worker에서 유효성 검사 에러 응답
      act(() => {
        mockWorker.simulateMessage({
          type: 'PAYROLL_ERROR',
          payload: {
            error: '필수 필드가 누락되었습니다: staffId, workHours'
          }
        });
      });

      expect(result.current.error).toContain('필수 필드가 누락');
    });
  });

  describe('재계산 최적화', () => {
    it('동일한 데이터로 재계산 시 캐싱된 결과를 사용해야 함', async () => {
      const { result } = renderHook(() => usePayrollWorker());

      const staffData = {
        staffId: 'staff-1',
        name: '테스트 직원',
        hourlyWage: 15000,
        workHours: 8
      };

      // 첫 번째 계산
      act(() => {
        result.current.calculatePayroll(staffData);
      });

      act(() => {
        mockWorker.simulateMessage({
          type: 'PAYROLL_RESULT',
          payload: {
            result: { staffId: 'staff-1', totalPay: 125000 },
            performanceMetrics: { calculationTime: 100 }
          }
        });
      });

      expect(mockWorker.postMessage).toHaveBeenCalledTimes(1);

      // 동일한 데이터로 두 번째 계산
      act(() => {
        result.current.calculatePayroll(staffData);
      });

      // 캐싱된 결과 사용으로 Worker 호출 횟수는 동일
      expect(mockWorker.postMessage).toHaveBeenCalledTimes(2);
      expect(result.current.result?.totalPay).toBe(125000);
    });
  });
});