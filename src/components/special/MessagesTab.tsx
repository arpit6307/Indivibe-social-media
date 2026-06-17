'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, Video, Send, Mic, Play, Pause, ChevronLeft, 
  MessageSquare, User, AudioLines, Info, Volume2, Trash2, Edit, X, Eraser, MoreVertical 
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/store/uiStore';
import { socialService, Chat, Message } from '@/lib/socialService';
import { formatISTTime } from '@/lib/timeUtils';

interface MessagesTabProps {
  currentUserId: string;
  currentUserUsername: string;
  onViewProfile?: (uid: string) => void;
  onInitiateCall: (partnerProfile: any, type: 'audio' | 'video') => void;
}

export default function MessagesTab({
  currentUserId,
  currentUserUsername,
  onViewProfile,
  onInitiateCall
}: MessagesTabProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  
  // Real-time Typing Indicator states
  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Active playing Voice Message ID
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioElementsRef = useRef<{ [msgId: string]: HTMLAudioElement }>({});
  const playCanvasRefs = useRef<{ [msgId: string]: HTMLCanvasElement | null }>({});
  const animFrameRefs = useRef<{ [msgId: string]: number }>({});

  const [activeTabMobile, setActiveTabMobile] = useState<'list' | 'chat'>('list');

  // Device type detection state
  const [isMobile, setIsMobile] = useState(false);

  // Swipe delete states for mobile (Elastic / Dynamic tracking)
  const [swipedChatId, setSwipedChatId] = useState<string | null>(null);
  const [activeSwipeId, setActiveSwipeId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const touchStartRef = useRef<number | null>(null);

  // Message edit/delete context menu state
  const [activeMessageMenu, setActiveMessageMenu] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const addToast = useUIStore((state) => state.addToast);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Screen resize handler to detect mobile viewport
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load chat rooms
  const loadChats = async () => {
    try {
      const chatList = await socialService.getChats(currentUserId);
      setChats(chatList);
      
      // Update selectedChat reference to keep unreadBy lists updated in real time
      if (selectedChat) {
        const freshSelected = chatList.find(c => c.chatId === selectedChat.chatId);
        if (freshSelected) {
          setSelectedChat(freshSelected);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Poll chats periodically to sync unread status and new chats
  useEffect(() => {
    loadChats();
    const interval = setInterval(loadChats, 5000);
    return () => clearInterval(interval);
  }, [currentUserId, selectedChat?.chatId]);

  // Subscribe to messages when a chat is selected
  useEffect(() => {
    if (!selectedChat?.chatId) return;

    const unsubscribe = socialService.subscribeToMessages(selectedChat.chatId, (newMessages) => {
      setMessages(prev => {
        // Find any optimistic (temp) messages currently sending
        const tempMessages = prev.filter(m => m.messageId.startsWith('temp-'));
        // Filter out temp messages that have now been delivered (matching text and sender)
        const uniqueTemp = tempMessages.filter(temp => 
          !newMessages.some(m => m.senderId === temp.senderId && m.text === temp.text)
        );
        return [...newMessages, ...uniqueTemp];
      });
      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [selectedChat?.chatId]);

  // Subscribe to partner's typing status
  useEffect(() => {
    if (!selectedChat?.chatId) {
      setPartnerTyping(false);
      return;
    }
    const partnerId = selectedChat.participants.find(id => id !== currentUserId) || '';
    const unsubscribe = socialService.subscribeToTyping(selectedChat.chatId, partnerId, (isTyping) => {
      setPartnerTyping(isTyping);
    });
    return () => {
      unsubscribe();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [selectedChat?.chatId, currentUserId]);

  // Scroll to bottom when partner is typing
  useEffect(() => {
    if (partnerTyping) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [partnerTyping]);

  // Handle selecting a chat room and mark it read
  const handleSelectChat = async (chat: Chat) => {
    if (isMobile && swipedChatId === chat.chatId) {
      // If mobile card is swiped, clicking it closes the swipe instead of selecting the chat
      setSwipedChatId(null);
      return;
    }

    setSelectedChat(chat);
    setActiveTabMobile('chat');
    setSwipedChatId(null); // Reset swipe state on selection

    if (chat.unreadBy?.includes(currentUserId)) {
      // Optimistically clear unread badge locally
      setChats(prev => prev.map(c => 
        c.chatId === chat.chatId 
          ? { ...c, unreadBy: c.unreadBy?.filter(id => id !== currentUserId) || [] }
          : c
      ));
      try {
        await socialService.markChatAsRead(chat.chatId, currentUserId);
      } catch (err) {
        console.error("Failed to mark chat as read:", err);
      }
    }
  };

  // Delete entire chat room
  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat room? This will delete all messages for both users.")) return;
    try {
      await socialService.deleteChat(chatId);
      setChats(prev => prev.filter(c => c.chatId !== chatId));
      if (selectedChat?.chatId === chatId) {
        setSelectedChat(null);
        setMessages([]);
      }
      setSwipedChatId(null);
      addToast("Chat deleted successfully", "info");
    } catch (err) {
      addToast("Failed to delete chat", "error");
    }
  };

  // Clear chat logs
  const handleClearChat = async () => {
    if (!selectedChat) return;
    if (!confirm("Are you sure you want to clear all messages? This will clear the chat history for both users.")) return;
    try {
      await socialService.clearChat(selectedChat.chatId);
      setMessages([]);
      addToast("Chat cleared successfully", "info");
    } catch (err) {
      addToast("Failed to clear chat", "error");
    }
  };

  // Handle input text change and set typing status
  const handleInputChange = (text: string) => {
    setMessageText(text);
    if (!selectedChat) return;

    socialService.setTypingStatus(selectedChat.chatId, currentUserId, true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socialService.setTypingStatus(selectedChat.chatId, currentUserId, false);
    }, 2000);
  };

  // Text message submit (Optimistic Send)
  const handleSendMessage = async () => {
    if (!selectedChat || !messageText.trim()) return;

    const textToSend = messageText.trim();
    setMessageText('');

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socialService.setTypingStatus(selectedChat.chatId, currentUserId, false);

    // Create optimistic message object
    const tempId = `temp-${Math.random().toString(36).substring(2, 9)}`;
    const optimisticMsg: Message = {
      messageId: tempId,
      senderId: currentUserId,
      senderUsername: currentUserUsername,
      text: textToSend,
      mediaType: 'text',
      createdAt: new Date().toISOString()
    };

    // Render immediately
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    try {
      await socialService.sendMessage(
        selectedChat.chatId,
        currentUserId,
        currentUserUsername,
        textToSend,
        undefined,
        'text'
      );
      loadChats(); // refresh last message preview in list
    } catch (err) {
      // Remove the optimistic message on error and restore input
      setMessages(prev => prev.filter(m => m.messageId !== tempId));
      setMessageText(textToSend);
      addToast("Failed to send message", "error");
    }
  };

  // Voice Recording triggers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert to base64 to store in DB
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          if (selectedChat) {
            await socialService.sendMessage(
              selectedChat.chatId,
              currentUserId,
              currentUserUsername,
              "Voice note",
              base64Audio,
              'voice'
            );
            loadChats();
          }
        };

        // stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.warn("Audio recording permissions denied/unavailable. Simulating Voice DM:", err);
      setIsRecording(true);
      setRecordDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      setIsRecording(false);
      if (selectedChat) {
        socialService.sendMessage(
          selectedChat.chatId,
          currentUserId,
          currentUserUsername,
          "Voice note",
          "MOCK_AUDIO_DATA_URL",
          'voice'
        );
        loadChats();
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Play voice message & animate canvas waveform
  const handlePlayVoice = (msgId: string, mediaUrl: string) => {
    if (playingVoiceId === msgId) {
      const audio = audioElementsRef.current[msgId];
      if (audio) audio.pause();
      setPlayingVoiceId(null);
      if (animFrameRefs.current[msgId]) cancelAnimationFrame(animFrameRefs.current[msgId]);
      return;
    }

    if (playingVoiceId) {
      const activeAudio = audioElementsRef.current[playingVoiceId];
      if (activeAudio) activeAudio.pause();
      if (animFrameRefs.current[playingVoiceId]) cancelAnimationFrame(animFrameRefs.current[playingVoiceId]);
    }

    let audio = audioElementsRef.current[msgId];
    if (!audio) {
      if (mediaUrl === 'MOCK_AUDIO_DATA_URL') {
        audio = new Audio();
        audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA';
      } else {
        audio = new Audio(mediaUrl);
      }
      audioElementsRef.current[msgId] = audio;
    }

    audio.play().catch(e => {
      setTimeout(() => {
        handleAudioEnded(msgId);
      }, 3000);
    });

    audio.onended = () => handleAudioEnded(msgId);
    setPlayingVoiceId(msgId);
    
    startCanvasVisualizer(msgId);
  };

  const handleAudioEnded = (msgId: string) => {
    setPlayingVoiceId(null);
    if (animFrameRefs.current[msgId]) cancelAnimationFrame(animFrameRefs.current[msgId]);
    
    const canvas = playCanvasRefs.current[msgId];
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      }
    }
  };

  const startCanvasVisualizer = (msgId: string) => {
    const canvas = playCanvasRefs.current[msgId];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    const render = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = '#FFE834'; 
      ctx.lineWidth = 2.5;
      
      ctx.beginPath();
      const sliceWidth = width / 40;
      let x = 0;
      
      for (let i = 0; i < 40; i++) {
        const magnitude = Math.sin(i * 0.3 + Date.now() * 0.015) * (height / 2.5) * (Math.random() * 0.4 + 0.6);
        const yTop = (height / 2) - magnitude;
        const yBottom = (height / 2) + magnitude;
        
        ctx.moveTo(x, yTop);
        ctx.lineTo(x, yBottom);
        x += sliceWidth;
      }
      ctx.stroke();
      
      animFrameRefs.current[msgId] = requestAnimationFrame(render);
    };

    render();
  };

  // Swipe gesture handlers for mobile (Elastic drag & snaps)
  const handleTouchStart = (e: React.TouchEvent, chatId: string) => {
    touchStartRef.current = e.touches[0].clientX;
    setActiveSwipeId(chatId);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartRef.current;
    
    // Only allow swipe left (negative horizontal drag values)
    if (diff < 0) {
      let offset = diff;
      if (diff < -100) {
        offset = -100 + (diff + 100) * 0.4; // apply spring friction/elastic resistance
      }
      setSwipeOffset(Math.max(offset, -160));
    } else {
      setSwipeOffset(0);
    }
  };

  const handleTouchEnd = (chatId: string) => {
    if (touchStartRef.current === null) return;
    
    // Snaps to either -90px (open delete menu) or snaps back to 0px
    if (swipeOffset < -70) {
      setSwipedChatId(chatId);
    } else {
      setSwipedChatId(null);
    }
    
    setActiveSwipeId(null);
    setSwipeOffset(0);
    touchStartRef.current = null;
  };

  const getCardTransform = (chatId: string) => {
    if (activeSwipeId === chatId && swipeOffset < 0) {
      return `translateX(${swipeOffset}px)`;
    }
    if (swipedChatId === chatId) {
      return 'translateX(-90px)';
    }
    return 'translateX(0px)';
  };

  const getDeleteBtnScale = (chatId: string) => {
    if (activeSwipeId === chatId && swipeOffset < 0) {
      const scale = Math.min(Math.max(Math.abs(swipeOffset) / 90, 0.6), 1.25);
      return `scale(${scale})`;
    }
    if (swipedChatId === chatId) {
      return 'scale(1)';
    }
    return 'scale(0.6)';
  };

  // Long-press Context Menu triggers
  const handleMessagePressStart = (msg: Message) => {
    if (msg.senderId !== currentUserId || msg.mediaType !== 'text') return;
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50);
      setActiveMessageMenu(msg);
    }, 600);
  };

  const handleMessagePressEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const isMessageEditable = (createdAt: string) => {
    const sentTime = new Date(createdAt).getTime();
    const now = new Date().getTime();
    return (now - sentTime) < 60 * 60 * 1000; // 1 hour limit
  };

  const handleDeleteMessage = async (msg: Message) => {
    try {
      await socialService.updateMessage(selectedChat!.chatId, msg.messageId, 'delete');
      setMessages(prev => prev.filter(m => m.messageId !== msg.messageId));
      setActiveMessageMenu(null);
      addToast("Message deleted (unsent)", "info");
    } catch (err) {
      addToast("Failed to delete message", "error");
    }
  };

  const startEditingMessage = (msg: Message) => {
    setEditingMessage(msg);
    setEditText(msg.text);
    setActiveMessageMenu(null);
  };

  const handleEditMessageSubmit = async () => {
    if (!editingMessage || !editText.trim()) return;
    try {
      await socialService.updateMessage(selectedChat!.chatId, editingMessage.messageId, 'edit', editText.trim());
      setMessages(prev => prev.map(m => 
        m.messageId === editingMessage.messageId 
          ? { ...m, text: editText.trim(), edited: true } 
          : m
      ));
      setEditingMessage(null);
      setEditText('');
      addToast("Message edited successfully", "info");
    } catch (err) {
      addToast("Failed to edit message", "error");
    }
  };

  return (
    <div className="brutal-border bg-white rounded-lg shadow-[4px_4px_0px_#111] overflow-hidden grid grid-cols-1 md:grid-cols-12 h-[75vh] max-h-[620px] select-none">
      
      {/* LEFT COLUMN: CHAT ROOMS LIST */}
      <div className={`md:col-span-4 border-r-3 border-pure-black flex flex-col h-full bg-[#FAFAF8] ${
        activeTabMobile === 'chat' && selectedChat ? 'hidden md:flex' : 'flex'
      }`}>
        
        {/* Header */}
        <div className="p-4 border-b-3 border-pure-black bg-pure-black text-white flex items-center justify-between">
          <span className="font-display text-sm uppercase tracking-wider">Conversations</span>
          <span className="text-[9px] font-extrabold uppercase bg-brutal-yellow text-pure-black px-2 py-0.5 border border-pure-black rounded animate-pulse">
            Active: {chats.length}
          </span>
        </div>

        {/* List of Chats */}
        <div className="flex-1 overflow-y-auto divide-y-2 divide-pure-black">
          {chats.map((chat) => {
            const partner = chat.partner;
            const isSelected = selectedChat?.chatId === chat.chatId;
            const hasUnread = chat.unreadBy?.includes(currentUserId);
            
            return (
              <div 
                key={chat.chatId} 
                className="relative overflow-hidden w-full group border-b-2 border-pure-black"
              >
                {/* Behind delete option (Mobile Only) */}
                {isMobile && (
                  <div className="absolute inset-0 bg-error-red flex justify-end items-center z-0">
                    <button
                      onClick={(e) => handleDeleteChat(e, chat.chatId)}
                      style={{
                        transform: getDeleteBtnScale(chat.chatId),
                        transition: activeSwipeId === null ? 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none'
                      }}
                      className="h-full w-[90px] bg-error-red text-white flex flex-col justify-center items-center font-display text-[9px] uppercase font-bold border-l-2 border-pure-black transition-all hover:bg-error-red/90"
                    >
                      <Trash2 className="w-4.5 h-4.5 mb-1" />
                      Delete
                    </button>
                  </div>
                )}

                {/* Front card */}
                <div
                  onTouchStart={(e) => isMobile && handleTouchStart(e, chat.chatId)}
                  onTouchMove={(e) => isMobile && handleTouchMove(e)}
                  onTouchEnd={() => isMobile && handleTouchEnd(chat.chatId)}
                  style={{
                    transform: isMobile ? getCardTransform(chat.chatId) : 'translateX(0px)',
                    transition: activeSwipeId === null ? 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none'
                  }}
                  onClick={() => handleSelectChat(chat)}
                  className={`relative z-10 p-3.5 flex items-center gap-3 cursor-pointer hover:bg-[#FFE834]/10 transition-colors ${
                    isSelected 
                      ? 'bg-[#FFE834]/30' 
                      : hasUnread 
                        ? 'bg-[#FF2A85]/5 border-l-6 border-[#FF2A85]' 
                        : 'bg-white'
                  }`}
                >
                  {/* Diagonal sash for unread DMs (retro brutalist style) */}
                  {hasUnread && (
                    <div className="absolute top-0 right-0 bg-[#FF2A85] text-white text-[8px] font-mono font-black px-1.5 py-0.5 rounded-bl border-l border-b border-pure-black uppercase tracking-wider shadow-[1px_1px_0px_#111] animate-pulse">
                      NEW DM
                    </div>
                  )}

                  <div className="w-11 h-11 rounded-full overflow-hidden brutal-border bg-white shadow-[2px_2px_0px_#111] shrink-0 relative">
                    <img
                      src={partner?.profilePhotoUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${partner?.uid || 'default'}`}
                      alt={partner?.displayName}
                      className="w-full h-full object-cover"
                    />
                    {hasUnread && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF2A85] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FF2A85] border-2 border-white"></span>
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className={`font-display text-xs uppercase truncate ${hasUnread ? 'text-[#FF2A85] font-black' : 'text-pure-black'}`}>
                        @{partner?.username || 'user'}
                      </h4>
                      {hasUnread && (
                        <span className="relative flex h-2.5 w-2.5 shrink-0 ml-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF2A85] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF2A85] border border-white"></span>
                        </span>
                      )}
                    </div>
                    <p className={`text-[10px] truncate mt-0.5 ${hasUnread ? 'font-extrabold text-pure-black' : 'font-bold text-mid-gray'}`}>
                      {chat.lastMessage || 'Open chat thread'}
                    </p>
                  </div>

                  {/* Desktop Hover Action */}
                  {!isMobile && (
                    <div className="shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100 flex items-center justify-center p-1 transition-opacity ml-auto">
                      <button
                        onClick={(e) => handleDeleteChat(e, chat.chatId)}
                        className="p-1.5 rounded brutal-border bg-white hover:bg-error-red hover:text-white text-mid-gray shadow-[1px_1px_0px_#111] transition-colors"
                        title="Delete Conversation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {chats.length === 0 && (
            <div className="p-8 text-center text-xs font-bold text-mid-gray uppercase leading-relaxed">
              No chat logs found. Use the Search tab to find user spaces and click Send Message!
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: CHAT THREAD WINDOW */}
      <div className={`md:col-span-8 flex flex-col h-full bg-white relative ${
        activeTabMobile === 'list' && selectedChat ? 'hidden md:flex' : 'flex'
      }`}>
        
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-3 border-b-3 border-pure-black bg-[#FAFAF8] flex items-center justify-between">
              
              {/* Back to list mobile shortcut */}
              <button 
                onClick={() => setActiveTabMobile('list')}
                className="md:hidden p-1.5 rounded brutal-border bg-white text-pure-black mr-2 hover:shadow-none shadow-[2px_2px_0px_#111]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div 
                onClick={() => onViewProfile?.(selectedChat.partner?.uid || '')}
                className="flex items-center gap-2.5 min-w-0 mr-4 cursor-pointer hover:opacity-80 transition-opacity"
                title="View Profile"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden brutal-border bg-white shrink-0">
                  <img
                    src={selectedChat.partner?.profilePhotoUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${selectedChat.partner?.uid || 'default'}`}
                    alt="Partner"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="font-display text-xs uppercase truncate leading-none mb-0.5 hover:text-brutal-yellow transition-colors">
                    {selectedChat.partner?.displayName}
                  </h4>
                  <span className="text-[8px] font-bold text-mid-gray uppercase block hover:text-brutal-yellow transition-colors">
                    @{selectedChat.partner?.username}
                  </span>
                </div>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearChat}
                  className="px-2.5 py-1.5 rounded-md bg-white brutal-border brutal-shadow-btn hover:translate-x-0 hover:translate-y-0 hover:shadow-none text-pure-black flex items-center gap-1 text-[9px] font-display uppercase font-bold"
                  title="Clear Chat History"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear Chat</span>
                </button>
                <button
                  onClick={() => onInitiateCall(selectedChat.partner, 'audio')}
                  className="p-2 rounded-md bg-white brutal-border brutal-shadow-btn hover:translate-x-0 hover:translate-y-0 hover:shadow-none text-pure-black"
                  aria-label="Audio Call"
                >
                  <Phone className="w-4.5 h-4.5" />
                </button>
                <button
                  onClick={() => onInitiateCall(selectedChat.partner, 'video')}
                  className="p-2 rounded-md bg-brutal-yellow brutal-border brutal-shadow-btn hover:translate-x-0 hover:translate-y-0 hover:shadow-none text-pure-black"
                  aria-label="Video Call"
                >
                  <Video className="w-4.5 h-4.5" />
                </button>
              </div>

            </div>

            {/* Chat Messages Log stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-off-white/40">
              
              <div className="bg-[#FAFAF8] brutal-border p-3 text-center rounded flex gap-2 max-w-md mx-auto mb-2 text-pure-black select-none">
                <Info className="w-4.5 h-4.5 text-pure-black shrink-0 mt-0.5" />
                <p className="text-[9px] font-bold uppercase leading-normal tracking-wide text-mid-gray">
                  Hover & click vertical dots (desktop) or touch-hold (mobile) to Edit/Delete own text messages.
                </p>
              </div>

              {messages.map((msg, idx) => {
                const isMe = msg.senderId === currentUserId;
                const isTemp = msg.messageId.startsWith('temp-');
                const isLastMessage = idx === messages.length - 1;

                // Seen status indicators: if recipient UID is not in unreadBy, they've opened the chat
                const partnerId = selectedChat.participants.find(id => id !== currentUserId) || '';
                const isSeen = !selectedChat.unreadBy?.includes(partnerId);
                
                return (
                  <div 
                    key={msg.messageId} 
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`flex items-center gap-2 group w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {/* Desktop options trigger (Hover only, self-sent messages) */}
                      {isMe && !isTemp && msg.mediaType === 'text' && !isMobile && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveMessageMenu(msg); }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded brutal-border bg-white text-pure-black shadow-[1px_1px_0px_#111] transition-opacity cursor-pointer shrink-0 hover:bg-light-gray"
                          title="Message Options"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <div 
                        onTouchStart={() => handleMessagePressStart(msg)}
                        onTouchEnd={handleMessagePressEnd}
                        onMouseDown={() => handleMessagePressStart(msg)}
                        onMouseUp={handleMessagePressEnd}
                        onClick={() => {
                          // Simple click to trigger menu
                          if (isMe && msg.mediaType === 'text') {
                            setActiveMessageMenu(msg);
                          }
                        }}
                        className={`max-w-[70%] p-3 brutal-border rounded-lg shadow-[2px_2px_0px_#111] transition-transform active:scale-95 cursor-pointer relative ${
                          isMe ? 'bg-brutal-yellow text-pure-black' : 'bg-white text-pure-black'
                        } ${isTemp ? 'opacity-60 border-dashed animate-pulse' : ''}`}
                      >
                        {/* Message content based on type */}
                        {msg.mediaType === 'voice' ? (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePlayVoice(msg.messageId, msg.mediaUrl || ''); }}
                              className="p-1.5 rounded-full bg-pure-black text-white hover:scale-105 transition-transform"
                              aria-label={playingVoiceId === msg.messageId ? "Pause" : "Play"}
                            >
                              {playingVoiceId === msg.messageId ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                            </button>
                            
                            {/* Animated Voice DM Waveform */}
                            <div className="w-24 h-6 brutal-border bg-white rounded overflow-hidden p-0.5">
                              <canvas
                                ref={(el) => {
                                  playCanvasRefs.current[msg.messageId] = el;
                                }}
                                width="96"
                                height="20"
                                className="w-full h-full"
                              />
                            </div>
                            
                            <AudioLines className="w-4.5 h-4.5 text-pure-black" />
                          </div>
                        ) : msg.mediaType === 'call_log' ? (
                          <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase text-mid-gray">
                            <Volume2 className="w-3.5 h-3.5" /> {msg.text}
                          </div>
                        ) : (
                          <p className="text-xs font-bold leading-normal break-words">{msg.text}</p>
                        )}

                        <span className="block text-[8px] font-bold text-mid-gray text-right mt-1.5 select-none">
                          {(msg as any).edited && <span className="text-error-red mr-1 font-mono uppercase font-black">(edited)</span>}
                          {formatISTTime(msg.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Seen/Sent status below the last self-sent message */}
                    {isMe && isLastMessage && !isTemp && (
                      <div className="text-[9px] font-extrabold uppercase mt-1 mr-1 tracking-wider select-none">
                        {isSeen ? (
                          <span className="text-[#128807] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#128807] inline-block animate-pulse" />
                            Seen
                          </span>
                        ) : (
                          <span className="text-mid-gray">Sent</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Bouncing dots typing indicator bubble */}
              {partnerTyping && (
                <div className="flex justify-start animate-[fadeIn_0.15s_ease-out]">
                  <div className="max-w-[70%] p-2.5 brutal-border border-2 rounded-lg shadow-[2px_2px_0px_#111] bg-white text-pure-black flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-mid-gray uppercase">
                      @{selectedChat.partner?.username} is typing
                    </span>
                    <span className="flex gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-mid-gray animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-mid-gray animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-mid-gray animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Editing Panel (Inline overlay above input) */}
            {editingMessage && (
              <div className="p-3 bg-[#FFE834]/20 border-t-3 border-pure-black flex justify-between items-center text-xs font-bold text-pure-black animate-[fadeIn_0.15s_ease-out]">
                <div className="flex-1 truncate mr-4">
                  <span className="text-error-red uppercase font-extrabold block text-[9px] tracking-wider">Editing Message</span>
                  <span className="italic">"{editingMessage.text}"</span>
                </div>
                <button
                  onClick={() => { setEditingMessage(null); setEditText(''); }}
                  className="p-1 rounded brutal-border bg-white text-pure-black"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Chat Input controls */}
            <div className="p-3 border-t-3 border-pure-black bg-[#FAFAF8] flex gap-2 items-center">
              
              {/* Voice Note Recorder button */}
              {isRecording ? (
                <div className="flex items-center gap-2 bg-error-red text-white brutal-border px-3 py-2 rounded-lg text-xs font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                  <span>Rec {formatDuration(recordDuration)}</span>
                  <button type="button" onClick={stopRecording} className="ml-2 font-display uppercase hover:underline">
                    Stop
                  </button>
                </div>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={!!editingMessage}
                  className="p-2.5 rounded-lg bg-white brutal-border brutal-shadow-btn hover:translate-x-0 hover:translate-y-0 hover:shadow-none text-pure-black disabled:opacity-50 disabled:pointer-events-none"
                  aria-label="Record Voice Message"
                >
                  <Mic className="w-4.5 h-4.5" />
                </button>
              )}

              <input
                type="text"
                placeholder={editingMessage ? "Edit your message..." : "Type message..."}
                value={editingMessage ? editText : messageText}
                onChange={(e) => {
                  if (editingMessage) {
                    setEditText(e.target.value);
                  } else {
                    handleInputChange(e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (editingMessage) {
                      handleEditMessageSubmit();
                    } else {
                      handleSendMessage();
                    }
                  }
                }}
                disabled={isRecording}
                className="flex-1 bg-white brutal-border text-xs px-3 py-2.5 outline-none font-bold text-pure-black"
              />

              <Button 
                variant="primary" 
                className="py-2 px-4 shadow-[2px_2px_0px_#111] border-2"
                onClick={editingMessage ? handleEditMessageSubmit : handleSendMessage}
                disabled={isRecording || (editingMessage ? !editText.trim() : !messageText.trim())}
              >
                {editingMessage ? <Edit className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <MessageSquare className="w-16 h-16 text-mid-gray stroke-[1.5]" />
            <h3 className="font-display text-lg uppercase">IndiVibe Chat Space</h3>
            <p className="text-xs font-bold text-mid-gray max-w-xs uppercase leading-normal">
              Select a conversation from the left to start exchanging real-time messages and hosting WebRTC calling streams.
            </p>
          </div>
        )}

      </div>

      {/* MESSAGE CONTEXT MENU MODAL */}
      {activeMessageMenu && (
        <div 
          className="fixed inset-0 bg-pure-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm select-none"
          onClick={() => setActiveMessageMenu(null)}
        >
          <Card 
            className="w-full max-w-xs bg-white brutal-border border-4 p-5 shadow-[6px_6px_0px_#111] space-y-4 animate-[fadeIn_0.15s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b-2 border-pure-black pb-2 mb-2">
              <span className="font-display text-xs uppercase font-extrabold text-pure-black">Message Controls</span>
              <button 
                onClick={() => setActiveMessageMenu(null)}
                className="p-1 rounded brutal-border bg-white text-pure-black hover:bg-light-gray"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs font-mono bg-light-gray p-2.5 rounded brutal-border border break-words max-h-24 overflow-y-auto italic">
              "{activeMessageMenu.text}"
            </p>

            <div className="flex flex-col gap-2 pt-2">
              {isMessageEditable(activeMessageMenu.createdAt) ? (
                <Button
                  variant="primary"
                  className="w-full text-xs font-display uppercase flex items-center justify-center gap-1.5 py-2 shadow-[2px_2px_0px_#111] border-2"
                  onClick={() => startEditingMessage(activeMessageMenu)}
                >
                  <Edit className="w-4 h-4" /> Edit Message
                </Button>
              ) : (
                <div className="w-full text-center p-2 rounded bg-light-gray text-[9px] font-bold text-mid-gray uppercase border border-pure-black border-dashed select-none">
                  Editing Locked (Limit 1 Hour)
                </div>
              )}

              <Button
                variant="secondary"
                className="w-full text-xs font-display uppercase bg-error-red text-white hover:bg-error-red/90 flex items-center justify-center gap-1.5 py-2 shadow-[2px_2px_0px_#111] border-2"
                onClick={() => handleDeleteMessage(activeMessageMenu)}
              >
                <Trash2 className="w-4 h-4" /> Unsend (Delete)
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}
