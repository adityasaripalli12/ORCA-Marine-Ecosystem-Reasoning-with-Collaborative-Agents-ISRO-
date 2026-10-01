import React from 'react';
import { Waves, Compass, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from '../i18n';

export const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-24 h-24 rounded-3xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-2xl shadow-cyan-500/20"
      >
        <Compass className="w-12 h-12 animate-spin" />
      </motion.div>

      <div className="space-y-2 max-w-md">
        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
          HTTP 404 NOT FOUND
        </span>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">{t('errors.notFoundHeading', {}, 'Charted Territory Unknown')}</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          {t('errors.notFoundSubDesc', {}, 'The requested coordinate or page route does not exist in the ORCA ocean discovery matrix.')}
        </p>
      </div>

      <a
        href="#/dashboard"
        className="px-6 py-3 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:from-ocean-400 hover:to-cyan-400 shadow-xl shadow-cyan-500/25 flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" /> {t('errors.backToDashboard', {}, 'Return to Operations Dashboard')}
      </a>
    </div>
  );
};
