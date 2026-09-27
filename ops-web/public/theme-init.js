// 첫 페인트 전에 저장된 테마를 적용한다 — 라이트 사용자가 다크 화면을 먼저 보는 깜빡임 방지.
// 인라인이 아니라 같은 출처 파일이라 CSP script-src 'self' 와 충돌하지 않는다.
// 키·값 규칙은 src/lib/theme.ts 와 같아야 한다(STORAGE_KEY = 'ops-web:theme', 기본 다크).
try {
  if (localStorage.getItem('ops-web:theme') === 'light') {
    document.documentElement.dataset.theme = 'light';
  }
} catch {
  // 저장소 접근 불가(사생활 보호 모드 등) — 기본 다크 유지
}
