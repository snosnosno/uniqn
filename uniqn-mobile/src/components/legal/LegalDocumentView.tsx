/**
 * UNIQN Mobile - Legal Document View
 *
 * 약관/정책 문서를 동일한 시각 위계로 렌더링하는 공용 컴포넌트.
 * settings/{terms,privacy,employer-terms,liability-waiver}에서 사용.
 */

import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackHeader } from '@/components/headers';
import { Card } from '@/components/ui';
import { type LegalDocument, formatKoreanDate } from '@/constants/legal';

type HighlightTone = 'neutral' | 'warning' | 'error';

interface LegalDocumentViewProps {
  document: LegalDocument;
  /** 헤더 타이틀 (StackHeader에 표기) */
  headerTitle: string;
  /** prologue 박스 톤 (기본 neutral — 일반 안내 텍스트) */
  prologueTone?: HighlightTone;
  /** epilogue 박스 톤 (기본 error) */
  epilogueTone?: HighlightTone;
}

const TONE_CLASSES: Record<
  Exclude<HighlightTone, 'neutral'>,
  { container: string; text: string }
> = {
  warning: {
    container: 'bg-warning-50 dark:bg-warning-900/20',
    text: 'text-warning-800 dark:text-warning-200',
  },
  error: {
    container: 'bg-error-50 dark:bg-error-900/20',
    text: 'text-error-800 dark:text-error-200',
  },
};

export function LegalDocumentView({
  document,
  headerTitle,
  prologueTone = 'neutral',
  epilogueTone = 'error',
}: LegalDocumentViewProps) {
  return (
    <SafeAreaView className="flex-1 bg-surface-page" edges={['top', 'bottom']}>
      <StackHeader title={headerTitle} fallbackHref="/(app)/settings" />
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        <Card className="mb-4">
          <Text className="mb-4 text-lg font-display text-content-primary">{document.title}</Text>

          {document.prologue && <ProseBox tone={prologueTone} text={document.prologue} />}

          {document.sections.map((section) => (
            <View key={section.title} className="mb-6">
              <Text className="mb-2 text-base font-sans-semibold text-content-primary">
                {section.title}
              </Text>
              <Text className="text-sm leading-6 text-content-muted font-sans">{section.body}</Text>
            </View>
          ))}

          {document.epilogue && <ProseBox tone={epilogueTone} text={document.epilogue} />}

          <View className="border-t border-divider pt-4">
            <Text className="text-[10px] uppercase tracking-wider text-content-muted font-sans-bold mb-2">
              부칙
            </Text>
            <Text className="text-xs text-content-muted font-sans">
              - 공고일: {formatKoreanDate(document.publishDate)}
              {'\n'}- 시행일: {formatKoreanDate(document.effectiveDate)}
              {'\n'}- 버전: {document.version}
            </Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProseBox({ tone, text }: { tone: HighlightTone; text: string }) {
  if (tone === 'neutral') {
    return <Text className="mb-6 text-sm leading-6 text-content-muted font-sans">{text}</Text>;
  }
  const cls = TONE_CLASSES[tone];
  return (
    <View className={`mb-6 rounded-lg p-4 ${cls.container}`}>
      <Text className={`text-sm font-sans-medium leading-6 ${cls.text}`}>{text}</Text>
    </View>
  );
}
