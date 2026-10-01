import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { ROLE_CONFIG, UserRole } from '../../types';
import { RoleBadge } from '../common/RoleBadge';
import {
  LayoutDashboard, MessageSquare, MessagesSquare, UploadCloud, Database,
  BarChart3, ShieldCheck, FileSpreadsheet, Users,
  Settings, LogOut, Lock, CheckCircle2, Compass, AlertTriangle, Anchor,
  ShieldAlert, Mic, Map, BookOpen, FileText, Activity, Sparkles
} from 'lucide-react';

interface SidebarProps {
  currentPath: string;
}

/* ── Nav item definition ── */
interface NavItem {
  i18nKey: string;
  defaultLabel: string;
  path: string;
  icon: React.ElementType;
  /** Key that must appear in the role's navAccess list */
  key: string;
  /** Admin-only badge shown on the link */
  adminBadge?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard',          i18nKey: 'nav.dashboard',          defaultLabel: 'Dashboard',             path: '#/dashboard',          icon: LayoutDashboard },
  { key: 'ocean-intel',        i18nKey: 'nav.oceanIntel',         defaultLabel: 'Ocean Intelligence',    path: '#/dashboard#intel',    icon: Compass         },
  { key: 'maritime-intel',      i18nKey: 'nav.maritimeIntel',      defaultLabel: 'Maritime Intelligence', path: '#/dashboard#maritime', icon: Anchor          },
  { key: 'maritime-safety',     i18nKey: 'nav.maritimeSafety',     defaultLabel: 'Maritime Safety',       path: '#/dashboard#safety',   icon: ShieldAlert     },
  { key: 'ocean-assistant',     i18nKey: 'nav.oceanAssistant',     defaultLabel: 'Ocean Assistant',       path: '#/dashboard#assistant',icon: Sparkles       },
  { key: 'learn-ocean',        i18nKey: 'nav.learnOcean',         defaultLabel: 'Learn Ocean Data',      path: '#/dashboard#learn',    icon: BookOpen        },
  { key: 'flowchat-ai',        i18nKey: 'nav.flowchatAi',        defaultLabel: 'ORCA AI',           path: '#/flowchat-ai',        icon: MessageSquare   },
  { key: 'research-chat',      i18nKey: 'nav.researchChat',      defaultLabel: 'Research Chat',         path: '#/research-chat',      icon: MessagesSquare  },
  { key: 'upload',             i18nKey: 'nav.upload',            defaultLabel: 'Upload Dataset',        path: '#/upload',             icon: UploadCloud     },
  { key: 'datasets',           i18nKey: 'nav.datasets',          defaultLabel: 'Dataset Manager',       path: '#/datasets',           icon: Database        },
  { key: 'visualization',      i18nKey: 'nav.visualization',     defaultLabel: 'Visualization',         path: '#/visualization',      icon: BarChart3       },
  { key: 'sea-conditions',     i18nKey: 'nav.seaConditions',      defaultLabel: 'Sea Conditions',        path: '#/dashboard#sea',      icon: Activity        },
  { key: 'ocean-conditions',   i18nKey: 'nav.oceanConditions',    defaultLabel: 'Ocean Conditions',      path: '#/dashboard#conditions',icon: Activity       },
  { key: 'regional-analysis',  i18nKey: 'nav.regionalAnalysis',   defaultLabel: 'Regional Analysis',     path: '#/visualization',      icon: Compass         },
  { key: 'operational-map',    i18nKey: 'nav.operationalMap',     defaultLabel: 'Operational Map',       path: '#/visualization',      icon: Map             },
  { key: 'ocean-map',          i18nKey: 'nav.oceanMap',           defaultLabel: 'Ocean Map',             path: '#/dashboard#map',      icon: Map             },
  { key: 'safety',             i18nKey: 'nav.safety',             defaultLabel: 'Safety',                path: '#/dashboard#safety',   icon: ShieldAlert     },
  { key: 'alerts',             i18nKey: 'nav.alerts',             defaultLabel: 'Alerts',                path: '#/dashboard#alerts',   icon: AlertTriangle   },
  { key: 'coastal-alerts',     i18nKey: 'nav.coastalAlerts',      defaultLabel: 'Coastal Alerts',        path: '#/dashboard#alerts',   icon: AlertTriangle   },
  { key: 'voice-assistant',    i18nKey: 'nav.voiceAssistant',     defaultLabel: 'Voice Assistant',       path: '#/dashboard#voice',    icon: Mic             },
  { key: 'reports',            i18nKey: 'nav.reports',            defaultLabel: 'Reports',               path: '#/dashboard#reports',  icon: FileText        },
  { key: 'security',           i18nKey: 'nav.security',           defaultLabel: 'Security Dashboard',    path: '#/security',           icon: ShieldCheck,    adminBadge: true },
  { key: 'audit-logs',         i18nKey: 'nav.auditLogs',          defaultLabel: 'Audit Logs',            path: '#/audit-logs',         icon: FileSpreadsheet,adminBadge: true },
  { key: 'user-management',    i18nKey: 'nav.userManagement',     defaultLabel: 'User Management',       path: '#/user-management',    icon: Users,          adminBadge: true },
  { key: 'settings',           i18nKey: 'nav.settings',           defaultLabel: 'Settings',              path: '#/settings',           icon: Settings        },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentPath }) => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const role = (user?.role ?? 'Student') as UserRole;
  const cfg  = ROLE_CONFIG[role];
  const allowed = cfg.navAccess as readonly string[];

  const visibleItems = NAV_ITEMS.filter((item) => allowed.includes(item.key));

  return (
    <aside className="w-64 shrink-0 glass-panel border-r border-ocean-500/20 backdrop-blur-2xl flex flex-col justify-between p-4 min-h-[calc(100vh-65px)]">
      <div className="space-y-5">

        {/* ── Role identity card ── */}
        <div className={`p-3.5 rounded-2xl ${cfg.bgClass} border ${cfg.borderClass}`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl ${cfg.bgClass} border ${cfg.borderClass} flex items-center justify-center text-base shrink-0`}>
              {cfg.emoji}
            </div>
            <div className="min-w-0">
              <p className={`text-[11px] font-bold truncate ${cfg.textClass}`}>{t(`roles.${role}`, {}, cfg.label)}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Permission chips */}
          <div className="mt-3 space-y-1">
            {cfg.permissions.map((p) => (
              <div key={p} className="flex items-center gap-1.5">
                <CheckCircle2 className={`w-3 h-3 shrink-0 ${cfg.textClass}`} />
                <span className="text-[10px] text-slate-400">{p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Navigation ── */}
        <div>
          <div className="px-3 mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>{t('nav.navigation')}</span>
            <span className={`font-mono ${cfg.textClass}`}>{t('nav.rbac')}</span>
          </div>

          <nav className="space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                currentPath === item.path ||
                (currentPath === '' && item.path === '#/dashboard');

              return (
                <a
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-ocean-600 to-cyan-600 text-white shadow-lg shadow-cyan-500/20 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{t(item.i18nKey, {}, item.defaultLabel)}</span>
                  {item.adminBadge && (
                    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {t('nav.adminBadge')}
                    </span>
                  )}
                </a>
              );
            })}
          </nav>
        </div>

        {/* ── Restricted-access info for non-admin roles ── */}
        {role !== 'Admin' && (
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('nav.restrictedAccess')}</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              {t('nav.restrictedDesc')}
            </p>
            <div className="pt-1">
              <RoleBadge role={role} size="sm" showFull />
            </div>
          </div>
        )}
      </div>

      {/* ── Footer / Logout ── */}
      <div className="pt-4 border-t border-slate-800/80">
        <button
          onClick={() => {
            logout();
            window.location.hash = '#/login';
          }}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>{t('nav.signOut')}</span>
        </button>
      </div>
    </aside>
  );
};
