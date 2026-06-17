'use client';

import React, { useEffect, useState } from 'react';
import { Terminal } from 'lucide-react';

interface PreloaderProps {
  onComplete: () => void;
}

export const BrutalistPreloader: React.FC<PreloaderProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Booting IndiVibe v1.0.0...');
  const [shouldRender, setShouldRender] = useState(true);
  const [fadeClass, setFadeClass] = useState('opacity-100');

  useEffect(() => {
    // Progress increment loop
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        
        // Random incremental steps for realistic load feel
        const increment = Math.floor(Math.random() * 8) + 4;
        const next = Math.min(prev + increment, 100);
        
        // Dynamic status text updates
        if (next < 25) {
          setLoadingText('Initializing Firebase Auth Client...');
        } else if (next < 50) {
          setLoadingText('Verifying Patr ID Identity Engine...');
        } else if (next < 75) {
          setLoadingText('Loading Three.js 3D WebGL Canvas...');
        } else if (next < 95) {
          setLoadingText('Compiling Brutalism Styling Tokens...');
        } else {
          setLoadingText('Ready to Vibe! Redirecting...');
        }
        
        return next;
      });
    }, 80);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress === 100) {
      // Small delay for success state before fade out
      const timeout = setTimeout(() => {
        setFadeClass('opacity-0 pointer-events-none translate-y-[-100vh]');
        const exitTimeout = setTimeout(() => {
          setShouldRender(false);
          onComplete();
        }, 500); // matches CSS transitions
        return () => clearTimeout(exitTimeout);
      }, 400);

      return () => clearTimeout(timeout);
    }
  }, [progress, onComplete]);

  if (!shouldRender) return null;

  return (
    <div
      className={`
        fixed 
        inset-0 
        z-50 
        bg-off-white 
        flex 
        flex-col 
        items-center 
        justify-center 
        p-4 
        transition-all 
        duration-500 
        ease-in-out
        ${fadeClass}
      `.replace(/\s+/g, ' ').trim()}
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111111_1px,transparent_1px),linear-gradient(to_bottom,#111111_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.05] pointer-events-none" />

      {/* Brutalist Loading Box */}
      <div className="w-full max-w-sm brutal-border bg-white p-6 rounded-lg brutal-shadow-card relative">
        {/* Terminal Header */}
        <div className="flex justify-between items-center border-b-2.5 border-pure-black pb-3 mb-5 select-none">
          <div className="flex items-center gap-2 text-pure-black">
            <Terminal className="w-4 h-4" />
            <span className="font-display text-xs uppercase tracking-wider">SYSTEM.BOOT</span>
          </div>
          <span className="text-xs font-extrabold bg-brutal-yellow brutal-border px-2 py-0.5 rounded uppercase">
            v1.0.0
          </span>
        </div>

        {/* Text */}
        <h2 className="font-display text-2xl uppercase mb-2 tracking-tight">
          INDIVIBE SOCIAL
        </h2>
        
        <p className="text-xs font-bold text-mid-gray uppercase mb-6 min-h-[16px] animate-[pulse_1s_infinite]">
          {loadingText}
        </p>

        {/* Custom Progress Bar */}
        <div className="w-full h-8 brutal-border bg-light-gray rounded-[4px] relative overflow-hidden flex items-center">
          {/* Fills from left to right */}
          <div
            style={{ width: `${progress}%` }}
            className="h-full bg-brutal-yellow brutal-transition duration-75 border-r-2 border-pure-black"
          />
          {/* Centered text display percentage */}
          <span className="absolute inset-0 flex items-center justify-center font-display text-sm text-pure-black select-none z-10">
            {progress}%
          </span>
        </div>

        {/* Subtle footer */}
        <div className="mt-6 text-center">
          <span className="text-[10px] font-bold text-mid-gray uppercase tracking-widest">
            MADE IN INDIA • PATR INFRAPROJECT
          </span>
        </div>
      </div>
    </div>
  );
};
