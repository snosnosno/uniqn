# 롤백 절차 가이드

최종 업데이트: 2026-03-30  
기준 코드: `uniqn-mobile/`, `functions/`, `firebase.json`

이 문서는 현재 배포 경로 기준 롤백 절차만 다룹니다.

## 우선순위

1. 웹 export 재배포
2. Firebase Functions 재배포
3. Firestore Rules 복원
4. 데이터 복구

## 웹 롤백

현재 웹은 `npm run build:web` + `npm run deploy:cloudflare` 경로를 사용합니다.

```bash
cd uniqn-mobile
npm run deploy:cloudflare
```

이전 정상 커밋으로 되돌린 뒤 다시 배포하는 것이 가장 안전합니다.

## Functions 롤백

### 전체 재배포

```bash
git checkout <stable-commit>
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

### 특정 함수만 롤백

```bash
firebase deploy --only functions:FUNCTION_NAME
```

## Firestore Rules 롤백

```bash
git checkout <stable-commit> -- firestore.rules
firebase deploy --only firestore:rules
```

필요 시 인덱스도 같은 방식으로 복원합니다.

## 로그 확인

```bash
firebase functions:log
```

추가로 Sentry와 앱 관리자 통계를 함께 확인합니다.

## 긴급 체크리스트

- 문제 범위 확인
- 사용자 영향 판단
- 웹 / Functions / Rules 중 어디를 먼저 되돌릴지 결정
- 롤백 후 로그인, 공고 조회, 관리자 주요 화면 재확인
- 인시던트 기록 남기기
