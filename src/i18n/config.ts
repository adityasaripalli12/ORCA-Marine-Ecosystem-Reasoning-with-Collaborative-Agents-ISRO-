/**
 * FloatChat Internationalization (i18n) Configuration
 * 
 * Supports dynamic addition of new languages by:
 * 1. Adding a LanguageConfig entry in SUPPORTED_LANGUAGES.
 * 2. Registering the locale JSON loader in `bundleLoaders`.
 * 3. Adding the corresponding `locales/<lang>.json` file.
 */

export interface LanguageConfig {
  code: string;           // Language identifier (e.g. 'en', 'te', 'hi')
  name: string;           // English name
  nativeName: string;     // Native script name
  locale: string;         // Standard BCP-47 locale code
  direction: 'ltr' | 'rtl';
  flag: string;           // Emoji or visual indicator
  fontFamily?: string;    // Optional specific font stack
}

export const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    locale: 'en-US',
    direction: 'ltr',
    flag: '🇺🇸',
  },
  te: {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    locale: 'te-IN',
    direction: 'ltr',
    flag: '🇮🇳',
    fontFamily: "'Noto Sans Telugu', 'Gautami', 'Mandali', sans-serif",
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    locale: 'hi-IN',
    direction: 'ltr',
    flag: '🇮🇳',
    fontFamily: "'Noto Sans Devanagari', 'Mangal', 'Utsaah', sans-serif",
  },
};

export const DEFAULT_LANGUAGE = 'en';
export const FALLBACK_LANGUAGE = 'en';
export const STORAGE_KEY = 'floatchat_language_preference';

/**
 * Lazy-load bundles for performance.
 * Adding a new language only requires adding a dynamic import here.
 */
export const bundleLoaders: Record<string, () => Promise<{ default: Record<string, any> }>> = {
  en: () => import('./locales/en.json'),
  te: () => import('./locales/te.json'),
  hi: () => import('./locales/hi.json'),
};
