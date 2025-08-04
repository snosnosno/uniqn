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

// logger.error 호출 수정
function fixLoggerErrors(content, filePath) {
  let modified = false;
  let newContent = content;

  // logger.error('message', { object }, { component }) 패턴을 올바른 형식으로 수정
  newContent = newContent.replace(
    /logger\.error\s*\(\s*(['"`][^'"`]+['"`])\s*,\s*(\{[^}]+\})\s*,\s*(\{[^}]+component[^}]+\})\s*\)/g,
    (match, message, dataObject, contextObject) => {
      modified = true;
      // context에서 component 추출
      const componentMatch = contextObject.match(/component\s*:\s*['"`]([^'"`]+)['"`]/);
      const component = componentMatch ? componentMatch[1] : 'unknown';
      
      return `logger.error(${message}, new Error(${message}), { component: '${component}', data: ${dataObject} })`;
    }
  );

  // logger.warn과 logger.debug에서 잘못된 패턴 수정
  newContent = newContent.replace(
    /logger\.(warn|debug)\s*\(\s*(['"`][^'"`]+['"`])\s*,\s*\{([^}]+)\}\s*\)/g,
    (match, method, message, objectContent) => {
      // component가 포함되어 있는지 확인
      if (objectContent.includes('component:')) {
        return match; // 이미 올바른 형식
      }
      
      // component가 없으면 추가
      modified = true;
      const componentName = path.basename(filePath, path.extname(filePath));
      return `logger.${method}(${message}, { component: '${componentName}', data: { ${objectContent} } })`;
    }
  );

  return { newContent, modified };
}

// 메인 실행 함수
function main() {
  const srcPath = path.join(__dirname, '../src');
  const files = getAllFiles(srcPath);
  let totalFixed = 0;
  const modifiedFiles = [];

  files.forEach(filePath => {
    const content = fs.readFileSync(filePath, 'utf8');
    const { newContent, modified } = fixLoggerErrors(content, filePath);

    if (modified) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      totalFixed++;
      modifiedFiles.push(filePath);
      console.log(`✅ 수정됨: ${path.relative(srcPath, filePath)}`);
    }
  });

  console.log(`\n📊 총 ${totalFixed}개 파일 수정됨`);
  if (modifiedFiles.length > 0) {
    console.log('\n📝 수정된 파일 목록:');
    modifiedFiles.forEach(file => {
      console.log(`  - ${path.relative(srcPath, file)}`);
    });
  }
}

main();