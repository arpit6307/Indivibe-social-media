import { NextResponse } from 'next/server';
import { syncGlobalStore, persistGlobalStore } from '@/lib/firebase/dbHelper';
import { isMockFirebase, db } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    syncGlobalStore();
    const body = await request.json();
    const { storyId, viewerUid, viewerUsername, viewerProfilePhotoUrl } = body;

    if (!storyId || !viewerUid || !viewerUsername) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const viewerObj = {
      uid: viewerUid,
      username: viewerUsername,
      profilePhotoUrl: viewerProfilePhotoUrl || '',
      viewedAt: new Date().toISOString()
    };

    if (!isMockFirebase) {
      try {
        const storyRef = doc(db, 'stories', storyId);
        const storySnapshot = await getDoc(storyRef);
        if (storySnapshot.exists()) {
          const data = storySnapshot.data();
          const viewers = data.viewers || [];
          // Avoid duplicate views from same user
          if (!viewers.some((v: any) => v.uid === viewerUid)) {
            viewers.push(viewerObj);
            await updateDoc(storyRef, { viewers });
          }
          return NextResponse.json({ success: true, viewers });
        }
      } catch (firestoreErr) {
        console.warn("Firestore record story view failed, using fallback:", firestoreErr);
      }
    }

    // Fallback to local server db-mock.json
    const globalStore = globalThis as any;
    const stories = globalStore.stories || [];
    const story = stories.find((s: any) => s.storyId === storyId);

    if (story) {
      if (!story.viewers) {
        story.viewers = [];
      }
      if (!story.viewers.some((v: any) => v.uid === viewerUid)) {
        story.viewers.push(viewerObj);
        globalStore.stories = stories;
        persistGlobalStore();
      }
      return NextResponse.json({ success: true, viewers: story.viewers });
    }

    return NextResponse.json({ error: 'Story not found' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
