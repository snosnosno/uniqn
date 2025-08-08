
export interface ParsedParticipant {
  name: string;
  phone?: string;
  chips: number;
  isValid: boolean;
  error?: string;
}

/**
 * CSV 또는 탭으로 구분된 텍스트를 파싱하여 참가자 데이터로 변환
 */
export function parseParticipantsText(text: string): ParsedParticipant[] {
  const lines = text.trim().split(/\r?\n/);
  const participants: ParsedParticipant[] = [];
  
  // 첫 줄이 헤더인지 확인 (숫자가 없으면 헤더로 간주)
  let startIndex = 0;
  if (lines.length > 0 && lines[0] && !(/\d/.test(lines[0]))) {
    startIndex = 1; // 헤더 스킵
  }
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    
    // 탭 또는 쉼표로 구분
    const delimiter = line.includes('\t') ? '\t' : ',';
    const parts = line.split(delimiter).map(part => part.trim());
    
    if (parts.length < 2) {
      participants.push({
        name: '',
        chips: 0,
        isValid: false,
        error: `줄 ${i + 1}: 최소 2개 필드(이름,칩) 필요`
      });
      continue;
    }
    
    const name = parts[0] || '';
    let phone = '';
    let chipsStr = '';
    
    // 3개 필드: 이름,전화번호,칩
    if (parts.length >= 3) {
      phone = parts[1] || '';
      chipsStr = parts[2] || '';
    } 
    // 2개 필드: 이름,칩
    else {
      chipsStr = parts[1] || '';
    }
    
    // 칩 수 파싱
    const chips = parseInt(chipsStr.replace(/[^0-9]/g, ''), 10);
    
    // 유효성 검사
    let isValid = true;
    let error = '';
    
    if (!name) {
      isValid = false;
      error = '이름이 필요합니다';
    } else if (isNaN(chips) || chips < 0) {
      isValid = false;
      error = '올바른 칩 수를 입력해주세요';
    }
    
    const participant: ParsedParticipant = {
      name,
      phone,
      chips: isNaN(chips) ? 0 : chips,
      isValid
    };
    
    if (error) {
      participant.error = error;
    }
    
    participants.push(participant);
  }
  
  return participants;
}

/**
 * CSV 파일 읽기
 */
export function readCSVFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const text = event.target?.result as string;
      resolve(text);
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * 샘플 CSV 생성
 */
export function generateSampleCSV(): string {
  const header = '이름,전화번호,칩';
  const samples = [
    '홍길동,010-1234-5678,10000',
    '김철수,010-9876-5432,15000',
    '이영희,010-5555-1234,20000',
    '박민수,,12000',
    '최지우,010-3333-4444,18000'
  ];
  
  return [header, ...samples].join('\n');
}

/**
 * CSV 다운로드
 */
export function downloadCSV(content: string, filename: string = 'participants_template.csv') {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}