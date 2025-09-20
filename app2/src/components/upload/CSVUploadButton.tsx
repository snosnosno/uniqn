import React, { useRef } from 'react';
import { readCSVFile } from '../../utils/csvParser';
import { logger } from '../../utils/logger';
import { toast } from '../../utils/toast';

interface CSVUploadButtonProps {
  onFileRead: (content: string) => void;
  disabled?: boolean;
}

const CSVUploadButton: React.FC<CSVUploadButtonProps> = ({ onFileRead, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일 타입 확인
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      toast.error('CSV 또는 TXT 파일만 업로드 가능합니다.');
      return;
    }

    try {
      const content = await readCSVFile(file);
      onFileRead(content);
    } catch (error) {
      logger.error('파일 읽기 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'CSVUploadButton',
        data: { fileName: file.name }
      });
      toast.error('파일을 읽는 중 오류가 발생했습니다.');
    }

    // 같은 파일 재선택 가능하도록 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <button
        onClick={handleClick}
        disabled={disabled}
        className="btn btn-secondary"
      >
        엑셀 업로드
      </button>
    </>
  );
};

export default CSVUploadButton;