#!/usr/bin/env node

/**
 * React Icons 마이그레이션 자동화 스크립트
 * react-icons에서 커스텀 SVG 아이콘으로 자동 변환
 */

const fs = require('fs');
const path = require('path');

// 아이콘 매핑 테이블
const iconMapping = {
  // Font Awesome 아이콘
  'FaClock': 'ClockIcon',
  'FaTimes': 'TimesIcon',
  'FaUsers': 'UsersIcon',
  'FaCalendarAlt': 'CalendarIcon',
  'FaCalendarCheck': 'CalendarIcon',
  'FaCalendar': 'CalendarIcon',
  'FaCheckCircle': 'CheckCircleIcon',
  'FaExclamationTriangle': 'ExclamationTriangleIcon',
  'FaInfoCircle': 'InfoCircleIcon',
  'FaInfo': 'InfoCircleIcon',
  'FaSave': 'SaveIcon',
  'FaTable': 'TableIcon',
  'FaPlus': 'PlusIcon',
  'FaCog': 'CogIcon',
  'FaGoogle': 'GoogleIcon',
  'FaChevronUp': 'ChevronUpIcon',
  'FaChevronDown': 'ChevronDownIcon',
  'FaUser': 'UserIcon',
  'FaUserCircle': 'UserIcon',
  'FaPhone': 'PhoneIcon',
  'FaEnvelope': 'MailIcon',
  'FaHistory': 'HistoryIcon',
  'FaTrophy': 'TrophyIcon',
  'FaEdit': 'EditIcon',
  'FaTrash': 'TrashIcon',
  'FaFilter': 'FilterIcon',
  'FaSearch': 'SearchIcon',
  'FaEye': 'EyeIcon',
  'FaEyeSlash': 'EyeSlashIcon',
  'FaEllipsisV': 'EllipsisVIcon',
  'FaStar': 'StarIcon',
  'FaBriefcase': 'BriefcaseIcon',
  'FaIdCard': 'IdCardIcon',
  'FaGlobe': 'GlobeIcon',
  'FaMapMarkerAlt': 'MapMarkerIcon',
  'FaWallet': 'WalletIcon',
  'FaUniversity': 'UniversityIcon',
  'FaCreditCard': 'CreditCardIcon',
  'FaVenusMars': 'GenderIcon',
  'FaBirthdayCake': 'BirthdayIcon',
  'FaFileExport': 'FileExportIcon',
  'FaMoneyBillWave': 'MoneyIcon',
  'FaThList': 'ListIcon',
  'FaUserPlus': 'UserPlusIcon',
  'FaMugHot': 'CoffeeIcon',
  'FaCoffee': 'CoffeeIcon',
  'FaUserClock': 'UserClockIcon',
};

// 파일 처리 함수
function processFile(filePath) {
  console.log(`처리 중: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // react-icons import 찾기
  const importRegex = /import\s*{([^}]+)}\s*from\s*['"]react-icons\/[^'"]+['"]/g;
  const imports = [];
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    const icons = match[1].split(',').map(icon => icon.trim());
    imports.push(...icons);
  }
  
  if (imports.length === 0) {
    console.log(`  → react-icons import 없음`);
    return;
  }
  
  console.log(`  → 발견된 아이콘: ${imports.join(', ')}`);
  
  // 커스텀 아이콘으로 변환 가능한지 확인
  const customIcons = [];
  const remainingIcons = [];
  
  imports.forEach(icon => {
    if (iconMapping[icon]) {
      customIcons.push(iconMapping[icon]);
    } else {
      remainingIcons.push(icon);
    }
  });
  
  if (customIcons.length === 0) {
    console.log(`  → 변환 가능한 아이콘 없음`);
    return;
  }
  
  // import 문 교체
  content = content.replace(importRegex, (match) => {
    modified = true;
    return ''; // 기존 import 제거
  });
  
  // 커스텀 아이콘 import 추가
  const customImportLine = `import { ${customIcons.join(', ')} } from './Icons';`;
  
  // 남은 react-icons import 추가 (필요한 경우)
  let remainingImportLine = '';
  if (remainingIcons.length > 0) {
    remainingImportLine = `\nimport { ${remainingIcons.join(', ')} } from 'react-icons/fa';`;
  }
  
  // 파일 맨 위의 import 문 뒤에 추가
  const firstImportIndex = content.indexOf('import');
  const firstNewlineAfterImports = content.indexOf('\n\n', firstImportIndex);
  
  if (firstNewlineAfterImports !== -1) {
    content = content.slice(0, firstNewlineAfterImports) + 
              '\n' + customImportLine + remainingImportLine +
              content.slice(firstNewlineAfterImports);
  }
  
  // JSX에서 아이콘 이름 교체
  imports.forEach(oldIcon => {
    if (iconMapping[oldIcon]) {
      const newIcon = iconMapping[oldIcon];
      // <FaClock → <ClockIcon 패턴으로 교체
      const jsxRegex = new RegExp(`<${oldIcon}([\\s/>])`, 'g');
      content = content.replace(jsxRegex, `<${newIcon}$1`);
      
      // </FaClock> → </ClockIcon> 패턴으로 교체
      const closeTagRegex = new RegExp(`</${oldIcon}>`, 'g');
      content = content.replace(closeTagRegex, `</${newIcon}>`);
      
      console.log(`  → ${oldIcon} → ${newIcon}`);
      modified = true;
    }
  });
  
  // 파일 저장
  if (modified) {
    // 백업 생성
    const backupPath = filePath + '.backup';
    fs.copyFileSync(filePath, backupPath);
    
    // 수정된 내용 저장
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ 마이그레이션 완료 (백업: ${backupPath})`);
  }
}

// 디렉토리 재귀 탐색
function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // node_modules 제외
      if (file !== 'node_modules' && file !== '.git') {
        processDirectory(fullPath);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
      processFile(fullPath);
    }
  });
}

// 메인 실행
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('사용법: node react-icons-migration.js <파일 또는 디렉토리 경로>');
    console.log('예시: node react-icons-migration.js src/components');
    process.exit(1);
  }
  
  args.forEach(arg => {
    const fullPath = path.resolve(arg);
    
    if (!fs.existsSync(fullPath)) {
      console.error(`경로를 찾을 수 없습니다: ${fullPath}`);
      return;
    }
    
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      console.log(`디렉토리 처리 중: ${fullPath}`);
      processDirectory(fullPath);
    } else if (stat.isFile()) {
      processFile(fullPath);
    }
  });
  
  console.log('\n✨ 마이그레이션 완료!');
  console.log('주의: 일부 아이콘은 수동으로 추가해야 할 수 있습니다.');
  console.log('Icons/index.tsx 파일에 누락된 아이콘을 추가하세요.');
}

// 스크립트 실행
main();