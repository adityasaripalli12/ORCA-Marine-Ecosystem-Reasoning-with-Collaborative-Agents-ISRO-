import React from 'react';
import { ShieldAlert, Lock, ArrowLeft, Waves } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from '../i18n';

export const ForbiddenPage: React.FC<{ message?: string }> = ({ message }) => {
  const { t } = useTranslation();
  const msg = message ?? t('errors.forbiddenMessage', {}, '403 Access Denied. You do not have the required Role-Based Access Control (RBAC) permissions to view this system area.');
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-24 h-24 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-2xl shadow-rose-500/20"
      >
        <Lock className="w-12 h-12 animate-pulse" />
      </motion.div>

      <div className="space-y-2 max-w-md">
        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
          HTTP 403 FORBIDDEN
        </span>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">{t('errors.forbiddenHeading', {}, 'Access Denied')}</h2>
        <p className="text-xs text-slate-400 leading-relaxed">{msg}</p>
      </div>

      <div className="flex gap-4 pt-2">
        <a
          href="#/dashboard"
          className="px-6 py-3 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:from-ocean-400 hover:to-cyan-400 shadow-xl shadow-cyan-500/25 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> {t('errors.backToDashboard', {}, 'Return to Dashboard')}
        </a>
      </div>
    </div>
  );
};
