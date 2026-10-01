import React, { useState, useMemo } from 'react';
import { useDevices } from '../context/DeviceContext';
import { useAuth } from '../context/AuthContext';
import { GlassCard } from '../components/common/GlassCard';
import { DeviceStatusBadge } from '../components/devices/DeviceStatusBadge';
import { ConfirmDialog } from '../components/devices/ConfirmDialog';
import { AddDeviceModal } from '../components/devices/AddDeviceModal';
import { DeviceStatus, DEVICE_STATUS_CONFIG, HardwareDevice } from '../types/devices';
import {
  Plus, Search, Monitor, Battery, Signal, Thermometer,
  Clock, MoreVertical, Eye, History, MapPin, Pencil,
  UserPlus, FolderPlus, RotateCcw, Ban, Trash2,
  Server, Wifi, WifiOff, AlertTriangle, X, CheckCircle2,
} from 'lucide-react';

const STATUS_FILTERS: { key: DeviceStatus | 'all'; label: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'All Devices', icon: Server },
  { key: 'online', label: 'Online', icon: Wifi },
  { key: 'offline', label: 'Offline', icon: WifiOff },
  { key: 'warning', label: 'Warning', icon: AlertTriangle },
  { key: 'critical', label: 'Critical', icon: AlertTriangle },
];

export const DevicesPage: React.FC = () => {
  const { devices, deviceGroups, deleteDevice, disableDevice, enableDevice, restartDevice, assignUserToDevice, assignGroupToDevice } = useDevices();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const [statusFilter, setStatusFilter] = useState<DeviceStatus | 'all'>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Action menus
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Confirmation dialogs
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean; title: string; message: string;
    variant: 'danger' | 'warning'; action: () => void;
  }>({ isOpen: false, title: '', message: '', variant: 'danger', action: () => {} });

  // Assign modals
  const [assignUserModal, setAssignUserModal] = useState<{ deviceId: string; isOpen: boolean }>({ deviceId: '', isOpen: false });
  const [assignGroupModal, setAssignGroupModal] = useState<{ deviceId: string; isOpen: boolean }>({ deviceId: '', isOpen: false });
  const [assignInput, setAssignInput] = useState('');

  // Edit device modal
  const [editModal, setEditModal] = useState<{ device: HardwareDevice | null; isOpen: boolean }>({ device: null, isOpen: false });

  const filtered = useMemo(() => {
    let result = [...devices];
    if (statusFilter !== 'all') result = result.filter(d => d.status === statusFilter);
    if (groupFilter !== 'all') result = result.filter(d => d.groupId === groupFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d =>
        d.name.toLowerCase().includes(q) || d.id.toLowerCase().includes(q) ||
        d.type.toLowerCase().includes(q) || d.assignedUser.toLowerCase().includes(q)
      );
    }
    return result;
  }, [devices, statusFilter, groupFilter, searchQuery]);

  // Summary stats
  const stats = useMemo(() => ({
    total: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    offline: devices.filter(d => d.status === 'offline').length,
    warning: devices.filter(d => d.status === 'warning').length,
    critical: devices.filter(d => d.status === 'critical').length,
  }), [devices]);

  const getGroupName = (groupId: string) => deviceGroups.find(g => g.id === groupId)?.name || 'Unassigned';

  const timeSince = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return `${Math.round(diff / 1000)} seconds ago`;
    if (diff < 3600000) return `${Math.round(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)} hours ago`;
    return `${Math.round(diff / 86400000)} days ago`;
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="glass-panel p-6 rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-900/90 via-navy-900/80 to-ocean-950/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Monitor className="w-7 h-7 text-cyan-400" />
            Device Management
          </h2>
          <p className="text-xs text-slate-300 mt-1">Monitor, configure, and manage all connected hardware devices.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:from-ocean-400 hover:to-cyan-400 shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Device
          </button>
        )}
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-cyan-400', bg: 'bg-cyan-500/10', icon: Server },
          { label: 'Online', value: stats.online, color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: Wifi },
          { label: 'Offline', value: stats.offline, color: 'text-slate-400', bg: 'bg-slate-500/10', icon: WifiOff },
          { label: 'Warning', value: stats.warning, color: 'text-amber-400', bg: 'bg-amber-500/10', icon: AlertTriangle },
          { label: 'Critical', value: stats.critical, color: 'text-rose-400', bg: 'bg-rose-500/10', icon: AlertTriangle },
        ].map((stat, i) => {
          const SIcon = stat.icon;
          return (
            <GlassCard key={i} hoverEffect={false} className="!p-3.5 flex items-center gap-3">
              <div className={`p-2 rounded-xl ${stat.bg}`}>
                <SIcon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div>
                <div className={`text-lg font-extrabold font-mono ${stat.color}`}>{stat.value}</div>
                <div className="text-[10px] text-slate-400 font-semibold">{stat.label}</div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search devices by name, ID, type..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs glass-input placeholder-slate-500"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
                statusFilter === f.key
                  ? 'bg-gradient-to-r from-ocean-600 to-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-slate-400 bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Group filter */}
        <select
          value={groupFilter}
          onChange={e => setGroupFilter(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs glass-input"
        >
          <option value="all">All Groups</option>
          {deviceGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {/* ── Device Cards Grid ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Monitor className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-400">No devices found</p>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or add a new device.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(device => (
            <div
              key={device.id}
              className="glass-panel rounded-2xl p-4 border border-slate-800/60 hover:border-cyan-500/30 transition-all group relative"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2.5 rounded-xl ${
                    device.status === 'critical' ? 'bg-rose-500/10' :
                    device.status === 'warning' ? 'bg-amber-500/10' :
                    device.status === 'online' ? 'bg-emerald-500/10' : 'bg-slate-500/10'
                  }`}>
                    <Monitor className={`w-5 h-5 ${
                      device.status === 'critical' ? 'text-rose-400' :
                      device.status === 'warning' ? 'text-amber-400' :
                      device.status === 'online' ? 'text-emerald-400' : 'text-slate-400'
                    }`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{device.name}</p>
                    <p className="text-[10px] font-mono text-slate-400">{device.id}</p>
                  </div>
                </div>

                {/* Actions dropdown */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === device.id ? null : device.id); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {openMenuId === device.id && (
                    <div className="absolute right-0 top-full mt-1 w-48 glass-panel rounded-xl border border-slate-700/80 shadow-2xl p-1.5 z-50">
                      <button onClick={() => { window.location.hash = `#/devices/${device.id}`; setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition-colors">
                        <Eye className="w-3.5 h-3.5 text-cyan-400" /> View Device
                      </button>
                      <button onClick={() => { window.location.hash = `#/devices/${device.id}?tab=history`; setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition-colors">
                        <History className="w-3.5 h-3.5 text-cyan-400" /> View History
                      </button>
                      <button onClick={() => { window.location.hash = `#/devices/${device.id}?tab=location`; setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition-colors">
                        <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Show Location
                      </button>

                      {isAdmin && (
                        <>
                          <div className="my-1 h-px bg-slate-800" />
                          <button onClick={() => { setEditModal({ device, isOpen: true }); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition-colors">
                            <Pencil className="w-3.5 h-3.5 text-amber-400" /> Edit Device
                          </button>
                          <button onClick={() => { setAssignUserModal({ deviceId: device.id, isOpen: true }); setAssignInput(device.assignedUser); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition-colors">
                            <UserPlus className="w-3.5 h-3.5 text-amber-400" /> Assign User
                          </button>
                          <button onClick={() => { setAssignGroupModal({ deviceId: device.id, isOpen: true }); setAssignInput(device.groupId); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition-colors">
                            <FolderPlus className="w-3.5 h-3.5 text-amber-400" /> Assign Group
                          </button>
                          <button onClick={() => { restartDevice(device.id); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition-colors">
                            <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> Restart Device
                          </button>
                          <div className="my-1 h-px bg-slate-800" />
                          <button onClick={() => {
                            setConfirmState({
                              isOpen: true, variant: 'warning',
                              title: device.isDisabled ? 'Enable Device' : 'Disable Device',
                              message: device.isDisabled
                                ? `Are you sure you want to re-enable ${device.name} (${device.id})?`
                                : `This will take ${device.name} (${device.id}) offline. The device will stop sending telemetry until re-enabled.`,
                              action: () => device.isDisabled ? enableDevice(device.id) : disableDevice(device.id),
                            });
                            setOpenMenuId(null);
                          }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-amber-400 hover:bg-amber-500/10 transition-colors">
                            <Ban className="w-3.5 h-3.5" /> {device.isDisabled ? 'Enable Device' : 'Disable Device'}
                          </button>
                          <button onClick={() => {
                            setConfirmState({
                              isOpen: true, variant: 'danger',
                              title: 'Delete Device',
                              message: `Permanently delete ${device.name} (${device.id})? This action cannot be undone. All associated history and telemetry will be lost.`,
                              action: () => deleteDevice(device.id),
                            });
                            setOpenMenuId(null);
                          }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" /> Delete Device
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Status + Type */}
              <div className="flex items-center gap-2 mt-3">
                <DeviceStatusBadge status={device.status} />
                <span className="text-[10px] text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-full">{device.type}</span>
                <span className="text-[10px] text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-full">{getGroupName(device.groupId)}</span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Battery className="w-3 h-3" /> Battery
                  </div>
                  <span className={`text-xs font-bold font-mono ${device.batteryLevel < 20 ? 'text-rose-400' : device.batteryLevel < 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {device.batteryLevel}%
                  </span>
                </div>
                <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Signal className="w-3 h-3" /> Signal
                  </div>
                  <span className={`text-xs font-bold font-mono ${device.signalStrength < 30 ? 'text-rose-400' : device.signalStrength < 60 ? 'text-amber-400' : 'text-cyan-400'}`}>
                    {device.signalStrength}%
                  </span>
                </div>
                <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Thermometer className="w-3 h-3" /> Temp
                  </div>
                  <span className={`text-xs font-bold font-mono ${device.temperature > 50 ? 'text-rose-400' : device.temperature > 38 ? 'text-amber-400' : 'text-cyan-400'}`}>
                    {device.temperature}°C
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <Clock className="w-3 h-3" />
                  <span>Last seen: {timeSince(device.lastSeen)}</span>
                </div>
                <button
                  onClick={() => { window.location.hash = `#/devices/${device.id}`; }}
                  className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                >
                  Details <Eye className="w-3 h-3" />
                </button>
              </div>

              {device.isDisabled && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] rounded-2xl flex items-center justify-center">
                  <span className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 bg-slate-800 border border-slate-700">DISABLED</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      <AddDeviceModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant}
        confirmLabel={confirmState.title.includes('Delete') ? 'Delete Permanently' : 'Confirm'}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState(s => ({ ...s, isOpen: false }))}
      />

      {/* Assign User Inline Modal */}
      {assignUserModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setAssignUserModal({ deviceId: '', isOpen: false })}>
          <div className="glass-panel rounded-2xl p-5 max-w-sm w-full border border-cyan-500/20 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><UserPlus className="w-4 h-4 text-cyan-400" /> Assign User</h3>
              <button onClick={() => setAssignUserModal({ deviceId: '', isOpen: false })} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <input type="email" value={assignInput} onChange={e => setAssignInput(e.target.value)} placeholder="user@example.com" className="w-full px-3.5 py-2.5 rounded-xl text-xs glass-input mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setAssignUserModal({ deviceId: '', isOpen: false })} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 border border-slate-700">Cancel</button>
              <button onClick={() => { assignUserToDevice(assignUserModal.deviceId, assignInput); setAssignUserModal({ deviceId: '', isOpen: false }); }} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500 shadow-lg">Assign</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Group Inline Modal */}
      {assignGroupModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setAssignGroupModal({ deviceId: '', isOpen: false })}>
          <div className="glass-panel rounded-2xl p-5 max-w-sm w-full border border-cyan-500/20 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><FolderPlus className="w-4 h-4 text-cyan-400" /> Assign Group</h3>
              <button onClick={() => setAssignGroupModal({ deviceId: '', isOpen: false })} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <select value={assignInput} onChange={e => setAssignInput(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl text-xs glass-input mb-4">
              {deviceGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAssignGroupModal({ deviceId: '', isOpen: false })} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 border border-slate-700">Cancel</button>
              <button onClick={() => { assignGroupToDevice(assignGroupModal.deviceId, assignInput); setAssignGroupModal({ deviceId: '', isOpen: false }); }} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500 shadow-lg">Assign</button>
            </div>
          </div>
        </div>
      )}

      {/* Close menu when clicking outside */}
      {openMenuId && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
      )}
    </div>
  );
};
