'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { X, Play, Pause, Music, Volume2, Clock, Search } from 'lucide-react';

export const PRESET_SONGS = [
  {
    id: "1635014240",
    title: "Kesariya (From \"Brahmastra\")",
    artist: "Pritam, Arijit Singh & Amitabh Bhattacharya",
    audioUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/38/4c/5c/384c5c8f-3ff8-e457-b2f7-3158ce108649/mzaf_12389299033886433185.plus.aac.p.m4a",
    coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/9f/13/ca/9f13ca3b-e533-03e0-f19a-f0aaa774581d/196589311191.jpg/300x300bb.jpg"
  },
  {
    id: "1073359419",
    title: "Tum Hi Ho",
    artist: "Mithoon & Arijit Singh",
    audioUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/38/de/b9/38deb942-d44a-f2bb-205c-ddf05be84693/mzaf_9747647124859107103.plus.aac.p.m4a",
    coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/bb/23/ee/bb23eeed-0c35-4f1d-2b11-485622777ae4/8902894353007_cover.jpg/300x300bb.jpg"
  },
  {
    id: "6766268386",
    title: "Apna Bana Le - Arijit Singh Vocals Only",
    artist: "Arijit Singh, Sachin-Jigar & Amitabh Bhattacharya",
    audioUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ff/b2/c2/ffb2c28b-2139-4ec4-f61e-271bc06bddad/mzaf_12403837045914372948.plus.aac.p.m4a",
    coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/65/6f/5f/656f5fc0-4ce3-e03e-b7da-667a289f9e28/8909024114538.png/300x300bb.jpg"
  },
  {
    id: "1702461667",
    title: "Chaleya (From \"Jawan\")",
    artist: "Anirudh Ravichander, Arijit Singh, Shilpa Rao & Kumaar",
    audioUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/87/61/a9/8761a939-8e1c-678e-b186-09401480b314/mzaf_2211340113577128300.plus.aac.p.m4a",
    coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/1e/ff/32/1eff3216-190d-6fd9-8f68-acbba846e6ee/8903431956026_cover.jpg/300x300bb.jpg"
  },
  {
    id: "1070912818",
    title: "Kabira",
    artist: "Pritam, Tochi Raina & Rekha Bhardwaj",
    audioUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e2/06/19/e2061998-6444-5c5b-5bfc-a149c55e2e2e/mzaf_10494977375651598168.plus.aac.p.m4a",
    coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/62/d6/74/62d67432-0670-631f-db6a-d4bac3adae4b/8902894353328_cover.jpg/300x300bb.jpg"
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

  // Debounced search on type
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const delayDebounceFn = setTimeout(async () => {
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
    }, 450); // 450ms debounce delay

    return () => clearTimeout(delayDebounceFn);
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
                  max="25" 
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
                  max="45" 
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
