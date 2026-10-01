import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  LanguageConfig,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  STORAGE_KEY,
  bundleLoaders
} from './config';

export * from './config';

interface I18nContextType {
  language: string;
  currentLanguageConfig: LanguageConfig;
  supportedLanguages: LanguageConfig[];
  setLanguage: (lang: string) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>, defaultVal?: string) => string;
  isLoading: boolean;
}

// In-memory cache for loaded translation bundles
const translationCache: Record<string, Record<string, any>> = {};

const I18nContext = createContext<I18nContextType | null>(null);

/**
 * Helper to traverse nested objects via dot notation (e.g. 'nav.dashboard')
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  if (!obj) return undefined;
  return path.split('.').reduce((prev, curr) => (prev && prev[curr] !== undefined ? prev[curr] : undefined), obj);
}

/**
 * Interpolate parameters into template strings like "{{name}} is active"
 */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params || typeof template !== 'string') return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{{${key}}}`;
  });
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Resolve initial language: localStorage -> navigator.language -> default
  const [language, setLanguageState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED_LANGUAGES[saved]) {
        return saved;
      }
      // Check browser language
      const browserLang = navigator.language?.slice(0, 2).toLowerCase();
      if (browserLang && SUPPORTED_LANGUAGES[browserLang]) {
        return browserLang;
      }
    } catch {
      // Ignore storage access errors
    }
    return DEFAULT_LANGUAGE;
  });

  const [activeBundle, setActiveBundle] = useState<Record<string, any>>({});
  const [fallbackBundle, setFallbackBundle] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load a translation bundle dynamically with caching
  const loadBundle = useCallback(async (lang: string): Promise<Record<string, any>> => {
    if (translationCache[lang]) {
      return translationCache[lang];
    }
    const loader = bundleLoaders[lang] || bundleLoaders[FALLBACK_LANGUAGE];
    try {
      const module = await loader();
      const data = module.default || module;
      translationCache[lang] = data;
      return data;
    } catch (err) {
      console.error(`[i18n] Failed to load locale bundle for: ${lang}`, err);
      return {};
    }
  }, []);

  // Initialize fallback (English) and active language bundle
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    Promise.all([
      loadBundle(FALLBACK_LANGUAGE),
      loadBundle(language),
    ]).then(([fbBundle, curBundle]) => {
      if (!isMounted) return;
      setFallbackBundle(fbBundle);
      setActiveBundle(curBundle);
      setIsLoading(false);

      // Update HTML attributes for accessibility and SEO
      const cfg = SUPPORTED_LANGUAGES[language] || SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];
      document.documentElement.lang = cfg.locale || language;
      document.documentElement.dir = cfg.direction || 'ltr';
    });

    return () => {
      isMounted = false;
    };
  }, [language, loadBundle]);

  // Switch active language
  const setLanguage = useCallback(async (newLang: string) => {
    if (!SUPPORTED_LANGUAGES[newLang]) {
      console.warn(`[i18n] Language "${newLang}" is not supported.`);
      return;
    }
    setIsLoading(true);
    const bundle = await loadBundle(newLang);
    setActiveBundle(bundle);
    setLanguageState(newLang);
    setIsLoading(false);

    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch (err) {
      console.warn('[i18n] Failed to persist language to localStorage', err);
    }

    const cfg = SUPPORTED_LANGUAGES[newLang];
    document.documentElement.lang = cfg.locale || newLang;
    document.documentElement.dir = cfg.direction || 'ltr';
  }, [loadBundle]);

  // Main translation function
  const t = useCallback((key: string, params?: Record<string, string | number>, defaultVal?: string): string => {
    // 1. Try active language bundle
    let val = getNestedValue(activeBundle, key);

    // 2. Fall back to fallback bundle (English)
    if (val === undefined) {
      val = getNestedValue(fallbackBundle, key);
    }

    // 3. Fall back to provided default value
    if (val === undefined) {
      val = defaultVal !== undefined ? defaultVal : key;
    }

    return typeof val === 'string' ? interpolate(val, params) : String(val);
  }, [activeBundle, fallbackBundle]);

  const currentLanguageConfig = useMemo(() => {
    return SUPPORTED_LANGUAGES[language] || SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];
  }, [language]);

  const supportedLanguages = useMemo(() => {
    return Object.values(SUPPORTED_LANGUAGES);
  }, []);

  const value = useMemo(() => ({
    language,
    currentLanguageConfig,
    supportedLanguages,
    setLanguage,
    t,
    isLoading,
  }), [language, currentLanguageConfig, supportedLanguages, setLanguage, t, isLoading]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

/**
 * Reusable translation hook
 */
export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};
