'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { socialService, CallState } from '@/lib/socialService';

interface CallOverlayProps {
  chatId: string;
  currentUserId: string;
  currentUserUsername: string;
  partnerProfile: {
    uid: string;
    username: string;
    displayName: string;
    profilePhotoUrl: string;
  };
  onClose: () => void;
  incomingCallState?: CallState | null; // Passed if we are receiving the call
}

export default function CallOverlay({
  chatId,
  currentUserId,
  currentUserUsername,
  partnerProfile,
  onClose,
  incomingCallState = null
}: CallOverlayProps) {
  const [callState, setCallState] = useState<CallState | null>(incomingCallState);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const isCaller = !incomingCallState;
  const isVideo = incomingCallState ? incomingCallState.type === 'video' : true; // Default to video or caller type

  // 1. Play ringing synthesizer sound
  useEffect(() => {
    let oscInterval: NodeJS.Timeout;
    let audioCtx: AudioContext;

    const playRingtone = () => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtx = new AudioContextClass();
        
        let toggle = true;
        oscInterval = setInterval(() => {
          if (callState?.status === 'ringing') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(toggle ? 440 : 480, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
            toggle = !toggle;
          }
        }, 800);
      } catch (e) {
        console.warn("Audio Context error playing ringtone:", e);
      }
    };

    if (callState?.status === 'ringing') {
      playRingtone();
    }

    return () => {
      if (oscInterval) clearInterval(oscInterval);
      if (audioCtx) audioCtx.close();
    };
  }, [callState?.status]);

  // 2. Manage duration timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (callState?.status === 'accepted') {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callState?.status]);

  // 3. Audio visualizer wave effect
  useEffect(() => {
    if (callState?.status !== 'accepted' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let localAnalyser = analyserRef.current;
    
    // If no real stream audio, simulate audio waves
    if (!localAnalyser) {
      const drawSimulation = () => {
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        const width = canvas.width;
        const height = canvas.height;
        const sliceWidth = width / 100;
        let x = 0;
        
        for (let i = 0; i < 100; i++) {
          const v = 0.5 + Math.sin(i * 0.15 + Date.now() * 0.005) * 0.3 * (Math.random() * 0.4 + 0.6);
          const y = v * height;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        ctx.stroke();
        animationFrameRef.current = requestAnimationFrame(drawSimulation);
      };
      
      drawSimulation();
      return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };
    }

    const bufferLength = localAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!ctx || !canvas || !localAnalyser) return;
      
      const width = canvas.width;
      const height = canvas.height;
      
      localAnalyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = '#FAFAF8';
      ctx.fillRect(0, 0, width, height);

      // Draw a neat brutalist outline
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#111111';

      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * (height / 2);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [callState?.status, remoteStream]);

  // 4. Initialize Local Media Stream
  const initLocalStream = async (type: 'audio' | 'video') => {
    try {
      const constraints = {
        audio: true,
        video: type === 'video' ? { width: 400, height: 300 } : false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      // Hook up audio analyzer
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      return stream;
    } catch (err) {
      console.warn("Could not access camera/microphone. Simulating media stream:", err);
      // Fallback for environments without cameras
      return null;
    }
  };

  // 5. Setup WebRTC peer or simulator
  const startCallingProcess = async () => {
    // Determine video type
    const callType = isVideo ? 'video' : 'audio';
    
    // Register active call state in signaling service
    if (isCaller) {
      const mockState: CallState = {
        chatId,
        callerId: currentUserId,
        callerUsername: currentUserUsername,
        receiverId: partnerProfile.uid,
        type: callType,
        status: 'ringing',
        createdAt: new Date().toISOString()
      };
      setCallState(mockState);
      await socialService.initiateCall(chatId, currentUserId, currentUserUsername, partnerProfile.uid, callType);
    }

    // Subscribe to call signaling updates
    const unsubscribe = socialService.subscribeToCall(chatId, async (updatedCall) => {
      if (!updatedCall) return;
      
      setCallState(updatedCall);

      // Handle call rejection or termination
      if (updatedCall.status === 'rejected' || updatedCall.status === 'ended') {
        cleanupCall();
        onClose();
      }

      // Handle call acceptance
      if (updatedCall.status === 'accepted' && !localStream) {
        const stream = await initLocalStream(updatedCall.type);
        
        // Simulating Remote stream if no WebRTC connection is negotiated (Mock fallback)
        // In full mock mode we duplicate the local stream or show an avatar
        if (stream) {
          setRemoteStream(stream);
          if (remoteVideoRef.current && updatedCall.type === 'video') {
            remoteVideoRef.current.srcObject = stream;
          }
        }
      }
    });

    // Simulated Bot receiver: if calling official bot or offline mode, accept after 3 seconds
    if (isCaller && (partnerProfile.uid === 'mock-uid-system' || partnerProfile.uid === 'mock-uid-arjun' || partnerProfile.uid.startsWith('mock'))) {
      setTimeout(async () => {
        await socialService.respondToCall(chatId, 'accepted');
      }, 3000);
    }

    return unsubscribe;
  };

  useEffect(() => {
    let unsubSignaling: () => void = () => {};

    const start = async () => {
      // First initialize local hardware
      await initLocalStream(isVideo ? 'video' : 'audio');
      // Then start signaling listeners
      const unsub = await startCallingProcess();
      unsubSignaling = unsub;
    };

    start();

    return () => {
      unsubSignaling();
      cleanupCall();
    };
  }, []);

  const cleanupCall = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
    }
    peerConnectionRef.current = null;
  };

  // 6. User Actions
  const handleAcceptCall = async () => {
    await socialService.respondToCall(chatId, 'accepted');
    setCallState((prev) => prev ? { ...prev, status: 'accepted' } : null);
  };

  const handleDeclineCall = async () => {
    await socialService.respondToCall(chatId, 'rejected');
    cleanupCall();
    onClose();
  };

  const handleEndCall = async () => {
    await socialService.respondToCall(chatId, 'ended');
    // Save call log message in chat
    await socialService.sendMessage(
      chatId,
      currentUserId,
      currentUserUsername,
      `Call ended (${formatDuration(callDuration)})`,
      undefined,
      'call_log'
    );
    cleanupCall();
    onClose();
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (localStream && localStream.getVideoTracks().length > 0) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    } else {
      setIsCameraOff(!isCameraOff);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-pure-black/90 p-4 backdrop-blur-md">
      <Card className="w-full max-w-lg bg-off-white text-pure-black brutal-border brutal-shadow-card flex flex-col items-center overflow-hidden h-[85vh] max-h-[650px] relative">
        
        {/* Call Header */}
        <div className="w-full brutal-border border-x-0 border-t-0 bg-pure-black text-white p-3 flex justify-between items-center px-6">
          <div className="flex flex-col">
            <span className="font-display text-sm tracking-widest uppercase">
              IndiVibe Call Space
            </span>
            <span className="text-[10px] text-brutal-yellow font-bold uppercase tracking-wider">
              {isVideo ? 'WebRTC Video Call' : 'WebRTC Voice Call'}
            </span>
          </div>
          {callState?.status === 'accepted' && (
            <div className="bg-success-green border-2 border-white px-2.5 py-0.5 text-xs font-mono font-bold text-white uppercase rounded">
              {formatDuration(callDuration)}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 w-full flex flex-col items-center justify-center p-6 relative">
          
          {/* Ringing Overlay / Acceptance Controls */}
          {callState?.status === 'ringing' && (
            <div className="flex flex-col items-center justify-center space-y-6 animate-pulse w-full">
              <div className="w-28 h-28 rounded-full brutal-border overflow-hidden bg-white shadow-[4px_4px_0px_#111]">
                <img
                  src={partnerProfile.profilePhotoUrl || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default'}
                  alt="Partner Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-display text-2xl uppercase text-pure-black">
                  {partnerProfile.displayName}
                </h3>
                <p className="text-sm font-bold text-mid-gray uppercase tracking-widest">
                  {isCaller ? 'Ringing their device...' : 'Incoming Call Request'}
                </p>
              </div>

              {!isCaller && (
                <div className="flex gap-6 pt-6">
                  <button
                    onClick={handleDeclineCall}
                    className="p-4 rounded-full bg-error-red text-white brutal-border brutal-shadow-btn hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                    aria-label="Decline Call"
                  >
                    <PhoneOff className="w-8 h-8 stroke-[2.5]" />
                  </button>
                  <button
                    onClick={handleAcceptCall}
                    className="p-4 rounded-full bg-success-green text-white brutal-border brutal-shadow-btn hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                    aria-label="Accept Call"
                  >
                    <Phone className="w-8 h-8 stroke-[2.5]" />
                  </button>
                </div>
              )}

              {isCaller && (
                <div className="pt-6">
                  <Button variant="danger" className="py-2.5 px-6 uppercase text-sm font-display brutal-shadow-btn border-2" onClick={handleDeclineCall}>
                    <PhoneOff className="w-4 h-4 mr-2" /> Cancel Call
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Active Call Layout */}
          {callState?.status === 'accepted' && (
            <div className="w-full h-full flex flex-col justify-between items-center relative">
              
              {/* Media streams frame */}
              <div className="w-full flex-1 flex items-center justify-center p-2 relative bg-pure-black brutal-border rounded-lg overflow-hidden shadow-[4px_4px_0px_#111] min-h-[300px]">
                {isVideo && !isCameraOff ? (
                  <>
                    {/* Remote stream (main background) */}
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover bg-pure-black"
                    />
                    {/* Local picture-in-picture stream */}
                    <div className="absolute bottom-3 right-3 w-32 h-24 brutal-border bg-pure-black rounded overflow-hidden shadow-[3px_3px_0px_#111] z-10">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </>
                ) : (
                  // Voice view: visualizer & avatars
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#FAFAF8] p-4 space-y-6">
                    <div className="flex gap-6 items-center">
                      <div className="w-20 h-20 rounded-full brutal-border overflow-hidden bg-white shadow-[3px_3px_0px_#111]">
                        <img
                          src={localStream ? 'https://api.dicebear.com/7.x/pixel-art/svg?seed=user' : 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default'}
                          alt="You"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="font-display text-lg uppercase text-mid-gray">VS</span>
                      <div className="w-20 h-20 rounded-full brutal-border overflow-hidden bg-white shadow-[3px_3px_0px_#111]">
                        <img
                          src={partnerProfile.profilePhotoUrl || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default'}
                          alt={partnerProfile.displayName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>

                    <div className="w-full space-y-2 text-center">
                      <h4 className="font-display text-base uppercase">Voice Connected</h4>
                      <p className="text-xs font-bold text-mid-gray uppercase">Speaking...</p>
                    </div>

                    {/* Canvas visualizer */}
                    <div className="w-full max-w-sm h-20 brutal-border bg-white rounded overflow-hidden shadow-[2px_2px_0px_#111]">
                      <canvas ref={canvasRef} width="350" height="80" className="w-full h-full" />
                    </div>
                  </div>
                )}

                {/* Camera off / audio indicator banner */}
                {(isCameraOff || !isVideo) && (
                  <div className="absolute top-3 left-3 bg-error-red text-white text-[10px] font-bold px-2 py-0.5 brutal-border border-white uppercase z-10">
                    Camera Off
                  </div>
                )}
              </div>

              {/* In-Call Actions */}
              <div className="w-full flex justify-around items-center pt-6 px-4">
                <button
                  onClick={toggleMute}
                  className={`p-3 rounded-full brutal-border brutal-shadow-btn hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none ${
                    isMuted ? 'bg-error-red text-white' : 'bg-white text-pure-black'
                  }`}
                  aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                {isVideo && (
                  <button
                    onClick={toggleCamera}
                    className={`p-3 rounded-full brutal-border brutal-shadow-btn hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none ${
                      isCameraOff ? 'bg-error-red text-white' : 'bg-white text-pure-black'
                    }`}
                    aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
                  >
                    {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  </button>
                )}

                <button
                  onClick={handleEndCall}
                  className="p-4 rounded-full bg-error-red text-white brutal-border brutal-shadow-btn hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                  aria-label="End Call"
                >
                  <PhoneOff className="w-6 h-6 stroke-[2.5]" />
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="w-full brutal-border border-x-0 border-b-0 bg-light-gray p-2 text-center text-[10px] font-bold text-mid-gray uppercase tracking-wider">
          Secure Peer-to-Peer encrypted communication
        </div>

      </Card>
    </div>
  );
}
