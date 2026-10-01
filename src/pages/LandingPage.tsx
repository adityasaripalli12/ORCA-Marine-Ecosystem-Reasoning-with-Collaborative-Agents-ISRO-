import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Waves, Sparkles, ShieldCheck, Database, Cpu, Lock, 
  ArrowRight, Compass, Activity, Server, FileCode, CheckCircle2,
  Globe, Layers, ChevronRight, Play, X, BarChart3, MessageSquare, Search, 
  LayoutDashboard, Bot, Heart, Users, TrendingUp, Anchor, ShieldAlert
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('home');
  const [stats, setStats] = useState({ datasets: 0, queries: 0, profiles: 0, blocked: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        datasets: Math.min(prev.datasets + 150, 12450),
        queries: Math.min(prev.queries + 300, 48500),
        profiles: Math.min(prev.profiles + 1500, 142000),
        blocked: Math.min(prev.blocked + 20, 1204)
      }));
    }, 20);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#020917] text-slate-100 overflow-x-hidden selection:bg-cyan-500 selection:text-white relative font-sans">
      
      {/* ───────────────────────────────────────────────────────────
          HERO WRAPPER WITH BACKGROUND OCEAN & ORCA
          ─────────────────────────────────────────────────────────── */}
      <div className="relative min-h-screen lg:h-screen lg:max-h-screen flex flex-col justify-between overflow-hidden">
        
        {/* Background Photo Image with cinematic overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0 transition-all duration-700"
          style={{ backgroundImage: `url('/orca_ocean_hero.jpg')` }}
        >
          {/* Multi-layered cinematic gradient overlays */}
          {/* Top subtle vignette for navbar readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#020917]/80 via-transparent to-[#020917]/95" />
          
          {/* Left vignette for crisp text contrast */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#020917]/90 via-[#020917]/60 md:via-[#020917]/35 to-transparent" />
          
          {/* Cyan water tint & subtle ambient glow */}
          <div className="absolute inset-0 bg-cyan-950/20 mix-blend-color" />

          {/* Underwater God Rays animation overlay */}
          <div className="absolute inset-0 opacity-25 pointer-events-none overflow-hidden">
            <div className="absolute top-[-40%] left-[20%] w-[140%] h-[180%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-300/30 via-sky-600/10 to-transparent rotate-12 blur-3xl" />
          </div>

          {/* Floating Bioluminescent Plankton Particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 24 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-cyan-300/60 blur-[1px]"
                style={{
                  width: (i % 3 === 0 ? 3 : i % 2 === 0 ? 2 : 1.5) + 'px',
                  height: (i % 3 === 0 ? 3 : i % 2 === 0 ? 2 : 1.5) + 'px',
                  left: (i * 4.2 + (i % 5) * 2) + '%',
                  top: ((i * 7.7) % 100) + '%',
                }}
                animate={{
                  y: [0, -60, 0],
                  x: [0, (i % 2 === 0 ? 15 : -15), 0],
                  opacity: [0.2, 0.8, 0.2],
                }}
                transition={{
                  duration: 8 + (i % 6) * 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.4
                }}
              />
            ))}
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────
            TOP NAVIGATION BAR
            ─────────────────────────────────────────────────────────── */}
        <header className="relative z-50 w-full px-6 lg:px-12 pt-5">
          <div className="max-w-[1550px] mx-auto flex items-center justify-between">
            
            {/* Left: Brand Identity */}
            <a href="#/" className="flex items-center gap-3.5 group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 group-hover:scale-105 transition-transform duration-300 shrink-0">
                <Waves className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <div className="flex items-baseline leading-none">
                  <span className="font-extrabold text-xl lg:text-2xl tracking-tight text-white">ORCA </span>
                  <span className="font-extrabold text-xl lg:text-2xl tracking-tight text-cyan-400 ml-1.5">Marine EcoSystem</span>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 mt-1">
                  ENTERPRISE V2.4 • OCEAN PLATFORM
                </div>
              </div>
            </a>

            {/* Center: Navigation Links */}
            <nav className="hidden lg:flex items-center gap-7 xl:gap-8 text-[14px] font-medium text-slate-300">
              <a 
                href="#/" 
                onClick={() => setActiveNav('home')}
                className={`transition-colors relative py-1 ${activeNav === 'home' ? 'text-cyan-400 font-semibold' : 'hover:text-cyan-300'}`}
              >
                Home
                {activeNav === 'home' && (
                  <motion.div 
                    layoutId="activeNavIndicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee]"
                  />
                )}
              </a>
              <a href="#features" onClick={() => setActiveNav('features')} className={`hover:text-cyan-300 transition-colors ${activeNav === 'features' ? 'text-cyan-400' : ''}`}>Features</a>
              <a href="#/datasets" onClick={() => setActiveNav('data')} className={`hover:text-cyan-300 transition-colors ${activeNav === 'data' ? 'text-cyan-400' : ''}`}>Data</a>
              <a href="#/flowchat-ai" onClick={() => setActiveNav('ai-agents')} className={`hover:text-cyan-300 transition-colors ${activeNav === 'ai-agents' ? 'text-cyan-400' : ''}`}>AI Agents</a>
              <a href="#impact" onClick={() => setActiveNav('impact')} className={`hover:text-cyan-300 transition-colors ${activeNav === 'impact' ? 'text-cyan-400' : ''}`}>Impact</a>
              <a href="#about" onClick={() => setActiveNav('about')} className={`hover:text-cyan-300 transition-colors ${activeNav === 'about' ? 'text-cyan-400' : ''}`}>About</a>
              <a href="#contact" onClick={() => setActiveNav('contact')} className={`hover:text-cyan-300 transition-colors ${activeNav === 'contact' ? 'text-cyan-400' : ''}`}>Contact</a>
            </nav>

            {/* Right: Authentication Buttons */}
            <div className="flex items-center gap-3">
              <a
                href="#/login"
                className="px-5 lg:px-6 py-2 rounded-xl text-xs lg:text-sm font-semibold text-slate-100 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 border border-slate-700/80 backdrop-blur-md transition-all shadow-sm"
              >
                Sign In
              </a>
              <a
                href="#/register"
                className="px-5 lg:px-6 py-2 rounded-xl text-xs lg:text-sm font-bold text-white bg-[#00a8e8] hover:bg-[#0096d1] transition-all shadow-[0_0_24px_rgba(0,168,232,0.55)] hover:shadow-[0_0_32px_rgba(0,168,232,0.8)]"
              >
                Create Account
              </a>
            </div>

          </div>
        </header>

        {/* ───────────────────────────────────────────────────────────
            HERO MAIN CONTENT AREA (Left Headline + Floating Overlays)
            ─────────────────────────────────────────────────────────── */}
        <div className="relative z-40 max-w-[1550px] mx-auto px-6 lg:px-12 w-full py-6 lg:py-4 flex-1 flex flex-col justify-center">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            
            {/* Left Column (Span 6): Typography & Primary CTAs */}
            <div className="lg:col-span-6 space-y-6 z-20">
              
              {/* Pill Badge */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-cyan-400/40 bg-slate-950/60 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.2)]"
              >
                <Waves className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold tracking-wide text-cyan-300">
                  Intelligent Marine Intelligence Platform
                </span>
              </motion.div>

              {/* Main Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-[62px] xl:text-[72px] font-extrabold text-white tracking-tight leading-[1.08]"
              >
                Dive into <br />
                <span className="text-[#00c2ff]">a Safer, Smarter</span> <br />
                Ocean
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-sm sm:text-base lg:text-lg text-slate-300/90 leading-relaxed font-normal max-w-xl"
              >
                AI-Powered Marine Data Analysis, Monitoring and Prediction Platform
              </motion.p>

              {/* Call to Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-wrap items-center gap-4 pt-1"
              >
                <a
                  href="#/dashboard"
                  className="px-7 lg:px-8 py-3 lg:py-3.5 rounded-full font-bold text-sm lg:text-base text-white bg-[#00a8e8] hover:bg-[#0096d1] shadow-[0_0_35px_rgba(0,168,232,0.65)] hover:shadow-[0_0_48px_rgba(0,168,232,0.85)] transition-all flex items-center gap-2.5 group"
                >
                  <span>🚀 Let's Explore</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>

                <a
                  href="#/register"
                  className="px-7 lg:px-8 py-3 lg:py-3.5 rounded-full font-semibold text-sm lg:text-base text-slate-200 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 border border-slate-700/80 backdrop-blur-md transition-all"
                >
                  Create Account
                </a>
              </motion.div>
            </div>

            {/* Right Column (Span 6): Floating Glass Cards over the Ocean & Orca */}
            <div className="lg:col-span-6 relative h-[420px] lg:h-[460px] xl:h-[500px] w-full">
              
              {/* Floating Card 1: Marine Data Analytics (Top Center) */}
              <motion.a
                href="#/datasets"
                initial={{ opacity: 0, y: -20 }}
                animate={{ 
                  opacity: 1, 
                  y: [0, -7, 0],
                }}
                transition={{ 
                  opacity: { duration: 0.7, delay: 0.2 },
                  y: { duration: 4.5, repeat: Infinity, ease: "easeInOut" }
                }}
                className="absolute top-[6%] left-[6%] xl:left-[12%] z-20 group"
              >
                <div className="glass-panel border border-cyan-500/30 hover:border-cyan-400 bg-[#06142e]/75 backdrop-blur-md rounded-2xl px-4 py-2.5 flex items-center gap-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] group-hover:shadow-[0_10px_35px_rgba(6,182,212,0.3)] group-hover:scale-105 transition-all duration-300">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-cyan-300 group-hover:bg-blue-600/50 transition-colors">
                    <Waves className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-white text-xs lg:text-sm whitespace-nowrap">Marine Data Analytics</span>
                </div>
              </motion.a>

              {/* Floating Card 2: Marine Threat Detection (Mid Right) */}
              <motion.a
                href="#/security"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  y: [0, 7, 0],
                }}
                transition={{ 
                  opacity: { duration: 0.7, delay: 0.35 },
                  scale: { duration: 0.7, delay: 0.35 },
                  y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }
                }}
                className="absolute top-[34%] left-[24%] xl:left-[32%] z-20 group"
              >
                <div className="glass-panel border border-indigo-500/30 hover:border-indigo-400 bg-[#0b1335]/75 backdrop-blur-md rounded-2xl px-4 py-2.5 flex items-center gap-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] group-hover:shadow-[0_10px_35px_rgba(99,102,241,0.3)] group-hover:scale-105 transition-all duration-300">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 group-hover:bg-indigo-600/50 transition-colors">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-white text-xs lg:text-sm whitespace-nowrap">Marine Threat Detection</span>
                </div>
              </motion.a>

              {/* Floating Card 3: AI Marine Assistant (Far Right) */}
              <motion.a
                href="#/flowchat-ai"
                initial={{ opacity: 0, x: 20 }}
                animate={{ 
                  opacity: 1, 
                  x: 0,
                  y: [0, -6, 0],
                }}
                transition={{ 
                  opacity: { duration: 0.7, delay: 0.45 },
                  y: { duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 1 }
                }}
                className="absolute top-[30%] right-[0%] z-20 group"
              >
                <div className="glass-panel border border-teal-500/30 hover:border-teal-400 bg-[#041a27]/75 backdrop-blur-md rounded-2xl px-4 py-2.5 flex items-center gap-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] group-hover:shadow-[0_10px_35px_rgba(20,184,166,0.3)] group-hover:scale-105 transition-all duration-300">
                  <div className="w-9 h-9 rounded-xl bg-teal-600/30 border border-teal-400/40 flex items-center justify-center text-teal-300 group-hover:bg-teal-600/50 transition-colors">
                    <Bot className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-white text-xs lg:text-sm whitespace-nowrap">AI Marine Assistant</span>
                </div>
              </motion.a>

              {/* Floating Card 4: Ocean Maps & Visualization (Bottom Left/Mid) */}
              <motion.a
                href="#/visualization"
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity: 1, 
                  y: [0, -6, 0],
                }}
                transition={{ 
                  opacity: { duration: 0.7, delay: 0.55 },
                  y: { duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 1.5 }
                }}
                className="absolute bottom-[22%] left-[8%] xl:left-[16%] z-20 group"
              >
                <div className="glass-panel border border-rose-500/30 hover:border-rose-400 bg-[#1c0e25]/75 backdrop-blur-md rounded-2xl px-4 py-2.5 flex items-center gap-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] group-hover:shadow-[0_10px_35px_rgba(244,63,94,0.3)] group-hover:scale-105 transition-all duration-300">
                  <div className="w-9 h-9 rounded-xl bg-rose-600/30 border border-rose-400/40 flex items-center justify-center text-rose-300 group-hover:bg-rose-600/50 transition-colors">
                    <Globe className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-white text-xs lg:text-sm whitespace-nowrap">Ocean Maps & Visualization</span>
                </div>
              </motion.a>

              {/* Floating Card 5: Real-time Monitoring (Bottom Right) */}
              <motion.a
                href="#/dashboard"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  y: [0, 6, 0],
                }}
                transition={{ 
                  opacity: { duration: 0.7, delay: 0.65 },
                  y: { duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 0.8 }
                }}
                className="absolute bottom-[10%] right-[3%] xl:right-[8%] z-20 group"
              >
                <div className="glass-panel border border-amber-500/30 hover:border-amber-400 bg-[#241a0b]/75 backdrop-blur-md rounded-2xl px-4 py-2.5 flex items-center gap-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] group-hover:shadow-[0_10px_35px_rgba(245,158,11,0.3)] group-hover:scale-105 transition-all duration-300">
                  <div className="w-9 h-9 rounded-xl bg-amber-600/30 border border-amber-400/40 flex items-center justify-center text-amber-300 group-hover:bg-amber-600/50 transition-colors">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-white text-xs lg:text-sm whitespace-nowrap">Real-time Monitoring</span>
                </div>
              </motion.a>

            </div>

          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────
            BOTTOM VALUE PROPOSITIONS BAR
            ─────────────────────────────────────────────────────────── */}
        <div className="relative z-40 w-full border-t border-slate-800/80 bg-[#020b1c]/80 backdrop-blur-xl">
          <div className="max-w-[1550px] mx-auto px-6 lg:px-12 py-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 lg:divide-x lg:divide-slate-800/80">
            
            {/* Item 1: Healthier Oceans */}
            <div className="flex items-center gap-4 lg:px-6">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Healthier Oceans</h4>
                <p className="text-xs text-slate-400 mt-0.5">For a Better Tomorrow</p>
              </div>
            </div>

            {/* Item 2: Data-Driven Decisions */}
            <div className="flex items-center gap-4 lg:px-6">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Data-Driven Decisions</h4>
                <p className="text-xs text-slate-400 mt-0.5">For Sustainable Growth</p>
              </div>
            </div>

            {/* Item 3: Protect Marine Life */}
            <div className="flex items-center gap-4 lg:px-6">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Protect Marine Life</h4>
                <p className="text-xs text-slate-400 mt-0.5">For Future Generations</p>
              </div>
            </div>

            {/* Item 4: Empower Communities */}
            <div className="flex items-center gap-4 lg:px-6">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Empower Communities</h4>
                <p className="text-xs text-slate-400 mt-0.5">Through Ocean Intelligence</p>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* ───────────────────────────────────────────────────────────
          PLATFORM CAPABILITIES / FEATURES SECTION
          ─────────────────────────────────────────────────────────── */}
      <section id="features" className="relative z-30 max-w-7xl mx-auto px-6 py-28 border-t border-slate-800/60">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-semibold text-cyan-300 uppercase tracking-widest">
            Capabilities
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white">Platform Capabilities</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            High-performance scientific tools engineered for modern marine research and operations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { icon: MessageSquare, title: 'AI Conversational Agent', desc: 'Query massive ocean datasets in English, Hindi, and Telugu with LLM natural language analysis.', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', link: '#/flowchat-ai' },
            { icon: Globe, title: 'Ocean Maps & Visualization', desc: 'Interactive Leaflet 3D/2D maps with real-time ARGO float trajectory, salinity, and temperature layers.', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', link: '#/visualization' },
            { icon: Search, title: 'FAISS Vector Search', desc: 'Sub-millisecond semantic retrieval across millions of oceanographic profiles and research citations.', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', link: '#/datasets' },
            { icon: Database, title: 'PostgreSQL Architecture', desc: 'Optimized relational schema supporting multi-year ARGO NetCDF matrices with SHA-256 integrity verification.', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', link: '#/datasets' },
            { icon: ShieldCheck, title: 'Cyber Security & WAF', desc: 'Enterprise RBAC, JWT tokens, Prompt Injection Detection, SQL injection filters, and complete audit logs.', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', link: '#/security' },
            { icon: LayoutDashboard, title: 'Operational Dashboard', desc: 'Live telemetric telemetry, sensor status monitors, active floats, and maritime anomaly alerts.', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', link: '#/dashboard' }
          ].map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <motion.a 
                href={feature.link}
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className={`glass-panel p-8 rounded-3xl border ${feature.border} hover:bg-slate-900/90 transition-all group relative overflow-hidden block shadow-lg hover:shadow-cyan-500/10`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className={`w-14 h-14 rounded-2xl ${feature.bg} flex items-center justify-center mb-6 border border-white/5`}>
                  <Icon className={`w-7 h-7 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-cyan-300 transition-colors flex items-center justify-between">
                  {feature.title}
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
              </motion.a>
            )
          })}
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          SYSTEM ARCHITECTURE SECTION
          ─────────────────────────────────────────────────────────── */}
      <section id="architecture" className="relative z-30 max-w-7xl mx-auto px-6 py-28 border-t border-slate-800/60">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-semibold text-cyan-300 uppercase tracking-widest">
            Pipeline
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white">System Architecture</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">An advanced data-intelligence pipeline from raw NetCDF to Interactive Analytics.</p>
        </div>

        <div className="glass-panel p-8 md:p-12 rounded-3xl border border-slate-700/50 relative overflow-hidden bg-slate-950/70">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
            {[
              { label: 'NetCDF Upload', icon: FileCode },
              { label: 'Validation', icon: ShieldCheck },
              { label: 'PostgreSQL', icon: Database },
              { label: 'FAISS Index', icon: Search },
              { label: 'LangChain', icon: Layers },
              { label: 'Groq LLM', icon: Cpu },
              { label: 'Visualization', icon: BarChart3 }
            ].map((step, idx, arr) => (
              <React.Fragment key={idx}>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)] z-10 relative">
                    <step.icon className="w-8 h-8" />
                  </div>
                  <span className="text-xs font-bold text-slate-300 text-center w-24">{step.label}</span>
                </motion.div>
                {idx < arr.length - 1 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="hidden md:block w-full h-1 bg-gradient-to-r from-cyan-500/50 to-blue-500/50 relative rounded-full"
                  >
                    <motion.div 
                      className="absolute top-0 left-0 h-full w-4 bg-white rounded-full shadow-[0_0_10px_white]"
                      animate={{ left: ['0%', '100%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: idx * 0.2 }}
                    />
                  </motion.div>
                )}
                {idx < arr.length - 1 && (
                  <div className="md:hidden h-8 w-1 bg-cyan-500/30"></div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          ENTERPRISE SECURITY SECTION
          ─────────────────────────────────────────────────────────── */}
      <section id="security" className="relative z-30 max-w-7xl mx-auto px-6 py-28 border-t border-slate-800/60">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-300 uppercase tracking-widest">
            Security Shield
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white">Enterprise Security & Defense</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">Rigorous compliance and zero-trust safeguards safeguarding ocean research data.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            'JWT Authentication', 'Role-Based Access Control', 'HTTPS / TLS 1.3', 
            'SHA-256 Integrity Verification', 'Prompt Injection Detection', 
            'SQL Injection Protection', 'System Audit Logs', 'Zero-Trust Architecture'
          ].map((sec, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
              className="glass-panel p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-3 hover:bg-emerald-500/10 transition-colors"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-slate-200">{sec}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          STATISTICS COUNTER
          ─────────────────────────────────────────────────────────── */}
      <section className="relative z-30 max-w-7xl mx-auto px-6 py-24 border-t border-slate-800/60">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { label: 'Datasets Processed', value: stats.datasets.toLocaleString() },
            { label: 'AI Queries Handled', value: stats.queries.toLocaleString() },
            { label: 'Ocean Profiles Indexed', value: stats.profiles.toLocaleString() },
            { label: 'Threats Intercepted', value: stats.blocked.toLocaleString() }
          ].map((stat, idx) => (
            <div key={idx} className="text-center space-y-2 glass-panel py-8 px-4 rounded-3xl border border-slate-800/80 bg-slate-900/40">
              <div className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          ABOUT SECTION
          ─────────────────────────────────────────────────────────── */}
      <section id="about" className="relative z-30 max-w-4xl mx-auto px-6 py-28 border-t border-slate-800/60 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto mb-2 shadow-[0_0_25px_rgba(6,182,212,0.3)]">
          <Waves className="w-8 h-8" />
        </div>
        <h2 className="text-3xl md:text-4xl font-extrabold text-white">About ORCA Marine EcoSystem</h2>
        <p className="text-lg text-slate-300 leading-relaxed">
          ORCA Marine EcoSystem is an innovative AI-powered conversational platform designed for ocean data discovery, analysis, and visualization. By bridging deep-sea telemetry with LLMs, ORCA empowers researchers, maritime authorities, and students to query, monitor, and visualize ocean profiles in real-time, delivering actionable ocean intelligence.
        </p>
      </section>

      {/* ───────────────────────────────────────────────────────────
          FOOTER
          ─────────────────────────────────────────────────────────── */}
      <footer id="contact" className="relative z-30 border-t border-slate-800/80 bg-[#020713] py-14 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left space-y-2 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20 shrink-0">
              <Waves className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-extrabold text-white">ORCA </span>
                <span className="text-lg font-extrabold text-cyan-400">Marine EcoSystem</span>
                <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-semibold uppercase">Platform</span>
              </div>
              <p className="text-xs text-slate-400">ENTERPRISE V2.4 • OCEAN PLATFORM &middot; Built for Next-Gen Oceanography</p>
            </div>
          </div>
          
          <div className="flex flex-wrap justify-center items-center gap-5 text-xs font-medium text-slate-400">
            <a href="#/login" className="hover:text-cyan-400 transition-colors">Sign In</a>
            <a href="#/register" className="hover:text-cyan-400 transition-colors">Register</a>
            <a href="#/dashboard" className="hover:text-cyan-400 transition-colors">Dashboard</a>
            <a href="#/flowchat-ai" className="hover:text-cyan-400 transition-colors">ORCA AI</a>
            <a href="#/visualization" className="hover:text-cyan-400 transition-colors">Maps</a>
          </div>
        </div>
      </footer>

      {/* Demo Modal */}
      <AnimatePresence>
        {isDemoModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full relative shadow-2xl"
            >
              <button 
                onClick={() => setIsDemoModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">ORCA Overview</h3>
                <p className="text-slate-400 text-sm">Discover how we transform ocean data analysis.</p>
              </div>
              <div className="aspect-video bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-slate-500">
                <Play className="w-16 h-16 text-slate-700 mb-4" />
                <p>Interactive System Preview</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
