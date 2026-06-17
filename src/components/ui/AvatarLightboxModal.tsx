'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card } from './Card';
import { X, ZoomIn, ZoomOut, RotateCcw, User } from 'lucide-react';

interface AvatarLightboxModalProps {
  userProfile: {
    uid: string;
    username: string;
    displayName: string;
    profilePhotoUrl: string;
  };
  onClose: () => void;
  onViewProfile: () => void;
}

export function AvatarLightboxModal({ userProfile, onClose, onViewProfile }: AvatarLightboxModalProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Handle wheel zoom
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    const direction = e.deltaY < 0 ? 1 : -1;
    setZoom(prev => Math.max(0.5, Math.min(5, prev + direction * zoomFactor)));
  };

  // Bind wheel zoom listener to container
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (el) {
        el.removeEventListener('wheel', handleWheel);
      }
    };
  }, []);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch pan handlers (Mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    const touch = e.touches[0];
    dragStart.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPan({
      x: touch.clientX - dragStart.current.x,
      y: touch.clientY - dragStart.current.y
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-pure-black/95 flex flex-col justify-between p-4 sm:p-6 select-none animate-[fadeIn_0.15s_ease-out]">
      {/* Brutalist Grid Backdrop */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:50px_50px] opacity-[0.03] pointer-events-none" />

      {/* Lightbox Header */}
      <div className="flex justify-between items-center w-full z-10 border-b-2 border-white/20 pb-4">
        <div className="flex flex-col">
          <span className="font-display text-base sm:text-lg uppercase text-brutal-yellow leading-tight">
            {userProfile.displayName}
          </span>
          <span className="text-[10px] font-mono uppercase text-white/75 mt-0.5">
            @{userProfile.username}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onViewProfile}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brutal-yellow text-pure-black font-display text-[10px] uppercase tracking-wider brutal-border border-2 shadow-[2px_2px_0px_#fff] active:translate-y-0.5 active:shadow-none cursor-pointer rounded"
          >
            <User className="w-3.5 h-3.5" /> View Profile
          </button>
          
          <button 
            onClick={onClose}
            className="p-1.5 rounded brutal-border border-2 bg-error-red text-white hover:bg-error-red/90 transition-colors cursor-pointer shadow-[2px_2px_0px_#fff] active:translate-y-0.5 active:shadow-none"
            aria-label="Close Lightbox"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Interactive Main Area */}
      <div 
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden relative cursor-grab active:cursor-grabbing my-4"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        <img
          src={userProfile.profilePhotoUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${userProfile.uid}`}
          alt="Avatar Full View"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            maxHeight: '72vh',
          }}
          className="max-w-[85vw] object-contain bg-white brutal-border border-4 shadow-[6px_6px_0px_#FFE834] rounded-lg"
          draggable={false}
        />

        {/* Double-tap indicator badge */}
        <div className="absolute bottom-4 left-4 bg-pure-black/60 text-white border border-white/20 text-[8px] font-mono py-1 px-2.5 rounded-full select-none">
          Scroll wheel / slider to zoom • Drag to pan
        </div>
      </div>

      {/* Control Actions & Zoom Slider */}
      <div className="w-full max-w-sm mx-auto z-10 bg-pure-black border-2 border-white/30 p-4 rounded-xl shadow-[4px_4px_0px_rgba(255,255,255,0.15)] space-y-4">
        
        {/* Zoom Slider Details */}
        <div className="flex items-center justify-between text-[10px] font-display uppercase tracking-wider text-white/60">
          <span>Display Zoom</span>
          <span className="font-mono text-brutal-yellow">{Math.round(zoom * 100)}%</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
            className="p-2 rounded brutal-border border-2 bg-white text-pure-black hover:bg-brutal-yellow transition-all shadow-[2px_2px_0px_#FFE834] active:translate-y-0.5 active:shadow-none cursor-pointer"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-4 h-4 stroke-[2.5]" />
          </button>
          
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-brutal-yellow h-1.5 bg-white/20 rounded outline-none cursor-pointer"
          />
          
          <button 
            onClick={() => setZoom(prev => Math.min(5, prev + 0.25))}
            className="p-2 rounded brutal-border border-2 bg-white text-pure-black hover:bg-brutal-yellow transition-all shadow-[2px_2px_0px_#FFE834] active:translate-y-0.5 active:shadow-none cursor-pointer"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-4 h-4 stroke-[2.5]" />
          </button>

          <button 
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="p-2 rounded brutal-border border-2 bg-white text-pure-black hover:bg-light-gray transition-all shadow-[2px_2px_0px_#FFE834] active:translate-y-0.5 active:shadow-none cursor-pointer"
            title="Reset Avatar View"
          >
            <RotateCcw className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
}
