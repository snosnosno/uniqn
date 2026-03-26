import { Redirect, useLocalSearchParams } from 'expo-router';
import { resolveEmployerAliasHref } from '@/shared/navigation/webRouteAliases';

export default function EmployerAliasCatchAll() {
  const { slug } = useLocalSearchParams<{ slug?: string[] | string }>();
  return <Redirect href={resolveEmployerAliasHref(slug)} />;
}
