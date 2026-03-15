#!/usr/bin/env node
/**
 * T-HOLDEM 문서 자동 업데이트 스크립트
 * [레거시] app2 문서 워크플로우용 유틸리티
 * 
 * 기능:
 * - package.json의 버전과 문서 버전 동기화
 * - 날짜 자동 업데이트
 * - 일관성 검사 및 자동 수정
 * 
 * 사용법: node scripts/update-docs.js
 */

const fs = require('fs');
const path = require('path');

// 설정
const CONFIG = {
  packageJsonPath: path.join(__dirname, '../app2/package.json'),
  docsPath: path.join(__dirname, '../docs'),
  rootFiles: [
    'README.md',
    'ROADMAP.md', 
    'TODO.md',
    'CONTRIBUTING.md',
    'CLAUDE.md'
  ],
  dateFormat: new Date().toISOString().split('T')[0] // YYYY-MM-DD
};

// 유틸리티 함수
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.warn(`⚠️  파일 읽기 실패: ${filePath}`);
    return null;
  }
}

function writeFile(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (error) {
    console.error(`❌ 파일 쓰기 실패: ${filePath}`, error.message);
    return false;
  }
}

function getPackageVersion() {
  const packageJson = readFile(CONFIG.packageJsonPath);
  if (!packageJson) return null;
  
  try {
    const parsed = JSON.parse(packageJson);
    return parsed.version;
  } catch (error) {
    console.error('❌ package.json 파싱 실패:', error.message);
    return null;
  }
}

// 문서 업데이트 규칙
const updateRules = [
  // 버전 업데이트
  {
    name: 'version-sync',
    pattern: /(\*\*버전\*\*:\s*)(v?\d+\.\d+\.\d+)/g,
    replace: (match, prefix, version, packageVersion) => 
      `${prefix}${packageVersion}`
  },
  
  // 날짜 업데이트
  {
    name: 'date-update',
    pattern: /(\*\*최종 업데이트\*\*:\s*)(\d{4}년\s*\d{1,2}월\s*\d{1,2}일)/g,
    replace: (match, prefix) => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      return `${prefix}${year}년 ${month}월 ${day}일`;
    }
  },
  
  // 마지막 업데이트 날짜
  {
    name: 'last-update',
    pattern: /(\*마지막 업데이트:\s*)(\d{4}년\s*\d{1,2}월\s*\d{1,2}일)/g,
    replace: (match, prefix) => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      return `${prefix}${year}년 ${month}월 ${day}일`;
    }
  }
];

// 문서 파일 업데이트
function updateDocumentFile(filePath, packageVersion) {
  const content = readFile(filePath);
  if (!content) return false;
  
  let updatedContent = content;
  let changeCount = 0;
  
  updateRules.forEach(rule => {
    const originalContent = updatedContent;
    
    if (rule.name === 'version-sync' && packageVersion) {
      updatedContent = updatedContent.replace(rule.pattern, (match, prefix, version) => {
        changeCount++;
        return rule.replace(match, prefix, version, `v${packageVersion}`);
      });
    } else if (rule.name.includes('date')) {
      updatedContent = updatedContent.replace(rule.pattern, (match, prefix) => {
        changeCount++;
        return rule.replace(match, prefix);
      });
    }
  });
  
  if (changeCount > 0) {
    const success = writeFile(filePath, updatedContent);
    if (success) {
      console.log(`✅ ${path.basename(filePath)} 업데이트 완료 (${changeCount}개 변경)`);
      return true;
    }
  } else {
    console.log(`📄 ${path.basename(filePath)} 변경 사항 없음`);
  }
  
  return false;
}

// 문서 일관성 검사
function checkDocumentConsistency() {
  const issues = [];
  
  // README.md와 package.json 버전 일치 확인
  const packageVersion = getPackageVersion();
  const readmePath = path.join(__dirname, '../README.md');
  const readmeContent = readFile(readmePath);
  
  if (readmeContent && packageVersion) {
    const versionMatch = readmeContent.match(/\*\*버전\*\*:\s*(v?\d+\.\d+\.\d+)/);
    const readmeVersion = versionMatch ? versionMatch[1].replace('v', '') : null;
    
    if (readmeVersion !== packageVersion) {
      issues.push({
        type: 'version-mismatch',
        message: `버전 불일치: README.md(${readmeVersion}) vs package.json(${packageVersion})`,
        file: 'README.md'
      });
    }
  }
  
  // TODO.md 현재 스프린트 날짜 확인
  const todoPath = path.join(__dirname, '../TODO.md');
  const todoContent = readFile(todoPath);
  
  if (todoContent) {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    // 스프린트 기간 확인 (예: 2025년 9월 10일 - 24일)
    const sprintMatch = todoContent.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*-\s*(\d{1,2})일/);
    
    if (sprintMatch) {
      const [, year, month, startDay, endDay] = sprintMatch;
      const sprintYear = parseInt(year);
      const sprintMonth = parseInt(month);
      const sprintEnd = parseInt(endDay);
      
      if (sprintYear < currentYear || 
          (sprintYear === currentYear && sprintMonth < currentMonth) ||
          (sprintYear === currentYear && sprintMonth === currentMonth && sprintEnd < currentDate.getDate())) {
        issues.push({
          type: 'outdated-sprint',
          message: `TODO.md의 스프린트 기간이 과거입니다: ${year}년 ${month}월`,
          file: 'TODO.md'
        });
      }
    }
  }
  
  return issues;
}

// 메인 실행 함수
async function main() {
  console.log('🚀 T-HOLDEM 문서 자동 업데이트 시작');
  console.log('=' .repeat(50));
  
  // package.json 버전 확인
  const packageVersion = getPackageVersion();
  if (!packageVersion) {
    console.error('❌ package.json 버전을 읽을 수 없습니다.');
    process.exit(1);
  }
  
  console.log(`📦 현재 패키지 버전: v${packageVersion}`);
  console.log('');
  
  // 루트 파일들 업데이트
  console.log('📝 루트 문서 파일 업데이트...');
  let updatedFiles = 0;
  
  CONFIG.rootFiles.forEach(fileName => {
    const filePath = path.join(__dirname, '..', fileName);
    const updated = updateDocumentFile(filePath, packageVersion);
    if (updated) updatedFiles++;
  });
  
  // docs 폴더의 마크다운 파일들 업데이트
  console.log('');
  console.log('📚 docs/ 폴더 문서 업데이트...');
  
  try {
    const docsFiles = fs.readdirSync(CONFIG.docsPath)
      .filter(file => file.endsWith('.md'));
    
    docsFiles.forEach(fileName => {
      const filePath = path.join(CONFIG.docsPath, fileName);
      const updated = updateDocumentFile(filePath, packageVersion);
      if (updated) updatedFiles++;
    });
  } catch (error) {
    console.warn('⚠️  docs/ 폴더 읽기 실패:', error.message);
  }
  
  console.log('');
  console.log('🔍 문서 일관성 검사...');
  
  const issues = checkDocumentConsistency();
  
  if (issues.length > 0) {
    console.log('⚠️  발견된 이슈:');
    issues.forEach(issue => {
      console.log(`   - ${issue.message}`);
    });
  } else {
    console.log('✅ 문서 일관성 검사 통과');
  }
  
  console.log('');
  console.log('=' .repeat(50));
  console.log(`🎉 업데이트 완료! (${updatedFiles}개 파일 수정)`);
  
  if (issues.length > 0) {
    console.log(`⚠️  ${issues.length}개 이슈 발견 - 수동 검토 필요`);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 스크립트 실행 실패:', error.message);
    process.exit(1);
  });
}

module.exports = {
  updateDocumentFile,
  checkDocumentConsistency,
  getPackageVersion
};
