'use client';

import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export const ScrollToTop: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      className={`
        fixed 
        bottom-6 
        right-6 
        md:bottom-8 
        md:right-8 
        z-40 
        brutal-border 
        bg-brutal-yellow 
        text-pure-black 
        p-3.5 
        rounded-full 
        brutal-shadow-btn 
        brutal-transition 
        hover:-translate-x-[2px] 
        hover:-translate-y-[2px] 
        hover:shadow-[6px_6px_0px_#111111] 
        active:translate-x-0 
        active:translate-y-0 
        active:shadow-brutal-btn 
        cursor-pointer 
        focus:outline-none
      `.replace(/\s+/g, ' ').trim()}
      aria-label="Scroll to top"
    >
      <ArrowUp className="w-5 h-5 stroke-[2.5]" />
    </button>
  );
};
