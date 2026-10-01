import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const LanguageSelector: React.FC = () => {
  const { language, currentLanguageConfig, supportedLanguages, setLanguage, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (code: string) => {
    await setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        id="language-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 transition-all text-xs font-medium text-slate-200 hover:border-cyan-500/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 shadow-sm"
        aria-label="Select application language"
        title={`Current Language: ${currentLanguageConfig.name} (${currentLanguageConfig.nativeName})`}
      >
        <Globe className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-base leading-none">{currentLanguageConfig.flag}</span>
        <span className="hidden sm:inline font-medium text-slate-200">
          {currentLanguageConfig.nativeName}
        </span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-48 rounded-2xl glass-panel border border-cyan-500/20 shadow-2xl p-1.5 z-50 space-y-1 backdrop-blur-xl bg-slate-900/90"
          >
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-400/80 border-b border-slate-800/80 flex items-center justify-between">
              <span>{t('common.selectLanguage')}</span>
              <span className="text-slate-500 font-mono text-[9px]">{supportedLanguages.length} {t('common.available', {}, 'Available')}</span>
            </div>

            <div className="pt-1 space-y-0.5">
              {supportedLanguages.map((lang) => {
                const isSelected = lang.code === language;
                return (
                  <button
                    key={lang.code}
                    id={`lang-option-${lang.code}`}
                    onClick={() => handleSelect(lang.code)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                      isSelected
                        ? 'bg-cyan-500/15 text-cyan-300 font-semibold border border-cyan-500/30'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base leading-none">{lang.flag}</span>
                      <div className="flex flex-col text-left">
                        <span className="font-medium text-slate-200 leading-tight">
                          {lang.nativeName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {lang.name}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
