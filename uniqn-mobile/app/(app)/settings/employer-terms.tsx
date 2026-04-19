/**
 * UNIQN Mobile - Employer Terms of Service Screen
 * 구인자 이용약관 화면
 * 본문: src/constants/legal/employerTerms.ts (단일 소스)
 */

import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { EMPLOYER_TERMS } from '@/constants/legal';

export default function EmployerTermsScreen() {
  return <LegalDocumentView document={EMPLOYER_TERMS} headerTitle="구인자 이용약관" />;
}
