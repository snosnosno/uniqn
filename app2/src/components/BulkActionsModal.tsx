import React, { useState } from 'react';

import { StaffData } from '../hooks/useStaffManagement';

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

  if (!isOpen) return null;

  const handleAction = async () => {
    if (selectedStaff.length === 0) return;
    
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
          if (window.confirm(`정말로 선택된 ${selectedStaff.length}명의 스태프를 삭제하시겠습니까?`)) {
            await onBulkDelete(staffIds);
          }
          break;
      }
      onClose();
    } catch (error) {
      console.error('일괄 작업 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'message' as const, label: '메시지 전송', icon: '💬' },
    { id: 'status' as const, label: '상태 변경', icon: '📊' },
    { id: 'delete' as const, label: '삭제', icon: '🗑️' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">일괄 작업</h3>
            <p className="text-sm text-gray-600 mt-1">
              {selectedStaff.length}명의 스태프가 선택됨
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 선택된 스태프 목록 */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">선택된 스태프</h4>
          <div className="max-h-24 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              {selectedStaff.map(staff => (
                <span
                  key={staff.id}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {staff.name || '이름 미정'}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 탭 메뉴 */}
        <div className="flex border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 내용 */}
        <div className="p-6">
          {activeTab === 'message' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  메시지 내용
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="스태프들에게 보낼 메시지를 입력하세요..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={4}
                />
              </div>
              <div className="text-sm text-gray-500">
                💡 메시지는 각 스태프의 연락처(이메일/전화번호)로 전송됩니다.
              </div>
            </div>
          )}

          {activeTab === 'status' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  변경할 상태
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">상태를 선택하세요</option>
                  <option value="not_started">출근 전</option>
                  <option value="checked_in">출근</option>
                  <option value="checked_out">퇴근</option>
                </select>
              </div>
              <div className="text-sm text-gray-500">
                ⚠️ 선택된 모든 스태프의 출석 상태가 일괄 변경됩니다.
              </div>
            </div>
          )}

          {activeTab === 'delete' && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      위험한 작업입니다
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>
                        선택된 {selectedStaff.length}명의 스태프가 영구적으로 삭제됩니다. 
                        이 작업은 되돌릴 수 없습니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">삭제될 스태프:</h4>
                <div className="max-h-32 overflow-y-auto bg-gray-50 rounded-lg p-3">
                  {selectedStaff.map(staff => (
                    <div key={staff.id} className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-700">
                        {staff.name || '이름 미정'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {staff.assignedRole || staff.role || '역할 미정'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            취소
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
                ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
                : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400'
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
                {activeTab === 'delete' && '삭제 실행'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkActionsModal;