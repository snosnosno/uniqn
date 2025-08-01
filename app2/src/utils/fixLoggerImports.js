const fs = require('fs');
const path = require('path');

// 잘못된 import 경로를 올바른 경로로 수정하는 함수
function fixLoggerImports(content, filePath) {
  // 다양한 잘못된 패턴들을 찾아서 수정
  const wrongPatterns = [
    /import { logger } from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/utils\/logger';/g,
    /import { logger } from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/utils\/logger';/g,
    /import { logger } from '\.+\/utils\/logger';/g // 너무 많은 ../ 가 있는 모든 경우
  ];
  
  let fixed = content;
  let hasWrongImport = false;
  
  wrongPatterns.forEach(pattern => {
    if (pattern.test(fixed)) {
      hasWrongImport = true;
    }
  });
  
  if (!hasWrongImport) {
    return content;
  }
  
  // 파일 경로에서 상대 경로 계산
  const relativePath = getRelativePathToLogger(filePath);
  const correctImport = `import { logger } from '${relativePath}';`;
  
  wrongPatterns.forEach(pattern => {
    fixed = fixed.replace(pattern, correctImport);
  });
  
  return fixed;
}

function getRelativePathToLogger(filePath) {
  const dir = path.dirname(filePath);
  const fromSrc = path.relative(dir, path.join(__dirname, '..'));
  const depth = fromSrc.split(path.sep).filter(d => d === '..').length;
  
  if (depth === 0) {
    return './utils/logger';
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
      // node_modules, build 등 제외
      if (!['node_modules', 'build', 'dist', '.git'].includes(file)) {
        processDirectory(filePath);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      processFile(filePath);
    }
  });
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fixed = fixLoggerImports(content, filePath);
    
    if (content !== fixed) {
      fs.writeFileSync(filePath, fixed, 'utf8');
      console.log(`✅ Fixed import in: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

// 실행
const srcPath = path.join(__dirname, '..');
console.log('🔄 Fixing logger imports...');
console.log(`📁 Processing directory: ${srcPath}`);
processDirectory(srcPath);
console.log('✨ Import fix complete!');