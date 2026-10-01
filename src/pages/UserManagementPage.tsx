import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { GlassCard } from '../components/common/GlassCard';
import { RoleBadge } from '../components/common/RoleBadge';
import { ForbiddenPage } from './ForbiddenPage';
import { UserRole, UserStatus } from '../types';
import { 
  Users, UserPlus, Search, ShieldCheck, KeyRound, 
  Trash2, Power, CheckCircle2, XCircle, AlertTriangle,
  UserCheck, UserX, Ban, RefreshCw, Key, Building2,
  Check, X, Shield, Filter, FilterX
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const UserManagementPage: React.FC = () => {
  const { 
    users, govKeys, createUser, deleteUser, approveUser, rejectUser, 
    suspendUser, deactivateUser, activateUser, resetUserPassword, 
    updateUserRole, generateGovKey, deactivateGovKey 
  } = useData();
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'users' | 'gov_keys'>('users');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGovKeyModal, setShowGovKeyModal] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);

  // Form states
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newOrg, setNewOrg] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Researcher');
  const [newStatus, setNewStatus] = useState<UserStatus>('Active');

  // Gov key form
  const [govOrgInput, setGovOrgInput] = useState('INCOIS');
  const [govIssuedTo, setGovIssuedTo] = useState('');

  // RBAC Access Guard
  if (currentUser?.role !== 'Admin') {
    return <ForbiddenPage message="User Management is strictly restricted to System Administrator accounts. You do not have permission to manage accounts or roles." />;
  }

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newName) return;

    createUser({
      name: newName,
      email: newEmail,
      role: newRole,
      organization: newOrg || 'Independent Research',
      status: newStatus,
      mfaEnabled: newRole === 'Admin' || newRole === 'Government',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    });

    addToast('user_created', 'User Account Created', `Provisioned account for ${newEmail} (${newRole})`);
    setShowCreateModal(false);
    setNewEmail('');
    setNewName('');
    setNewOrg('');
  };

  const handleGenerateGovKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!govOrgInput || !govIssuedTo) return;

    const generatedKey = generateGovKey(govOrgInput, govIssuedTo);
    addToast('gov_key_generated', 'Government Access Key Issued', `Generated key ${generatedKey} for ${govOrgInput}`);
    setShowGovKeyModal(false);
    setGovIssuedTo('');
  };

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case 'Active':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">🟢 Active</span>;
      case 'Pending Approval':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-fit animate-pulse">🟡 Pending Approval</span>;
      case 'Suspended':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center gap-1 w-fit">🟠 Suspended</span>;
      case 'Disabled':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1 w-fit">🔴 Disabled</span>;
      case 'Deleted':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-500 border border-slate-700 flex items-center gap-1 w-fit">⚫ Deleted</span>;
    }
  };

  // Filtered Users List
  const filteredUsers = users.filter(u => {
    const queryMatch = 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.organization && u.organization.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!queryMatch) return false;
    if (filterRole !== 'all' && u.role !== filterRole) return false;
    if (filterStatus !== 'all' && u.status !== filterStatus) return false;

    return true;
  });

  const pendingUsersCount = users.filter(u => u.status === 'Pending Approval').length;

  return (
    <div className="space-y-6">
      {/* Header Banner - Enterprise Entra ID Style */}
      <div className="glass-panel p-6 rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-[#071328] via-[#091b36] to-[#041021] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              System Administrator Control Panel
            </span>
            {pendingUsersCount > 0 && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                {pendingUsersCount} Pending Approval
              </span>
            )}
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1 flex items-center gap-2">
            <Users className="w-6 h-6 text-cyan-400" />
            User Identity & Government Access Control
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Approve pending registrations, manage user RBAC roles, reset credentials, configure account suspensions, and issue Government Access Keys.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowGovKeyModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-200 glass-panel hover:bg-slate-800 border border-slate-700 flex items-center gap-2 transition-all"
          >
            <Key className="w-4 h-4 text-cyan-400" /> Issue Gov Key
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:from-ocean-400 hover:to-cyan-400 shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all"
          >
            <UserPlus className="w-4 h-4" /> Provision New User
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Users vs Government Access Keys) */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-2 text-sm font-bold transition-all relative ${
              activeTab === 'users' ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Accounts ({users.length})
            {activeTab === 'users' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />}
          </button>
          <button
            onClick={() => setActiveTab('gov_keys')}
            className={`pb-2 text-sm font-bold transition-all relative ${
              activeTab === 'gov_keys' ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Government Access Keys ({govKeys.length})
            {activeTab === 'gov_keys' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />}
          </button>
        </div>
      </div>

      {activeTab === 'users' ? (
        <>
          {/* Filters & Search Header */}
          <GlassCard hoverEffect={false} className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Search */}
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, email, organization..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-white/[0.04] border border-slate-700/60 focus:border-cyan-500/50 text-slate-100 placeholder-slate-500 focus:outline-none"
                />
              </div>

              {/* Role filter */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-400">Role:</span>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-xs bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none"
                >
                  <option value="all">All Roles</option>
                  <option value="Admin">Administrator</option>
                  <option value="Government">Government Agency</option>
                  <option value="Researcher">Research Scientist</option>
                  <option value="Student">Student / Public</option>
                  <option value="Shipping">Shipping & Maritime</option>
                  <option value="Coastal Guard">Coastal Guard Safety</option>
                </select>
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-400">Status:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-xs bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="Active">🟢 Active</option>
                  <option value="Pending Approval">🟡 Pending Approval</option>
                  <option value="Suspended">🟠 Suspended</option>
                  <option value="Disabled">🔴 Disabled</option>
                  <option value="Deleted">⚫ Deleted</option>
                </select>
              </div>
            </div>
          </GlassCard>

          {/* Users Master Table */}
          <GlassCard hoverEffect={false} className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider bg-slate-900/50">
                    <th className="py-3 px-4">User Details</th>
                    <th className="py-3 px-4">Organization</th>
                    <th className="py-3 px-4">Role Access Level</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4">Last Login</th>
                    <th className="py-3 px-4 text-right">Administrator Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredUsers.map((u) => {
                    const isSelf = currentUser?.email === u.email;

                    return (
                      <tr key={u.id} className="hover:bg-slate-900/80 transition-colors">
                        {/* User Details */}
                        <td className="py-3 px-4 font-semibold text-slate-200 flex items-center gap-3">
                          <img 
                            src={u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'} 
                            alt={u.name} 
                            className="w-8 h-8 rounded-xl object-cover ring-1 ring-cyan-500/30" 
                          />
                          <div>
                            <span className="text-slate-100 block font-bold">{u.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono block">{u.email}</span>
                          </div>
                        </td>

                        {/* Organization */}
                        <td className="py-3 px-4 text-slate-300 font-medium">
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-300">
                            <Building2 className="w-3 h-3 text-cyan-400" />
                            {u.organization || 'Independent Research'}
                          </span>
                        </td>

                        {/* Role Select */}
                        <td className="py-3 px-4">
                          <select
                            disabled={isSelf}
                            value={u.role}
                            onChange={(e) => {
                              const newR = e.target.value as UserRole;
                              updateUserRole(u.id, newR);
                              addToast('role_updated', 'Role Permission Modified', `Updated ${u.name} role to ${newR}`);
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs bg-slate-900 border border-slate-700 text-slate-200 disabled:opacity-50"
                          >
                            <option value="Admin">🔴 System Administrator</option>
                            <option value="Government">🟢 Government Agency</option>
                            <option value="Researcher">🔵 Research Scientist</option>
                            <option value="Student">🟣 Student / Public Access</option>
                            <option value="Shipping">🚢 Shipping & Maritime</option>
                            <option value="Coastal Guard">🛡️ Coastal Guard Safety</option>
                          </select>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4">
                          {getStatusBadge(u.status)}
                        </td>

                        {/* Last Login */}
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{u.lastLogin}</td>

                        {/* Admin Action Buttons */}
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          {/* Account Approval / Rejection buttons if Pending */}
                          {u.status === 'Pending Approval' && !isSelf && (
                            <>
                              <button
                                onClick={() => {
                                  approveUser(u.id);
                                  addToast('user_approved', 'Account Approved', `Approved user account for ${u.email}`);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 text-[10px] font-bold inline-flex items-center gap-1"
                                title="Approve Registration"
                              >
                                <Check className="w-3 h-3" /> Approve
                              </button>
                              <button
                                onClick={() => {
                                  rejectUser(u.id);
                                  addToast('user_rejected', 'Account Rejected', `Rejected registration request for ${u.email}`);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 text-[10px] font-bold inline-flex items-center gap-1"
                                title="Reject Registration"
                              >
                                <X className="w-3 h-3" /> Reject
                              </button>
                            </>
                          )}

                          {/* Activate / Suspend / Deactivate controls for approved accounts */}
                          {u.status !== 'Pending Approval' && !isSelf && (
                            <>
                              {u.status === 'Active' ? (
                                <>
                                  <button
                                    onClick={() => {
                                      suspendUser(u.id);
                                      addToast('info', 'Account Suspended', `Suspended user ${u.name}`);
                                    }}
                                    className="p-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20"
                                    title="Suspend Account"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      deactivateUser(u.id);
                                      addToast('account_disabled', 'Account Disabled', `Disabled user ${u.name}`);
                                    }}
                                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                                    title="Disable Account"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => {
                                    activateUser(u.id);
                                    addToast('info', 'Account Activated', `Activated user ${u.name}`);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 text-[10px] font-bold inline-flex items-center gap-1"
                                  title="Activate Account"
                                >
                                  <Power className="w-3 h-3 text-emerald-400" /> Activate
                                </button>
                              )}
                            </>
                          )}

                          {/* Reset Password */}
                          <button
                            onClick={() => {
                              resetUserPassword(u.id);
                              addToast('info', 'Password Reset Sent', `Reset link dispatched to ${u.email}`);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
                            title="Reset Password"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                          </button>

                          {/* Delete Account */}
                          {!isSelf && (
                            <button
                              onClick={() => {
                                deleteUser(u.id);
                                addToast('info', 'User Account Deleted', `Permanently removed user ${u.name}`);
                              }}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                              title="Delete Account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      ) : (
        /* Government Access Keys Ledger Tab */
        <GlassCard hoverEffect={false} className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-400" /> Issued Government Access Keys Ledger
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Control organization keys required for Government Agency registration.</p>
            </div>

            <button
              onClick={() => setShowGovKeyModal(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:opacity-90 flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5" /> Issue New Key
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider bg-slate-900/50">
                  <th className="py-3 px-4">Government Access Key</th>
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Issued To Officer</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4">Expiration</th>
                  <th className="py-3 px-4">Key Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {govKeys.map((gk) => (
                  <tr key={gk.id} className="hover:bg-slate-900/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-cyan-400">{gk.key}</td>
                    <td className="py-3 px-4 font-semibold text-slate-200">{gk.organization}</td>
                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">{gk.issuedTo}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono">{gk.createdAt}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono">{gk.expiresAt}</td>
                    <td className="py-3 px-4">
                      {gk.status === 'Active' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>
                      ) : gk.status === 'Expired' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Expired</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Deactivated</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {gk.status === 'Active' && (
                        <button
                          onClick={() => {
                            deactivateGovKey(gk.id);
                            addToast('info', 'Government Key Revoked', `Deactivated ${gk.key}`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[10px] font-bold"
                        >
                          Deactivate Key
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Provision New User Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel p-6 rounded-3xl border border-cyan-500/30 max-w-md w-full space-y-4 bg-slate-900/95"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-cyan-400" /> Provision Platform User Account
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Dr. Maya Patel"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white/[0.05] border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Email Address</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="maya.patel@argo-ocean.org"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white/[0.05] border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Organization</label>
                  <input
                    type="text"
                    value={newOrg}
                    onChange={(e) => setNewOrg(e.target.value)}
                    placeholder="e.g. INCOIS / ISRO / MIT"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white/[0.05] border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Role</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none"
                    >
                      <option value="Researcher">Research Scientist</option>
                      <option value="Government">Government Agency</option>
                      <option value="Admin">System Administrator</option>
                      <option value="Student">Student / Public</option>
                      <option value="Shipping">Shipping & Maritime</option>
                      <option value="Coastal Guard">Coastal Guard Safety</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Initial Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as UserStatus)}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none"
                    >
                      <option value="Active">🟢 Active</option>
                      <option value="Pending Approval">🟡 Pending Approval</option>
                      <option value="Suspended">🟠 Suspended</option>
                      <option value="Disabled">🔴 Disabled</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs text-slate-300 bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500"
                  >
                    Provision Account
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Generate Gov Access Key Modal */}
      <AnimatePresence>
        {showGovKeyModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel p-6 rounded-3xl border border-cyan-500/30 max-w-md w-full space-y-4 bg-slate-900/95"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-cyan-400" /> Issue Government Access Key
                </h3>
                <button onClick={() => setShowGovKeyModal(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleGenerateGovKey} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Government Organization</label>
                  <select
                    value={govOrgInput}
                    onChange={(e) => setGovOrgInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-slate-700 text-slate-100"
                  >
                    <option value="INCOIS">INCOIS (Indian National Centre for Ocean Information Services)</option>
                    <option value="ISRO">ISRO (Indian Space Research Organisation)</option>
                    <option value="MoES">MoES (Ministry of Earth Sciences)</option>
                    <option value="IMD">IMD (India Meteorological Department)</option>
                    <option value="NIOT">NIOT (National Institute of Ocean Technology)</option>
                    <option value="DRDO">DRDO (Defence Research and Development Organisation)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Issued To Officer Email</label>
                  <input
                    type="email"
                    required
                    value={govIssuedTo}
                    onChange={(e) => setGovIssuedTo(e.target.value)}
                    placeholder="officer@incois.gov.in"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white/[0.05] border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </div>

                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-300 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Key Format: GOV-{govOrgInput.toUpperCase().slice(0,4)}-XXXX
                  </p>
                  <p className="text-[10px] text-slate-400">
                    This access key is required during registration when selecting the Government Agency role.
                  </p>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowGovKeyModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs text-slate-300 bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500"
                  >
                    Generate & Issue Key
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
