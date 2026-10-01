import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UserRole, ROLE_CONFIG } from '../types';
import { getApiUrl } from '../utils/api';
import {
  Waves, Eye, EyeOff, ShieldCheck, Lock, Mail,
  ArrowRight, CheckSquare, Square, CheckCircle2,
  XCircle, AlertTriangle, Loader2, Shield, Zap,
  Globe, X, User, Phone, Building2, UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';


/* ──────────────────────────────────────────────────────
   Password helpers
────────────────────────────────────────────────────── */
interface PwdRules {
  minLength: boolean;
  hasUpper:  boolean;
  hasLower:  boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}
function evaluatePassword(pw: string): PwdRules {
  return {
    minLength:  pw.length >= 8,
    hasUpper:   /[A-Z]/.test(pw),
    hasLower:   /[a-z]/.test(pw),
    hasNumber:  /[0-9]/.test(pw),
    hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw),
  };
}

function countPassed(rules: PwdRules) {
  return Object.values(rules).filter(Boolean).length;
}

function isPasswordValid(rules: PwdRules) {
  return Object.values(rules).every(Boolean);
}

function isEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ──────────────────────────────────────────────────────
   Sub-components
────────────────────────────────────────────────────── */
const RuleItem: React.FC<{ passed: boolean; label: string }> = ({ passed, label }) => (
  <div className={`flex items-center gap-2 text-[11px] transition-colors duration-200 ${passed ? 'text-emerald-400' : 'text-rose-400'}`}>
    {passed ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <XCircle className="w-3 h-3 shrink-0" />}
    <span>{label}</span>
  </div>
);

const StrengthBar: React.FC<{ score: number }> = ({ score }) => {
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Strong'];
  const colors  = ['', 'bg-rose-500', 'bg-amber-400', 'bg-yellow-400', 'bg-emerald-400', 'bg-emerald-500'];
  const textCols = ['', 'text-rose-400', 'text-amber-400', 'text-yellow-400', 'text-emerald-400', 'text-emerald-400'];
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${score >= n ? colors[score] : 'bg-slate-700'}`}
          />
        ))}
      </div>
      {score > 0 && (
        <p className={`text-[10px] font-semibold ${textCols[score]}`}>
          Password Strength: {labels[score]}
        </p>
      )}
    </div>
  );
};

/* Animated wave row */
const WaveRow: React.FC<{ delay?: number; opacity?: number }> = ({ delay = 0, opacity = 0.15 }) => (
  <motion.div
    animate={{ x: [0, -60, 0] }}
    transition={{ duration: 12 + delay, repeat: Infinity, ease: 'linear' }}
    style={{ opacity }}
    className="absolute w-[200%] h-full"
  >
    <svg viewBox="0 0 1440 120" className="w-full h-full" preserveAspectRatio="none">
      <path
        d="M0,60 C180,100 360,20 540,60 C720,100 900,20 1080,60 C1260,100 1440,20 1440,60 L1440,120 L0,120 Z"
        fill="currentColor"
        className="text-cyan-400"
      />
    </svg>
  </motion.div>
);

const Orb: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
  <motion.div
    animate={{ y: [-12, 12, -12], opacity: [0.5, 1, 0.5] }}
    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
    style={style}
    className="absolute rounded-full pointer-events-none"
  />
);

const Modal: React.FC<{ children: React.ReactNode; onClose: () => void }> = ({ children, onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md"
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.88, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: 10 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-sm"
    >
      {children}
    </motion.div>
  </motion.div>
);

/* Reusable input field */
const InputField: React.FC<{
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  icon: React.ElementType;
  rightSlot?: React.ReactNode;
}> = ({ id, label, type = 'text', required = true, placeholder, value, onChange, error, icon: Icon, rightSlot }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
      {label}
      {!required && <span className="text-slate-600 font-normal normal-case tracking-normal text-[10px]">(optional)</span>}
    </label>
    <div className="relative group">
      <Icon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs bg-white/[0.05] border ${
          error ? 'border-rose-500/60 focus:ring-rose-500/30' : 'border-white/[0.08] focus:border-cyan-500/50'
        } text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all`}
      />
      {rightSlot}
    </div>
    <AnimatePresence>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="text-[11px] text-rose-400 flex items-center gap-1.5"
        >
          <XCircle className="w-3 h-3 shrink-0" /> {error}
        </motion.p>
      )}
    </AnimatePresence>
  </div>
);

/* ──────────────────────────────────────────────────────
   Allowed self-registration roles (Admin excluded)
────────────────────────────────────────────────────── */
const REGISTER_ROLES: UserRole[] = ['Student', 'Researcher', 'Government'];

const ORG_EXAMPLES = ['INCOIS', 'ISRO', 'ARGO Research Institute', 'State University', 'Government Agency'];

/* ──────────────────────────────────────────────────────
   Main RegisterPage
────────────────────────────────────────────────────── */
export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const { addToast } = useToast();

  const [fullName,   setFullName]   = useState('');
  const [email,      setEmail]      = useState('');
  const [phone,      setPhone]      = useState('');
  const [org,        setOrg]        = useState('');
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [role,       setRole]       = useState<UserRole>('Student');
  const [showPwd,    setShowPwd]    = useState(false);
  const [showConf,   setShowConf]   = useState(false);
  const [pwdFocused, setPwdFocused] = useState(false);
  const [agreed,     setAgreed]     = useState(false);
  const [isLoading,  setIsLoading]  = useState(false);

  const [govOrg,     setGovOrg]     = useState(ORG_EXAMPLES[0]);
  const [accessKey,  setAccessKey]  = useState('');
  const [showAccessKey, setShowAccessKey] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  type ModalKind = 'success' | 'gov_success' | 'duplicate' | 'mismatch' | 'terms' | 'gov_key_empty' | 'gov_key_invalid' | null;
  const [modal, setModal] = useState<ModalKind>(null);

  const pwdRules  = evaluatePassword(password);
  const pwdScore  = countPassed(pwdRules);
  const pwdStrong = isPasswordValid(pwdRules);
  const pwdMatch  = password === confirm && confirm.length > 0;

  const [orgPlaceholder, setOrgPlaceholder] = useState(ORG_EXAMPLES[0]);
  useEffect(() => {
    const id = setInterval(() => {
      setOrgPlaceholder(ORG_EXAMPLES[Math.floor(Math.random() * ORG_EXAMPLES.length)]);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const clearError = (key: string) =>
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!fullName.trim())          errs.fullName = 'Full name is required.';
    if (!email.trim())             errs.email    = 'Email is required.';
    else if (!isEmailValid(email)) errs.email    = 'Please enter a valid email address.';
    if (!org.trim())               errs.org      = 'Organization is required.';
    if (!password)                 errs.password = 'Password is required.';
    else if (!pwdStrong)           errs.password = 'Password must meet all security requirements.';
    if (!confirm)                  errs.confirm  = 'Please confirm your password.';

    if (role === 'Government') {
      if (!accessKey.trim()) {
        setModal('gov_key_empty');
        return;
      }
    }

    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    if (password !== confirm)      { setModal('mismatch'); return; }
    if (!agreed)                   { setModal('terms');    return; }

    setIsLoading(true);

    if (role === 'Government') {
      try {
        const baseUrl = getApiUrl();
        const response = await fetch(`${baseUrl}/auth/verify-gov`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, org: govOrg, access_key: accessKey })
        });

        if (!response.ok) {
          setIsLoading(false);
          setModal('gov_key_invalid');
          return;
        }
        addToast('gov_success', 'Government Verification Successful', 'Authorization confirmed.');
      } catch (err) {
        setIsLoading(false);
        setModal('gov_key_invalid');
        return;
      }
    }

    try {
      await register(fullName.trim(), email.trim(), password, role, org);
      setIsLoading(false);

      if (role === 'Government') {
        setModal('gov_success');
      } else {
        addToast('login_success', 'Account Created in Database', `Welcome to ORCA Marine EcoSystem, ${fullName.split(' ')[0]}!`);
        setModal('success');
      }

      setTimeout(() => {
        window.location.hash = '#/dashboard';
      }, 1500);
    } catch (err: any) {
      setIsLoading(false);
      if (err.message && err.message.toLowerCase().includes('already exists')) {
        setModal('duplicate');
      } else {
        addToast('error', 'Registration Failed', err.message || 'Could not create account');
      }
    }
  };

  return (

    <div className="min-h-screen flex overflow-hidden bg-[#030918] selection:bg-cyan-500 selection:text-white">

      {/* ══════════ LEFT PANEL ══════════ */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] relative overflow-hidden bg-gradient-to-br from-[#030c1e] via-[#041830] to-[#061e40]">

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] rounded-full bg-cyan-600/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-700/10 blur-[140px]" />
        </div>

        <Orb style={{ top: '12%', left: '15%', width: 14, height: 14, background: 'rgba(56,189,248,0.55)', boxShadow: '0 0 24px 6px rgba(56,189,248,0.3)' }} />
        <Orb style={{ top: '38%', left: '72%', width: 10, height: 10, background: 'rgba(6,182,212,0.5)',  boxShadow: '0 0 18px 4px rgba(6,182,212,0.25)' }} />
        <Orb style={{ top: '62%', left: '28%', width:  8, height:  8, background: 'rgba(34,211,238,0.6)', boxShadow: '0 0 16px 4px rgba(34,211,238,0.2)' }} />
        <Orb style={{ top: '82%', left: '68%', width: 12, height: 12, background: 'rgba(56,189,248,0.45)', boxShadow: '0 0 20px 5px rgba(56,189,248,0.2)' }} />

        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />

        <div className="absolute bottom-0 left-0 right-0 h-56 overflow-hidden">
          <div className="relative w-full h-full">
            <WaveRow delay={0} opacity={0.18} />
            <WaveRow delay={3} opacity={0.12} />
            <WaveRow delay={6} opacity={0.08} />
          </div>
        </div>

        <div className="relative z-10 flex flex-col justify-center flex-1 px-14 py-16 space-y-8">

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-700 flex items-center justify-center shadow-2xl shadow-cyan-500/30">
              <Waves className="w-7 h-7 text-white" />
            </div>
            <div>
              <span className="text-2xl font-extrabold text-white tracking-tight">
                ORCA <span className="text-cyan-400">Marine EcoSystem</span>
              </span>
              <div className="text-[10px] uppercase tracking-widest text-cyan-400/70 font-bold mt-0.5">ENTERPRISE V2.4 • OCEAN PLATFORM</div>
            </div>
          </motion.div>

          {/* Hero text */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="space-y-4"
          >
            <h1 className="text-4xl font-black text-white leading-[1.1] tracking-tight">
              Join the<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400">
                Ocean Data
              </span><br />
              Community
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
              Create your account and gain access to millions of ARGO ocean profiles. Query, visualize, and export data with enterprise-grade security.
            </p>
            <p className="text-xs font-bold tracking-widest text-cyan-400/80 uppercase">
              Secure&nbsp;•&nbsp;Intelligent&nbsp;•&nbsp;Reliable
            </p>
          </motion.div>

          {/* Role access tier cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="space-y-2"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              Available Access Tiers
            </p>
            {REGISTER_ROLES.map((r) => {
              const cfg = ROLE_CONFIG[r];
              return (
                <div key={r} className={`flex items-center gap-3 p-2.5 rounded-xl ${cfg.bgClass} border ${cfg.borderClass}`}>
                  <span className="text-lg leading-none">{cfg.emoji}</span>
                  <div>
                    <div className={`text-xs font-semibold ${cfg.textClass}`}>{cfg.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{cfg.permissions.join(' • ')}</div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>

        {/* Bottom security badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="relative z-10 px-14 pb-10 flex items-center gap-3 flex-wrap"
        >
          {['TLS 1.3', 'JWT Auth', 'BCrypt', 'Rate Limited', 'GDPR Ready'].map((b) => (
            <span key={b} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.07]">
              {b}
            </span>
          ))}
        </motion.div>
      </div>

      {/* ══════════ RIGHT PANEL ══════════ */}
      <div className="flex-1 flex items-start justify-center p-6 relative overflow-y-auto">

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-cyan-600/8 blur-[120px]" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-700/8 blur-[120px]" />
        </div>

        <div className="relative z-10 w-full max-w-[460px] py-8">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-2xl shadow-[0_32px_80px_-12px_rgba(0,0,0,0.8)] p-7 space-y-5"
          >

            {/* Card header */}
            <div className="text-center space-y-3">
              <div className="relative mx-auto w-fit">
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-700 flex items-center justify-center shadow-2xl shadow-cyan-500/40"
                >
                  <UserPlus className="w-7 h-7 text-white" />
                </motion.div>
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500" />
                </span>
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">Create ORCA Marine EcoSystem Account</h2>
                <p className="text-xs text-slate-400 mt-1">Join the AI Powered Ocean Data Discovery Platform</p>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-bold text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                🔒 BCrypt Hashed • JWT Ready • Rate Limited
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="space-y-3.5">

              {/* Full Name */}
              <InputField
                id="reg-name"
                label="Full Name"
                placeholder="Dr. Sarah Jenkins"
                value={fullName}
                onChange={(v) => { setFullName(v); clearError('fullName'); }}
                error={errors.fullName}
                icon={User}
              />

              {/* Email */}
              <InputField
                id="reg-email"
                label="Email Address"
                type="email"
                placeholder="name@institution.org"
                value={email}
                onChange={(v) => { setEmail(v); clearError('email'); }}
                error={errors.email}
                icon={Mail}
              />

              {/* Phone + Org side-by-side */}
              <div className="grid grid-cols-2 gap-3">
                <InputField
                  id="reg-phone"
                  label="Phone"
                  type="tel"
                  required={false}
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={setPhone}
                  icon={Phone}
                />
                <InputField
                  id="reg-org"
                  label="Organization"
                  placeholder={orgPlaceholder}
                  value={org}
                  onChange={(v) => { setOrg(v); clearError('org'); }}
                  error={errors.org}
                  icon={Building2}
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                  <input
                    id="reg-password"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearError('password'); }}
                    onFocus={() => setPwdFocused(true)}
                    onBlur={() => setPwdFocused(false)}
                    placeholder="ORCA@2026"
                    className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-xs bg-white/[0.05] border ${
                      errors.password ? 'border-rose-500/60' : 'border-white/[0.08] focus:border-cyan-500/50'
                    } text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all`}
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Strength bar */}
                {password.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <StrengthBar score={pwdScore} />
                  </motion.div>
                )}

                {/* Live rule panel */}
                <AnimatePresence>
                  {(pwdFocused || (password.length > 0 && !pwdStrong)) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-1.5 p-3 rounded-xl bg-slate-900/60 border border-white/[0.07] grid grid-cols-2 gap-1.5">
                        <RuleItem passed={pwdRules.minLength}  label="Min 8 characters" />
                        <RuleItem passed={pwdRules.hasUpper}   label="Uppercase letter" />
                        <RuleItem passed={pwdRules.hasLower}   label="Lowercase letter" />
                        <RuleItem passed={pwdRules.hasNumber}  label="One number" />
                        <RuleItem passed={pwdRules.hasSpecial} label="Special character" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {errors.password && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-[11px] text-rose-400 flex items-center gap-1.5">
                      <XCircle className="w-3 h-3" /> {errors.password}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Confirm Password
                </label>
                <div className="relative group">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                  <input
                    id="reg-confirm"
                    type={showConf ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); clearError('confirm'); }}
                    placeholder="Re-enter password"
                    className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-xs bg-white/[0.05] border ${
                      errors.confirm
                        ? 'border-rose-500/60'
                        : confirm.length > 0
                          ? pwdMatch ? 'border-emerald-500/50' : 'border-rose-500/50'
                          : 'border-white/[0.08] focus:border-cyan-500/50'
                    } text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all`}
                  />
                  <button type="button" onClick={() => setShowConf(!showConf)} tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <AnimatePresence>
                  {confirm.length > 0 && !pwdMatch && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-[11px] text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" /> Passwords do not match yet.
                    </motion.p>
                  )}
                  {pwdMatch && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3" /> Passwords match.
                    </motion.p>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {errors.confirm && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-[11px] text-rose-400 flex items-center gap-1.5">
                      <XCircle className="w-3 h-3" /> {errors.confirm}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Access Role */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex flex-wrap items-center gap-2">
                  Access Role
                  <span className="text-[10px] font-normal normal-case tracking-normal text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    ⚠ Admin accounts require Admin approval
                  </span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2.5 rounded-xl text-xs bg-white/[0.05] border border-white/[0.08] focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/25 focus:outline-none text-slate-100 transition-all appearance-none"
                >
                  {REGISTER_ROLES.map((r) => (
                    <option key={r} value={r} className="bg-slate-900">
                      {ROLE_CONFIG[r].emoji} {ROLE_CONFIG[r].label}
                    </option>
                  ))}
                </select>

                {/* Permission chips for selected role */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {ROLE_CONFIG[role].permissions.map((p) => (
                    <span
                      key={p}
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium
                        ${ROLE_CONFIG[role].bgClass} ${ROLE_CONFIG[role].textClass} ${ROLE_CONFIG[role].borderClass}`}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              {/* Government Additional Fields */}
              <AnimatePresence>
                {role === 'Government' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden space-y-3.5"
                  >
                    <div className="space-y-1.5 pt-2 border-t border-white/[0.05]">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Government Organization
                      </label>
                      <select
                        value={govOrg}
                        onChange={(e) => setGovOrg(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-xs bg-white/[0.05] border border-white/[0.08] focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/25 focus:outline-none text-slate-100 transition-all appearance-none"
                      >
                        {['INCOIS', 'ISRO', 'MoES', 'IMD', 'NIOT', 'DRDO', 'Other'].map((o) => (
                          <option key={o} value={o} className="bg-slate-900">{o}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Access Key
                      </label>
                      <div className="relative group">
                        <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                        <input
                          type={showAccessKey ? 'text' : 'password'}
                          value={accessKey}
                          onChange={(e) => { setAccessKey(e.target.value); clearError('accessKey'); }}
                          placeholder="Enter Government Access Key"
                          className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-xs bg-white/[0.05] border ${
                            errors.accessKey ? 'border-rose-500/60' : 'border-white/[0.08] focus:border-cyan-500/50'
                          } text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all`}
                        />
                        <button type="button" onClick={() => setShowAccessKey(!showAccessKey)} tabIndex={-1}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                          {showAccessKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <AnimatePresence>
                        {errors.accessKey && (
                          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="text-[11px] text-rose-400 flex items-center gap-1.5">
                            <XCircle className="w-3 h-3" /> {errors.accessKey}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Terms & Conditions */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setAgreed(!agreed)}
                  className="flex items-start gap-2.5 text-xs text-slate-400 hover:text-slate-200 transition-colors group text-left"
                >
                  {agreed
                    ? <CheckSquare className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    : <Square className="w-4 h-4 text-slate-600 shrink-0 mt-0.5 group-hover:text-slate-400" />}
                  <span>
                    I agree to the{' '}
                    <span className="text-cyan-400 hover:underline cursor-pointer">Terms and Conditions</span>
                    {' '}and{' '}
                    <span className="text-cyan-400 hover:underline cursor-pointer">Privacy Policy</span>
                    {'.'}{' '}
                    <span className="text-rose-400">Required *</span>
                  </span>
                </button>
              </div>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: isLoading ? 1 : 1.015 }}
                whileTap={{ scale: isLoading ? 1 : 0.985 }}
                className="relative w-full py-3 rounded-xl font-bold text-sm text-white overflow-hidden transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-1"
                style={{ background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 50%, #06b6d4 100%)' }}
              >
                {!isLoading && (
                  <motion.div
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '200%' }}
                    transition={{ duration: 0.55 }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
                  />
                )}
                <span className="relative flex items-center justify-center gap-2">
                  {isLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating Account…</>
                    : <>Create Account <ArrowRight className="w-4 h-4" /></>
                  }
                </span>
              </motion.button>
            </form>

            {/* Footer */}
            <div className="pt-4 border-t border-white/[0.07] text-center space-y-1">
              <p className="text-[11px] text-slate-500">Already have an account?</p>
              <a href="#/login"
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors">
                Sign In to ORCA Marine EcoSystem <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Security footer row */}
            <div className="flex items-center justify-center gap-4 flex-wrap">
              {[
                { icon: Shield,      label: 'BCrypt Hash' },
                { icon: ShieldCheck, label: 'JWT Ready' },
                { icon: Zap,         label: 'Rate Limited' },
                { icon: Globe,       label: 'HTTPS Ready' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                  <Icon className="w-3 h-3" /> {label}
                </div>
              ))}
            </div>
          </motion.div>

          <p className="mt-5 text-center text-[11px] text-slate-600">
            © 2026 ORCA Marine EcoSystem — ARGO Ocean Data Platform v2.4.0
          </p>
        </div>
      </div>

      {/* ══════════ MODALS ══════════ */}
      <AnimatePresence>

        {/* Success */}
        {modal === 'success' && (
          <Modal onClose={() => {}}>
            <div className="rounded-2xl bg-[#0d1628] border border-emerald-500/30 shadow-2xl p-6 space-y-5 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center"
              >
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </motion.div>
              <div>
                <h3 className="text-base font-bold text-white">Account Created Successfully!</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Welcome to ORCA Marine EcoSystem,{' '}
                  <span className="text-emerald-400 font-semibold">{fullName.split(' ')[0]}</span>!
                  <br />Your account is ready. You can now log in.
                </p>
              </div>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border
                ${ROLE_CONFIG[role].bgClass} ${ROLE_CONFIG[role].textClass} ${ROLE_CONFIG[role].borderClass}`}>
                {ROLE_CONFIG[role].emoji} {ROLE_CONFIG[role].label}
              </div>
              <a href="#/login"
                className="block w-full py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:opacity-90 transition-opacity text-center">
                Go to Login →
              </a>
            </div>
          </Modal>
        )}

        {/* Duplicate email */}
        {modal === 'duplicate' && (
          <Modal onClose={() => setModal(null)}>
            <div className="rounded-2xl bg-[#0d1628] border border-amber-500/30 shadow-2xl p-6 space-y-4 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Account Already Exists</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  An account with{' '}
                  <span className="text-amber-400 font-semibold">{email}</span>{' '}
                  already exists. Please login instead.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setModal(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.09] transition-colors">
                  Close
                </button>
                <a href="#/login"
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:opacity-90 transition-opacity text-center">
                  Go to Login
                </a>
              </div>
            </div>
          </Modal>
        )}

        {/* Password mismatch */}
        {modal === 'mismatch' && (
          <Modal onClose={() => setModal(null)}>
            <div className="rounded-2xl bg-[#0d1628] border border-rose-500/30 shadow-2xl p-6 space-y-4 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center">
                <XCircle className="w-7 h-7 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Passwords Do Not Match</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Your password and confirm password fields do not match.
                  <br />Please re-enter them carefully.
                </p>
              </div>
              <button
                onClick={() => { setModal(null); setConfirm(''); }}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-rose-500 hover:opacity-90 transition-opacity"
              >
                Re-enter Password
              </button>
            </div>
          </Modal>
        )}

        {/* Terms not agreed */}
        {modal === 'terms' && (
          <Modal onClose={() => setModal(null)}>
            <div className="rounded-2xl bg-[#0d1628] border border-cyan-500/30 shadow-2xl p-6 space-y-4 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Terms Required</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  You must agree to the Terms and Conditions to create an account.
                </p>
              </div>
              <button
                onClick={() => { setModal(null); setAgreed(true); }}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:opacity-90 transition-opacity"
              >
                I Agree — Continue
              </button>
              <button onClick={() => setModal(null)}
                className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                Cancel
              </button>
            </div>
          </Modal>
        )}

        {/* Government Empty Key */}
        {modal === 'gov_key_empty' && (
          <Modal onClose={() => setModal(null)}>
            <div className="rounded-2xl bg-[#0d1628] border border-amber-500/30 shadow-2xl p-6 space-y-4 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Access Key Required</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Government Access Key is required.
                </p>
              </div>
              <button
                onClick={() => setModal(null)}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-amber-500 hover:opacity-90 transition-opacity"
              >
                OK
              </button>
            </div>
          </Modal>
        )}

        {/* Government Invalid Key */}
        {modal === 'gov_key_invalid' && (
          <Modal onClose={() => setModal(null)}>
            <div className="rounded-2xl bg-[#0d1628] border border-rose-500/30 shadow-2xl p-6 space-y-4 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center">
                <XCircle className="w-7 h-7 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Access Denied</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Invalid Government Access Key. <br/>
                  Only authorized government organizations can create Government accounts.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setModal(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.09] transition-colors">
                  Cancel
                </button>
                <button onClick={() => setModal(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-rose-500 hover:opacity-90 transition-opacity">
                  Retry
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Government Success Registration */}
        {modal === 'gov_success' && (
          <Modal onClose={() => {}}>
            <div className="rounded-2xl bg-[#0d1628] border border-emerald-500/30 shadow-2xl p-6 space-y-5 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center"
              >
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </motion.div>
              <div>
                <h3 className="text-base font-bold text-white">Government Account Created Successfully</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Your account has been verified. <br/>
                  Please login.
                </p>
              </div>
              <a href="#/login"
                className="block w-full py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:opacity-90 transition-opacity text-center">
                Go to Login →
              </a>
            </div>
          </Modal>
        )}

      </AnimatePresence>
    </div>
  );
};
