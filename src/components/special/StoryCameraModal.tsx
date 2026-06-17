'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Camera, FlipHorizontal, Image as ImageIcon, Zap, ZapOff, X, Send, Type, Undo, CheckCircle2, Music } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/store/uiStore';
import { socialService } from '@/lib/socialService';
import { SongSelectorModal } from '@/components/ui/SongSelectorModal';

interface StoryCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  currentUserUsername: string;
  currentUserProfile: any;
  onRefreshFeed?: () => void;
}

export default function StoryCameraModal({
  isOpen,
  onClose,
  currentUserId,
  currentUserUsername,
  currentUserProfile,
  onRefreshFeed
}: StoryCameraModalProps) {
  const addToast = useUIStore((state) => state.addToast);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [flashOn, setFlashOn] = useState(false);
  const [showFlashOverlay, setShowFlashOverlay] = useState(false);
  
  // Capture States
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [publishType, setPublishType] = useState<'story' | 'post'>('story');
  const [isPublishing, setIsPublishing] = useState(false);

  // Text Overlay state
  const [overlayText, setOverlayText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textBg, setTextBg] = useState(true);

  // Music state
  const [selectedSong, setSelectedSong] = useState<any | null>(null);
  const [isMusicSelectorOpen, setIsMusicSelectorOpen] = useState(false);

  // Initialize camera stream
  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: facingMode,
          width: { ideal: 1080 },
          height: { ideal: 1920 }
        },
        audio: false
      });
      
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      addToast("Could not access your camera. Make sure permissions are granted.", "error");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, facingMode, capturedImage]);

  if (!isOpen) return null;

  // Toggle Flip Camera
  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Gallery Select
  const handleGalleryClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        addToast("File size too large. Max is 10MB.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
        stopCamera();
      };
      reader.readAsDataURL(file);
    }
  };

  // Shutter Capture
  const handleCapture = () => {
    if (!videoRef.current) return;

    // Trigger flash screen simulation
    setShowFlashOverlay(true);
    setTimeout(() => setShowFlashOverlay(false), 150);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Mirror image if user camera
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Reset transform if mirrored
      if (facingMode === 'user') {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setCapturedImage(dataUrl);
      stopCamera();
    }
  };

  // Compile image with text overlay onto canvas for final upload
  const compileFinalImage = (): Promise<string> => {
    return new Promise((resolve) => {
      if (!capturedImage) return resolve('');
      
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // 1. Draw base image
          ctx.drawImage(img, 0, 0);

          // 2. Draw text overlay if it exists
          if (overlayText.trim()) {
            const fontSize = Math.round(canvas.width * 0.05); // Dynamic size based on image width
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const x = canvas.width / 2;
            const y = canvas.height * 0.45; // Centered vertically in upper area
            const padding = fontSize * 0.5;
            
            const metrics = ctx.measureText(overlayText);
            const textWidth = metrics.width;
            const textHeight = fontSize;

            // Draw semi-transparent background bubble
            if (textBg) {
              ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
              const rectX = x - textWidth / 2 - padding;
              const rectY = y - textHeight / 2 - padding / 2;
              const rectW = textWidth + padding * 2;
              const rectH = textHeight + padding;
              const radius = fontSize * 0.3;

              // Rounded rectangle
              ctx.beginPath();
              ctx.moveTo(rectX + radius, rectY);
              ctx.lineTo(rectX + rectW - radius, rectY);
              ctx.quadraticCurveTo(rectX + rectW, rectY, rectX + rectW, rectY + radius);
              ctx.lineTo(rectX + rectW, rectY + rectH - radius);
              ctx.quadraticCurveTo(rectX + rectW, rectY + rectH, rectX + rectW - radius, rectY + rectH);
              ctx.lineTo(rectX + radius, rectY + rectH);
              ctx.quadraticCurveTo(rectX, rectY + rectH, rectX, rectY + rectH - radius);
              ctx.lineTo(rectX, rectY + radius);
              ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
              ctx.closePath();
              ctx.fill();
            }

            // Draw Text
            ctx.fillStyle = textColor;
            ctx.fillText(overlayText, x, y + fontSize * 0.05);
          }

          resolve(canvas.toDataURL('image/jpeg', 0.95));
        } else {
          resolve(capturedImage);
        }
      };
      img.src = capturedImage;
    });
  };

  // Publish Story/Post
  const handlePublish = async () => {
    if (!capturedImage) return;

    setIsPublishing(true);
    addToast(`Publishing your new ${publishType}...`, 'info');

    try {
      const compiledBase64 = await compileFinalImage();
      let finalMediaUrl = compiledBase64;

      // Upload to Cloudinary
      try {
        const response = await fetch('/api/cloudinary', {
          method: 'POST',
          body: JSON.stringify({ file: compiledBase64, folder: publishType === 'story' ? 'indivibe_stories' : 'indivibe_posts' }),
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (data.success && data.secure_url) {
          finalMediaUrl = data.secure_url;
        }
      } catch (err) {
        console.warn("Cloudinary upload failed, using fallback base64 URL:", err);
      }

      if (publishType === 'story') {
        // Save as Story
        await socialService.createStory(
          currentUserId,
          currentUserUsername,
          currentUserProfile?.profilePhotoUrl || '',
          finalMediaUrl,
          'image',
          selectedSong || undefined
        );
        addToast("Story uploaded successfully!", "success");
      } else {
        // Save as Post
        await socialService.createPost(
          currentUserId,
          currentUserUsername,
          currentUserProfile?.displayName || currentUserUsername.toUpperCase(),
          currentUserProfile?.profilePhotoUrl || '',
          finalMediaUrl,
          'image',
          overlayText ? `✨ ${overlayText}` : 'New post shared from IndiVibe Camera',
          selectedSong || undefined
        );
        addToast("Post shared to feed successfully!", "success");
      }

      if (onRefreshFeed) onRefreshFeed();
      handleCloseAll();
    } catch (err: any) {
      console.error(err);
      addToast("Failed to upload. Please try again.", "error");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCloseAll = () => {
    stopCamera();
    setCapturedImage(null);
    setOverlayText('');
    setSelectedSong(null);
    setIsMusicSelectorOpen(false);
    setIsPublishing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-pure-black flex items-center justify-center sm:p-4 select-none">
      
      {/* Simulation of screen flash */}
      {showFlashOverlay && (
        <div className="absolute inset-0 bg-white z-50 animate-fadeOut pointer-events-none"></div>
      )}

      {/* Main Container */}
      <div className="w-full h-full sm:max-w-md sm:h-[90vh] bg-pure-black sm:rounded-2xl border-0 sm:border-4 border-white shadow-[0_0_20px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col relative">
        
        {/* Header toolbar */}
        <div className="absolute top-4 left-4 right-4 z-40 flex justify-between items-center">
          <button
            type="button"
            onClick={handleCloseAll}
            className="w-10 h-10 rounded-full bg-pure-black/60 border border-white/20 text-white flex items-center justify-center hover:bg-pure-black transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {!capturedImage && (
            <button
              type="button"
              onClick={() => setFlashOn(!flashOn)}
              className="w-10 h-10 rounded-full bg-pure-black/60 border border-white/20 text-white flex items-center justify-center hover:bg-pure-black transition-colors"
            >
              {flashOn ? <Zap className="w-5 h-5 text-brutal-yellow" /> : <ZapOff className="w-5 h-5" />}
            </button>
          )}

          {capturedImage && (
            <div className="flex gap-2">
              {/* Text styling toggle */}
              <button
                type="button"
                onClick={() => setTextBg(!textBg)}
                className={`w-10 h-10 rounded-full border text-white flex items-center justify-center transition-colors ${
                  textBg ? 'bg-brutal-yellow border-pure-black text-pure-black' : 'bg-pure-black/60 border-white/20'
                }`}
              >
                <Type className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* 1. Camera Viewport / Preview */}
        <div className="flex-1 bg-pure-black flex items-center justify-center relative">
          
          {/* CAMERA FEED */}
          {!capturedImage && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
          )}

          {/* CAPTURED PREVIEW */}
          {capturedImage && (
            <div className="w-full h-full relative flex items-center justify-center bg-black">
              <img
                src={capturedImage}
                alt="Captured Preview"
                className="w-full h-full object-contain"
              />

              {/* Dynamic Text Overlay Render */}
              {overlayText.trim() && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[80%] text-center">
                  <span 
                    style={{ color: textColor }}
                    className={`px-4 py-2 text-lg font-bold block rounded-xl break-words leading-relaxed ${
                      textBg ? 'bg-pure-black/65 backdrop-blur-xs brutal-border text-white' : ''
                    }`}
                  >
                    {overlayText}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Camera guidelines overlay */}
          {!capturedImage && (
            <div className="absolute inset-0 border-[6px] border-white/10 pointer-events-none flex items-center justify-center">
              <div className="w-[80%] h-[70%] border border-dashed border-white/20 rounded"></div>
            </div>
          )}
        </div>

        {/* 2. Controls Panel */}
        <div className="bg-pure-black p-6 border-t border-white/15 flex flex-col gap-5">
          
          {/* Preview overlay text input */}
          {capturedImage && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-2">
                <Type className="w-4 h-4 text-white/60 shrink-0" />
                <input
                  type="text"
                  placeholder="Type text overlay..."
                  value={overlayText}
                  onChange={(e) => setOverlayText(e.target.value)}
                  className="bg-transparent border-none outline-none text-white text-xs w-full font-bold"
                  maxLength={60}
                />
              </div>
              
              {/* Color Selection Palette */}
              <div className="flex gap-2 justify-center">
                {['#ffffff', '#FFE834', '#000000', '#FF3B30', '#34C759', '#007AFF'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setTextColor(color)}
                    className={`w-6 h-6 rounded-full border border-white flex items-center justify-center`}
                    style={{ backgroundColor: color }}
                  >
                    {textColor === color && (
                      <div className={`w-2 h-2 rounded-full ${color === '#ffffff' || color === '#FFE834' ? 'bg-black' : 'bg-white'}`}></div>
                    )}
                  </button>
                ))}
              </div>

              {/* Music Selection Overlay inside controls */}
              <div className="pt-1">
                {!selectedSong ? (
                  <button
                    type="button"
                    onClick={() => setIsMusicSelectorOpen(true)}
                    className="w-full py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-xs font-display uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Music className="w-4 h-4 text-brutal-yellow" /> Add Music
                  </button>
                ) : (
                  <div className="flex items-center gap-2.5 p-2 bg-white/10 border border-white/25 rounded-lg">
                    <div className="w-8 h-8 rounded border border-white/30 overflow-hidden bg-white/5 shrink-0">
                      <img src={selectedSong.coverUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[10px] font-display uppercase text-white truncate">{selectedSong.title}</p>
                      <p className="text-[8px] font-mono text-white/60 uppercase truncate">{selectedSong.artist} • {selectedSong.duration}s</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedSong(null)}
                      className="p-1 rounded bg-error-red/80 hover:bg-error-red text-white border border-pure-black shadow-[1px_1px_0px_#111] cursor-pointer"
                      title="Remove Song"
                    >
                      <X className="w-3 h-3 stroke-[2.5]" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active controls */}
          {!capturedImage ? (
            <div className="flex justify-between items-center px-4">
              
              {/* Gallery button */}
              <button
                type="button"
                onClick={handleGalleryClick}
                className="w-12 h-12 rounded-full bg-white/15 border border-white/20 text-white flex items-center justify-center hover:bg-white/30 active:scale-95 transition-all cursor-pointer"
                title="Select photo from Gallery"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Shutter Capture Button */}
              <button
                type="button"
                onClick={handleCapture}
                className="w-18 h-18 rounded-full border-4 border-white flex items-center justify-center p-1 bg-transparent hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <div className="w-full h-full rounded-full bg-white hover:bg-light-gray transition-colors"></div>
              </button>

              {/* Flip camera button */}
              <button
                type="button"
                onClick={handleFlipCamera}
                className="w-12 h-12 rounded-full bg-white/15 border border-white/20 text-white flex items-center justify-center hover:bg-white/30 active:scale-95 transition-all cursor-pointer"
                title="Flip Camera"
              >
                <FlipHorizontal className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              {/* Retake Button */}
              <Button
                onClick={() => setCapturedImage(null)}
                variant="secondary"
                className="flex-1 text-xs py-3 brutal-border bg-white text-pure-black border-2 shadow-[2px_2px_0px_#111] hover:bg-light-gray flex items-center justify-center gap-1.5"
                disabled={isPublishing}
              >
                <Undo className="w-4 h-4" /> Retake
              </Button>

              {/* Share/Publish Button */}
              <Button
                onClick={handlePublish}
                className="flex-1 text-xs py-3 brutal-border bg-brutal-yellow text-pure-black border-2 shadow-[2px_2px_0px_#111] hover:translate-y-0.5 hover:shadow-[1px_1px_0px_#111] flex items-center justify-center gap-1.5"
                disabled={isPublishing}
              >
                <Send className="w-4 h-4" /> Share
              </Button>
            </div>
          )}

          {/* Mode Selector (Story vs Post) */}
          <div className="flex justify-center border-t border-white/10 pt-4">
            <div className="bg-white/10 brutal-border border border-white/25 rounded-full p-1 flex gap-1">
              <button
                type="button"
                onClick={() => setPublishType('story')}
                className={`px-4 py-1.5 rounded-full text-[10px] font-extrabold uppercase transition-all ${
                  publishType === 'story'
                    ? 'bg-brutal-yellow text-pure-black'
                    : 'text-white/60 hover:text-white'
                }`}
                disabled={isPublishing}
              >
                Story mode
              </button>
              <button
                type="button"
                onClick={() => setPublishType('post')}
                className={`px-4 py-1.5 rounded-full text-[10px] font-extrabold uppercase transition-all ${
                  publishType === 'post'
                    ? 'bg-brutal-yellow text-pure-black'
                    : 'text-white/60 hover:text-white'
                }`}
                disabled={isPublishing}
              >
                Post mode
              </button>
            </div>
          </div>

        </div>

      </div>

      {isMusicSelectorOpen && (
        <SongSelectorModal
          onSelect={(song) => {
            setSelectedSong(song);
            setIsMusicSelectorOpen(false);
          }}
          onClose={() => setIsMusicSelectorOpen(false)}
        />
      )}
    </div>
  );
}
