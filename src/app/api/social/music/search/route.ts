import { NextResponse } from 'next/server';

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  // Check cache
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: 'no-store'
    });

    if (!res.ok) {
      console.error('Spotify token retrieval failed status:', res.status);
      return null;
    }

    const data = await res.json();
    if (data.access_token) {
      cachedToken = data.access_token;
      // Expires in data.expires_in seconds (usually 3600), subtract 60s buffer
      tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
      return cachedToken;
    }
  } catch (err) {
    console.error('Error fetching Spotify token:', err);
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    if (!query) {
      return NextResponse.json({ data: [] });
    }

    const spotifyToken = await getSpotifyAccessToken();

    if (spotifyToken) {
      // 1. SPOTIFY SEARCH FLOW
      const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`, {
        headers: {
          'Authorization': `Bearer ${spotifyToken}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        const items = data.tracks?.items || [];

        // Map Spotify tracks and resolve missing preview_urls using iTunes
        const songs = await Promise.all(items.map(async (item: any) => {
          let audioUrl = item.preview_url;

          // Fallback to iTunes search if Spotify doesn't have a preview URL
          if (!audioUrl) {
            try {
              const artistName = item.artists?.[0]?.name || '';
              const searchterm = `${item.name} ${artistName}`;
              const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchterm)}&media=music&limit=1`);
              if (itunesRes.ok) {
                const itunesData = await itunesRes.json();
                if (itunesData.results?.[0]?.previewUrl) {
                  audioUrl = itunesData.results[0].previewUrl;
                }
              }
            } catch (itErr) {
              console.warn("iTunes preview fallback resolve failed:", itErr);
            }
          }

          return {
            id: item.id.toString(),
            title: item.name,
            artist: item.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
            audioUrl: audioUrl || '',
            coverUrl: item.album?.images?.[0]?.url || item.album?.images?.[1]?.url || ''
          };
        }));

        // Filter out songs that have no audio preview URL to ensure they are playable
        const playableSongs = songs.filter(song => song.audioUrl !== '');

        return NextResponse.json({ data: playableSongs });
      } else {
        console.warn("Spotify search API failed, falling back to iTunes search");
      }
    }

    // 2. FALLBACK ITUNES SEARCH FLOW (If Spotify credentials are not configured or request fails)
    const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=30`);
    if (!itunesRes.ok) {
      throw new Error('iTunes Search API returned error');
    }
    const itunesData = await itunesRes.json();
    const songs = (itunesData.results || []).map((item: any) => ({
      id: item.trackId.toString(),
      title: item.trackName,
      artist: item.artistName || 'Unknown Artist',
      audioUrl: item.previewUrl,
      coverUrl: item.artworkUrl100?.replace('100x100bb', '300x300bb') || ''
    })).filter((song: any) => song.audioUrl);

    return NextResponse.json({ data: songs });
  } catch (err: any) {
    console.error("Music Search API error:", err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
