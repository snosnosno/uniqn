const fs = require('fs');
const path = require('path');

// 디렉토리를 재귀적으로 탐색하여 모든 .ts, .tsx 파일 찾기
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!['node_modules', 'build', 'coverage', '.git', '__tests__', '__mocks__'].includes(file)) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      }
    } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.endsWith('.test.ts') && !file.endsWith('.test.tsx')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

// console 사용을 logger로 변환
function replaceConsoleWithLogger(content, filePath) {
  let modified = false;
  let newContent = content;

  // 이미 logger.ts 파일이면 스킵
  if (filePath.endsWith('logger.ts')) {
    return { newContent, modified };
  }

  // import logger 추가 여부 확인
  const hasLoggerImport = /import\s+.*\blogger\b.*from\s+['"].*logger['"]/.test(content);
  const hasConsoleUsage = /console\.(log|error|warn|info|debug)/.test(content);
  
  if (hasConsoleUsage && !hasLoggerImport) {
    // 적절한 위치에 logger import 추가
    const importMatch = content.match(/^(import\s+.*?;?\s*\n)+/m);
    if (importMatch) {
      const lastImportIndex = importMatch.index + importMatch[0].length;
      
      // 상대 경로 계산
      const fileDir = path.dirname(filePath);
      const loggerPath = path.join(__dirname, '../src/utils/logger');
      const relativePath = path.relative(fileDir, loggerPath).replace(/\\/g, '/');
      const importPath = relativePath.startsWith('.') ? relativePath : './' + relativePath;
      
      newContent = content.slice(0, lastImportIndex) + 
                  `import { logger } from '${importPath}';\n` + 
                  content.slice(lastImportIndex);
      modified = true;
    }
  }

  const componentName = path.basename(filePath, path.extname(filePath));

  // console.log 변환 (다양한 패턴 처리)
  newContent = newContent.replace(
    /console\.log\s*\(([\s\S]*?)\);/g,
    (match, args) => {
      modified = true;
      // 첫 번째 인자가 문자열인 경우
      if (args.trim().startsWith("'") || args.trim().startsWith('"') || args.trim().startsWith('`')) {
        const messageMatch = args.match(/^(['"`])(.*?)\1\s*(?:,\s*([\s\S]*))?$/);
        if (messageMatch) {
          const message = messageMatch[2];
          const extraArgs = messageMatch[3];
          if (extraArgs) {
            return `logger.debug('${message}', { component: '${componentName}', data: ${extraArgs} });`;
          }
          return `logger.debug('${message}', { component: '${componentName}' });`;
        }
      }
      // 그 외의 경우
      return `logger.debug('Log output', { component: '${componentName}', data: ${args} });`;
    }
  );

  // console.error 변환
  newContent = newContent.replace(
    /console\.error\s*\(([\s\S]*?)\);/g,
    (match, args) => {
      modified = true;
      // 첫 번째 인자가 문자열인 경우
      if (args.trim().startsWith("'") || args.trim().startsWith('"') || args.trim().startsWith('`')) {
        const messageMatch = args.match(/^(['"`])(.*?)\1\s*(?:,\s*([\s\S]*))?$/);
        if (messageMatch) {
          const message = messageMatch[2];
          const extraArgs = messageMatch[3];
          if (extraArgs) {
            return `logger.error('${message}', ${extraArgs}, { component: '${componentName}' });`;
          }
          return `logger.error('${message}', new Error('${message}'), { component: '${componentName}' });`;
        }
      }
      // 에러 객체만 있는 경우
      return `logger.error('Error occurred', ${args}, { component: '${componentName}' });`;
    }
  );

  // console.warn 변환
  newContent = newContent.replace(
    /console\.warn\s*\(([\s\S]*?)\);/g,
    (match, args) => {
      modified = true;
      // 첫 번째 인자가 문자열인 경우
      if (args.trim().startsWith("'") || args.trim().startsWith('"') || args.trim().startsWith('`')) {
        const messageMatch = args.match(/^(['"`])(.*?)\1\s*(?:,\s*([\s\S]*))?$/);
        if (messageMatch) {
          const message = messageMatch[2];
          const extraArgs = messageMatch[3];
          if (extraArgs) {
            return `logger.warn('${message}', { component: '${componentName}', data: ${extraArgs} });`;
          }
          return `logger.warn('${message}', { component: '${componentName}' });`;
        }
      }
      // 그 외의 경우
      return `logger.warn('Warning', { component: '${componentName}', data: ${args} });`;
    }
  );

  // console.info 변환
  newContent = newContent.replace(
    /console\.info\s*\(([\s\S]*?)\);/g,
    (match, args) => {
      modified = true;
      // 주석 처리된 경우 스킵
      if (match.includes('//')) {
        return match;
      }
      // 첫 번째 인자가 문자열인 경우
      if (args.trim().startsWith("'") || args.trim().startsWith('"') || args.trim().startsWith('`')) {
        const messageMatch = args.match(/^(['"`])(.*?)\1\s*(?:,\s*([\s\S]*))?$/);
        if (messageMatch) {
          const message = messageMatch[2];
          const extraArgs = messageMatch[3];
          if (extraArgs) {
            return `logger.info('${message}', { component: '${componentName}', data: ${extraArgs} });`;
          }
          return `logger.info('${message}', { component: '${componentName}' });`;
        }
      }
      // 그 외의 경우
      return `logger.info('Info', { component: '${componentName}', data: ${args} });`;
    }
  );

  return { newContent, modified };
}

// 메인 실행 함수
function main() {
  const srcPath = path.join(__dirname, '../src');
  const files = getAllFiles(srcPath);
  let totalReplaced = 0;
  const modifiedFiles = [];

  files.forEach(filePath => {
    const content = fs.readFileSync(filePath, 'utf8');
    const { newContent, modified } = replaceConsoleWithLogger(content, filePath);

    if (modified) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      totalReplaced++;
      modifiedFiles.push(filePath);
      console.log(`✅ 수정됨: ${path.relative(srcPath, filePath)}`);
    }
  });

  console.log(`\n📊 총 ${totalReplaced}개 파일 수정됨`);
  if (modifiedFiles.length > 0) {
    console.log('\n📝 수정된 파일 목록:');
    modifiedFiles.forEach(file => {
      console.log(`  - ${path.relative(srcPath, file)}`);
    });
  }
}

main();