import React, { useState, useEffect } from 'react';
import Modal, { ModalFooter } from '../ui/Modal';
import { parseParticipantsText, ParsedParticipant } from '../../utils/csvParser';
import { FaCheckCircle, FaExclamationTriangle } from '../Icons/ReactIconsReplacement';
import { logger } from '../../utils/logger';
import { toast } from '../../utils/toast';

interface BulkAddParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (participants: ParsedParticipant[]) => Promise<void>;
}

const BulkAddParticipantsModal: React.FC<BulkAddParticipantsModalProps> = ({
  isOpen,
  onClose,
  onConfirm
}) => {
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedParticipant[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (inputText) {
      const parsed = parseParticipantsText(inputText);
      setParsedData(parsed);
    } else {
      setParsedData([]);
    }
  }, [inputText]);

  const handleConfirm = async () => {
    const validParticipants = parsedData.filter(p => p.isValid);
    if (validParticipants.length === 0) {
      toast.warning('추가할 유효한 참가자가 없습니다.');
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm(validParticipants);
      setInputText('');
      setParsedData([]);
      onClose();
    } catch (error) {
      logger.error('대량 추가 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'BulkAddParticipantsModal',
        data: { count: validParticipants.length }
      });
      toast.error('참가자 추가 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedData.filter(p => p.isValid).length;
  const invalidCount = parsedData.filter(p => !p.isValid).length;

  const sampleText = `홍길동,10000
김철수,010-1234-5678,15000
이영희,20000
박민수,12000`;

  const footerButtons = (
    <ModalFooter>
      <div className="flex justify-between items-center w-full">
        <div className="text-sm text-text-secondary">
          {validCount > 0 && `${validCount}명을 추가합니다`}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isProcessing}
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            className="btn btn-primary"
            disabled={isProcessing || validCount === 0}
          >
            {isProcessing ? '추가 중...' : `${validCount}명 추가`}
          </button>
        </div>
      </div>
    </ModalFooter>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="참가자 대량 추가"
      size="xl"
      footer={footerButtons}
      aria-label="참가자 대량 추가"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            입력 형식
          </label>
          <div className="bg-background-secondary dark:bg-gray-700 p-3 rounded text-sm">
            <p className="font-semibold mb-1">형식 1: 이름,칩</p>
            <p className="font-semibold mb-1">형식 2: 이름,전화번호,칩</p>
            <p className="text-text-secondary mt-2">
              * 엑셀에서 복사한 데이터를 직접 붙여넣을 수 있습니다
            </p>
            <p className="text-text-secondary">
              * 각 참가자는 줄바꿈으로 구분합니다
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            참가자 데이터 입력
          </label>
          <textarea
            className="w-full h-48 p-3 border rounded-lg font-mono text-sm"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={sampleText}
            disabled={isProcessing}
          />
        </div>

        {parsedData.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">미리보기</label>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-success">
                  <FaCheckCircle className="w-4 h-4" />
                  유효: {validCount}명
                </span>
                {invalidCount > 0 && (
                  <span className="flex items-center gap-1 text-error">
                    <FaExclamationTriangle className="w-4 h-4" />
                    오류: {invalidCount}명
                  </span>
                )}
              </div>
            </div>
            
            <div className="max-h-64 overflow-y-auto border dark:border-gray-700 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-background-secondary dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">상태</th>
                    <th className="px-3 py-2 text-left">이름</th>
                    <th className="px-3 py-2 text-left">전화번호</th>
                    <th className="px-3 py-2 text-right">칩</th>
                    <th className="px-3 py-2 text-left">오류</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.map((participant, index) => (
                    <tr
                      key={index}
                      className={`border-b dark:border-gray-700 ${!participant.isValid ? 'bg-red-50 dark:bg-red-900/30' : ''}`}
                    >
                      <td className="px-3 py-2">
                        {participant.isValid ? (
                          <FaCheckCircle className="w-4 h-4 text-success" />
                        ) : (
                          <FaExclamationTriangle className="w-4 h-4 text-error" />
                        )}
                      </td>
                      <td className="px-3 py-2">{participant.name}</td>
                      <td className="px-3 py-2">{participant.phone || '-'}</td>
                      <td className="px-3 py-2 text-right">
                        {participant.chips.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-error text-xs">
                        {participant.error || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
};

export default BulkAddParticipantsModal;