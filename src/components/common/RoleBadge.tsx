import React from 'react';
import { UserRole, ROLE_CONFIG } from '../../types';

interface RoleBadgeProps {
  role: UserRole;
  size?: 'sm' | 'md' | 'lg';
  /** Show the full label instead of abbreviated label */
  showFull?: boolean;
}

const SIZE = {
  sm: 'px-2 py-0.5 text-[11px] gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
  lg: 'px-3 py-1.5 text-sm gap-2',
};

/** Short display labels used when showFull is false */
const SHORT_LABEL: Record<UserRole, string> = {
  Admin:          'Administrator',
  Government:     'Government',
  Researcher:     'Researcher',
  Student:        'Student',
  Shipping:       'Shipping',
  'Coastal Guard': 'Coastal Guard',
};

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, size = 'md', showFull = false }) => {
  const cfg = ROLE_CONFIG[role];
  const label = showFull ? cfg.label : SHORT_LABEL[role];

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold border ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass} ${SIZE[size]}`}
    >
      <span className="leading-none">{cfg.emoji}</span>
      {label}
    </span>
  );
};
