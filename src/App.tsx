import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { DataProvider } from './context/DataContext';
import { I18nProvider, useTranslation } from './i18n';
import { Lock, KeyRound, ShieldAlert } from 'lucide-react';

import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';

import { LandingPage } from './pages/LandingPage';
import { PasskeyModal } from './components/security/PasskeyModal';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AdminLoginPage } from './pages/AdminLoginPage';

import { DashboardPage } from './pages/DashboardPage';
import { FlowChatAIPage } from './pages/FlowChatAIPage';
import { ResearchChatPage } from './pages/ResearchChatPage';
import { UploadPage } from './pages/UploadPage';
import { VisualizationPage } from './pages/VisualizationPage';
import { DatasetManagerPage } from './pages/DatasetManagerPage';
import { SecurityDashboardPage } from './pages/SecurityDashboardPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { SettingsPage } from './pages/SettingsPage';
import { DeviceProvider } from './context/DeviceContext';

import { ForbiddenPage } from './pages/ForbiddenPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { Error500Page } from './pages/Error500Page';
import { FloatingAIAssistant } from './components/common/FloatingAIAssistant';

const AppRouter: React.FC = () => {
  const [currentHash, setCurrentHash] = useState<string>(window.location.hash || '#/');
  const [isPasskeyVerified, setIsPasskeyVerified] = useState(false);
  const { isAuthenticated, user, isLoading } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || '#/');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Translated Page Titles Map
  const pageTitles: Record<string, string> = {
    '#/dashboard': t('nav.dashboard', {}, 'Operations Dashboard'),
    '#/flowchat-ai': t('nav.flowchatAi', {}, 'ORCA AI'),
    '#/research-chat': t('nav.researchChat', {}, 'Research Collaboration & Chat'),
    '#/upload': t('nav.upload', {}, 'Upload Dataset'),
    '#/datasets': t('nav.datasets', {}, 'Dataset Manager'),
    '#/visualization': t('nav.visualization', {}, 'Data Visualization'),
    '#/security': t('nav.security', {}, 'Security Dashboard'),
    '#/audit-logs': t('nav.auditLogs', {}, 'System Audit Logs'),
    '#/user-management': t('nav.userManagement', {}, 'User Management'),
    '#/settings': t('nav.settings', {}, 'System Settings'),
    '#/403': t('errors.forbiddenTitle', {}, '403 Forbidden'),
    '#/404': t('errors.notFoundTitle', {}, '404 Not Found'),
    '#/500': t('errors.serverErrorTitle', {}, '500 System Error')
  };

  const activeTitle = pageTitles[currentHash] || 'ORCA Marine EcoSystem';

  // Public Full-Page Routes
  if (currentHash === '' || currentHash === '#/' || currentHash === '#' || currentHash === '#/landing') {
    return <LandingPage />;
  }

  if (currentHash === '#/login') {
    return <LoginPage />;
  }

  if (currentHash === '#/register') {
    return <RegisterPage />;
  }

  if (currentHash === '#/admin-login') {
    return <AdminLoginPage />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030918] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <p className="text-xs font-mono text-cyan-400/80 tracking-widest uppercase">{t('common.loading', {}, 'Initializing ORCA Marine EcoSystem…')}</p>
        </div>
      </div>
    );
  }

  // Handle Unauthenticated state -> redirect to Login for protected routes
  if (!isAuthenticated) {
    return <LoginPage />;
  }


  const isProtectedAdminRoute = (currentHash === '#/security' || currentHash === '#/audit-logs' || currentHash === '#/user-management') && user?.role === 'Admin';
  const showPasskeyGate = isProtectedAdminRoute && !isPasskeyVerified;

  const renderMainContent = () => {
    if (showPasskeyGate) {
      return (
        <PasskeyModal
          onSuccess={() => setIsPasskeyVerified(true)}
          onCancel={() => { window.location.hash = '#/dashboard'; }}
        />
      );
    }

    switch (currentHash) {
      case '':
      case '#/':
      case '#/dashboard':
        return <DashboardPage />;
      case '#/flowchat-ai':
        return <FlowChatAIPage />;
      case '#/research-chat':
        return <ResearchChatPage />;
      case '#/upload':
        return <UploadPage />;
      case '#/datasets':
        return <DatasetManagerPage />;
      case '#/visualization':
        return <VisualizationPage />;
      case '#/security':
        return <SecurityDashboardPage />;
      case '#/audit-logs':
        return <AuditLogsPage />;
      case '#/user-management':
        return <UserManagementPage />;
      case '#/settings':
        return <SettingsPage />;
      case '#/403':
        return <ForbiddenPage />;
      case '#/500':
        return <Error500Page />;
      default:
        return <NotFoundPage />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      <Navbar activePageTitle={activeTitle} />
      <div className="flex flex-1">
        <Sidebar currentPath={currentHash} />
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full">
          {renderMainContent()}
        </main>
      </div>
      <FloatingAIAssistant />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <I18nProvider>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <DataProvider>
              <DeviceProvider>
                <AppRouter />
              </DeviceProvider>
            </DataProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </I18nProvider>
  );
};
export default App;
