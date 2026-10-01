import React, { useState } from 'react';
import { X, Plus, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DeviceType, DeviceStatus } from '../../types/devices';
import { useDevices } from '../../context/DeviceContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const DEVICE_TYPES: DeviceType[] = [
  'IoT Sensor', 'Environmental Monitor', 'Security Camera', 'Field Device',
  'Gateway', 'Edge Node', 'Weather Station', 'Marine Buoy',
];

export const AddDeviceModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { addDevice, deviceGroups } = useDevices();
  const [form, setForm] = useState({
    name: '', type: 'IoT Sensor' as DeviceType,
    description: '', assignedUser: '', groupId: 'grp-dev',
    firmwareVersion: 'v1.0.0', latitude: '', longitude: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    addDevice({
      name: form.name,
      type: form.type,
      status: 'online' as DeviceStatus,
      batteryLevel: 100,
      signalStrength: 95,
      temperature: 25 + Math.round(Math.random() * 8),
      cpuUsage: 5 + Math.round(Math.random() * 15),
      ramUsage: 15 + Math.round(Math.random() * 20),
      networkTraffic: Math.round(Math.random() * 50 * 10) / 10,
      latitude: form.latitude ? parseFloat(form.latitude) : 17.6868,
      longitude: form.longitude ? parseFloat(form.longitude) : 83.2185,
      locationEnabled: true,
      firmwareVersion: form.firmwareVersion,
      assignedUser: form.assignedUser || 'admin@gmail.com',
      groupId: form.groupId,
      description: form.description,
    });

    // Reset form
    setForm({ name: '', type: 'IoT Sensor', description: '', assignedUser: '', groupId: 'grp-dev', firmwareVersion: 'v1.0.0', latitude: '', longitude: '' });
    onClose();
  };

  const inputClass = 'w-full px-3.5 py-2.5 rounded-xl text-xs glass-input placeholder-slate-500 focus:ring-2 focus:ring-cyan-500/40';
  const labelClass = 'text-[11px] font-semibold text-slate-300 uppercase tracking-wider';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={e => e.stopPropagation()}
            className="glass-panel rounded-2xl p-6 max-w-lg w-full border border-cyan-500/20 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/10">
                  <Monitor className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Add New Device</h3>
                  <p className="text-[11px] text-slate-400">Register a hardware device to the fleet</p>
                </div>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* Device Name */}
              <div className="space-y-1.5">
                <label className={labelClass}>Device Name *</label>
                <input
                  type="text" required value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Alpha Sensor Node"
                  className={inputClass}
                />
              </div>

              {/* Type + Group row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelClass}>Device Type</label>
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value as DeviceType })}
                    className={inputClass}
                  >
                    {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Group</label>
                  <select
                    value={form.groupId}
                    onChange={e => setForm({ ...form, groupId: e.target.value })}
                    className={inputClass}
                  >
                    {deviceGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Owner */}
              <div className="space-y-1.5">
                <label className={labelClass}>Owner / Assigned User</label>
                <input
                  type="email" value={form.assignedUser}
                  onChange={e => setForm({ ...form, assignedUser: e.target.value })}
                  placeholder="e.g. researcher@example.com"
                  className={inputClass}
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className={labelClass}>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief device description..."
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>

              {/* Location row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelClass}>Latitude</label>
                  <input
                    type="number" step="any" value={form.latitude}
                    onChange={e => setForm({ ...form, latitude: e.target.value })}
                    placeholder="17.6868"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Longitude</label>
                  <input
                    type="number" step="any" value={form.longitude}
                    onChange={e => setForm({ ...form, longitude: e.target.value })}
                    placeholder="83.2185"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Firmware */}
              <div className="space-y-1.5">
                <label className={labelClass}>Firmware Version</label>
                <input
                  type="text" value={form.firmwareVersion}
                  onChange={e => setForm({ ...form, firmwareVersion: e.target.value })}
                  placeholder="v1.0.0"
                  className={inputClass}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button" onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:from-ocean-400 hover:to-cyan-400 shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Device
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
