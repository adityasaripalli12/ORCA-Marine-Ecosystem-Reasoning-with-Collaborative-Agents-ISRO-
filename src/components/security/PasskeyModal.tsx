import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, KeyRound, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../utils/api';

interface PasskeyModalProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const LOCKOUT_KEY = 'floatchat_passkey_lockout_until';

export const PasskeyModal: React.FC<PasskeyModalProps> = ({ onSuccess, onCancel }) => {
  const { addToast } = useToast();
  const { addAuditLog } = useData();
  const { user } = useAuth();

  const [passkey, setPasskey] = useState('');
  const [showPasskey, setShowPasskey] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(59);

  // Lockout check

  const [lockoutRemaining, setLockoutRemaining] = useState<number | null>(() => {
    const lockUntil = localStorage.getItem(LOCKOUT_KEY);
    if (lockUntil) {
      const diff = Math.ceil((parseInt(lockUntil, 10) - Date.now()) / 1000);
      return diff > 0 ? diff : null;
    }
    return null;
  });

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input automatically
  useEffect(() => {
    if (!lockoutRemaining) {
      inputRef.current?.focus();
    }
  }, [lockoutRemaining]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemaining === null) return;
    const interval = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev === null || prev <= 1) {
          localStorage.removeItem(LOCKOUT_KEY);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemaining]);

  // 59-second Verification Countdown timer
  useEffect(() => {
    if (lockoutRemaining !== null) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          addAuditLog({
            username: user?.name || 'System Administrator',
            role: user?.role || 'Admin',
            action: 'SECURITY_VERIFICATION_TIMEOUT',
            status: 'Failed',
            severity: 'Medium',
            ipAddress: '127.0.0.1',
            description: 'Security Passkey verification timed out (59s limit reached).'
          });
          addToast('error', 'Verification Timed Out', 'Please try again.');
          onCancel();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutRemaining, onCancel, addToast, addAuditLog, user]);

  const getTimerColor = (sec: number) => {
    if (sec >= 30) return { text: 'text-emerald-400', stroke: '#10b981', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    if (sec >= 10) return { text: 'text-amber-400', stroke: '#f59e0b', bg: 'bg-amber-500/10 border-amber-500/30' };
    return { text: 'text-rose-400', stroke: '#f43f5e', bg: 'bg-rose-500/10 border-rose-500/30' };
  };

  const timerStyle = getTimerColor(timeLeft);
  const strokeDashoffset = 125.6 - (125.6 * timeLeft) / 59;

  const handleVerify = async (e?: React.FormEvent) => {

    if (e) e.preventDefault();
    if (!passkey.trim() || lockoutRemaining !== null || isVerifying) return;

    setIsVerifying(true);
    setErrorMsg('');

    // Capture passkey value now before clearing it
    const enteredPasskey = passkey.trim();

    let responseStatus: number | null = null;
    let backendReachable = false;

    try {
      const baseUrl = getApiUrl();
      const token = localStorage.getItem('floatchat_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${baseUrl}/auth/verify-passkey`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ passkey: enteredPasskey }),
      });

      backendReachable = true;
      responseStatus = response.status;

      if (response.ok) {
        // ✅ Correct passkey — backend confirmed
        setIsVerifying(false);
        addToast('verification_success', 'Verification Successful', 'Administrator Passkey confirmed.');
        addAuditLog({
          username: user?.name || 'System Administrator',
          role: user?.role || 'Admin',
          action: 'SECURITY_VERIFICATION_SUCCESS',
          status: 'Success',
          severity: 'Low',
          ipAddress: '127.0.0.1',
          description: 'Admin passkey verified successfully for elevated SOC access.',
        });
        onSuccess();
        return;
      }

      // Backend responded but passkey was wrong (401) — treat as wrong passkey
      let detail = 'Invalid Security Passkey. Please try again.';
      try {
        const errBody = await response.json();
        if (errBody?.detail) detail = errBody.detail;
      } catch {
        // ignore JSON parse errors
      }
      throw Object.assign(new Error(detail), { isWrongPasskey: true });

    } catch (err: any) {
      setIsVerifying(false);
      setPasskey('');

      // ❌ Network error (CORS, backend unreachable, VITE_API_URL not set, etc.)
      // Distinguish from a wrong-passkey rejection so the user sees the real problem
      if (!backendReachable) {
        const networkMsg = 'Cannot reach the security server. Check your network connection or API configuration.';
        setErrorMsg(networkMsg);
        addAuditLog({
          username: user?.name || 'System Administrator',
          role: user?.role || 'Admin',
          action: 'SECURITY_VERIFICATION_NETWORK_ERROR',
          status: 'Failed',
          severity: 'High',
          ipAddress: '127.0.0.1',
          description: `Security verification network error: ${err?.message || 'fetch failed'}`,
        });
        // Do NOT increment attempt counter for network errors — it's not the user's fault
        return;
      }

      // ❌ Wrong passkey — backend returned 401/400
      const newCount = failedAttempts + 1;
      setFailedAttempts(newCount);

      addAuditLog({
        username: user?.name || 'System Administrator',
        role: user?.role || 'Admin',
        action: 'SECURITY_VERIFICATION_FAILED',
        status: 'Failed',
        severity: 'High',
        ipAddress: '127.0.0.1',
        description: `Invalid passkey attempt #${newCount} (HTTP ${responseStatus ?? 'unknown'})`,
      });

      if (newCount >= 3) {
        const lockUntil = Date.now() + 5 * 60 * 1000;
        localStorage.setItem(LOCKOUT_KEY, lockUntil.toString());
        setLockoutRemaining(300);
        addAuditLog({
          username: user?.name || 'System Administrator',
          role: user?.role || 'Admin',
          action: 'SECURITY_LOCKOUT',
          status: 'Blocked',
          severity: 'Critical',
          ipAddress: '127.0.0.1',
          description: 'Too many failed passkey attempts. Security verification locked for 5 minutes.',
        });
      } else {
        setErrorMsg(err?.message || 'Invalid Security Passkey. Please try again.');
      }
    }
  };


  const formatLockoutTime = (seconds: number) => {

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="w-full max-w-md glass-panel p-7 rounded-3xl border border-rose-500/30 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.9)] bg-slate-900/95 space-y-6 relative overflow-hidden"
      >
        {/* Header & Lockout Guard */}
        {lockoutRemaining !== null ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-8 h-8 animate-bounce" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">Too Many Failed Attempts</h2>
              <p className="text-xs text-rose-300 mt-2 leading-relaxed px-4">
                Security verification has been temporarily locked.<br />Please try again after 5 minutes.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 font-mono text-sm font-bold text-rose-400">
              <Clock className="w-4 h-4" />
              <span>Lockout Remaining: {formatLockoutTime(lockoutRemaining)}</span>
            </div>
            <button
              onClick={onCancel}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.09] transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            {/* Top Bar: Icon + Circular Countdown Timer */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/10">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-1.5">
                    🛡 Security Verification Required
                  </h2>
                  <p className="text-[11px] text-slate-400">Elevated Administrator Passkey Gate</p>
                </div>
              </div>

              {/* SVG Circular Countdown */}
              <div className="relative flex items-center justify-center shrink-0">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle cx="24" cy="24" r="20" stroke="#1e293b" strokeWidth="3" fill="transparent" />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke={timerStyle.stroke}
                    strokeWidth="3"
                    strokeDasharray="125.6"
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <span className={`absolute font-mono text-[11px] font-bold ${timerStyle.text}`}>
                  {timeLeft < 10 ? `0${timeLeft}` : timeLeft}s
                </span>
              </div>
            </div>

            {/* Prompt Text */}
            <p className="text-xs text-slate-300 leading-relaxed">
              Enter the Administrator Security Passkey to access this sensitive area.
            </p>

            {/* Form */}
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-1.5">


                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Security Passkey
                </label>
                <div className="relative group">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-rose-400 transition-colors" />
                  <input
                    ref={inputRef}
                    type={showPasskey ? 'text' : 'password'}
                    value={passkey}
                    onChange={(e) => {
                      setPasskey(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="Enter Security Passkey"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl text-xs bg-white/[0.05] border border-white/[0.1] focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/20 text-slate-100 placeholder-slate-500 focus:outline-none transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasskey(!showPasskey)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPasskey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {errorMsg && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[11px] text-rose-400 font-semibold flex items-center gap-1.5 pt-1"
                  >
                    <XCircle className="w-3.5 h-3.5 shrink-0" /> {errorMsg}
                  </motion.p>
                )}

                {failedAttempts > 0 && failedAttempts < 3 && (
                  <p className="text-[10px] text-amber-400 font-medium">
                    ⚠ Warning: {3 - failedAttempts} attempt(s) remaining before lockout.
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.09] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifying || !passkey.trim()}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-rose-500/20 flex items-center justify-center gap-1.5"
                >
                  {isVerifying ? 'Verifying…' : 'Verify Passkey →'}
                </button>
              </div>
            </form>

            <div className="text-center pt-1 border-t border-white/[0.05]">
              <span className="text-[10px] text-slate-500">
                🔒 59-Second Session Challenge • BCrypt Hashed Validation
              </span>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
};
