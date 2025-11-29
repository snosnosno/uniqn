import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { readCSVFile } from '../../utils/csvParser';
import { logger } from '../../utils/logger';
import { toast } from '../../utils/toast';

interface CSVUploadButtonProps {
  onFileRead: (content: string) => void;
  disabled?: boolean;
}

const CSVUploadButton: React.FC<CSVUploadButtonProps> = ({ onFileRead, disabled }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일 타입 확인
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      toast.error(t('toast.common.csvTxtOnly'));
      return;
    }

    try {
      const content = await readCSVFile(file);
      onFileRead(content);
    } catch (error) {
      logger.error('파일 읽기 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'CSVUploadButton',
        data: { fileName: file.name },
      });
      toast.error(t('toast.common.fileReadError'));
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
        className="btn btn-secondary dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
      >
        엑셀 업로드
      </button>
    </>
  );
};

export default CSVUploadButton;
