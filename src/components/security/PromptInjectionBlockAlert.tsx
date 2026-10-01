import React from 'react';
import { Shield, Lock, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

interface PromptInjectionBlockAlertProps {
  timestamp?: string;
  className?: string;
}

/**
 * Premium cybersecurity alert card rendered when a prompt injection attempt
 * is intercepted and blocked by ORCA security controls before reaching the LLM.
 */
export const PromptInjectionBlockAlert: React.FC<PromptInjectionBlockAlertProps> = ({
  timestamp,
  className = ''
}) => {
  return (
    <motion.div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`relative w-full max-w-2xl overflow-hidden rounded-[20px] border border-rose-500/30 bg-[#070B18]/95 backdrop-blur-xl p-4 sm:p-5 shadow-[0_4px_24px_rgba(0,0,0,0.45),0_0_25px_rgba(244,63,94,0.08)] transition-all duration-200 ${className}`}
    >
      {/* Subtle top-edge accent glow */}
      <div
        className="pointer-events-none absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-rose-500/50 to-transparent"
        aria-hidden="true"
      />

      {/* Main horizontal layout: Icon on left, Content on right */}
      <div className="flex items-start gap-3.5 sm:gap-4">
        {/* Prominent Shield + Lock Security Icon */}
        <div
          className="relative flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl border border-rose-500/35 bg-gradient-to-br from-rose-500/20 via-rose-600/10 to-pink-950/20 shadow-[0_0_16px_rgba(244,63,94,0.22)]"
          aria-hidden="true"
        >
          <Shield className="h-6 w-6 text-rose-400" strokeWidth={1.8} />
          {/* Layered Lock Badge */}
          <div className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 sm:h-5 sm:w-5 items-center justify-center rounded-full border border-rose-500/50 bg-[#0A0F1F] shadow-sm">
            <Lock className="h-2.5 w-2.5 text-rose-300" strokeWidth={2.4} />
          </div>
        </div>

        {/* Message Content & Visual Hierarchy */}
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Header Badge: SECURITY GATEWAY */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 shadow-[0_0_10px_rgba(244,63,94,0.12)]">
              <ShieldAlert className="h-3 w-3 text-rose-400" strokeWidth={2} />
              <span className="font-mono text-[10px] font-bold tracking-widest text-rose-300 uppercase">
                SECURITY GATEWAY
              </span>
            </div>
          </div>

          {/* Strongest Text: PROMPT INJECTION BLOCKED */}
          <h4 className="pt-0.5 text-sm sm:text-base font-extrabold tracking-wide text-rose-100 drop-shadow-[0_1px_6px_rgba(244,63,94,0.25)]">
            PROMPT INJECTION BLOCKED
          </h4>

          {/* Explanatory Sentence */}
          <p className="text-xs leading-relaxed text-slate-300 font-sans">
            This request was blocked by ORCA security controls before reaching the AI model.
          </p>

          {/* Subtly placed timestamp at bottom-right */}
          {timestamp && (
            <div className="pt-1 text-right">
              <time className="font-mono text-[10px] text-slate-500 select-none">
                {timestamp}
              </time>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
