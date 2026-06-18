'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, FlipHorizontal, Image as ImageIcon, Zap, ZapOff, X, Send, Type, Undo, AlertCircle, Music, Upload } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/store/uiStore';
import { socialService } from '@/lib/socialService';
import { SongSelectorModal } from '@/components/ui/SongSelectorModal';

interface CreateTabProps {
  currentUserId: string;
  currentUserUsername: string;
  currentUserProfile: any;
  onNavigateToTab: (tab: string) => void;
}

export default function CreateTab({
  currentUserId,
  currentUserUsername,
  currentUserProfile,
  onNavigateToTab
}: CreateTabProps) {
  const addToast = useUIStore((state) => state.addToast);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [flashOn, setFlashOn] = useState(false);
  const [showFlashOverlay, setShowFlashOverlay] = useState(false);
  
  // Capture States
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<'post' | 'story'>('post');
  const [isUploading, setIsUploading] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [audience, setAudience] = useState<'public' | 'close_friends'>('public');

  // Music attachment
  const [selectedSong, setSelectedSong] = useState<any | null>(null);
  const [isMusicSelectorOpen, setIsMusicSelectorOpen] = useState(false);

  // Caption (Post only)
  const [caption, setCaption] = useState('');

  // Text Overlay state
  const [overlayText, setOverlayText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textBg, setTextBg] = useState(true);

  // Start Camera
  const startCamera = async () => {
    try {
      setCameraError(false);
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
      console.warn("Could not start camera, using file upload mode:", err);
      setCameraError(true);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  // Lifecycle stream hook
  useEffect(() => {
    if (!capturedImage && !cameraError) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [facingMode, capturedImage, cameraError]);

  // Gallery Uploader select
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

  // Capture Photo
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
      // Reset transform
      if (facingMode === 'user') {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setCapturedImage(dataUrl);
      stopCamera();
    }
  };

  // Retake
  const handleRetake = () => {
    setCapturedImage(null);
    setSelectedSong(null);
    setCameraError(false);
    setOverlayText('');
  };

  // Compile image with text overlay and optional 9:16 crop for stories
  const compileFinalImage = (): Promise<string> => {
    return new Promise((resolve) => {
      if (!capturedImage) return resolve('');
      
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const isStory = uploadType === 'story';

        if (isStory) {
          // Force 9:16 aspect ratio crop
          const targetAspect = 9 / 16;
          let cropWidth = img.width;
          let cropHeight = img.height;
          let sx = 0;
          let sy = 0;
          
          if (img.width / img.height > targetAspect) {
            cropWidth = img.height * targetAspect;
            sx = (img.width - cropWidth) / 2;
          } else {
            cropHeight = img.width / targetAspect;
            sy = (img.height - cropHeight) / 2;
          }
          
          canvas.width = 1080;
          canvas.height = 1920;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, sx, sy, cropWidth, cropHeight, 0, 0, 1080, 1920);
            
            // Draw text overlay if it exists
            if (overlayText.trim()) {
              const fontSize = 54;
              ctx.font = `bold ${fontSize}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              
              const x = 540;
              const y = 864;
              const padding = fontSize * 0.5;
              
              const metrics = ctx.measureText(overlayText);
              const textWidth = metrics.width;
              const textHeight = fontSize;
              
              if (textBg) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                const rectX = x - textWidth / 2 - padding;
                const rectY = y - textHeight / 2 - padding / 2;
                const rectW = textWidth + padding * 2;
                const rectH = textHeight + padding;
                const radius = fontSize * 0.3;
                
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
              
              ctx.fillStyle = textColor;
              ctx.fillText(overlayText, x, y + fontSize * 0.05);
            }
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          } else {
            resolve(capturedImage);
          }
        } else {
          // Standard post compile
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            
            if (overlayText.trim()) {
              const fontSize = Math.round(canvas.width * 0.05);
              ctx.font = `bold ${fontSize}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              
              const x = canvas.width / 2;
              const y = canvas.height * 0.45;
              const padding = fontSize * 0.5;
              
              const metrics = ctx.measureText(overlayText);
              const textWidth = metrics.width;
              const textHeight = fontSize;
              
              if (textBg) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                const rectX = x - textWidth / 2 - padding;
                const rectY = y - textHeight / 2 - padding / 2;
                const rectW = textWidth + padding * 2;
                const rectH = textHeight + padding;
                const radius = fontSize * 0.3;
                
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
              
              ctx.fillStyle = textColor;
              ctx.fillText(overlayText, x, y + fontSize * 0.05);
            }
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          } else {
            resolve(capturedImage);
          }
        }
      };
      img.src = capturedImage;
    });
  };

  // Submit / Publish
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!capturedImage) {
      addToast("Please snap or select a photo first.", "error");
      return;
    }

    setIsUploading(true);
    addToast("Uploading media to cloud space...", "info");

    try {
      const compiledBase64 = await compileFinalImage();
      let finalMediaUrl = compiledBase64;

      // Upload to Cloudinary
      try {
        const response = await fetch('/api/cloudinary', {
          method: 'POST',
          body: JSON.stringify({ file: compiledBase64, folder: uploadType === 'story' ? 'indivibe_stories' : 'indivibe_posts' }),
          headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        if (data.success && data.secure_url) {
          finalMediaUrl = data.secure_url;
        }
      } catch (uploadErr) {
        console.warn("Cloudinary upload failed, saving locally:", uploadErr);
      }

      if (uploadType === 'post') {
        await socialService.createPost(
          currentUserId,
          currentUserUsername,
          currentUserProfile?.displayName || currentUserUsername.toUpperCase(),
          currentUserProfile?.profilePhotoUrl || '',
          finalMediaUrl,
          'image',
          caption.trim(),
          selectedSong || undefined
        );
        addToast("Post created successfully in feed!", "success");
      } else {
        await socialService.createStory(
          currentUserId,
          currentUserUsername,
          currentUserProfile?.profilePhotoUrl || '',
          finalMediaUrl,
          'image',
          selectedSong || undefined,
          audience,
          overlayText
        );
        addToast("Story posted successfully for 24 hours!", "success");
      }

      // Cleanup & redirect
      setCapturedImage(null);
      setSelectedSong(null);
      setCaption('');
      setOverlayText('');
      setIsUploading(false);
      onNavigateToTab('feed');

    } catch (err: any) {
      console.error(err);
      addToast("Failed to publish media. Please try again.", "error");
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-16 select-none animate-[fadeIn_0.15s_ease-out]">
      
      {/* Studio Header */}
      <div className="border-b-3 border-pure-black pb-4 mb-6 text-center md:text-left">
        <h2 className="font-display text-2xl uppercase">Creation Studio</h2>
        <p className="text-xs font-bold text-mid-gray uppercase tracking-wider mt-1">
          Capture photos via live camera, trim custom background music, and post to feed or story
        </p>
      </div>

      {showFlashOverlay && (
        <div className="fixed inset-0 bg-white z-[60] pointer-events-none animate-fadeOut"></div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Story vs Post Mode Toggle */}
        <div className="grid grid-cols-2 gap-3 border-3 border-pure-black p-1 bg-white rounded-lg shadow-[3px_3px_0px_#111]">
          <button
            type="button"
            onClick={() => setUploadType('post')}
            className={`py-2.5 text-xs font-display uppercase rounded text-center tracking-wider transition-colors cursor-pointer ${
              uploadType === 'post' ? 'bg-brutal-yellow text-pure-black font-bold' : 'bg-transparent text-mid-gray'
            }`}
            disabled={isUploading}
          >
            <ImageIcon className="w-3.5 h-3.5 inline mr-1.5" /> Post mode
          </button>
          <button
            type="button"
            onClick={() => setUploadType('story')}
            className={`py-2.5 text-xs font-display uppercase rounded text-center tracking-wider transition-colors cursor-pointer ${
              uploadType === 'story' ? 'bg-brutal-yellow text-pure-black font-bold' : 'bg-transparent text-mid-gray'
            }`}
            disabled={isUploading}
          >
            <Camera className="w-3.5 h-3.5 inline mr-1.5" /> Story mode
          </button>
        </div>

        {/* Story Audience Selection */}
        {uploadType === 'story' && (
          <div className="flex items-center gap-3 p-3 bg-white brutal-border border-2 border-pure-black shadow-[3px_3px_0px_#111] rounded-lg">
            <span className="text-xs font-display uppercase text-pure-black tracking-wider font-bold">Story Audience:</span>
            <div className="flex gap-2 flex-1 justify-end">
              <button
                type="button"
                onClick={() => setAudience('public')}
                className={`px-3 py-1.5 text-[10px] font-display uppercase tracking-wider brutal-border border rounded cursor-pointer transition-colors ${
                  audience === 'public' 
                    ? 'bg-brutal-yellow text-pure-black shadow-[1.5px_1.5px_0px_#111]' 
                    : 'bg-transparent text-mid-gray border-light-gray shadow-none'
                }`}
              >
                Public
              </button>
              <button
                type="button"
                onClick={() => setAudience('close_friends')}
                className={`px-3 py-1.5 text-[10px] font-display uppercase tracking-wider brutal-border border rounded cursor-pointer transition-colors ${
                  audience === 'close_friends' 
                    ? 'bg-[#34C759] text-white shadow-[1.5px_1.5px_0px_#111]' 
                    : 'bg-transparent text-mid-gray border-light-gray shadow-none'
                }`}
              >
                ⭐ Close Friends
              </button>
            </div>
          </div>
        )}

        {/* Viewport Frame */}
        <div className={`p-0 bg-[#111] overflow-hidden flex flex-col items-center justify-center relative ${
          !capturedImage && !cameraError
            ? 'fixed inset-0 z-50 md:relative md:inset-auto md:z-0 md:h-[450px] md:min-h-0 md:brutal-border md:border-3 md:shadow-[4px_4px_0px_#111] md:rounded-lg' 
            : 'w-full h-[350px] md:h-[450px] brutal-border border-3 shadow-[4px_4px_0px_#111] rounded-lg'
        }`}>
          
          {!capturedImage ? (
            /* CAMERA STATE */
            !cameraError ? (
              <div className="w-full h-full min-h-[350px] relative flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full min-h-[350px] object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                />

                {/* Guidelines Overlay */}
                <div className="absolute inset-0 border-[6px] border-white/10 pointer-events-none flex items-center justify-center">
                  <div className="w-[85%] h-[75%] border border-dashed border-white/20 rounded-md"></div>
                </div>

                {/* Floating Camera controls */}
                <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
                  <button
                    type="button"
                    onClick={() => setCameraError(true)}
                    className="w-10 h-10 rounded-full bg-pure-black/60 border border-white/20 text-white flex items-center justify-center hover:bg-pure-black transition-colors cursor-pointer md:hidden"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlashOn(!flashOn)}
                    className="w-10 h-10 rounded-full bg-pure-black/60 border border-white/20 text-white flex items-center justify-center hover:bg-pure-black transition-colors cursor-pointer"
                  >
                    {flashOn ? <Zap className="w-5 h-5 text-brutal-yellow" /> : <ZapOff className="w-5 h-5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                    className="w-10 h-10 rounded-full bg-pure-black/60 border border-white/20 text-white flex items-center justify-center hover:bg-pure-black transition-colors cursor-pointer"
                  >
                    <FlipHorizontal className="w-5 h-5" />
                  </button>
                </div>

                {/* Bottom Capture / Gallery controls */}
                <div className="absolute bottom-6 left-4 right-4 flex justify-between items-center z-10 px-6">
                  <button
                    type="button"
                    onClick={handleGalleryClick}
                    className="w-12 h-12 rounded-full bg-pure-black/60 border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"
                    title="Select Photo"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>

                  {/* Shutter */}
                  <button
                    type="button"
                    onClick={handleCapture}
                    className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-transparent hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                  >
                    <div className="w-full h-full rounded-full bg-white"></div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCameraError(true)}
                    className="w-12 h-12 rounded-full bg-pure-black/60 border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"
                    title="Switch to File Upload"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              /* CAMERA FALLBACK / ERROR UPLOAD SCREEN */
              <label className="w-full flex flex-col items-center justify-center p-10 cursor-pointer text-center group bg-white h-[350px]">
                <Upload className="w-12 h-12 text-pure-black mb-3 group-hover:scale-110 transition-transform" />
                <span className="font-display text-sm uppercase text-pure-black">Choose photo from library</span>
                <span className="text-[10px] font-bold text-mid-gray uppercase mt-1">
                  Camera feed unavailable. Select local picture (max 10MB)
                </span>
                {cameraError && (
                  <button
                    type="button"
                    onClick={() => { setCameraError(false); startCamera(); }}
                    className="mt-4 px-4 py-1.5 bg-brutal-yellow text-pure-black text-[9px] font-display uppercase tracking-wider brutal-border border-2 shadow-[2px_2px_0px_#111] hover:translate-y-0.5 hover:shadow-none"
                  >
                    Try Camera Again
                  </button>
                )}
              </label>
            )
          ) : (
            /* CAPTURED / SELECTED PREVIEW IMAGE */
            <div className="w-full h-full relative aspect-square flex items-center justify-center bg-[#0d0d0d]">
              <img src={capturedImage} alt="Captured preview" className="max-h-[350px] w-full object-contain" />
              
              {/* Dynamic Text Overlay Render */}
              {overlayText.trim() && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[80%] text-center">
                  <span 
                    style={{ color: textColor }}
                    className={`px-4 py-2 text-sm md:text-lg font-bold block rounded-xl break-words leading-relaxed ${
                      textBg ? 'bg-pure-black/65 backdrop-blur-xs brutal-border text-white' : ''
                    }`}
                  >
                    {overlayText}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={handleRetake}
                className="absolute top-4 right-4 bg-error-red text-white p-2 rounded-md brutal-border border-2 shadow-[2px_2px_0px_#111] hover:shadow-none hover:translate-y-0.5 font-display text-[9px] uppercase tracking-wider cursor-pointer"
              >
                <Undo className="w-3.5 h-3.5 inline mr-1" /> Retake snap
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Text Overlay Controls */}
        {capturedImage && (
          <div className="space-y-3 p-4 bg-white brutal-border border-2 border-pure-black shadow-[3px_3px_0px_#111] rounded-lg">
            <div className="flex items-center justify-between">
              <label className="text-xs font-display uppercase tracking-wider text-mid-gray flex items-center gap-1">
                <Type className="w-4 h-4 text-pure-black" /> Text Overlay
              </label>
              <button
                type="button"
                onClick={() => setTextBg(!textBg)}
                className={`px-2.5 py-1 text-[9px] font-display uppercase tracking-wider brutal-border border rounded cursor-pointer transition-colors ${
                  textBg ? 'bg-brutal-yellow text-pure-black shadow-[1.5px_1.5px_0px_#111]' : 'bg-transparent text-mid-gray border-light-gray'
                }`}
              >
                Bg Shield: {textBg ? 'ON' : 'OFF'}
              </button>
            </div>

            <input
              type="text"
              placeholder="Type overlay text (e.g. @username or #hashtag)..."
              value={overlayText}
              onChange={(e) => setOverlayText(e.target.value)}
              className="w-full bg-white text-pure-black font-bold text-xs brutal-border p-2.5 rounded-lg shadow-[2px_2px_0px_#111] outline-none"
              maxLength={60}
            />

            <div className="flex gap-2 justify-center pt-1">
              {['#ffffff', '#FFE834', '#000000', '#FF3B30', '#34C759', '#007AFF'].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setTextColor(color)}
                  className="w-6 h-6 rounded-full border border-pure-black flex items-center justify-center cursor-pointer shadow-[1px_1px_0px_#111]"
                  style={{ backgroundColor: color }}
                >
                  {textColor === color && (
                    <div className={`w-1.5 h-1.5 rounded-full ${color === '#ffffff' || color === '#FFE834' ? 'bg-black' : 'bg-white'}`}></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Audio Track Selector & Trim Detail Area */}
        {capturedImage && (
          <div className="space-y-2">
            <label className="text-xs font-display uppercase tracking-wider text-mid-gray block">
              Background Soundtrack
            </label>
            {!selectedSong ? (
              <button
                type="button"
                onClick={() => setIsMusicSelectorOpen(true)}
                className="w-full py-3 bg-white hover:bg-brutal-yellow brutal-border border-2 border-pure-black text-pure-black font-display text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-[3px_3px_0px_#111] active:translate-y-0.5 active:shadow-none"
              >
                <Music className="w-4 h-4 text-pure-black fill-current" /> Add Soundtrack to {uploadType}
              </button>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-white brutal-border border-2 border-pure-black shadow-[3px_3px_0px_#111] rounded-lg">
                <div className="w-10 h-10 rounded brutal-border border bg-light-gray overflow-hidden shrink-0">
                  <img src={selectedSong.coverUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <h4 className="font-display text-xs uppercase text-pure-black truncate">{selectedSong.title}</h4>
                  <p className="text-[9px] font-mono text-mid-gray uppercase truncate">
                    {selectedSong.artist} • Trimmed to {selectedSong.duration}s (starts {selectedSong.startTime}s)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMusicSelectorOpen(true)}
                  className="px-2.5 py-1.5 bg-light-gray hover:bg-brutal-yellow text-pure-black border border-pure-black text-[9px] font-display uppercase tracking-wide cursor-pointer rounded"
                >
                  Edit Trimming
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSong(null)}
                  className="p-1.5 rounded bg-error-red text-white border border-pure-black shadow-[1.5px_1.5px_0px_#111] hover:shadow-none hover:translate-y-0.5 cursor-pointer"
                  title="Remove soundtrack"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Caption Area (Post Mode only) */}
        {uploadType === 'post' && capturedImage && (
          <div className="space-y-2">
            <label className="text-xs font-display uppercase tracking-wider text-mid-gray">
              Write a Caption
            </label>
            <textarea
              placeholder="Tell other space travelers about this photo... (Keep it emoji-free)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full bg-white text-pure-black font-bold text-xs brutal-border p-3 rounded-lg shadow-[3px_3px_0px_#111] outline-none min-h-[80px]"
            />
          </div>
        )}

        {/* Alert note */}
        <div className="bg-[#FFE834]/15 border border-[#FFE834] p-3 rounded flex gap-2.5 items-start text-pure-black select-none">
          <AlertCircle className="w-4 h-4 shrink-0 text-pure-black mt-0.5" />
          <p className="text-[10px] font-bold uppercase leading-normal tracking-wide text-mid-gray">
            Stories are kept active on user feeds for exactly 24 hours, after which they are expired automatically by the system.
          </p>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={isUploading || !capturedImage}
          variant="primary"
          className="w-full py-3.5 text-sm font-display uppercase tracking-widest brutal-shadow-card cursor-pointer"
        >
          {isUploading 
            ? 'Uploading Media Space...' 
            : uploadType === 'post' 
              ? 'Publish Post to Feed' 
              : 'Post Active 24h Story'}
        </Button>

      </form>

      {/* Music Trimmer Selector */}
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
