import React, { createContext, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert, XCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type ToastType = 
  | 'login_success' 
  | 'upload_completed' 
  | 'prompt_blocked' 
  | 'sql_blocked' 
  | 'integrity_failed' 
  | 'user_created' 
  | 'role_updated'
  | 'info'
  | 'error'
  | 'success'
  | 'gov_success'
  | 'user_approved'
  | 'user_rejected'
  | 'account_disabled'
  | 'gov_key_generated'
  | 'verification_success';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
}

interface ToastContextType {
  addToast: (type: ToastType, title?: string, message?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const defaultToastInfo: Record<ToastType, { title: string; defaultMsg: string; icon: any; color: string; border: string }> = {
  login_success: {
    title: 'Login Successful',
    defaultMsg: 'JWT session authenticated. Welcome back to ORCA Enterprise!',
    icon: CheckCircle2,
    color: 'text-emerald-400 bg-emerald-500/10',
    border: 'border-emerald-500/30'
  },
  upload_completed: {
    title: 'Upload Completed',
    defaultMsg: 'NetCDF dataset processed and SHA-256 integrity hash verified.',
    icon: CheckCircle2,
    color: 'text-cyan-400 bg-cyan-500/10',
    border: 'border-cyan-500/30'
  },
  prompt_blocked: {
    title: 'Prompt Injection Blocked',
    defaultMsg: 'Security Gateway detected potential prompt injection attack pattern.',
    icon: ShieldAlert,
    color: 'text-amber-400 bg-amber-500/10',
    border: 'border-amber-500/30'
  },
  sql_blocked: {
    title: 'SQL Injection Blocked',
    defaultMsg: 'WAF Rule #892 intercepted unauthorized SQL syntax pattern in payload.',
    icon: XCircle,
    color: 'text-rose-400 bg-rose-500/10',
    border: 'border-rose-500/30'
  },
  integrity_failed: {
    title: 'Integrity Verification Failed',
    defaultMsg: 'SHA-256 hash mismatch detected. File upload rejected by security engine.',
    icon: AlertTriangle,
    color: 'text-rose-400 bg-rose-500/10',
    border: 'border-rose-500/30'
  },
  user_created: {
    title: 'User Created',
    defaultMsg: 'New platform user provisioned with assigned role permissions.',
    icon: CheckCircle2,
    color: 'text-blue-400 bg-blue-500/10',
    border: 'border-blue-500/30'
  },
  role_updated: {
    title: 'Role Updated',
    defaultMsg: 'RBAC permissions modified successfully in system audit ledger.',
    icon: Info,
    color: 'text-sky-400 bg-sky-500/10',
    border: 'border-sky-500/30'
  },
  info: {
    title: 'Notification',
    defaultMsg: 'System status updated successfully.',
    icon: Info,
    color: 'text-ocean-400 bg-ocean-500/10',
    border: 'border-ocean-500/30'
  },
  error: {
    title: 'Error',
    defaultMsg: 'An error occurred.',
    icon: XCircle,
    color: 'text-rose-400 bg-rose-500/10',
    border: 'border-rose-500/30'
  },
  success: {
    title: 'Operation Successful',
    defaultMsg: 'The action completed successfully.',
    icon: CheckCircle2,
    color: 'text-emerald-400 bg-emerald-500/10',
    border: 'border-emerald-500/30'
  },
  gov_success: {
    title: 'Government Verification',
    defaultMsg: 'Account verified successfully.',
    icon: CheckCircle2,
    color: 'text-emerald-400 bg-emerald-500/10',
    border: 'border-emerald-500/30'
  },
  user_approved: {
    title: 'User Approved',
    defaultMsg: 'User account has been approved by Administrator.',
    icon: CheckCircle2,
    color: 'text-emerald-400 bg-emerald-500/10',
    border: 'border-emerald-500/30'
  },
  user_rejected: {
    title: 'User Rejected',
    defaultMsg: 'User registration request was rejected by Administrator.',
    icon: XCircle,
    color: 'text-rose-400 bg-rose-500/10',
    border: 'border-rose-500/30'
  },
  account_disabled: {
    title: 'Account Disabled',
    defaultMsg: 'Target user account has been disabled by Administrator.',
    icon: AlertTriangle,
    color: 'text-amber-400 bg-amber-500/10',
    border: 'border-amber-500/30'
  },
  gov_key_generated: {
    title: 'Government Access Key Generated',
    defaultMsg: 'New Government Access Key issued and recorded in audit ledger.',
    icon: CheckCircle2,
    color: 'text-cyan-400 bg-cyan-500/10',
    border: 'border-cyan-500/30'
  },
  verification_success: {
    title: 'Security Verification Successful',
    defaultMsg: 'Administrator Passkey verified. Access granted.',
    icon: CheckCircle2,
    color: 'text-emerald-400 bg-emerald-500/10',
    border: 'border-emerald-500/30'
  }
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (type: ToastType, customTitle?: string, customMsg?: string) => {
    const config = defaultToastInfo[type];
    const newToast: ToastItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      type,
      title: customTitle || config.title,
      message: customMsg || config.defaultMsg,
    };

    setToasts(prev => [newToast, ...prev].slice(0, 5));

    setTimeout(() => {
      removeToast(newToast.id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none px-4">
        <AnimatePresence>
          {toasts.map(toast => {
            const info = defaultToastInfo[toast.type];
            const Icon = info.icon;
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl glass-panel ${info.border} shadow-2xl backdrop-blur-xl border`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${info.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-slate-100">{toast.title}</h4>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{toast.message}</p>
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-slate-400 hover:text-white p-1 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
