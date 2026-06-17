import { NextResponse } from 'next/server';
import { syncGlobalStore, persistGlobalStore } from '@/lib/firebase/dbHelper';
import { isMockFirebase, db, rtdb } from '@/lib/firebase/config';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, set, push, get, update } from 'firebase/database';

export async function GET(request: Request) {
  try {
    syncGlobalStore();
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json({ error: 'Missing chatId parameter' }, { status: 400 });
    }

    if (!isMockFirebase) {
      try {
        const messagesRef = ref(rtdb, `chats/${chatId}/messages`);
        const snapshot = await get(messagesRef);
        const data = snapshot.val();
        if (data) {
          const list = Object.values(data).sort((a: any, b: any) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          return NextResponse.json(list);
        }
      } catch (rtdbErr) {
        console.warn("Firebase RTDB fetch messages failed, falling back to local storage:", rtdbErr);
      }
    }

    // Fallback to local server db-mock.json
    const globalStore = globalThis as any;
    const allMessages = globalStore.messages || {};
    const chatMessages = allMessages[chatId] || [];
    return NextResponse.json(chatMessages);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    syncGlobalStore();
    const body = await request.json();
    const { chatId, senderId, senderUsername, text, mediaUrl, mediaType } = body;

    if (!chatId || !senderId || !senderUsername || !text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const messageId = `msg-${Math.random().toString(36).substring(2, 9)}`;
    const newMsg = {
      messageId,
      senderId,
      senderUsername,
      text,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || 'text',
      createdAt: new Date().toISOString()
    };

    const displayMsg = mediaType === 'voice' ? '🎵 Voice Message' : mediaType === 'call_log' ? `📞 ${text}` : text;

    if (!isMockFirebase) {
      try {
        const msgRef = push(ref(rtdb, `chats/${chatId}/messages`));
        const finalMsg = { ...newMsg, messageId: msgRef.key || messageId };
        await set(msgRef, finalMsg);

        // Update last message in Firestore chats collection
        try {
          const chatDocRef = doc(db, 'chats', chatId);
          const chatDoc = await getDoc(chatDocRef);
          if (chatDoc.exists()) {
            const chatData = chatDoc.data();
            const recipientId = chatData.participants?.find((p: string) => p !== senderId);
            const unreadBy = chatData.unreadBy || [];
            if (recipientId && !unreadBy.includes(recipientId)) {
              unreadBy.push(recipientId);
            }
            await updateDoc(chatDocRef, {
              lastMessage: displayMsg,
              updatedAt: new Date().toISOString(),
              unreadBy
            });
          }
        } catch (fErr) {
          console.error("Failed to update lastMessage/unreadBy in Firestore:", fErr);
        }

        return NextResponse.json(finalMsg);
      } catch (rtdbErr) {
        console.warn("Firebase RTDB send message failed, falling back to local storage:", rtdbErr);
      }
    }

    // Fallback to local server db-mock.json
    const globalStore = globalThis as any;
    const allMessages = globalStore.messages || {};
    const chatMessages = allMessages[chatId] || [];
    
    chatMessages.push(newMsg);
    allMessages[chatId] = chatMessages;
    globalStore.messages = allMessages;

    // Update last message and unreadBy in chat list
    const chats = globalStore.chats || [];
    const chat = chats.find((c: any) => c.chatId === chatId);
    if (chat) {
      chat.lastMessage = displayMsg;
      chat.updatedAt = new Date().toISOString();
      const recipientId = chat.participants?.find((p: string) => p !== senderId);
      if (recipientId) {
        chat.unreadBy = chat.unreadBy || [];
        if (!chat.unreadBy.includes(recipientId)) {
          chat.unreadBy.push(recipientId);
        }
      }
    }

    persistGlobalStore();
    return NextResponse.json(newMsg);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    syncGlobalStore();
    const body = await request.json();
    const { chatId, messageId, action, newText } = body;

    if (!chatId || !messageId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!isMockFirebase) {
      try {
        const msgRef = ref(rtdb, `chats/${chatId}/messages/${messageId}`);
        if (action === 'delete') {
          await set(msgRef, null);
        } else if (action === 'edit') {
          await update(msgRef, { text: newText, edited: true });
        }
      } catch (rtdbErr) {
        console.warn("Firebase RTDB message update failed:", rtdbErr);
      }
    }

    // Fallback/local update
    const globalStore = globalThis as any;
    const allMessages = globalStore.messages || {};
    let chatMessages = allMessages[chatId] || [];

    if (action === 'delete') {
      chatMessages = chatMessages.filter((m: any) => m.messageId !== messageId);
      allMessages[chatId] = chatMessages;
    } else if (action === 'edit') {
      allMessages[chatId] = chatMessages.map((m: any) => 
        m.messageId === messageId ? { ...m, text: newText, edited: true } : m
      );
    }
    globalStore.messages = allMessages;

    // Update last message in chat list
    const chats = globalStore.chats || [];
    const chat = chats.find((c: any) => c.chatId === chatId);
    if (chat) {
      const remainingMessages = allMessages[chatId] || [];
      const lastMsg = remainingMessages[remainingMessages.length - 1];
      chat.lastMessage = lastMsg ? (lastMsg.mediaType === 'voice' ? '🎵 Voice Message' : lastMsg.mediaType === 'call_log' ? `📞 ${lastMsg.text}` : lastMsg.text) : 'Chat cleared.';
      chat.updatedAt = new Date().toISOString();
    }

    persistGlobalStore();
    return NextResponse.json({ success: true });
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
        // Clear messages in RTDB
        const messagesRef = ref(rtdb, `chats/${chatId}/messages`);
        await set(messagesRef, null);
        
        // Update last message in Firestore chat doc
        const chatDocRef = doc(db, 'chats', chatId);
        await updateDoc(chatDocRef, {
          lastMessage: 'Chat cleared.',
          updatedAt: new Date().toISOString()
        });
      } catch (fErr) {
        console.warn("Firestore/RTDB clear chat failed:", fErr);
      }
    }

    // Fallback to local server db-mock.json
    const globalStore = globalThis as any;
    const messages = globalStore.messages || {};
    messages[chatId] = [];
    globalStore.messages = messages;

    const chats = globalStore.chats || [];
    const chat = chats.find((c: any) => c.chatId === chatId);
    if (chat) {
      chat.lastMessage = 'Chat cleared.';
      chat.updatedAt = new Date().toISOString();
    }

    persistGlobalStore();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
