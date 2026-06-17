'use client';

import React from 'react';
import { useUIStore, ToastMessage } from '@/store/uiStore';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export const Toast: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const removeToast = useUIStore((state) => state.removeToast);

  const bgColors = {
    success: 'bg-success-green text-white',
    error: 'bg-error-red text-white',
    info: 'bg-brutal-yellow text-pure-black',
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 shrink-0" />,
    info: <Info className="w-5 h-5 shrink-0" />,
  };

  return (
    <div
      className={`
        brutal-border 
        brutal-shadow-btn 
        p-4 
        rounded-md 
        flex 
        items-center 
        justify-between 
        gap-3 
        pointer-events-auto 
        min-w-[280px] 
        max-w-[400px]
        animate-[slideIn_0.2s_ease-out]
        ${bgColors[toast.type]}
      `.replace(/\s+/g, ' ').trim()}
    >
      <div className="flex items-center gap-2">
        {icons[toast.type]}
        <p className="text-sm font-bold leading-tight">{toast.message}</p>
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-current opacity-80 hover:opacity-100 cursor-pointer"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const toasts = useUIStore((state) => state.toasts);

  return (
    <div className="fixed top-5 right-5 left-5 sm:left-auto z-50 flex flex-col items-stretch sm:items-end gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
};
