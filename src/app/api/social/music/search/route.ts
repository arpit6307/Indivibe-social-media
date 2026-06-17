import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    if (!query) {
      return NextResponse.json({ data: [] });
    }
    
    const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      throw new Error('Deezer API returned error');
    }
    const data = await res.json();
    
    // Map response to our standard audio track structure
    const songs = (data.data || []).map((item: any) => ({
      id: item.id.toString(),
      title: item.title,
      artist: item.artist?.name || 'Unknown Artist',
      audioUrl: item.preview,
      coverUrl: item.album?.cover_medium || item.album?.cover_small || ''
    }));
    
    return NextResponse.json({ data: songs });
  } catch (err: any) {
    console.error("Music Search Proxy API error:", err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
