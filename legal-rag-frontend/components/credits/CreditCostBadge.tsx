"use client";

import React from 'react';
import { Coins } from 'lucide-react';

interface CreditCostBadgeProps {
  cost: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'warning' | 'error';
}

export const CreditCostBadge: React.FC<CreditCostBadgeProps> = ({
  cost,
  size = 'md',
  variant = 'default'
}) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const variantClasses = {
    default: 'bg-blue-100 text-blue-800 border-blue-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    error: 'bg-red-100 text-red-800 border-red-200'
  };

  return (
    <div className={`
      inline-flex items-center gap-1 rounded-full border font-medium
      ${sizeClasses[size]}
      ${variantClasses[variant]}
    `}>
      <Coins className="h-3 w-3" />
      <span>{cost} crédit{cost > 1 ? 's' : ''}</span>
    </div>
  );
};
