import React from 'react';
import { DEVICE_STATUS_CONFIG, DeviceStatus } from '../../types/devices';

interface Props {
  status: DeviceStatus;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

export const DeviceStatusBadge: React.FC<Props> = ({ status, size = 'sm', showDot = true }) => {
  const cfg = DEVICE_STATUS_CONFIG[status];
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const px = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <span className={`inline-flex items-center gap-1.5 ${px} rounded-full font-bold ${textSize} ${cfg.bgClass} ${cfg.textClass} border ${cfg.borderClass}`}>
      {showDot && (
        <span className="relative flex">
          <span className={`${dotSize} rounded-full ${cfg.dotColor}`} />
          {cfg.pulse && (
            <span className={`absolute inset-0 ${dotSize} rounded-full ${cfg.dotColor} animate-ping opacity-50`} />
          )}
        </span>
      )}
      {cfg.label}
    </span>
  );
};
