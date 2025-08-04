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

// console.log를 logger로 변환
function replaceConsoleWithLogger(content, filePath) {
  let modified = false;
  let newContent = content;

  // import logger 추가 여부 확인
  const hasLoggerImport = /import\s+.*\blogger\b.*from\s+['"].*logger['"]/.test(content);
  const needsLoggerImport = /console\.(log|error|warn|info|debug)/.test(content) && !hasLoggerImport;

  if (needsLoggerImport) {
    // 적절한 위치에 logger import 추가
    const importMatch = content.match(/^(import\s+.*?;?\s*\n)+/m);
    if (importMatch) {
      const lastImportIndex = importMatch.index + importMatch[0].length;
      
      // 상대 경로 계산
      const fileDir = path.dirname(filePath);
      const relativePath = path.relative(fileDir, path.join(__dirname, '../src/utils/logger')).replace(/\\/g, '/');
      const importPath = relativePath.startsWith('.') ? relativePath : './' + relativePath;
      
      newContent = content.slice(0, lastImportIndex) + 
                  `import { logger } from '${importPath}';\n` + 
                  content.slice(lastImportIndex);
      modified = true;
    }
  }

  // console.log 변환
  newContent = newContent.replace(
    /console\.log\s*\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*(.+?))?\s*\)/g,
    (match, message, args) => {
      modified = true;
      const componentName = path.basename(filePath, path.extname(filePath));
      if (args) {
        return `logger.debug('${message}', { component: '${componentName}', data: ${args} })`;
      }
      return `logger.debug('${message}', { component: '${componentName}' })`;
    }
  );

  // console.error 변환
  newContent = newContent.replace(
    /console\.error\s*\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*(.+?))?\s*\)/g,
    (match, message, args) => {
      modified = true;
      const componentName = path.basename(filePath, path.extname(filePath));
      if (args) {
        return `logger.error('${message}', ${args}, { component: '${componentName}' })`;
      }
      return `logger.error('${message}', new Error('${message}'), { component: '${componentName}' })`;
    }
  );

  // console.warn 변환
  newContent = newContent.replace(
    /console\.warn\s*\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*(.+?))?\s*\)/g,
    (match, message, args) => {
      modified = true;
      const componentName = path.basename(filePath, path.extname(filePath));
      if (args) {
        return `logger.warn('${message}', { component: '${componentName}', data: ${args} })`;
      }
      return `logger.warn('${message}', { component: '${componentName}' })`;
    }
  );

  // console.info 변환
  newContent = newContent.replace(
    /console\.info\s*\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*(.+?))?\s*\)/g,
    (match, message, args) => {
      modified = true;
      const componentName = path.basename(filePath, path.extname(filePath));
      if (args) {
        return `logger.info('${message}', { component: '${componentName}', data: ${args} })`;
      }
      return `logger.info('${message}', { component: '${componentName}' })`;
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