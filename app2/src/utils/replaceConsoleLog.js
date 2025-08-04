const fs = require('fs');
const path = require('path');

// console.log를 logger로 교체하는 함수
function replaceConsoleLog(content, fileName) {
  let modified = content;
  let hasImport = content.includes("import { logger }") || content.includes("from '../utils/logger'") || content.includes('from "./utils/logger"');
  
  // console.log 패턴들
  const patterns = [
    // console.log('message')
    { 
      regex: /console\.log\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      replacement: (match, message) => `logger.debug(`${message}`, { component: '${getComponentName(fileName)}' })`
    },
    // console.log('message', data)
    { 
      regex: /console\.log\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(.+?)\s*\)/g,
      replacement: (match, message, data) => `logger.debug(`${message}`, { component: '${getComponentName(fileName)}', data: ${data} })`
    },
    // console.error('message')
    { 
      regex: /console\.error\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      replacement: (match, message) => `logger.error(`${message}`, new Error('${message}'), { component: '${getComponentName(fileName)}' })`
    },
    // console.error('message', error)
    { 
      regex: /console\.error\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(.+?)\s*\)/g,
      replacement: (match, message, error) => `logger.error(`${message}`, ${error} instanceof Error ? ${error} : new Error(String(${error})), { component: '${getComponentName(fileName)}' })`
    },
    // console.warn('message')
    { 
      regex: /console\.warn\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      replacement: (match, message) => `logger.warn(`${message}`, { component: '${getComponentName(fileName)}' })`
    }
  ];

  let wasModified = false;
  patterns.forEach(({ regex, replacement }) => {
    if (regex.test(modified)) {
      wasModified = true;
      modified = modified.replace(regex, replacement);
    }
  });

  // logger import 추가
  if (wasModified && !hasImport) {
    // TypeScript/TSX 파일인지 확인
    const isTypeScript = fileName.endsWith('.ts') || fileName.endsWith('.tsx');
    
    // import 문 찾기
    const importMatch = modified.match(/import[\s\S]*?from\s+['"`][^'"`]+['"`];?\s*\n/);
    if (importMatch) {
      const lastImportIndex = modified.lastIndexOf(importMatch[0]) + importMatch[0].length;
      const relativePathToLogger = getRelativePathToLogger(fileName);
      modified = modified.slice(0, lastImportIndex) + 
                `import { logger } from '${relativePathToLogger}';\n` + 
                modified.slice(lastImportIndex);
    }
  }

  return modified;
}

function getComponentName(filePath) {
  const fileName = path.basename(filePath, path.extname(filePath));
  return fileName;
}

function getRelativePathToLogger(filePath) {
  const dir = path.dirname(filePath);
  const depth = dir.split(path.sep).filter(d => d !== 'src' && d !== '').length;
  
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
      // logger.ts 자체는 제외
      if (!filePath.includes('logger.ts') && !filePath.includes('replaceConsoleLog.js')) {
        processFile(filePath);
      }
    }
  });
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const modified = replaceConsoleLog(content, filePath);
    
    if (content !== modified) {
      fs.writeFileSync(filePath, modified, 'utf8');
      console.log(`✅ Updated: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

// 실행
const srcPath = path.join(__dirname, '..');
console.log('🔄 Starting console.log replacement...');
console.log(`📁 Processing directory: ${srcPath}`);
processDirectory(srcPath);
console.log('✨ Replacement complete!');