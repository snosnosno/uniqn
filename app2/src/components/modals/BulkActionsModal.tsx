import React, { useState } from 'react';

import { logger } from '../../utils/logger';
import { StaffData } from '../../hooks/useStaffManagement';
import Modal, { ModalFooter } from '../ui/Modal';

interface BulkActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStaff: StaffData[];
  onBulkDelete: (staffIds: string[]) => Promise<void>;
  onBulkMessage: (staffIds: string[], message: string) => Promise<void>;
  onBulkStatusUpdate: (staffIds: string[], status: string) => Promise<void>;
}

const BulkActionsModal: React.FC<BulkActionsModalProps> = ({
  isOpen,
  onClose,
  selectedStaff,
  onBulkDelete,
  onBulkMessage,
  onBulkStatusUpdate
}) => {
  const [activeTab, setActiveTab] = useState<'message' | 'status' | 'delete'>('message');
  const [message, setMessage] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!isOpen) return null;

  const handleAction = async () => {
    if (selectedStaff.length === 0) return;

    // 삭제 탭에서는 확인 단계 표시
    if (activeTab === 'delete' && !showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setIsLoading(true);
    try {
      const staffIds = selectedStaff.map(staff => staff.id);

      switch (activeTab) {
        case 'message':
          if (message.trim()) {
            await onBulkMessage(staffIds, message.trim());
            setMessage('');
          }
          break;
        case 'status':
          if (selectedStatus) {
            await onBulkStatusUpdate(staffIds, selectedStatus);
            setSelectedStatus('');
          }
          break;
        case 'delete':
          await onBulkDelete(staffIds);
          setShowDeleteConfirm(false);
          break;
      }
      onClose();
    } catch (error) {
      logger.error('일괄 작업 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'BulkActionsModal' });
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'message' as const, label: '메시지 전송', icon: '💬' },
    { id: 'status' as const, label: '상태 변경', icon: '📊' },
    { id: 'delete' as const, label: '삭제', icon: '🗑️' }
  ];

  const footerButtons = (
    <ModalFooter>
      <button
        onClick={() => {
          if (activeTab === 'delete' && showDeleteConfirm) {
            setShowDeleteConfirm(false);
          } else {
            onClose();
          }
        }}
        className="flex-1 px-4 py-2 text-text-secondary bg-background-secondary rounded-lg hover:bg-background-tertiary transition-colors"
      >
        {activeTab === 'delete' && showDeleteConfirm ? '이전' : '취소'}
      </button>
      <button
        onClick={handleAction}
        disabled={
          isLoading ||
          (activeTab === 'message' && !message.trim()) ||
          (activeTab === 'status' && !selectedStatus)
        }
        className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors ${
          activeTab === 'delete'
            ? showDeleteConfirm
              ? 'bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-600 disabled:bg-red-400 dark:disabled:bg-red-500'
              : 'bg-error hover:bg-error-dark disabled:bg-error-light'
            : 'bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            처리 중...
          </div>
        ) : (
          <>
            {activeTab === 'message' && '메시지 전송'}
            {activeTab === 'status' && '상태 변경'}
            {activeTab === 'delete' && (showDeleteConfirm ? '삭제 실행' : '다음')}
          </>
        )}
      </button>
    </ModalFooter>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="일괄 작업"
      size="lg"
      footer={footerButtons}
      aria-label="일괄 작업"
    >
      {/* 선택된 스태프 개수 표시 */}
      <div className="mb-4">
        <p className="text-sm text-text-secondary">
          {selectedStaff.length}명의 스태프가 선택됨
        </p>
      </div>

      {/* 선택된 스태프 목록 */}
      <div className="p-4 bg-background-secondary dark:bg-gray-700 border border-border-light dark:border-gray-600 rounded-lg mb-4">
        <h4 className="text-sm font-medium text-text-primary mb-2">선택된 스태프</h4>
        <div className="max-h-24 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {selectedStaff.map(staff => (
              <span
                key={staff.id}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
              >
                {staff.name || '이름 미정'}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 탭 메뉴 */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 내용 */}
      <div>
        {activeTab === 'message' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                메시지 내용
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="스태프들에게 보낼 메시지를 입력하세요..."
                className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={4}
              />
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              💡 메시지는 각 스태프의 연락처(이메일/전화번호)로 전송됩니다.
            </div>
          </div>
        )}

        {activeTab === 'status' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                변경할 상태
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">상태를 선택하세요</option>
                <option value="not_started">출근 전</option>
                <option value="checked_in">출근</option>
                <option value="checked_out">퇴근</option>
              </select>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              ⚠️ 선택된 모든 스태프의 출석 상태가 일괄 변경됩니다.
            </div>
          </div>
        )}

        {activeTab === 'delete' && (
          <div className="space-y-4">
            {!showDeleteConfirm ? (
              <>
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                        위험한 작업입니다
                      </h3>
                      <div className="mt-2 text-sm text-red-700 dark:text-red-400">
                        <p>
                          선택된 {selectedStaff.length}명의 스태프가 영구적으로 삭제됩니다.
                          이 작업은 되돌릴 수 없습니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">삭제될 스태프:</h4>
                  <div className="max-h-32 overflow-y-auto bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    {selectedStaff.map(staff => (
                      <div key={staff.id} className="flex items-center justify-between py-1">
                        <span className="text-sm text-gray-700 dark:text-gray-200">
                          {staff.name || '이름 미정'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {staff.assignedRole || staff.role || '역할 미정'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-base font-medium text-yellow-800 dark:text-yellow-300">
                        정말 삭제하시겠습니까?
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-400">
                        <p className="font-medium mb-2">
                          {selectedStaff.length}명의 스태프가 영구적으로 삭제됩니다.
                        </p>
                        <p className="text-xs">
                          이 작업은 되돌릴 수 없으며, 모든 관련 데이터가 함께 삭제됩니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>확인하려면 아래 "삭제 실행" 버튼을 다시 눌러주세요.</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default BulkActionsModal;