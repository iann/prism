/**
 * Jest mock for `next-intl` (mapped in jest.config.js).
 *
 * next-intl ships ESM that ts-jest doesn't transpile, and unit tests don't need
 * the real i18n runtime. This resolves keys against the English catalog so
 * text-asserting tests still see real copy, does naive {placeholder} substitution,
 * and provides a pass-through provider. ICU plural/select strings are returned
 * raw (no test currently renders one).
 */
import * as React from 'react';
import en from '@/i18n/messages/en.json';

type Dict = Record<string, unknown>;

function lookupValue(namespace: string | undefined, key: string): unknown {
  const path = [namespace, key]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split('.'));

  return path.reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return (value as Dict)[segment];
  }, en);
}

function lookup(namespace: string | undefined, key: string): string {
  const value = lookupValue(namespace, key);
  return typeof value === 'string' ? value : namespace ? `${namespace}.${key}` : key;
}

export function NextIntlClientProvider({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export function useTranslations(namespace?: string) {
  const translate = (key: string, values?: Record<string, unknown>) => {
    let out = lookup(namespace, key);
    if (values) {
      for (const [k, v] of Object.entries(values)) {
        out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return out;
  };
  translate.has = (key: string) => typeof lookupValue(namespace, key) === 'string';
  return translate;
}

export function useLocale() {
  return 'en';
}

export function useFormatter() {
  return {} as Record<string, unknown>;
}
