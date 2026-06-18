'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Camera, FlipHorizontal, Image as ImageIcon, Zap, ZapOff, X, Send, Type, Undo, CheckCircle2, Music, Video, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/store/uiStore';
import { socialService } from '@/lib/socialService';
import { SongSelectorModal } from '@/components/ui/SongSelectorModal';
import { MentionAutocomplete } from '@/components/ui/MentionAutocomplete';

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
  const overlayInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [flashOn, setFlashOn] = useState(false);
  const [showFlashOverlay, setShowFlashOverlay] = useState(false);
  
  // Camera Mode: photo vs video
  const [cameraMode, setCameraMode] = useState<'photo' | 'video'>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Capture States
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedVideo, setCapturedVideo] = useState<string | null>(null);
  const [capturedVideoBlob, setCapturedVideoBlob] = useState<Blob | null>(null);
  const [publishType, setPublishType] = useState<'story' | 'post'>('story');
  const [isPublishing, setIsPublishing] = useState(false);

  // Text Overlay state
  const [overlayText, setOverlayText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textBg, setTextBg] = useState(true);
  const [textPosition, setTextPosition] = useState({ x: 50, y: 45 }); // Percentages
  const [overlayCursorPos, setOverlayCursorPos] = useState(0);

  // Music state
  const [selectedSong, setSelectedSong] = useState<any | null>(null);
  const [isMusicSelectorOpen, setIsMusicSelectorOpen] = useState(false);
  const [audience, setAudience] = useState<'public' | 'close_friends'>('public');
  const [isMuted, setIsMuted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);

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
        audio: cameraMode === 'video' ? true : false
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
    if (isOpen && !capturedImage && !capturedVideo) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, facingMode, capturedImage, capturedVideo, cameraMode]);

  // Selected song background preview playing
  useEffect(() => {
    if (selectedSong && (capturedImage || capturedVideo)) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(selectedSong.audioUrl);
      audio.currentTime = selectedSong.startTime;
      audio.play().catch(e => console.warn(e));
      previewAudioRef.current = audio;

      const endThreshold = selectedSong.startTime + selectedSong.duration;
      if (previewTimerRef.current) clearInterval(previewTimerRef.current);
      previewTimerRef.current = setInterval(() => {
        if (audio.currentTime >= endThreshold || audio.ended) {
          audio.currentTime = selectedSong.startTime;
        }
      }, 100);
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (previewTimerRef.current) {
        clearInterval(previewTimerRef.current);
        previewTimerRef.current = null;
      }
    }

    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      if (previewTimerRef.current) {
        clearInterval(previewTimerRef.current);
      }
    };
  }, [selectedSong, capturedImage, capturedVideo]);

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
      if (file.size > 15 * 1024 * 1024) {
        addToast("File size too large. Max is 15MB.", "error");
        return;
      }
      const isVideoFile = file.type.startsWith('video/');
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isVideoFile) {
          setCapturedVideo(reader.result as string);
          setCapturedVideoBlob(file);
          setCapturedImage(null);
        } else {
          setCapturedImage(reader.result as string);
          setCapturedVideo(null);
          setCapturedVideoBlob(null);
        }
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
      setCapturedVideo(null);
      setCapturedVideoBlob(null);
      stopCamera();
    }
  };

  // Video recording controls
  const handleStartRecording = () => {
    if (!stream) return;
    recordedChunksRef.current = [];
    let options = { mimeType: 'video/webm;codecs=vp9,opus' };
    let recorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch (e) {
      try {
        recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      } catch (e2) {
        recorder = new MediaRecorder(stream);
      }
    }
    
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/mp4' });
      const videoUrl = URL.createObjectURL(blob);
      setCapturedVideo(videoUrl);
      setCapturedVideoBlob(blob);
      setCapturedImage(null);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(10);
    setIsRecording(true);
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
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
        const isStory = publishType === 'story';

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
              
              const x = (textPosition.x / 100) * canvas.width;
              const y = (textPosition.y / 100) * canvas.height;
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
          // Standard post compile (keep original aspect)
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
              
              const x = (textPosition.x / 100) * canvas.width;
              const y = (textPosition.y / 100) * canvas.height;
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

  const convertBlobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Publish Story/Post
  const handlePublish = async () => {
    if (!capturedImage && !capturedVideoBlob) return;

    setIsPublishing(true);
    addToast(`Publishing your new ${publishType}...`, 'info');

    try {
      let finalMediaUrl = '';
      let mediaType: 'image' | 'video' = capturedVideoBlob ? 'video' : 'image';

      if (capturedVideoBlob) {
        const base64Video = await convertBlobToBase64(capturedVideoBlob);
        try {
          const response = await fetch('/api/cloudinary', {
            method: 'POST',
            body: JSON.stringify({ file: base64Video, folder: publishType === 'story' ? 'indivibe_stories' : 'indivibe_posts' }),
            headers: { 'Content-Type': 'application/json' }
          });
          const data = await response.json();
          if (data.success && data.secure_url) {
            finalMediaUrl = data.secure_url;
          } else {
            throw new Error(data.error || "Cloudinary failed");
          }
        } catch (err) {
          console.warn("Cloudinary video upload failed, using fallback local url:", err);
          finalMediaUrl = capturedVideo || '';
        }
      } else {
        const compiledBase64 = await compileFinalImage();
        finalMediaUrl = compiledBase64;
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
      }

      if (publishType === 'story') {
        // Save as Story
        await socialService.createStory(
          currentUserId,
          currentUserUsername,
          currentUserProfile?.profilePhotoUrl || '',
          finalMediaUrl,
          mediaType,
          selectedSong || undefined,
          audience,
          overlayText,
          textPosition,
          textColor,
          textBg
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
          mediaType,
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
    setCapturedVideo(null);
    setCapturedVideoBlob(null);
    setOverlayText('');
    setSelectedSong(null);
    setIsMusicSelectorOpen(false);
    setIsPublishing(false);
    setTextPosition({ x: 50, y: 45 });
    onClose();
  };

  // Draggable text pointer handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setTextPosition({
      x: Math.max(5, Math.min(95, x)),
      y: Math.max(5, Math.min(95, y))
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

  const handleSelectMentionOverlay = (username: string, start: number, end: number) => {
    const text = overlayText;
    const newText = text.substring(0, start) + '@' + username + ' ' + text.substring(end);
    setOverlayText(newText);
    setTimeout(() => {
      if (overlayInputRef.current) {
        overlayInputRef.current.focus();
        const cursor = start + username.length + 2;
        overlayInputRef.current.setSelectionRange(cursor, cursor);
        setOverlayCursorPos(cursor);
      }
    }, 10);
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

          {!capturedImage && !capturedVideo && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFlashOn(!flashOn)}
                className="w-10 h-10 rounded-full bg-pure-black/60 border border-white/20 text-white flex items-center justify-center hover:bg-pure-black transition-colors"
              >
                {flashOn ? <Zap className="w-5 h-5 text-brutal-yellow" /> : <ZapOff className="w-5 h-5" />}
              </button>
            </div>
          )}

          {(capturedImage || capturedVideo) && (
            <div className="flex gap-2">
              {/* Text styling bg shield toggle */}
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
        <div ref={containerRef} className="flex-1 bg-pure-black flex items-center justify-center relative overflow-hidden">
          
          {/* CAMERA FEED */}
          {!capturedImage && !capturedVideo && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
          )}

          {/* CAPTURED IMAGE PREVIEW */}
          {capturedImage && (
            <div className="w-full h-full relative flex items-center justify-center bg-black">
              <img
                src={capturedImage}
                alt="Captured Preview"
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {/* CAPTURED VIDEO PREVIEW */}
          {capturedVideo && (
            <div className="w-full h-full relative flex items-center justify-center bg-black">
              <video
                src={capturedVideo}
                autoPlay
                loop
                muted={isMuted || !!selectedSong}
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {/* Dynamic Drag Text Overlay Render */}
          {(capturedImage || capturedVideo) && overlayText.trim() && (
            <div 
              style={{ 
                left: `${textPosition.x}%`, 
                top: `${textPosition.y}%`, 
                transform: 'translate(-50%, -50%)',
                position: 'absolute',
                cursor: 'move',
                touchAction: 'none'
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="max-w-[80%] text-center z-30"
            >
              <span 
                style={{ color: textColor }}
                className={`px-4 py-2 text-lg font-bold block rounded-xl break-words leading-relaxed select-none ${
                  textBg ? 'bg-pure-black/65 backdrop-blur-xs brutal-border text-white' : ''
                }`}
              >
                {overlayText}
              </span>
            </div>
          )}

          {/* Camera guidelines overlay */}
          {!capturedImage && !capturedVideo && (
            <div className="absolute inset-0 border-[6px] border-white/10 pointer-events-none flex items-center justify-center">
              <div className="w-[80%] h-[70%] border border-dashed border-white/20 rounded"></div>
            </div>
          )}

          {/* Photo/Video Mode Selector Overlay for Camera */}
          {!capturedImage && !capturedVideo && (
            <div className="absolute bottom-20 left-0 right-0 flex justify-center z-30">
              <div className="bg-pure-black/60 border border-white/20 px-3 py-1 flex gap-1.5 rounded-full backdrop-blur-xs">
                <button
                  type="button"
                  onClick={() => setCameraMode('photo')}
                  className={`px-3 py-1 rounded-full text-[9px] font-display uppercase transition-colors ${
                    cameraMode === 'photo' ? 'bg-brutal-yellow text-pure-black font-bold' : 'text-white/60'
                  }`}
                >
                  Photo
                </button>
                <button
                  type="button"
                  onClick={() => setCameraMode('video')}
                  className={`px-3 py-1 rounded-full text-[9px] font-display uppercase transition-colors ${
                    cameraMode === 'video' ? 'bg-error-red text-white font-bold' : 'text-white/60'
                  }`}
                >
                  Video
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. Controls Panel */}
        <div className="bg-pure-black p-5 border-t border-white/15 flex flex-col gap-4">
          
          {/* Preview overlay text input */}
          {(capturedImage || capturedVideo) && (
            <div className="space-y-2.5">
              <div className="relative">
                <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-2">
                  <Type className="w-4 h-4 text-white/60 shrink-0" />
                  <input
                    ref={overlayInputRef}
                    type="text"
                    placeholder="Type text overlay..."
                    value={overlayText}
                    onChange={(e) => {
                      setOverlayText(e.target.value);
                      setOverlayCursorPos(e.target.selectionStart || 0);
                    }}
                    onKeyUp={(e) => setOverlayCursorPos((e.target as any).selectionStart || 0)}
                    onClick={(e) => setOverlayCursorPos((e.target as any).selectionStart || 0)}
                    className="bg-transparent border-none outline-none text-white text-xs w-full font-bold"
                    maxLength={60}
                  />
                </div>

                <MentionAutocomplete
                  inputValue={overlayText}
                  cursorPosition={overlayCursorPos}
                  currentUserId={currentUserId}
                  onSelect={handleSelectMentionOverlay}
                  className="bottom-full mb-1 left-0 text-pure-black"
                />
              </div>
              
              {/* Color Selection Palette */}
              <div className="flex gap-2 justify-center">
                {['#ffffff', '#FFE834', '#000000', '#FF3B30', '#34C759', '#007AFF'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setTextColor(color)}
                    className={`w-5 h-5 rounded-full border border-white flex items-center justify-center`}
                    style={{ backgroundColor: color }}
                  >
                    {textColor === color && (
                      <div className={`w-1.5 h-1.5 rounded-full ${color === '#ffffff' || color === '#FFE834' ? 'bg-black' : 'bg-white'}`}></div>
                    )}
                  </button>
                ))}
              </div>

              {/* Mute Video original sound */}
              {capturedVideo && (
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className={`w-full py-1.5 border rounded-lg text-[10px] font-display uppercase transition-colors flex items-center justify-center gap-1 ${
                    isMuted || selectedSong ? 'bg-error-red/25 border-error-red text-white' : 'border-white/20 text-white/60'
                  }`}
                  disabled={!!selectedSong}
                >
                  {isMuted || selectedSong ? (
                    <><VolumeX className="w-3 h-3" /> Audio Muted</>
                  ) : (
                    <><Volume2 className="w-3 h-3" /> Original Audio On</>
                  )}
                </button>
              )}

              {/* Music Selection Overlay inside controls */}
              <div className="pt-0.5">
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
          {!capturedImage && !capturedVideo ? (
            <div className="flex justify-between items-center px-4">
              
              {/* Gallery button */}
              <button
                type="button"
                onClick={handleGalleryClick}
                className="w-12 h-12 rounded-full bg-white/15 border border-white/20 text-white flex items-center justify-center hover:bg-white/30 active:scale-95 transition-all cursor-pointer"
                title="Select from Gallery"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Shutter Capture / Recording Button */}
              {cameraMode === 'photo' ? (
                <button
                  type="button"
                  onClick={handleCapture}
                  className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center p-1 bg-transparent hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <div className="w-full h-full rounded-full bg-white hover:bg-light-gray transition-colors"></div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  className={`w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-transparent hover:scale-105 active:scale-95 transition-all cursor-pointer ${
                    isRecording ? 'border-error-red animate-pulse' : ''
                  }`}
                >
                  <div className={`rounded-full transition-all ${isRecording ? 'w-8 h-8 bg-error-red rounded-sm' : 'w-full h-full bg-white'}`}></div>
                </button>
              )}

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
                onClick={() => {
                  setCapturedImage(null);
                  setCapturedVideo(null);
                  setCapturedVideoBlob(null);
                  setSelectedSong(null);
                  setTextPosition({ x: 50, y: 45 });
                }}
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

          {/* Story Audience Selection */}
          {publishType === 'story' && (
            <div className="flex items-center gap-3 p-2 bg-white/5 border border-white/15 rounded-lg shrink-0 mb-1 justify-between">
              <span className="text-[10px] font-display uppercase text-white tracking-wider font-extrabold">Audience:</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setAudience('public')}
                  className={`px-3 py-1 rounded-full text-[8px] font-display uppercase tracking-wider border transition-colors cursor-pointer ${
                    audience === 'public' 
                      ? 'bg-brutal-yellow text-pure-black border-brutal-yellow font-bold shadow-[1px_1px_0px_#111]' 
                      : 'bg-transparent text-white/60 border-white/20'
                  }`}
                >
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setAudience('close_friends')}
                  className={`px-3 py-1 rounded-full text-[8px] font-display uppercase tracking-wider border transition-colors cursor-pointer ${
                    audience === 'close_friends' 
                      ? 'bg-[#34C759] text-white border-[#34C759] font-bold shadow-[1px_1px_0px_#111]' 
                      : 'bg-transparent text-white/60 border-white/20'
                  }`}
                >
                  ⭐ Close Friends
                </button>
              </div>
            </div>
          )}

          {/* Mode Selector (Story vs Post) */}
          <div className="flex justify-center border-t border-white/10 pt-3">
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
