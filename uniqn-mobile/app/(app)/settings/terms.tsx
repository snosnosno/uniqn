/**
 * UNIQN Mobile - Terms of Service Screen
 * 이용약관 화면
 * 본문: src/constants/legal/termsOfService.ts (단일 소스)
 */

import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { TERMS_OF_SERVICE } from '@/constants/legal';

export default function TermsScreen() {
  return <LegalDocumentView document={TERMS_OF_SERVICE} headerTitle="이용약관" />;
}
