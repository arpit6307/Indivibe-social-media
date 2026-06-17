import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  hoverable = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`
        bg-off-white 
        text-pure-black 
        brutal-border 
        brutal-shadow-card 
        p-4 
        sm:p-6 
        rounded-[8px] 
        ${hoverable ? 'brutal-transition hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-[8px_8px_0px_#111111]' : ''} 
        ${className}
      `.replace(/\s+/g, ' ').trim()}
      {...props}
    >
      {children}
    </div>
  );
};
