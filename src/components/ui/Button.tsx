import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const baseStyle = `
    brutal-border 
    brutal-shadow-btn 
    brutal-transition 
    font-bold 
    py-2.5 
    px-5 
    rounded-[6px] 
    text-sm 
    inline-flex 
    items-center 
    justify-center 
    gap-2 
    cursor-pointer 
    select-none 
    hover:-translate-x-[2px] 
    hover:-translate-y-[2px] 
    hover:shadow-[6px_6px_0px_#111111] 
    active:translate-x-0 
    active:translate-y-0 
    active:shadow-brutal-btn 
    disabled:opacity-50 
    disabled:cursor-not-allowed 
    disabled:hover:translate-x-0 
    disabled:hover:translate-y-0 
    disabled:hover:shadow-brutal-btn 
    focus:outline-none
  `.replace(/\s+/g, ' ').trim();

  const variants = {
    primary: 'bg-brutal-yellow text-pure-black',
    secondary: 'bg-off-white text-pure-black',
    danger: 'bg-error-red text-white',
    success: 'bg-success-green text-white',
  };

  return (
    <button
      suppressHydrationWarning
      className={`${baseStyle} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
