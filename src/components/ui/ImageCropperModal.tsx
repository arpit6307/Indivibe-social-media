'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImageCropperModalProps {
  imageSrc: string;
  onCrop: (croppedImageSrc: string) => void;
  onClose: () => void;
}

export function ImageCropperModal({ imageSrc, onCrop, onClose }: ImageCropperModalProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [renderedSize, setRenderedSize] = useState({ width: 300, height: 300 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Dimensions of container and crop frame
  const containerSize = 300;
  const cropSize = 200;
  const padding = (containerSize - cropSize) / 2; // 50px

  // Calculate rendered size to cover 300x300 container
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      const r = img.naturalWidth / img.naturalHeight;
      let w = containerSize;
      let h = containerSize;
      
      if (r > 1) {
        // Landscape
        h = containerSize;
        w = containerSize * r;
      } else if (r < 1) {
        // Portrait
        w = containerSize;
        h = containerSize / r;
      }
      
      setRenderedSize({ width: w, height: h });
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
  }, [imageSrc]);

  // Constrain panning to ensure the crop circle is always covered
  const limitPan = (x: number, y: number, currentZoom: number) => {
    const w = renderedSize.width * currentZoom;
    const h = renderedSize.height * currentZoom;
    
    const maxPanX = Math.max(0, w / 2 - cropSize / 2);
    const minPanX = -maxPanX;
    const maxPanY = Math.max(0, h / 2 - cropSize / 2);
    const minPanY = -maxPanY;
    
    return {
      x: Math.max(minPanX, Math.min(maxPanX, x)),
      y: Math.max(minPanY, Math.min(maxPanY, y)),
    };
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const rawX = e.clientX - dragStart.current.x;
    const rawY = e.clientY - dragStart.current.y;
    const constrained = limitPan(rawX, rawY, zoom);
    setPan(constrained);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    const touch = e.touches[0];
    dragStart.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const rawX = touch.clientX - dragStart.current.x;
    const rawY = touch.clientY - dragStart.current.y;
    const constrained = limitPan(rawX, rawY, zoom);
    setPan(constrained);
  };

  // Handles Zoom Slider Changes
  const handleZoomChange = (newZoom: number) => {
    const nextZoom = Math.max(1, Math.min(3, newZoom));
    setZoom(nextZoom);
    // Re-constrain pan with the new zoom scale
    setPan(prev => limitPan(prev.x, prev.y, nextZoom));
  };

  // Perform Crop operation
  const handleCrop = () => {
    const img = imageRef.current;
    if (!img) return;

    const canvas1 = document.createElement('canvas');
    canvas1.width = containerSize;
    canvas1.height = containerSize;
    const ctx1 = canvas1.getContext('2d');
    if (!ctx1) return;

    // Fill background with white
    ctx1.fillStyle = '#ffffff';
    ctx1.fillRect(0, 0, containerSize, containerSize);

    ctx1.save();
    // Translate to center of canvas
    ctx1.translate(containerSize / 2, containerSize / 2);
    // Apply pan
    ctx1.translate(pan.x, pan.y);
    // Apply zoom
    ctx1.scale(zoom, zoom);
    // Draw the image centered
    ctx1.drawImage(
      img,
      -renderedSize.width / 2,
      -renderedSize.height / 2,
      renderedSize.width,
      renderedSize.height
    );
    ctx1.restore();

    // Copy crop area (from coordinates 50,50 of canvas1) to high resolution canvas2
    const canvas2 = document.createElement('canvas');
    const finalResolution = 400; // Output 400x400 JPG
    canvas2.width = finalResolution;
    canvas2.height = finalResolution;
    const ctx2 = canvas2.getContext('2d');
    if (!ctx2) return;

    ctx2.drawImage(
      canvas1,
      padding,
      padding,
      cropSize,
      cropSize,
      0,
      0,
      finalResolution,
      finalResolution
    );

    const croppedDataUrl = canvas2.toDataURL('image/jpeg', 0.95);
    onCrop(croppedDataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pure-black/75 backdrop-blur-sm">
      <Card className="w-full max-w-sm bg-white brutal-border border-4 shadow-[6px_6px_0px_#111] overflow-hidden flex flex-col p-0">
        
        {/* Modal Header */}
        <div className="p-4 border-b-3 border-pure-black flex justify-between items-center bg-[#FAFAF8]">
          <h3 className="font-display text-sm uppercase text-pure-black">Crop Profile Picture</h3>
          <button 
            onClick={onClose}
            className="p-1 rounded brutal-border bg-white text-pure-black hover:bg-error-red hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Crop Container */}
        <div className="p-6 flex flex-col items-center justify-center space-y-6 bg-white">
          <div 
            style={{ width: containerSize, height: containerSize }}
            className="relative brutal-border border-3 bg-light-gray overflow-hidden cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
          >
            {/* Image to crop */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Source"
              style={{
                width: renderedSize.width,
                height: renderedSize.height,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              }}
              className="max-w-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              draggable={false}
            />

            {/* Circular Crop Frame Highlight Mask */}
            <div 
              style={{
                width: cropSize,
                height: cropSize,
                top: padding,
                left: padding,
              }}
              className="absolute rounded-full border-3 border-dashed border-[#FFE834] pointer-events-none shadow-[0_0_0_9999px_rgba(17,17,17,0.6)]"
            />
          </div>

          {/* Controls: Zoom slider & buttons */}
          <div className="w-full space-y-3">
            <div className="flex items-center justify-between text-[10px] font-display uppercase tracking-wider text-mid-gray">
              <span>Zoom Image</span>
              <span className="font-mono">{Math.round(zoom * 100)}%</span>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={() => handleZoomChange(zoom - 0.1)}
                className="p-1.5 rounded brutal-border bg-white text-pure-black hover:bg-brutal-yellow transition-all shadow-[1.5px_1.5px_0px_#111] active:translate-y-0.5 active:shadow-none"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="flex-1 accent-brutal-yellow h-2 bg-light-gray rounded border border-pure-black outline-none"
              />
              
              <button 
                type="button"
                onClick={() => handleZoomChange(zoom + 0.1)}
                className="p-1.5 rounded brutal-border bg-white text-pure-black hover:bg-brutal-yellow transition-all shadow-[1.5px_1.5px_0px_#111] active:translate-y-0.5 active:shadow-none"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button 
                type="button"
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                className="p-1.5 rounded brutal-border bg-white text-pure-black hover:bg-light-gray transition-all shadow-[1.5px_1.5px_0px_#111] active:translate-y-0.5 active:shadow-none"
                title="Reset Image"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t-3 border-pure-black bg-[#FAFAF8] flex gap-3">
          <Button 
            variant="secondary" 
            className="flex-1 py-2 text-xs font-display uppercase border-pure-black"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button 
            variant="primary" 
            className="flex-1 py-2 text-xs font-display uppercase"
            onClick={handleCrop}
          >
            Crop & Save
          </Button>
        </div>

      </Card>
    </div>
  );
}
