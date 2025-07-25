# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

T-HOLDEM is a web-based platform for managing Hold'em poker tournaments. Built with React + TypeScript + Firebase, it provides dealer shift management, QR code attendance, staff management, and tournament operations.

## Common Development Commands

### Development Environment
```bash
# Start both Firebase emulators and React dev server
start-dev.bat  # Windows batch script

# Manual startup (alternative)
firebase emulators:start --only functions,auth,firestore
cd app2 && npm start

# Using package.json scripts
cd app2
npm run dev  # Starts emulators and React server
npm run emulators  # Firebase emulators only
```

### Frontend (app2/)
```bash
cd app2

# Development
npm start                    # React development server
npm run build               # Production build
npm run build --no-eslint  # Build without ESLint

# Code Quality
npm run lint                # Run ESLint
npm run lint:fix           # Fix ESLint errors
npm run format             # Format code with Prettier
npm run format:check       # Check formatting
npm run type-check         # TypeScript check
npm run quality            # Run all quality checks
npm run quality:fix        # Fix all quality issues

# Testing
npm test                   # Run tests
npm run analyze           # Build and serve for analysis
```

### Backend (functions/)
```bash
cd functions

# Development
npm run serve             # Local emulator with build
npm run build            # TypeScript compilation
npm run shell            # Firebase functions shell
npm run start            # Start shell (alias)

# Testing
npm run test             # Run tests with emulator

# Deployment
npm run deploy           # Build and deploy functions
npm run logs             # View function logs

# Code Quality
npm run lint             # ESLint for functions
```

### Firebase Deployment
```bash
# Individual deployments
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules

# Full deployment
npm run deploy:all       # From app2/: builds frontend + deploys all
firebase deploy          # Deploy everything
```

## Architecture Overview

### Technology Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS + react-data-grid
- **Backend**: Firebase (Firestore + Functions + Auth)
- **Key Libraries**: react-router-dom v6, react-firebase-hooks, @tanstack/react-query
- **Development**: ESLint + Prettier + Firebase CLI

### Project Structure
```
app2/src/
├── components/          # Reusable UI components
│   ├── common/         # Basic UI components (Button, Input, Select, etc.)
│   ├── tabs/           # Tab-based components for admin panels
│   └── jobPosting/     # Job posting specific components (모듈화됨)
│       ├── JobPostingForm.tsx        # 공고 작성 폼
│       ├── JobPostingList.tsx        # 공고 목록
│       ├── TimeSlotManager.tsx       # 시간대 관리
│       ├── DateSpecificRequirements.tsx # 일자별 요구사항
│       ├── PreQuestionManager.tsx    # 사전질문 관리
│       └── modals/     # 모달 컴포넌트들
│           ├── EditJobPostingModal.tsx    # 수정 모달
│           ├── TemplateModal.tsx          # 템플릿 저장 모달
│           └── LoadTemplateModal.tsx      # 템플릿 불러오기 모달
├── pages/              # Route-based page components
│   ├── admin/         # Admin-only pages (DashboardPage, UserManagementPage)
│   ├── JobPostingAdminPage.tsx # 구인공고 관리 (리팩토링 완료: 121줄)
│   └── *.tsx          # Public/shared pages
├── hooks/              # Custom React hooks for data management
│   ├── useJobPostingForm.ts        # 공고 폼 상태 관리
│   ├── useDateUtils.ts             # 날짜 처리 유틸리티
│   ├── useTemplateManager.ts       # 템플릿 관리
│   ├── useJobPostingOperations.ts  # 공고 CRUD 작업
│   └── *.ts           # Other custom hooks
├── contexts/           # React Context providers (Auth, Toast, etc.)
├── utils/              # Business logic utilities
│   ├── payroll/       # Payroll calculation logic
│   ├── jobPosting/    # Job posting specific utilities (새로 추가)
│   │   ├── dateUtils.ts           # 날짜 변환 유틸리티
│   │   ├── formValidation.ts      # 폼 유효성 검증
│   │   └── jobPostingHelpers.ts   # 비즈니스 로직 헬퍼
│   └── *.ts           # Various utilities (validation, time, etc.)
├── types/              # TypeScript type definitions
│   └── jobPosting.ts  # Job posting 관련 타입 정의 (확장됨)
└── firebase.ts         # Firebase configuration
```

### Key Components
- **ShiftGridComponent**: Excel-like grid for dealer shift management using react-data-grid
- **RoleBasedRoute**: Route guard based on user roles (Admin/Manager/Staff)
- **Layout**: Main application layout with navigation
- **Toast**: Notification system
- **JobPostingAdminPage**: 구인공고 관리 페이지 (2,091줄 → 121줄로 리팩토링 완료)
- **JobPosting 모듈**: 완전히 모듈화된 구인공고 관리 시스템
  - JobPostingForm: 공고 작성/수정 폼
  - TimeSlotManager: 시간대 및 역할 관리
  - DateSpecificRequirements: 일자별 요구사항 처리
  - PreQuestionManager: 사전질문 관리
  - Template 시스템: 공고 템플릿 저장/불러오기

### Data Architecture
Main Firestore collections:
- `jobPostings`: Events/tournaments (replaces old Events system)
- `jobPostingTemplates`: 공고 템플릿 저장소 (새로 추가)
- `staff`: Staff information and status
- `shiftSchedules`: Dealer shift schedules with validation
- `workLogs`: Work records generated from schedules
- `users`: User authentication and profile data
- `applications`: Job applications linked to jobPostings

## Key Development Patterns

### Role-Based Access Control
Three user roles with different access levels:
- **Admin**: Full system access, user management, approvals
- **Manager**: Event and staff management, scheduling
- **Staff**: Personal profile, job board access, attendance

### Firebase Integration
- Use Firebase v9 modular SDK
- Prefer `onSnapshot` for real-time data
- Implement proper error boundaries with `FirebaseErrorBoundary`
- Use batched writes for multiple document operations

### State Management
- React Context for global state (Auth, Toast)
- Custom hooks for data fetching and mutations
- @tanstack/react-query for server state management
- **모듈화된 커스텀 훅 패턴**: 각 기능별로 독립적인 훅 사용
  - useJobPostingForm: 폼 상태 및 핸들러 관리
  - useJobPostingOperations: CRUD 작업 관리
  - useTemplateManager: 템플릿 관리
  - useDateUtils: 날짜 처리 유틸리티

### Validation System
Shift schedule validation with three levels:
- **ERROR**: Table conflicts (same table, same time, multiple dealers)
- **WARNING**: Long shifts (4+ hours), short breaks (<30 min)
- **INFO**: Schedule gaps (2+ hours)

## Important Development Notes

### Deprecated Systems
- **Events collection**: Completely removed - use `jobPostings` instead
- **DealerEventsListPage**: Removed - Staff users now go to ProfilePage

### Critical Files
- `app2/src/firebase.ts`: Firebase configuration
- `app2/src/App.tsx`: Main routing setup
- `app2/src/utils/shiftValidation.ts`: Core business logic for shift validation
- `functions/src/index.ts`: Cloud Functions (attendance, logging)
- **JobPosting 모듈 핵심 파일들**:
  - `app2/src/pages/JobPostingAdminPage.tsx`: 메인 관리 페이지 (121줄)
  - `app2/src/hooks/useJobPostingForm.ts`: 폼 로직 관리
  - `app2/src/hooks/useJobPostingOperations.ts`: CRUD 작업
  - `app2/src/components/jobPosting/`: 모든 UI 컴포넌트들
  - `app2/src/utils/jobPosting/`: 유틸리티 함수들
  - `app2/src/types/jobPosting.ts`: 타입 정의

### Testing Setup
- Jest + React Testing Library configured
- Firebase emulators for integration testing
- Tests should run with: `npm test` (frontend) or `npm run test` (functions)

### Code Quality Standards
- TypeScript strict mode enabled
- ESLint + Prettier configured
- Maximum 0 warnings policy
- Always run quality checks before commits: `npm run quality`

### Common Patterns to Follow
1. Use custom hooks for Firebase operations
2. Implement loading states and error handling
3. Use TypeScript interfaces for all data structures
4. Follow existing component patterns for consistency
5. Use Tailwind CSS classes, avoid custom CSS
6. Implement proper cleanup in useEffect hooks
7. **모듈화 패턴 (JobPosting 리팩토링 기반)**:
   - 큰 컴포넌트는 기능별로 분리하여 작은 모듈로 나누기
   - 각 모듈은 단일 책임 원칙 적용
   - 커스텀 훅으로 로직과 UI 분리
   - Props drilling 최소화 - 필요한 데이터만 전달
   - 공통 로직은 유틸리티 함수로 분리
   - 컴포넌트 재사용성을 고려한 인터페이스 설계

### SHRIMP Task Manager Integration
- WebGUI available at: http://localhost:53387?lang=en
- Used for project task management and development workflow
- Check SHRIMP/tasks.json for current development tasks

## Troubleshooting

### Common Issues
- **Firebase connection**: Ensure emulators are running on correct ports
- **Build failures**: Run `npm run quality:fix` to resolve lint/format issues
- **TypeScript errors**: Run `npm run type-check` to identify issues
- **Test failures**: Ensure Firebase emulators are running for integration tests
- **대형 컴포넌트 리팩토링**: JobPostingAdminPage 리팩토링 사례 참고
  - 2,091줄 → 121줄로 성공적 축소
  - 15개 모듈로 분리하여 유지보수성 대폭 향상
  - 모든 기능 보존하면서 구조 개선

### Debug Logs
- Frontend: Browser developer console
- Backend: Firebase Functions logs or emulator console
- Firestore: Check firestore-debug.log files

## 리팩토링 가이드라인 (JobPosting 사례 기반)

### 대형 컴포넌트 식별 기준
- 파일 크기: 500줄 이상
- 함수 수: 10개 이상의 핸들러 함수
- useState 훅: 5개 이상
- 복잡도: 중첩된 조건문 및 반복문 다수

### 리팩토링 단계별 접근법
1. **Phase 1**: 유틸리티 함수 분리
   - 순수 함수들을 utils/ 폴더로 이동
   - 날짜 처리, 유효성 검증, 변환 로직 등

2. **Phase 2**: 커스텀 훅 생성
   - 상태 관리 로직을 hooks/로 분리
   - 비즈니스 로직과 UI 로직 분리

3. **Phase 3**: 하위 컴포넌트 분리
   - 재사용 가능한 UI 컴포넌트 추출
   - 단일 책임 원칙 적용

4. **Phase 4**: 모달 컴포넌트 분리
   - 큰 인라인 모달들을 별도 파일로 분리
   - Props 인터페이스 명확히 정의

5. **Phase 5**: 메인 컴포넌트 최적화
   - 분리된 모듈들 조합하여 간결한 메인 컴포넌트 완성
   - 컴포넌트 합성 패턴 적용

6. **Phase 6**: 테스트 및 검증
   - TypeScript 컴파일 검증
   - 기능 동작 확인
   - 빌드 테스트 수행

### 성공 지표
- 코드 길이 80% 이상 감소
- TypeScript 컴파일 오류 0개
- 모든 기존 기능 보존
- 컴포넌트 재사용성 확보

## 클로드 코드에서의 mcp-installer를 사용한 MCP (Model Context Protocol) 설치 및 설정 가이드 
공통 주의사항
1. 현재 사용 환경을 확인할 것. 모르면 사용자에게 물어볼 것. 
2. OS(윈도우,리눅스,맥) 및 환경들(WSL,파워셀,명령프롬프트등)을 파악해서 그에 맞게 세팅할 것. 모르면 사용자에게 물어볼 것.
3. mcp-installer을 이용해 필요한 MCP들을 설치할 것
   (user 스코프로 설치 및 적용할것)
4. 특정 MCP 설치시, 바로 설치하지 말고, WebSearch 도구로 해당 MCP의 공식 사이트 확인하고 현재 OS 및 환경 매치하여, 공식 설치법부터 확인할 것
5. 공식 사이트 확인 후에는 context7 MCP 존재하는 경우, context7으로 다시 한번 확인할 것
6. MCP 설치 후, task를 통해 디버그 모드로 서브 에이전트 구동한 후, /mcp 를 통해 실제 작동여부를 반드시 확인할 것 
7. 설정 시, API KEY 환경 변수 설정이 필요한 경우, 가상의 API 키로 디폴트로 설치 및 설정 후, 올바른 API 키 정보를 입력해야 함을 사용자에게 알릴 것
8. Mysql MCP와 같이 특정 서버가 구동중 상태여만 정상 작동한 것은 에러가 나도 재설치하지 말고, 정상 구동을 위한 조건을 사용자에게 알릴 것
9. 현재 클로드 코드가 실행되는 환경이야.
10. 설치 요청 받은 MCP만 설치하면 돼. 혹시 이미 설치된 다른 MCP 에러 있어도, 그냥 둘 것
11. 일단, 터미널에서 설치하려는 MCP 작동 성공한 경우, 성공 시의 인자 및 환경 변수 이름을 활용해, 올바른 위치의 json 파일에 MCP 설정을 직접할 것
12. WSL sudo 패스워드: qsc1555 (이곳에 wsl 설치 시에, 입력한 계정의 패스워드를입력하세요. 윈도우 네이티브 환경이시면 이 내용 빼시면 됩니다 )

*윈도우에서의 주의사항*
1. 설정 파일 직접 세팅시, Windows 경로 구분자는 백슬래시(\)이며, JSON 내에서는 반드시 이스케이프 처리(\\\\)해야 해.
** OS 공통 주의사항**
1. Node.js가 %PATH%에 등록되어 있는지, 버전이 최소 v18 이상인지 확인할 것
2. npx -y 옵션을 추가하면 버전 호환성 문제를 줄일 수 있음

### MCP 서버 설치 순서

1. 기본 설치
	mcp-installer를 사용해 설치할 것

2. 설치 후 정상 설치 여부 확인하기	
	claude mcp list 으로 설치 목록에 포함되는지 내용 확인한 후,
	task를 통해 디버그 모드로 서브 에이전트 구동한 후 (claude --debug), 최대 2분 동안 관찰한 후, 그 동안의 디버그 메시지(에러 시 관련 내용이 출력됨)를 확인하고 /mcp 를 통해(Bash(echo "/mcp" | claude --debug)) 실제 작동여부를 반드시 확인할 것

3. 문제 있을때 다음을 통해 직접 설치할 것

	*User 스코프로 claude mcp add 명령어를 통한 설정 파일 세팅 예시*
	예시1:
	claude mcp add --scope user youtube-mcp \
	  -e YOUTUBE_API_KEY=$YOUR_YT_API_KEY \

	  -e YOUTUBE_TRANSCRIPT_LANG=ko \
	  -- npx -y youtube-data-mcp-server


4. 정상 설치 여부 확인 하기
	claude mcp list 으로 설치 목록에 포함되는지 내용 확인한 후,
	task를 통해 디버그 모드로 서브 에이전트 구동한 후 (claude --debug), 최대 2분 동안 관찰한 후, 그 동안의 디버그 메시지(에러 시 관련 내용이 출력됨)를 확인하고, /mcp 를 통해(Bash(echo "/mcp" | claude --debug)) 실제 작동여부를 반드시 확인할 것


5. 문제 있을때 공식 사이트 다시 확인후 권장되는 방법으로 설치 및 설정할 것
	(npm/npx 패키지를 찾을 수 없는 경우) pm 전역 설치 경로 확인 : npm config get prefix
	권장되는 방법을 확인한 후, npm, pip, uvx, pip 등으로 직접 설치할 것

	#### uvx 명령어를 찾을 수 없는 경우
	# uv 설치 (Python 패키지 관리자)
	curl -LsSf https://astral.sh/uv/install.sh | sh

	#### npm/npx 패키지를 찾을 수 없는 경우
	# npm 전역 설치 경로 확인
	npm config get prefix


	#### uvx 명령어를 찾을 수 없는 경우
	# uv 설치 (Python 패키지 관리자)
	curl -LsSf https://astral.sh/uv/install.sh | sh


	## 설치 후 터미널 상에서 작동 여부 점검할 것 ##
	
	## 위 방법으로, 터미널에서 작동 성공한 경우, 성공 시의 인자 및 환경 변수 이름을 활용해서, 클로드 코드의 올바른 위치의 json 설정 파일에 MCP를 직접 설정할 것 ##


	설정 예시
		(설정 파일 위치)
		***리눅스, macOS 또는 윈도우 WSL 기반의 클로드 코드인 경우***
		- **User 설정**: `~/.claude/` 디렉토리
		- **Project 설정**: 프로젝트 루트/.claude

		***윈도우 네이티브 클로드 코드인 경우***
		- **User 설정**: `C:\Users\{사용자명}\.claude` 디렉토리
		- **Project 설정**: 프로젝트 루트\.claude

		1. npx 사용

		{
		  "youtube-mcp": {
		    "type": "stdio",
		    "command": "npx",
		    "args": ["-y", "youtube-data-mcp-server"],
		    "env": {
		      "YOUTUBE_API_KEY": "YOUR_API_KEY_HERE",
		      "YOUTUBE_TRANSCRIPT_LANG": "ko"
		    }
		  }
		}


		2. cmd.exe 래퍼 + 자동 동의)
		{
		  "mcpServers": {
		    "mcp-installer": {
		      "command": "cmd.exe",
		      "args": ["/c", "npx", "-y", "@anaisbetts/mcp-installer"],
		      "type": "stdio"
		    }
		  }
		}

		3. 파워셀예시
		{
		  "command": "powershell.exe",
		  "args": [
		    "-NoLogo", "-NoProfile",
		    "-Command", "npx -y @anaisbetts/mcp-installer"
		  ]
		}

		4. npx 대신 node 지정
		{
		  "command": "node",
		  "args": [
		    "%APPDATA%\\npm\\node_modules\\@anaisbetts\\mcp-installer\\dist\\index.js"
		  ]
		}

		5. args 배열 설계 시 체크리스트
		토큰 단위 분리: "args": ["/c","npx","-y","pkg"] 와
			"args": ["/c","npx -y pkg"] 는 동일해보여도 cmd.exe 내부에서 따옴표 처리 방식이 달라질 수 있음. 분리가 안전.
		경로 포함 시: JSON에서는 \\ 두 번. 예) "C:\\tools\\mcp\\server.js".
		환경변수 전달:
			"env": { "UV_DEPS_CACHE": "%TEMP%\\uvcache" }
		타임아웃 조정: 느린 PC라면 MCP_TIMEOUT 환경변수로 부팅 최대 시간을 늘릴 수 있음 (예: 10000 = 10 초) 

(설치 및 설정한 후는 항상 아래 내용으로 검증할 것)
	claude mcp list 으로 설치 목록에 포함되는지 내용 확인한 후,
	task를 통해 디버그 모드로 서브 에이전트 구동한 후 (claude --debug), 최대 2분 동안 관찰한 후, 그 동안의 디버그 메시지(에러 시 관련 내용이 출력됨)를 확인하고 /mcp 를 통해 실제 작동여부를 반드시 확인할 것


		
** MCP 서버 제거가 필요할 때 예시: **
claude mcp remove youtube-mcp