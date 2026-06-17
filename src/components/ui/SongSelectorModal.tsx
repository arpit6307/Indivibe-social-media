'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { X, Play, Pause, Music, Volume2, Clock, Search } from 'lucide-react';

export const PRESET_SONGS = [
  {
    id: 'lofi-1',
    title: 'Warm Coffee',
    artist: 'Chillhop Beats',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&auto=format&fit=crop&q=60'
  },
  {
    id: 'lofi-2',
    title: 'Midnight Drive',
    artist: 'Lofi Generator',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150&auto=format&fit=crop&q=60'
  },
  {
    id: 'lofi-3',
    title: 'Rainy Sunday',
    artist: 'Nostalgia Club',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150&auto=format&fit=crop&q=60'
  },
  {
    id: 'lofi-4',
    title: 'Summer Breeze',
    artist: 'Sunny Waves',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=150&auto=format&fit=crop&q=60'
  },
  {
    id: 'lofi-5',
    title: 'Neon Nights',
    artist: 'Retro Runner',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=150&auto=format&fit=crop&q=60'
  }
];

interface SongSelectorModalProps {
  onSelect: (song: {
    title: string;
    artist: string;
    coverUrl?: string;
    audioUrl: string;
    duration: number;
    startTime: number;
  }) => void;
  onClose: () => void;
}

export function SongSelectorModal({ onSelect, onClose }: SongSelectorModalProps) {
  const [selectedSong, setSelectedSong] = useState<any | null>(null);
  
  // Trimmer States
  const [duration, setDuration] = useState(15); // Default 15s
  const [startTime, setStartTime] = useState(10); // Default start 10s
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Preview in list state
  const [previewSongId, setPreviewSongId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  // Compute displayed songs
  const displayedSongs = searchQuery.trim() ? searchResults : PRESET_SONGS;

  // Sync preview audio playback
  useEffect(() => {
    if (!selectedSong) {
      // Handle song listing previews
      if (previewSongId) {
        const song = displayedSongs.find(s => s.id === previewSongId);
        if (song) {
          playUrlDirect(song.audioUrl);
        }
      } else {
        stopAudio();
      }
    } else {
      // Handle selected song trim previewing
      if (isPlaying) {
        playTrimmedSegment();
      } else {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }
  }, [previewSongId, selectedSong, isPlaying, startTime, duration]);

  // Reset search results if query cleared
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsPlaying(false);
  };

  const playUrlDirect = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    audioRef.current = new Audio(url);
    audioRef.current.loop = true;
    audioRef.current.play().catch(e => console.warn(e));
  };

  const playTrimmedSegment = () => {
    if (!selectedSong) return;
    
    if (timerRef.current) clearInterval(timerRef.current);
    
    if (!audioRef.current || audioRef.current.src !== selectedSong.audioUrl) {
      audioRef.current = new Audio(selectedSong.audioUrl);
    }
    
    const audio = audioRef.current;
    audio.currentTime = startTime;
    audio.play().catch(e => console.warn(e));

    const endThreshold = startTime + duration;
    
    timerRef.current = setInterval(() => {
      if (audio.currentTime >= endThreshold || audio.currentTime < startTime) {
        audio.currentTime = startTime; // Loop back
      }
    }, 100);
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    stopAudio();
    setPreviewSongId(null);
    try {
      const res = await fetch(`/api/social/music/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      setSearchResults(data.data || []);
    } catch (err) {
      console.warn("Failed to search music:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSongFromList = (song: any) => {
    stopAudio();
    setPreviewSongId(null);
    setSelectedSong(song);
    setDuration(15);
    setStartTime(5);
    setIsPlaying(true);
  };

  const handleSaveSelection = () => {
    if (!selectedSong) return;
    stopAudio();
    onSelect({
      title: selectedSong.title,
      artist: selectedSong.artist,
      coverUrl: selectedSong.coverUrl,
      audioUrl: selectedSong.audioUrl,
      duration,
      startTime
    });
  };

  const formatTimeStr = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pure-black/75 backdrop-blur-xs animate-[fadeIn_0.15s_ease-out]">
      <Card className="w-full max-w-sm bg-white brutal-border border-4 shadow-[6px_6px_0px_#111] overflow-hidden flex flex-col p-0 h-[500px]">
        
        {/* Modal Header */}
        <div className="p-4 border-b-3 border-pure-black flex justify-between items-center bg-[#FAFAF8] shrink-0">
          <h3 className="font-display text-sm uppercase text-pure-black flex items-center gap-2">
            <Music className="w-4 h-4 text-brutal-yellow fill-current" /> 
            {selectedSong ? 'Trim Audio Track' : 'Add Music Track'}
          </h3>
          <button 
            type="button"
            onClick={() => { stopAudio(); onClose(); }}
            className="p-1.5 rounded brutal-border bg-white text-pure-black hover:bg-error-red hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Search Bar (Only visible when listing songs) */}
        {!selectedSong && (
          <form onSubmit={handleSearchSubmit} className="px-4 pt-4 pb-2 bg-[#FAFAF8] border-b-2 border-pure-black flex gap-2 shrink-0">
            <div className="flex-1 bg-white brutal-border border border-pure-black px-3 py-1.5 flex items-center gap-2 rounded">
              <Search className="w-3.5 h-3.5 text-mid-gray shrink-0" />
              <input
                type="text"
                placeholder="Search Hindi or global songs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs font-bold outline-none text-pure-black bg-transparent"
              />
              {searchQuery && (
                <button 
                  type="button" 
                  onClick={() => { setSearchQuery(''); setSearchResults([]); stopAudio(); setPreviewSongId(null); }}
                  className="text-mid-gray hover:text-pure-black"
                >
                  <X className="w-3 h-3 shrink-0" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-3.5 py-1.5 bg-brutal-yellow text-pure-black text-xs font-display uppercase brutal-border border shadow-[1.5px_1.5px_0px_#111] hover:shadow-none hover:translate-y-0.5 active:translate-y-0.5 cursor-pointer rounded"
            >
              {searching ? '...' : 'Search'}
            </button>
          </form>
        )}

        {/* Modal Body */}
        {!selectedSong ? (
          /* Song Listing Screen */
          <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-[#FAFAF8]">
            {searching ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-2">
                <div className="w-8 h-8 rounded-full border-4 border-brutal-yellow border-t-transparent animate-spin"></div>
                <span className="text-[10px] font-display uppercase tracking-widest text-mid-gray">Searching database...</span>
              </div>
            ) : displayedSongs.length === 0 ? (
              <div className="text-center py-20 text-[10px] font-bold text-mid-gray uppercase">
                No music tracks found. Try another query.
              </div>
            ) : (
              <>
                <span className="text-[9px] font-display uppercase tracking-wider text-mid-gray block mb-1">
                  {searchQuery.trim() ? `Search results for "${searchQuery}"` : 'Curated lo-fi presets'}
                </span>
                {displayedSongs.map((song) => (
                  <div 
                    key={song.id} 
                    className="flex items-center gap-3 p-2.5 bg-white brutal-border border-2 border-pure-black shadow-[2px_2px_0px_#111] rounded-lg hover:translate-y-0.5 hover:shadow-[1px_1px_0px_#111] transition-all"
                  >
                    {/* Cover art image */}
                    <div className="w-12 h-12 rounded brutal-border border bg-light-gray overflow-hidden shrink-0">
                      {song.coverUrl ? (
                        <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-mid-gray/25"><Music className="w-5 h-5 text-mid-gray" /></div>
                      )}
                    </div>
                    
                    {/* Song info */}
                    <div className="flex-1 min-w-0" onClick={() => handleSelectSongFromList(song)}>
                      <h4 className="font-display text-xs uppercase text-pure-black truncate cursor-pointer hover:underline">
                        {song.title}
                      </h4>
                      <p className="text-[9px] font-mono text-mid-gray uppercase truncate">
                        {song.artist}
                      </p>
                    </div>

                    {/* Direct preview button */}
                    <button
                      type="button"
                      onClick={() => setPreviewSongId(previewSongId === song.id ? null : song.id)}
                      className={`p-2 rounded-full border border-pure-black shadow-[1.5px_1.5px_0px_#111] transition-all cursor-pointer shrink-0 ${
                        previewSongId === song.id ? 'bg-error-red text-white' : 'bg-brutal-yellow text-pure-black'
                      }`}
                    >
                      {previewSongId === song.id ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          /* Custom Trimming Screen */
          <div className="p-5 space-y-6 bg-white flex-1 overflow-y-auto">
            
            {/* Selected Song Badge */}
            <div className="flex items-center gap-4 bg-light-gray p-3 brutal-border border-2 shadow-[2px_2px_0px_#111] rounded-lg">
              <div className="w-14 h-14 rounded brutal-border border-2 bg-white overflow-hidden shrink-0">
                {selectedSong.coverUrl ? (
                  <img src={selectedSong.coverUrl} alt={selectedSong.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-mid-gray/25"><Music className="w-6 h-6 text-mid-gray" /></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-display text-sm uppercase text-pure-black truncate">{selectedSong.title}</h4>
                <p className="text-[10px] font-mono text-mid-gray uppercase truncate">{selectedSong.artist}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className={`p-2.5 rounded-full border-2 border-pure-black shadow-[2px_2px_0px_#111] transition-all active:translate-y-0.5 active:shadow-none cursor-pointer ${
                  isPlaying ? 'bg-error-red text-white' : 'bg-brutal-yellow text-pure-black'
                }`}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              </button>
            </div>

            {/* Trimming Parameters */}
            <div className="space-y-4">
              
              {/* Start offset timeline */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-display uppercase text-mid-gray">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Start Position</span>
                  <span className="font-mono text-pure-black font-bold">{formatTimeStr(startTime)}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="15" 
                  step="1"
                  value={startTime}
                  onChange={(e) => setStartTime(parseInt(e.target.value))}
                  className="w-full accent-brutal-yellow h-2 bg-light-gray rounded border border-pure-black outline-none cursor-pointer"
                />
                <span className="text-[8px] font-bold text-mid-gray uppercase block text-right italic">Previews are capped at 30 seconds</span>
              </div>

              {/* Clip duration trimmer */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-display uppercase text-mid-gray">
                  <span className="flex items-center gap-1"><Volume2 className="w-3 h-3" /> Clip Duration</span>
                  <span className="font-mono text-pure-black font-bold">{duration} seconds</span>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="25" 
                  step="1"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="w-full accent-brutal-yellow h-2 bg-light-gray rounded border border-pure-black outline-none cursor-pointer"
                />
              </div>

            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 pt-2">
              <Button 
                variant="secondary"
                className="flex-1 py-2.5 text-xs font-display uppercase border-2 shadow-[2px_2px_0px_#111]"
                onClick={() => { stopAudio(); setSelectedSong(null); }}
              >
                Back to List
              </Button>
              <Button 
                variant="primary"
                className="flex-1 py-2.5 text-xs font-display uppercase border-2 shadow-[2px_2px_0px_#111]"
                onClick={handleSaveSelection}
              >
                Apply Song
              </Button>
            </div>

          </div>
        )}

      </Card>
    </div>
  );
}
