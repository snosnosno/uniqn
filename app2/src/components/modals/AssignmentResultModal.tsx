import React from 'react';

export interface AssignmentResult {
  participantId: string;
  participantName: string;
  fromTableNumber?: number;
  fromSeatNumber?: number;
  toTableNumber: number;
  toSeatNumber: number;
}

interface AssignmentResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  results: AssignmentResult[];
}

const AssignmentResultModal: React.FC<AssignmentResultModalProps> = ({
  isOpen,
  onClose,
  title,
  results,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{title}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300 mt-1">
            총 {results.length}명의 참가자가 배정되었습니다.
          </p>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            {results.map((result, index) => (
              <div
                key={result.participantId}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-8">
                    {index + 1}.
                  </span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {result.participantName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {result.fromTableNumber !== undefined && result.fromSeatNumber !== undefined && (
                    <>
                      <span className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">
                        T{result.fromTableNumber}-{result.fromSeatNumber}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500">→</span>
                    </>
                  )}
                  <span className="text-sm font-semibold text-blue-600">
                    T{result.toTableNumber}-{result.toSeatNumber}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button onClick={onClose} className="btn btn-primary">
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignmentResultModal;
