import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../i18n';
import { RoleBadge } from '../common/RoleBadge';
import { UserRole, ROLE_CONFIG } from '../../types';
import { LanguageSelector } from './LanguageSelector';
import { 
  Waves, Search, Bell, Moon, Sun, Shield, 
  ChevronDown, LogOut, Settings, Sparkles, CheckCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NavbarProps {
  onToggleSidebar?: () => void;
  activePageTitle?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ activePageTitle }) => {
  const { user, logout, setRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const { t } = useTranslation();
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const notificationsList = [
    { id: 1, title: t('alerts.uploadVerified'), time: '5m ago', desc: 'argo_global_profile_2026_q2.nc SHA-256 hash verified.', type: 'upload_completed' as const },
    { id: 2, title: t('alerts.promptInjectionBlocked'), time: '18m ago', desc: 'Security WAF blocked unauthorized prompt payload.', type: 'prompt_blocked' as const },
    { id: 3, title: t('alerts.sqlBlocked'), time: '1h ago', desc: 'Payload containing SELECT * FROM users intercepted.', type: 'sql_blocked' as const },
  ];

  const handleRoleChange = (role: UserRole) => {
    setRole(role);
    addToast('role_updated', t('alerts.roleUpdated'), t('alerts.roleUpdatedDesc', { role }));
    setShowRoleSelector(false);
  };

  return (
    <header className="sticky top-0 z-30 w-full glass-panel border-b border-ocean-500/20 backdrop-blur-xl px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
      {/* Left: Brand & Page Title */}
      <div className="flex items-center gap-3">
        <a href="#/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-ocean-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <Waves className="w-5 h-5 text-white animate-pulse-slow" />
          </div>
          <div className="hidden sm:block">
            <div className="flex items-baseline gap-1">
              <span className="font-extrabold text-lg tracking-tight text-white">ORCA </span>
              <span className="font-extrabold text-lg tracking-tight text-cyan-400">Marine EcoSystem</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 ml-1.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">v2.4</span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-cyan-400/80 font-bold mt-0.5">ENTERPRISE V2.4 • OCEAN PLATFORM</p>
          </div>
        </a>

        {activePageTitle && (
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-700/50">
            <span className="text-sm font-semibold text-slate-200">{activePageTitle}</span>
          </div>
        )}
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-md hidden md:block">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('common.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs glass-input placeholder-slate-400 focus:ring-2 focus:ring-cyan-500/40"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700 font-mono">⌘K</kbd>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Language Selector Component */}
        <LanguageSelector />

        {/* Interactive RBAC Quick Switcher Pill */}
        <div className="relative">
          <button
            onClick={() => setShowRoleSelector(!showRoleSelector)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-all text-xs font-medium text-slate-200"
            title={t('common.switchRole')}
          >
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline text-slate-400">{t('common.role')}:</span>
            <RoleBadge role={user?.role || 'Researcher'} size="sm" />
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          <AnimatePresence>
            {showRoleSelector && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute right-0 mt-2 w-48 rounded-xl glass-panel border border-slate-700/80 shadow-2xl p-2 z-50 space-y-1"
              >
                <div className="px-2 py-1 flex items-center justify-between border-b border-slate-700/60 pb-1.5 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {t('common.switchRole')}
                  </span>
                  <span className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                    Preview Mode
                  </span>
                </div>
                {(Object.keys(ROLE_CONFIG) as UserRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => handleRoleChange(r)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      user?.role === r
                        ? `${ROLE_CONFIG[r].bgClass} ${ROLE_CONFIG[r].textClass} font-semibold`
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <RoleBadge role={r} size="sm" />
                    {user?.role === r && <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />}
                  </button>
                ))}
                <div className="px-2 pt-1.5 border-t border-slate-700/60 text-[9px] text-slate-400 leading-tight">
                  🔒 Backend permissions strictly enforced per account.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dark / Light Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 hover:text-white transition-colors"
          title={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-400" />}
        </button>

        {/* Notifications Button */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 hover:text-white transition-colors relative"
            title={t('common.notifications')}
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400"></span>
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute right-0 mt-2 w-80 rounded-2xl glass-panel border border-slate-700/80 shadow-2xl p-4 z-50 space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">{t('common.notifications')}</h4>
                  <button 
                    onClick={() => addToast('info', 'Demo Alert', 'Triggered test system notification.')}
                    className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Test Toast
                  </button>
                </div>
                <div className="space-y-2">
                  {notificationsList.map((n) => (
                    <div 
                      key={n.id} 
                      onClick={() => addToast(n.type)}
                      className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 cursor-pointer transition-colors"
                    >
                      <div className="flex justify-between items-center text-xs font-semibold text-slate-200">
                        <span>{n.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{n.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-snug">{n.desc}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 transition-colors"
          >
            <img
              src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
              alt={user?.name}
              className="w-7 h-7 rounded-lg object-cover ring-2 ring-cyan-500/30"
            />
            <span className="hidden lg:inline text-xs font-semibold text-slate-200 max-w-[100px] truncate">{user?.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute right-0 mt-2 w-56 rounded-2xl glass-panel border border-slate-700/80 shadow-2xl p-3 z-50 space-y-2"
              >
                <div className="px-2 py-1.5 border-b border-slate-700/50 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-100 truncate flex-1">{user?.name}</p>
                    <RoleBadge role={user?.role || 'Researcher'} size="sm" />
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                  <p className={`text-[10px] font-semibold ${ROLE_CONFIG[user?.role || 'Researcher'].textClass}`}>
                    {ROLE_CONFIG[user?.role || 'Researcher'].label}
                  </p>
                </div>
                <div className="space-y-1">
                  <a
                    href="#/settings"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-cyan-400" /> {t('nav.settings')}
                  </a>
                  <button
                    onClick={() => {
                      logout();
                      setShowProfileMenu(false);
                      window.location.hash = '#/login';
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" /> {t('nav.signOut')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
