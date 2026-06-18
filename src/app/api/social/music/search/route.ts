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
    const queryStr = searchParams.get('q');
    if (!queryStr) {
      return NextResponse.json({ data: [] });
    }

    const spotifyToken = await getSpotifyAccessToken();

    // Fetch Spotify and iTunes in parallel to avoid rate limiting and get fast responses
    const [spotifyRes, itunesRes] = await Promise.all([
      spotifyToken
        ? fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(queryStr)}&type=track&limit=25`, {
            headers: { 'Authorization': `Bearer ${spotifyToken}` }
          }).catch(err => {
            console.warn("Spotify fetch error:", err);
            return null;
          })
        : Promise.resolve(null),
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(queryStr)}&media=music&limit=30`).catch(err => {
        console.warn("iTunes fetch error:", err);
        return null;
      })
    ]);

    // Parse iTunes results first since we'll use them for local matching
    let itunesSongs: any[] = [];
    if (itunesRes && itunesRes.ok) {
      try {
        const itunesData = await itunesRes.json();
        itunesSongs = (itunesData.results || []).map((item: any) => ({
          id: `itunes-${item.trackId}`,
          title: item.trackName,
          artist: item.artistName || 'Unknown Artist',
          audioUrl: item.previewUrl || '',
          coverUrl: item.artworkUrl100?.replace('100x100bb', '300x300bb') || ''
        })).filter((s: any) => s.audioUrl !== '');
      } catch (err) {
        console.warn("Failed to parse iTunes search results:", err);
      }
    }

    const mergedSongs: any[] = [];
    const seenKeys = new Set<string>();

    const getSongKey = (title: string, artist: string) => {
      return `${title.toLowerCase().trim()}|${artist.toLowerCase().trim()}`;
    };

    // Process Spotify results if available
    if (spotifyRes && spotifyRes.ok) {
      try {
        const data = await spotifyRes.json();
        const items = data.tracks?.items || [];

        for (const item of items) {
          const title = item.name;
          const artist = item.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist';
          let audioUrl = item.preview_url || '';

          // If Spotify preview_url is missing, look it up in our iTunes results in-memory (no extra network request!)
          if (!audioUrl) {
            const firstArtist = item.artists?.[0]?.name?.toLowerCase() || '';
            const match = itunesSongs.find(is => 
              is.title.toLowerCase().includes(title.toLowerCase()) || 
              title.toLowerCase().includes(is.title.toLowerCase()) && 
              (is.artist.toLowerCase().includes(firstArtist) || firstArtist.includes(is.artist.toLowerCase()))
            );
            if (match) {
              audioUrl = match.audioUrl;
            }
          }

          if (audioUrl) {
            const key = getSongKey(title, artist);
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              mergedSongs.push({
                id: `spotify-${item.id}`,
                title,
                artist,
                audioUrl,
                coverUrl: item.album?.images?.[0]?.url || item.album?.images?.[1]?.url || ''
              });
            }
          }
        }
      } catch (err) {
        console.warn("Failed to parse Spotify search results:", err);
      }
    }

    // Append remaining iTunes songs that weren't merged/matched
    for (const song of itunesSongs) {
      const key = getSongKey(song.title, song.artist);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        mergedSongs.push(song);
      }
    }

    return NextResponse.json({ data: mergedSongs });
  } catch (err: any) {
    console.error("Music Search API error:", err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

