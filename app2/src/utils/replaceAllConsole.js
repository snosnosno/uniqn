const fs = require('fs');
const path = require('path');

// 변환 통계
let stats = {
  totalFiles: 0,
  modifiedFiles: 0,
  consoleLog: 0,
  consoleError: 0,
  consoleWarn: 0,
  consoleInfo: 0,
  consoleDebug: 0,
  skippedFiles: []
};

// console을 logger로 교체하는 함수
function replaceConsole(content, fileName) {
  let modified = content;
  let hasImport = content.includes("import { logger }") || 
                  content.includes("from '../utils/logger'") || 
                  content.includes('from "./utils/logger"') ||
                  content.includes("from '../../utils/logger'") ||
                  content.includes('from "@/utils/logger"');
  
  // 특수 파일들은 건너뛰기
  const skipFiles = [
    'logger.ts',
    'logger.js',
    'replaceConsoleLog.js',
    'replaceAllConsole.js',
    'serviceWorkerRegistration.ts',
    'reportWebVitals.ts',
    'setupTests.ts'
  ];
  
  if (skipFiles.some(skip => fileName.includes(skip))) {
    stats.skippedFiles.push(fileName);
    return content;
  }

  // .js 유틸리티 파일들도 건너뛰기
  if (fileName.includes('utils/fix') && fileName.endsWith('.js')) {
    stats.skippedFiles.push(fileName);
    return content;
  }
  
  // console 패턴들
  const patterns = [
    // console.log 패턴들
    { 
      regex: /console\.log\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      replacement: (match, message) => {
        stats.consoleLog++;
        return `logger.info(`${message}`, { component: '${getComponentName(fileName)}' })`;
      }
    },
    { 
      regex: /console\.log\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(.+?)\s*\)/g,
      replacement: (match, message, data) => {
        stats.consoleLog++;
        const dataStr = data.trim();
        // 객체가 아닌 경우 객체로 감싸기
        if (!dataStr.startsWith('{')) {
          return `logger.info(`${message}`, { component: '${getComponentName(fileName)}', data: ${dataStr} })`;
        }
        return `logger.info(`${message}`, { component: '${getComponentName(fileName)}', ...${dataStr} })`;
      }
    },
    // console.error 패턴들
    { 
      regex: /console\.error\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      replacement: (match, message) => {
        stats.consoleError++;
        return `logger.error(`${message}`, new Error('${message}'), { component: '${getComponentName(fileName)}' })`;
      }
    },
    { 
      regex: /console\.error\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(.+?)\s*\)(?=;|\s*\n|\s*$)/g,
      replacement: (match, message, error) => {
        stats.consoleError++;
        const errorVar = error.trim();
        // error가 이미 Error 객체인지 확인
        if (errorVar === 'error' || errorVar.includes('Error') || errorVar.includes('err')) {
          return `logger.error(`${message}`, ${errorVar} instanceof Error ? ${errorVar} : new Error(String(${errorVar})), { component: '${getComponentName(fileName)}' })`;
        }
        return `logger.error(`${message}`, new Error(String(${errorVar})), { component: '${getComponentName(fileName)}' })`;
      }
    },
    // console.warn 패턴들
    { 
      regex: /console\.warn\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      replacement: (match, message) => {
        stats.consoleWarn++;
        return `logger.warn(`${message}`, { component: '${getComponentName(fileName)}' })`;
      }
    },
    { 
      regex: /console\.warn\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(.+?)\s*\)(?=;|\s*\n|\s*$)/g,
      replacement: (match, message, data) => {
        stats.consoleWarn++;
        const dataStr = data.trim();
        if (!dataStr.startsWith('{')) {
          return `logger.warn(`${message}`, { component: '${getComponentName(fileName)}', data: ${dataStr} })`;
        }
        return `logger.warn(`${message}`, { component: '${getComponentName(fileName)}', ...${dataStr} })`;
      }
    },
    // console.info 패턴들
    { 
      regex: /console\.info\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      replacement: (match, message) => {
        stats.consoleInfo++;
        return `logger.info(`${message}`, { component: '${getComponentName(fileName)}' })`;
      }
    },
    // console.debug 패턴들
    { 
      regex: /console\.debug\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      replacement: (match, message) => {
        stats.consoleDebug++;
        return `logger.debug(`${message}`, { component: '${getComponentName(fileName)}' })`;
      }
    }
  ];

  let wasModified = false;
  
  // 모든 패턴 적용
  patterns.forEach(({ regex, replacement }) => {
    const matches = modified.match(regex);
    if (matches && matches.length > 0) {
      wasModified = true;
      modified = modified.replace(regex, replacement);
    }
  });

  // logger import 추가
  if (wasModified && !hasImport) {
    const isTypeScript = fileName.endsWith('.ts') || fileName.endsWith('.tsx');
    
    // 첫 번째 import 문 찾기
    const importRegex = /^import\s+.*?from\s+['"`][^'"`]+['"`];?\s*$/m;
    const firstImportMatch = modified.match(importRegex);
    
    if (firstImportMatch) {
      const firstImportIndex = modified.indexOf(firstImportMatch[0]);
      const relativePathToLogger = getRelativePathToLogger(fileName);
      modified = modified.slice(0, firstImportIndex) + 
                `import { logger } from '${relativePathToLogger}';\n` + 
                modified.slice(firstImportIndex);
    } else {
      // import가 없는 경우 파일 시작 부분에 추가
      const relativePathToLogger = getRelativePathToLogger(fileName);
      modified = `import { logger } from '${relativePathToLogger}';\n\n` + modified;
    }
  }

  return modified;
}

function getComponentName(filePath) {
  const fileName = path.basename(filePath, path.extname(filePath));
  // 컴포넌트 이름 정리
  return fileName.replace(/[.-]/g, '');
}

function getRelativePathToLogger(filePath) {
  // src 기준 상대 경로 계산
  const normalizedPath = filePath.replace(/\\/g, '/');
  const srcIndex = normalizedPath.lastIndexOf('/src/');
  
  if (srcIndex === -1) {
    return './utils/logger';
  }
  
  const relativePath = normalizedPath.slice(srcIndex + 5); // '/src/' 이후 경로
  const depth = relativePath.split('/').length - 1;
  
  if (depth === 0) {
    return './utils/logger';
  } else if (depth === 1) {
    return '../utils/logger';
  } else {
    return '../'.repeat(depth) + 'utils/logger';
  }
}

// 디렉토리 순회 함수
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // 제외할 디렉토리
      if (!['node_modules', 'build', 'dist', '.git', '__tests__', 'coverage'].includes(file)) {
        processDirectory(filePath);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      processFile(filePath);
    }
  });
}

function processFile(filePath) {
  try {
    stats.totalFiles++;
    const content = fs.readFileSync(filePath, 'utf8');
    const modified = replaceConsole(content, filePath);
    
    if (content !== modified) {
      fs.writeFileSync(filePath, modified, 'utf8');
      stats.modifiedFiles++;
      console.log(`✅ Updated: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

// 통계 출력 함수
function printStats() {
  console.log('\n📊 변환 통계:');
  console.log(`  총 파일 수: ${stats.totalFiles}`);
  console.log(`  수정된 파일: ${stats.modifiedFiles}`);
  console.log(`  console.log → logger.info: ${stats.consoleLog}`);
  console.log(`  console.error → logger.error: ${stats.consoleError}`);
  console.log(`  console.warn → logger.warn: ${stats.consoleWarn}`);
  console.log(`  console.info → logger.info: ${stats.consoleInfo}`);
  console.log(`  console.debug → logger.debug: ${stats.consoleDebug}`);
  console.log(`  총 변환 수: ${stats.consoleLog + stats.consoleError + stats.consoleWarn + stats.consoleInfo + stats.consoleDebug}`);
  
  if (stats.skippedFiles.length > 0) {
    console.log('\n⏭️  건너뛴 파일:');
    stats.skippedFiles.forEach(file => {
      console.log(`  - ${path.basename(file)}`);
    });
  }
}

// 실행
if (require.main === module) {
  const srcPath = path.join(__dirname, '..');
  console.log('🔄 Console → Logger 변환 시작...');
  console.log(`📁 처리 디렉토리: ${srcPath}`);
  console.log('');
  
  processDirectory(srcPath);
  
  console.log('\n✨ 변환 완료!');
  printStats();
}

module.exports = { replaceConsole, processDirectory };