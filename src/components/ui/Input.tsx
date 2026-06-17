import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-bold text-pure-black select-none">
            {label}
          </label>
        )}
        <input
          ref={ref}
          suppressHydrationWarning
          className={`
            w-full 
            bg-light-gray 
            text-pure-black 
            brutal-border 
            px-4 
            py-2.5 
            rounded-[4px] 
            text-sm 
            placeholder:text-mid-gray 
            focus:outline-none 
            focus:bg-white 
            focus:border-brutal-yellow
            disabled:opacity-50 
            disabled:cursor-not-allowed 
            ${className}
          `.replace(/\s+/g, ' ').trim()}
          {...props}
        />
        {error && (
          <span className="text-xs font-bold text-error-red mt-0.5">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
