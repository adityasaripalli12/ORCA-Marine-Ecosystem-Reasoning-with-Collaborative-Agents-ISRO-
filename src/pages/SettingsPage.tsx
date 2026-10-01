import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from '../i18n';
import { GlassCard } from '../components/common/GlassCard';
import { 
  Settings, Moon, Sun, Bell, User, Key, Database, 
  Globe, ShieldCheck, CheckCircle2, RefreshCw, Cpu
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'profile' | 'theme' | 'api' | 'system'>('profile');
  const [apiKey, setApiKey] = useState('fc_live_984f003a29188d01938b827e');
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-900/90 to-ocean-950/80 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">{t('settings.title', {}, 'System & Account Settings')}</h2>
          <p className="text-xs text-slate-300 mt-1">{t('settings.subtitle', {}, 'Configure user profile preferences, theme appearance, API keys, and database health.')}</p>
        </div>
        <span className="text-xs font-mono bg-cyan-500/10 text-cyan-400 px-3 py-1.5 rounded-full border border-cyan-500/20 font-bold">
          {t('common.version', {}, 'System Version')}: v2.4.0 {t('common.enterprise', {}, 'Enterprise')}
        </span>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        {[
          { id: 'profile', labelKey: 'settings.tabs.profile', defaultLabel: 'User Profile & Security', icon: User },
          { id: 'theme',   labelKey: 'settings.tabs.theme',   defaultLabel: 'Theme & Appearance',     icon: Sun  },
          { id: 'api',     labelKey: 'settings.tabs.api',     defaultLabel: 'API Keys & Integration', icon: Key  },
          { id: 'system',  labelKey: 'settings.tabs.system',  defaultLabel: 'Database & System Version', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" /> {t(tab.labelKey, {}, tab.defaultLabel)}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Profile Settings */}
      {activeTab === 'profile' && (
        <GlassCard hoverEffect={false} className="space-y-6 max-w-2xl">
          <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">{t('settings.profile.title', {}, 'Profile & Security Settings')}</h3>
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">{t('settings.profile.fullName', {}, 'Full Name')}</label>
                <input type="text" defaultValue={user?.name} className="w-full px-3 py-2 rounded-xl glass-input" />
              </div>
              <div>
                <label className="text-slate-400 font-semibold block mb-1">{t('settings.profile.emailAddress', {}, 'Email Address')}</label>
                <input type="email" defaultValue={user?.email} className="w-full px-3 py-2 rounded-xl glass-input" />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <h4 className="text-xs font-bold text-white mb-2">{t('settings.profile.changePassword', {}, 'Change Password')}</h4>
              <div className="space-y-3">
                <input type="password" placeholder={t('settings.profile.currentPassword', {}, 'Current Password')} className="w-full px-3 py-2 rounded-xl glass-input" />
                <input type="password" placeholder={t('settings.profile.newPassword', {}, 'New Password')} className="w-full px-3 py-2 rounded-xl glass-input" />
              </div>
            </div>

            <button
              onClick={() => addToast('info', t('settings.profile.profileSaved', {}, 'Profile Saved'), t('settings.profile.profileSavedDesc', {}, 'Updated account profile preferences.'))}
              className="py-2.5 px-5 rounded-xl font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500"
            >
              {t('settings.profile.saveProfile', {}, 'Save Profile Changes')}
            </button>
          </div>
        </GlassCard>
      )}



      {/* Tab 2: Theme Settings */}
      {activeTab === 'theme' && (
        <GlassCard hoverEffect={false} className="space-y-6 max-w-2xl">
          <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">{t('settings.theme.title', {}, 'Appearance & Theme Customization')}</h3>
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div>
                <h4 className="font-bold text-white">{t('settings.theme.activeTheme', {}, 'Active Theme Mode')}</h4>
                <p className="text-slate-400 text-[11px] mt-0.5">{t('settings.theme.activeThemeDesc', {}, 'Toggle between Dark Ocean and Light Ocean themes')}</p>
              </div>
              <button
                onClick={toggleTheme}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-2"
              >
                {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                {t('settings.theme.currentMode', {}, 'Current Mode')}: {theme.toUpperCase()}
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Tab 3: API Settings */}
      {activeTab === 'api' && (
        <GlassCard hoverEffect={false} className="space-y-6 max-w-2xl">
          <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">{t('settings.api.title', {}, 'REST & Vector API Keys')}</h3>
          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold block">{t('settings.api.activeKey', {}, 'Active API Secret Key')}</label>
              <div className="flex gap-2">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  readOnly
                  className="flex-1 px-3 py-2 rounded-xl glass-input font-mono text-cyan-300"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  {showApiKey ? t('settings.api.hide', {}, 'Hide') : t('settings.api.show', {}, 'Show')}
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                const newK = `fc_live_${Math.random().toString(36).substring(2, 18)}`;
                setApiKey(newK);
                addToast('info', t('settings.api.regenerated', {}, 'API Key Regenerated'), t('settings.api.regeneratedDesc', {}, 'Issued new bearer token.'));
              }}
              className="px-4 py-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold"
            >
              {t('settings.api.regenerate', {}, 'Regenerate Secret Key')}
            </button>
          </div>
        </GlassCard>
      )}

      {/* Tab 4: System & Database Health */}
      {activeTab === 'system' && (
        <GlassCard hoverEffect={false} className="space-y-6 max-w-2xl">
          <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">{t('settings.system.title', {}, 'Database & Infrastructure Status')}</h3>
          <div className="space-y-3 text-xs">
            {[
              { name: 'ARGO Vector Index Database', status: t('common.healthy', {}, 'Healthy'), ping: '12ms' },
              { name: 'NetCDF Binary Data Parser', status: t('common.healthy', {}, 'Healthy'), ping: '4ms' },
              { name: 'SHA-256 Ledger Node', status: t('common.healthy', {}, 'Healthy'), ping: '1ms' },
              { name: 'WAF Prompt Injection Engine', status: t('common.operational', {}, 'Operational'), ping: '2ms' }
            ].map((node, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="font-semibold text-slate-200">{node.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-500 font-mono">{t('settings.system.latency', {}, 'Latency')}: {node.ping}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {node.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
};
