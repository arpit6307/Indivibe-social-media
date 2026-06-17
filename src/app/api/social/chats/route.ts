import { NextResponse } from 'next/server';
import { syncGlobalStore, persistGlobalStore } from '@/lib/firebase/dbHelper';
import { isMockFirebase, db, rtdb } from '@/lib/firebase/config';
import { collection, getDocs, addDoc, query, where, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, set } from 'firebase/database';

export async function GET(request: Request) {
  try {
    syncGlobalStore();
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');

    if (!uid) {
      return NextResponse.json({ error: 'Missing uid parameter' }, { status: 400 });
    }

    if (!isMockFirebase) {
      try {
        const chatsRef = collection(db, 'chats');
        const q = query(chatsRef, where('participants', 'array-contains', uid));
        const qSnapshot = await getDocs(q);
        const chatsList: any[] = [];
        
        for (const d of qSnapshot.docs) {
          const chatData = d.data();
          const partnerId = chatData.participants.find((id: string) => id !== uid) || '';
          
          let partnerDetails = { uid: partnerId, username: 'user', displayName: 'IndiVibe User', profilePhotoUrl: '' };
          try {
            const partnerDoc = await getDoc(doc(db, 'users', partnerId));
            if (partnerDoc.exists()) {
              const pData = partnerDoc.data();
              partnerDetails = {
                uid: partnerId,
                username: pData.username || 'user',
                displayName: pData.displayName || 'IndiVibe User',
                profilePhotoUrl: pData.profilePhotoUrl || ''
              };
            }
          } catch (pErr) {
            console.error("Error fetching partner profile details:", pErr);
          }

          chatsList.push({
            chatId: d.id,
            ...chatData,
            partner: partnerDetails
          });
        }
        if (chatsList.length > 0) {
          return NextResponse.json(chatsList);
        }
      } catch (firestoreErr) {
        console.warn("Firestore fetch chats failed, falling back to local storage:", firestoreErr);
      }
    }

    // Fallback to local server db-mock.json
    const globalStore = globalThis as any;
    const chats = globalStore.chats || [];
    const profiles = globalStore.registeredUserProfiles || new Map();
    
    // Convert Map values to array for quick lookup
    const profilesList = Array.from(profiles.values() as any);

    const filtered = chats.filter((c: any) => c.participants.includes(uid));
    const result = filtered.map((c: any) => {
      const partnerId = c.participants.find((id: string) => id !== uid) || '';
      const partnerProfile = (profilesList.find((p: any) => p.uid === partnerId) || {
        uid: partnerId,
        username: partnerId.split('-')[2] || 'user',
        displayName: 'IndiVibe User',
        profilePhotoUrl: ''
      }) as any;
      return {
        ...c,
        partner: {
          uid: partnerProfile.uid,
          username: partnerProfile.username,
          displayName: partnerProfile.displayName,
          profilePhotoUrl: partnerProfile.profilePhotoUrl
        }
      };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    syncGlobalStore();
    const body = await request.json();
    const { uid1, uid2, action, chatId, uid } = body;

    // MARK CHAT AS READ ACTION
    if (action === 'markRead' && chatId && uid) {
      if (!isMockFirebase) {
        try {
          const chatDocRef = doc(db, 'chats', chatId);
          const chatDoc = await getDoc(chatDocRef);
          if (chatDoc.exists()) {
            const unreadBy = chatDoc.data().unreadBy || [];
            const updatedUnreadBy = unreadBy.filter((id: string) => id !== uid);
            await updateDoc(chatDocRef, { unreadBy: updatedUnreadBy });
          }
        } catch (fErr) {
          console.warn("Firestore markRead failed:", fErr);
        }
      }

      const globalStore = globalThis as any;
      const chats = globalStore.chats || [];
      const chat = chats.find((c: any) => c.chatId === chatId);
      if (chat) {
        chat.unreadBy = (chat.unreadBy || []).filter((id: string) => id !== uid);
      }
      persistGlobalStore();
      return NextResponse.json({ success: true });
    }

    if (!uid1 || !uid2) {
      return NextResponse.json({ error: 'Missing uid1 or uid2' }, { status: 400 });
    }

    if (!isMockFirebase) {
      try {
        const chatsRef = collection(db, 'chats');
        const q = query(chatsRef, where('participants', 'array-contains', uid1));
        const qSnapshot = await getDocs(q);
        let existingChatId = '';
        
        qSnapshot.forEach((d) => {
          const parts = d.data().participants || [];
          if (parts.includes(uid2)) {
            existingChatId = d.id;
          }
        });

        if (existingChatId) {
          return NextResponse.json({ chatId: existingChatId });
        }

        const newDoc = await addDoc(chatsRef, {
          participants: [uid1, uid2],
          lastMessage: 'Chat initialized.',
          updatedAt: new Date().toISOString()
        });
        return NextResponse.json({ chatId: newDoc.id });
      } catch (firestoreErr) {
        console.warn("Firestore create chat failed, falling back to local storage:", firestoreErr);
      }
    }

    // Fallback to local server db-mock.json
    const globalStore = globalThis as any;
    const chats = globalStore.chats || [];
    const existing = chats.find((c: any) => 
      c.participants.includes(uid1) && c.participants.includes(uid2)
    );

    if (existing) {
      return NextResponse.json({ chatId: existing.chatId });
    }

    const generatedChatId = `chat-${Math.random().toString(36).substring(2, 9)}`;
    const newChat = {
      chatId: generatedChatId,
      participants: [uid1, uid2],
      lastMessage: 'Chat initialized.',
      updatedAt: new Date().toISOString()
    };
    chats.push(newChat);
    globalStore.chats = chats;

    // Add first message
    const messages = globalStore.messages || {};
    const firstMsg = {
      messageId: 'msg-first',
      senderId: 'mock-uid-system',
      senderUsername: 'indivibe_official',
      text: 'Say hello to your new contact!',
      mediaType: 'text',
      createdAt: new Date().toISOString()
    };
    messages[generatedChatId] = [firstMsg];
    globalStore.messages = messages;

    persistGlobalStore();
    return NextResponse.json({ chatId: generatedChatId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    syncGlobalStore();
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json({ error: 'Missing chatId parameter' }, { status: 400 });
    }

    if (!isMockFirebase) {
      try {
        // Delete chat doc in Firestore
        const chatDocRef = doc(db, 'chats', chatId);
        await deleteDoc(chatDocRef);
        
        // Delete messages associated with this chat in RTDB
        const messagesRef = ref(rtdb, `chats/${chatId}`);
        await set(messagesRef, null);
      } catch (fErr) {
        console.warn("Firestore/RTDB delete chat failed:", fErr);
      }
    }

    // Fallback to local server db-mock.json
    const globalStore = globalThis as any;
    let chats = globalStore.chats || [];
    chats = chats.filter((c: any) => c.chatId !== chatId);
    globalStore.chats = chats;

    const messages = globalStore.messages || {};
    delete messages[chatId];
    globalStore.messages = messages;

    persistGlobalStore();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
