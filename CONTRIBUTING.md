# 🤝 T-HOLDEM 기여 가이드 (CONTRIBUTING)

**최종 업데이트**: 2025년 9월 10일  
**프로젝트 버전**: v0.1.0 (개발 단계)  
**기여 환영**: 모든 개발자, 디자이너, QA 전문가

---

## 🎯 기여 시작하기

T-HOLDEM 프로젝트에 관심을 가져주셔서 감사합니다! 이 문서는 프로젝트에 기여하는 방법을 안내합니다.

### 💡 기여할 수 있는 분야
- **백엔드 개발**: Firebase Functions, 데이터베이스 최적화
- **프론트엔드 개발**: React/TypeScript UI 개선, 성능 최적화
- **QA & 테스트**: 테스트 케이스 작성, 버그 리포트
- **문서화**: 개발 문서, 사용자 가이드 작성
- **디자인**: UI/UX 개선, 모바일 최적화
- **DevOps**: 배포 자동화, 모니터링 시스템

---

## 🚀 빠른 시작

### 1. 개발 환경 설정

**필수 요구사항**:
```bash
Node.js 18.0.0 이상
npm 9.0.0 이상
Firebase CLI 13.0.0 이상
Git 2.30.0 이상
```

**저장소 클론**:
```bash
git clone https://github.com/your-username/T-HOLDEM.git
cd T-HOLDEM/app2
npm install
```

**Firebase 설정**:
```bash
# Firebase CLI 설치
npm install -g firebase-tools

# Firebase 로그인
firebase login

# 프로젝트 설정
firebase use tholdem-ebc18
```

**환경 변수 설정**:
```bash
# .env 파일 생성
cp .env.example .env
# Firebase 키 정보 입력 필요
```

### 2. 개발 서버 실행

```bash
# 개발 서버 시작
npm start

# Firebase 에뮬레이터와 함께 실행
npm run dev

# 타입 체크 (필수!)
npm run type-check
```

---

## 📋 개발 워크플로우

### 브랜치 전략

```
master (main)     ← 안정 버전 (배포용)
  ↑
develop          ← 개발 통합 브랜치
  ↑
feature/기능명    ← 새 기능 개발
hotfix/버그명     ← 긴급 버그 수정
```

### 작업 프로세스

1. **이슈 확인**: [TODO.md](./TODO.md)에서 작업 선택 또는 새 이슈 생성
2. **브랜치 생성**: `feature/기능명` 또는 `fix/버그명`
3. **개발 진행**: 코딩, 테스트 작성, 문서화
4. **품질 검사**: 린팅, 타입 체크, 테스트 실행
5. **PR 생성**: 코드 리뷰 요청
6. **리뷰 & 머지**: 승인 후 develop 브랜치에 병합

---

## 🔧 개발 규칙

### 필수 준수사항

**코드 스타일**:
```typescript
// ✅ 올바른 사용
const { staffId, eventId } = workLogData;
logger.info('WorkLog 처리', { staffId, eventId });

// ❌ 사용 금지
const { dealerId, jobPostingId } = data; // 레거시 필드
console.log('Debug info', data);         // console 직접 사용
```

**TypeScript 규칙**:
- `any` 타입 사용 최소화 (현재 제거 작업 진행 중)
- strict mode 준수
- 모든 컴포넌트 타입 정의

**데이터 처리**:
- 표준 필드명 사용: `staffId`, `eventId` (레거시 필드 금지)
- UnifiedDataContext 활용
- Firebase 실시간 구독(`onSnapshot`) 사용

### 품질 검사 명령어

```bash
# TypeScript 타입 체크 (필수!)
npm run type-check

# ESLint 검사
npm run lint

# Prettier 포맷 적용
npm run format

# 모든 품질 검사
npm run quality

# 테스트 실행
npm run test

# E2E 테스트
npm run test:e2e
```

---

## 📝 커밋 & PR 가이드

### 커밋 메시지 규칙

**형식**:
```
<타입>: <제목>

<본문> (선택사항)
<이슈 번호> (해당시)
```

**타입 분류**:
- `feat`: 새 기능 추가
- `fix`: 버그 수정
- `refactor`: 코드 리팩토링 (기능 변경 없음)
- `style`: 코드 스타일 변경 (포맷, 세미콜론 등)
- `docs`: 문서 수정
- `test`: 테스트 추가/수정
- `chore`: 빌드 설정, 패키지 매니저 등
- `perf`: 성능 개선

**커밋 예시**:
```bash
feat: 급여 계산 Web Worker 구현

- 백그라운드에서 급여 계산 처리
- 메인 스레드 블로킹 문제 해결
- 계산 시간 5초 → 200ms로 단축

Closes #123
```

### Pull Request 가이드

**PR 제목**: `[타입] 간단한 설명`

**PR 템플릿**:
```markdown
## 📋 변경 사항
- [ ] 새 기능 추가
- [ ] 버그 수정
- [ ] 리팩토링
- [ ] 문서 업데이트

## 🔍 상세 설명
(변경된 내용과 이유를 설명해주세요)

## 🧪 테스트
- [ ] 기존 테스트 통과
- [ ] 새 테스트 추가
- [ ] E2E 테스트 확인

## 📸 스크린샷 (UI 변경 시)
(Before/After 스크린샷 첨부)

## 📋 체크리스트
- [ ] TypeScript 에러 0개 확인
- [ ] 린팅 통과
- [ ] 관련 문서 업데이트
- [ ] 브레이킹 체인지 여부 확인
```

---

## 🐛 버그 리포트

### 이슈 템플릿

```markdown
**🐛 버그 설명**
명확하고 간결한 버그 설명

**🔄 재현 단계**
1. '...' 메뉴 클릭
2. '...' 버튼 선택
3. 오류 발생

**✅ 예상 동작**
어떻게 동작해야 하는지 설명

**❌ 실제 동작**
실제로 어떻게 동작하는지 설명

**📱 환경 정보**
- OS: [Windows 10, macOS 13, etc.]
- 브라우저: [Chrome 91, Safari 14, etc.]
- 버전: [v0.1.0]

**📸 스크린샷**
(가능한 경우 첨부)

**📋 추가 정보**
기타 참고사항
```

---

## 🚀 새 기능 제안

### Feature Request 템플릿

```markdown
**💡 기능 제안**
원하는 기능에 대한 명확한 설명

**🎯 문제 상황**
현재 어떤 문제나 불편함이 있는지 설명

**💭 해결 방안**
어떤 방식으로 해결하고 싶은지 설명

**🔄 대안**
고려해본 다른 해결책이 있다면 설명

**📋 추가 정보**
기타 참고사항, 관련 링크 등
```

---

## 🧪 테스트 가이드

### 테스트 종류

1. **단위 테스트**: 개별 함수/컴포넌트 테스트
2. **통합 테스트**: 컴포넌트 간 상호작용 테스트
3. **E2E 테스트**: 전체 사용자 워크플로우 테스트

### 테스트 작성 규칙

```typescript
// ✅ 테스트 파일명: ComponentName.test.tsx
import { render, screen } from '@testing-library/react';
import { StaffCard } from './StaffCard';

describe('StaffCard', () => {
  it('스태프 이름을 올바르게 표시한다', () => {
    render(<StaffCard name="홍길동" role="dealer" />);
    expect(screen.getByText('홍길동')).toBeInTheDocument();
  });
});
```

### 테스트 실행

```bash
# 전체 테스트
npm run test

# 특정 파일 테스트
npm run test StaffCard.test.tsx

# 커버리지 확인
npm run test:coverage

# E2E 테스트
npm run test:e2e
```

---

## 📚 개발 리소스

### 프로젝트 문서
- [README.md](./README.md) - 프로젝트 개요
- [ROADMAP.md](./ROADMAP.md) - 개발 로드맵
- [TODO.md](./TODO.md) - 개발 작업 목록
- [CLAUDE.md](./CLAUDE.md) - Claude Code 전용 개발 가이드
- [docs/](./docs/) - 상세 기술 문서

### 주요 기술 스택
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Firebase (Firestore, Functions, Auth)
- **State Management**: Context API + Zustand
- **Testing**: Jest, React Testing Library, Playwright
- **Build**: Create React App, Web Workers

### 유용한 링크
- [React 공식 문서](https://react.dev)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs/)
- [Firebase 문서](https://firebase.google.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

## 👥 커뮤니티 & 지원

### 소통 채널
- **GitHub Issues**: 버그 리포트, 기능 제안
- **Discussions**: 일반적인 질문, 아이디어 토론
- **Discord** (준비 중): 실시간 소통

### 도움 요청하기

1. **먼저 확인해보세요**:
   - [문제 해결](./docs/TROUBLESHOOTING.md)
   - 기존 이슈 검색
   - 관련 문서 확인

2. **이슈 생성**:
   - 명확한 제목 작성
   - 재현 가능한 예시 제공
   - 환경 정보 포함

3. **멘토링**:
   - 신규 기여자를 위한 멘토링 프로그램 운영
   - `good-first-issue` 라벨 이슈부터 시작

---

## 🎯 기여 레벨별 가이드

### 🌱 초급 (First-time Contributors)
**추천 작업**:
- 문서 오타 수정
- 단순 UI 개선
- 테스트 케이스 추가
- `good-first-issue` 라벨 이슈

**시작하기**:
1. 간단한 이슈 선택
2. 로컬 환경 설정
3. 작은 변경사항으로 시작
4. 코드 리뷰 과정 경험

### 🌿 중급 (Regular Contributors)
**추천 작업**:
- 새 컴포넌트 개발
- 기존 기능 개선
- 성능 최적화
- 버그 수정

**발전 방향**:
1. 코드 품질 향상
2. 아키텍처 이해도 높이기
3. 테스트 커버리지 개선
4. 코드 리뷰 참여

### 🌳 고급 (Core Contributors)
**추천 작업**:
- 핵심 기능 설계
- 아키텍처 개선
- 성능 최적화
- 코드 리뷰 리드

**책임**:
1. 프로젝트 방향성 논의
2. 신규 기여자 멘토링
3. 릴리즈 관리 참여
4. 기술 결정 참여

---

## 🏆 기여 인정

### 기여자 인정 시스템
- **README.md**에 기여자 목록 관리
- 분기별 **Outstanding Contributor** 선정
- **릴리즈 노트**에 주요 기여자 언급

### 기여 유형별 인정
- 💻 **Code**: 코드 기여
- 📖 **Documentation**: 문서 작성
- 🐛 **Bug Reports**: 버그 리포트
- 💡 **Ideas**: 아이디어 제안
- 🎨 **Design**: 디자인 기여
- 🧪 **Tests**: 테스트 작성

---

## ⚖️ 행동 강령

### 우리의 약속
T-HOLDEM 프로젝트는 모든 참여자에게 괴롭힘 없는 경험을 제공합니다.

### 기대 행동
- 다른 관점과 경험에 대한 존중
- 건설적인 비판의 우아한 수용
- 커뮤니티에 가장 좋은 것에 집중
- 다른 커뮤니티 멤버에 대한 공감

### 금지 행동
- 성적 언어나 이미지 사용
- 트롤링, 모욕적/경멸적 댓글
- 공적 또는 사적 괴롭힘
- 명시적 허가 없는 개인 정보 공개

---

## 🔒 보안 & 라이선스

### 보안 취약점 신고
보안 문제를 발견한 경우:
1. **공개적으로 이슈를 생성하지 마세요**
2. 프로젝트 관리자에게 직접 연락
3. 상세한 취약점 정보 제공
4. 수정될 때까지 공개 보류

### 라이선스
이 프로젝트는 MIT 라이선스를 따릅니다. 기여함으로써 당신의 기여도 같은 라이선스 하에 있음에 동의합니다.

---

## 📞 연락처 & 지원

- **프로젝트 메인테이너**: GitHub Issues 활용
- **기술 문의**: Discussions 탭 활용
- **보안 문제**: 개인 메시지로 연락
- **일반 문의**: GitHub Issues 활용

---

**🙏 T-HOLDEM 프로젝트에 기여해주셔서 감사합니다!**

*모든 기여는 소중하며, 여러분의 참여가 더 나은 소프트웨어를 만듭니다.*

---

*마지막 업데이트: 2025년 9월 10일*  
*문서 버전: v1.0*