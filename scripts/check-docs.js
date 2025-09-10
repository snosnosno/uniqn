#!/usr/bin/env node
/**
 * T-HOLDEM 문서 품질 검사 스크립트
 * 
 * 기능:
 * - 문서 일관성 검사
 * - 링크 유효성 검증
 * - 문서 완성도 분석
 * - 오타 및 형식 오류 탐지
 * 
 * 사용법: node scripts/check-docs.js
 */

const fs = require('fs');
const path = require('path');

// 설정
const CONFIG = {
  rootDir: path.join(__dirname, '..'),
  docsDir: path.join(__dirname, '../docs'),
  excludeFiles: [
    'node_modules',
    '.git',
    'build',
    'dist',
    '*.log'
  ],
  requiredFiles: [
    'README.md',
    'CONTRIBUTING.md',
    'ROADMAP.md',
    'TODO.md',
    'CLAUDE.md'
  ],
  maxLineLength: 120
};

// 문서 검사 결과 저장
let checkResults = {
  errors: [],
  warnings: [],
  info: [],
  stats: {
    totalFiles: 0,
    totalLines: 0,
    totalWords: 0,
    avgWordsPerFile: 0
  }
};

// 유틸리티 함수
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return null;
  }
}

function getAllMarkdownFiles(dir) {
  const files = [];
  
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    items.forEach(item => {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory() && !CONFIG.excludeFiles.includes(item.name)) {
        files.push(...getAllMarkdownFiles(fullPath));
      } else if (item.isFile() && item.name.endsWith('.md')) {
        files.push(fullPath);
      }
    });
  } catch (error) {
    console.warn(`디렉토리 읽기 실패: ${dir}`);
  }
  
  return files;
}

// 필수 파일 존재 여부 검사
function checkRequiredFiles() {
  console.log('📋 필수 파일 존재 여부 검사...');
  
  CONFIG.requiredFiles.forEach(fileName => {
    const filePath = path.join(CONFIG.rootDir, fileName);
    
    if (!fs.existsSync(filePath)) {
      checkResults.errors.push({
        type: 'missing-file',
        message: `필수 파일 누락: ${fileName}`,
        file: fileName
      });
    } else {
      checkResults.info.push({
        type: 'file-exists',
        message: `필수 파일 존재: ${fileName}`,
        file: fileName
      });
    }
  });
}

// 문서 내용 분석
function analyzeDocumentContent(filePath) {
  const content = readFile(filePath);
  if (!content) return null;
  
  const fileName = path.basename(filePath);
  const lines = content.split('\n');
  const words = content.split(/\s+/).filter(word => word.trim());
  
  const analysis = {
    fileName,
    filePath,
    lineCount: lines.length,
    wordCount: words.length,
    charCount: content.length,
    isEmpty: content.trim().length === 0,
    hasTitle: lines.some(line => line.startsWith('# ')),
    hasHeaders: lines.some(line => line.match(/^#{2,6}\s/)),
    hasLinks: content.includes('[') && content.includes(']('),
    hasTOC: content.includes('## 목차') || content.includes('## Table of Contents'),
    longLines: lines
      .map((line, index) => ({ line: line.trim(), number: index + 1, length: line.length }))
      .filter(item => item.length > CONFIG.maxLineLength)
  };
  
  return analysis;
}

// 링크 유효성 검사
function checkInternalLinks(filePath, content) {
  const fileName = path.basename(filePath);
  const internalLinks = [];
  
  // 마크다운 링크 패턴: [텍스트](링크)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    const linkText = match[1];
    const linkUrl = match[2];
    
    // 내부 링크만 검사 (상대 경로)
    if (!linkUrl.startsWith('http') && !linkUrl.startsWith('mailto:')) {
      internalLinks.push({
        text: linkText,
        url: linkUrl,
        line: content.substring(0, match.index).split('\n').length
      });
    }
  }
  
  // 링크 유효성 검사
  internalLinks.forEach(link => {
    let targetPath;
    
    if (link.url.startsWith('./') || link.url.startsWith('../')) {
      // 상대 경로
      const baseDir = path.dirname(filePath);
      targetPath = path.resolve(baseDir, link.url.split('#')[0]); // 앵커 제거
    } else if (link.url.startsWith('/')) {
      // 루트 경로
      targetPath = path.join(CONFIG.rootDir, link.url.split('#')[0]);
    } else {
      // 현재 디렉토리 기준
      const baseDir = path.dirname(filePath);
      targetPath = path.join(baseDir, link.url.split('#')[0]);
    }
    
    if (!fs.existsSync(targetPath)) {
      checkResults.errors.push({
        type: 'broken-link',
        message: `깨진 링크: ${link.url}`,
        file: fileName,
        line: link.line,
        details: `대상 파일 없음: ${targetPath}`
      });
    }
  });
  
  return internalLinks;
}

// 버전 일관성 검사
function checkVersionConsistency() {
  console.log('🔍 버전 일관성 검사...');
  
  // package.json 버전
  const packagePath = path.join(CONFIG.rootDir, 'app2/package.json');
  let packageVersion = null;
  
  try {
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    packageVersion = packageContent.version;
  } catch (error) {
    checkResults.errors.push({
      type: 'package-read-error',
      message: 'package.json 읽기 실패',
      file: 'app2/package.json'
    });
    return;
  }
  
  // 문서들의 버전 검사
  const versionFiles = ['README.md', 'ROADMAP.md', 'CLAUDE.md'];
  const versionPattern = /(\*\*버전\*\*:\s*)(v?\d+\.\d+\.\d+)/g;
  
  versionFiles.forEach(fileName => {
    const filePath = path.join(CONFIG.rootDir, fileName);
    const content = readFile(filePath);
    
    if (content) {
      let match;
      while ((match = versionPattern.exec(content)) !== null) {
        const docVersion = match[2].replace('v', '');
        
        if (docVersion !== packageVersion) {
          checkResults.warnings.push({
            type: 'version-mismatch',
            message: `버전 불일치: ${fileName}(${docVersion}) vs package.json(${packageVersion})`,
            file: fileName
          });
        }
      }
    }
  });
}

// 문서 품질 점수 계산
function calculateQualityScore(analysis) {
  let score = 100;
  const penalties = [];
  
  // 기본 구조 검사
  if (!analysis.hasTitle) {
    score -= 20;
    penalties.push('제목 없음 (-20점)');
  }
  
  if (!analysis.hasHeaders) {
    score -= 10;
    penalties.push('헤더 구조 부족 (-10점)');
  }
  
  // 내용 풍부도 검사
  if (analysis.wordCount < 50) {
    score -= 15;
    penalties.push('내용 부족 (-15점)');
  }
  
  if (analysis.wordCount > 5000) {
    score -= 5;
    penalties.push('내용 과다 (-5점)');
  }
  
  // 긴 줄 체크
  if (analysis.longLines.length > 0) {
    score -= Math.min(10, analysis.longLines.length);
    penalties.push(`긴 줄 ${analysis.longLines.length}개 (-${Math.min(10, analysis.longLines.length)}점)`);
  }
  
  // 링크 존재 여부 (문서 간 연결성)
  if (analysis.hasLinks) {
    score += 5;
  }
  
  return {
    score: Math.max(0, score),
    penalties,
    grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'
  };
}

// 메인 검사 실행
async function runDocumentChecks() {
  console.log('🔍 T-HOLDEM 문서 품질 검사 시작');
  console.log('=' .repeat(50));
  
  // 1. 필수 파일 검사
  checkRequiredFiles();
  
  // 2. 모든 마크다운 파일 수집
  console.log('📄 마크다운 파일 수집 중...');
  const markdownFiles = getAllMarkdownFiles(CONFIG.rootDir);
  console.log(`📋 총 ${markdownFiles.length}개 마크다운 파일 발견`);
  
  // 3. 각 파일 분석
  console.log('📊 문서 내용 분석 중...');
  const analyses = [];
  let totalWords = 0;
  
  markdownFiles.forEach(filePath => {
    const analysis = analyzeDocumentContent(filePath);
    if (analysis) {
      analyses.push(analysis);
      totalWords += analysis.wordCount;
      
      // 빈 파일 체크
      if (analysis.isEmpty) {
        checkResults.warnings.push({
          type: 'empty-file',
          message: '빈 파일',
          file: analysis.fileName
        });
      }
      
      // 제목 없는 파일 체크
      if (!analysis.hasTitle) {
        checkResults.warnings.push({
          type: 'no-title',
          message: '제목(# )이 없음',
          file: analysis.fileName
        });
      }
      
      // 긴 줄 체크
      analysis.longLines.forEach(longLine => {
        checkResults.warnings.push({
          type: 'long-line',
          message: `긴 줄 (${longLine.length}자): ${longLine.line.substring(0, 50)}...`,
          file: analysis.fileName,
          line: longLine.number
        });
      });
      
      // 링크 검사
      const content = readFile(filePath);
      if (content) {
        checkInternalLinks(filePath, content);
      }
    }
  });
  
  // 4. 버전 일관성 검사
  checkVersionConsistency();
  
  // 5. 통계 계산
  checkResults.stats = {
    totalFiles: analyses.length,
    totalLines: analyses.reduce((sum, a) => sum + a.lineCount, 0),
    totalWords: totalWords,
    avgWordsPerFile: Math.round(totalWords / analyses.length) || 0
  };
  
  // 6. 품질 점수 계산
  console.log('📈 문서 품질 점수 계산 중...');
  const qualityScores = analyses.map(analysis => ({
    fileName: analysis.fileName,
    ...calculateQualityScore(analysis)
  }));
  
  return { analyses, qualityScores };
}

// 결과 출력
function printResults(analyses, qualityScores) {
  console.log('\n📊 검사 결과 요약');
  console.log('=' .repeat(50));
  
  // 통계
  console.log('📈 전체 통계:');
  console.log(`   - 총 파일: ${checkResults.stats.totalFiles}개`);
  console.log(`   - 총 단어: ${checkResults.stats.totalWords}개`);
  console.log(`   - 평균 단어/파일: ${checkResults.stats.avgWordsPerFile}개`);
  console.log('');
  
  // 에러
  if (checkResults.errors.length > 0) {
    console.log('❌ 에러:');
    checkResults.errors.forEach(error => {
      const location = error.line ? `${error.file}:${error.line}` : error.file;
      console.log(`   - ${location}: ${error.message}`);
      if (error.details) {
        console.log(`     ${error.details}`);
      }
    });
    console.log('');
  }
  
  // 경고
  if (checkResults.warnings.length > 0) {
    console.log('⚠️ 경고:');
    checkResults.warnings.slice(0, 10).forEach(warning => { // 상위 10개만 표시
      const location = warning.line ? `${warning.file}:${warning.line}` : warning.file;
      console.log(`   - ${location}: ${warning.message}`);
    });
    
    if (checkResults.warnings.length > 10) {
      console.log(`   ... 외 ${checkResults.warnings.length - 10}개 경고`);
    }
    console.log('');
  }
  
  // 품질 점수
  if (qualityScores.length > 0) {
    console.log('🏆 문서 품질 점수:');
    qualityScores
      .sort((a, b) => b.score - a.score)
      .forEach(score => {
        const grade = score.grade;
        const gradeEmoji = grade === 'A' ? '🥇' : grade === 'B' ? '🥈' : grade === 'C' ? '🥉' : '📄';
        console.log(`   ${gradeEmoji} ${score.fileName}: ${score.score}점 (${grade})`);
        
        if (score.penalties.length > 0) {
          console.log(`      감점: ${score.penalties.join(', ')}`);
        }
      });
    
    const avgScore = Math.round(qualityScores.reduce((sum, s) => sum + s.score, 0) / qualityScores.length);
    console.log(`\n   📊 평균 품질 점수: ${avgScore}점`);
  }
  
  // 최종 평가
  console.log('\n🎯 종합 평가:');
  const errorCount = checkResults.errors.length;
  const warningCount = checkResults.warnings.length;
  
  if (errorCount === 0 && warningCount === 0) {
    console.log('✅ 완벽합니다! 모든 검사를 통과했습니다.');
  } else if (errorCount === 0) {
    console.log(`⚠️ 양호합니다. ${warningCount}개 경고가 있지만 심각하지 않습니다.`);
  } else {
    console.log(`❌ 개선이 필요합니다. ${errorCount}개 에러와 ${warningCount}개 경고가 있습니다.`);
  }
  
  // 개선 제안
  console.log('\n💡 개선 제안:');
  
  if (analyses.some(a => !a.hasTitle)) {
    console.log('   - 모든 문서에 제목(# )을 추가하세요');
  }
  
  if (analyses.some(a => a.wordCount < 50)) {
    console.log('   - 내용이 부족한 문서를 보완하세요');
  }
  
  if (checkResults.warnings.some(w => w.type === 'long-line')) {
    console.log(`   - 줄 길이를 ${CONFIG.maxLineLength}자 이내로 유지하세요`);
  }
  
  if (checkResults.errors.some(e => e.type === 'broken-link')) {
    console.log('   - 깨진 링크를 수정하세요');
  }
  
  if (checkResults.warnings.some(w => w.type === 'version-mismatch')) {
    console.log('   - 문서 간 버전 일관성을 맞추세요');
  }
}

// 메인 실행
async function main() {
  try {
    const { analyses, qualityScores } = await runDocumentChecks();
    printResults(analyses, qualityScores);
    
    // 종료 코드 설정
    const hasErrors = checkResults.errors.length > 0;
    process.exit(hasErrors ? 1 : 0);
    
  } catch (error) {
    console.error('❌ 검사 중 오류 발생:', error.message);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = {
  checkRequiredFiles,
  analyzeDocumentContent,
  checkInternalLinks,
  calculateQualityScore
};