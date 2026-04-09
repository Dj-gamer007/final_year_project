import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TypingUser {
  id: string;
  name: string;
}

export const useTypingIndicator = (meetingId: string, userId: string, userName: string) => {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!meetingId) return;

    const channel = supabase.channel(`typing-${meetingId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId: typerId, userName: typerName, isTyping } = payload.payload;
        
        if (typerId === userId) return; // Ignore own typing events

        setTypingUsers((prev) => {
          if (isTyping) {
            // Add user if not already in list
            if (!prev.find((u) => u.id === typerId)) {
              return [...prev, { id: typerId, name: typerName }];
            }
            return prev;
          } else {
            // Remove user from list
            return prev.filter((u) => u.id !== typerId);
          }
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId, userId]);

  const startTyping = useCallback(() => {
    if (!channelRef.current) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Broadcast typing started
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId, userName, isTyping: true }
    });

    // Auto-stop typing after 3 seconds of no input
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [userId, userName]);

  const stopTyping = useCallback(() => {
    if (!channelRef.current) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId, userName, isTyping: false }
    });
  }, [userId, userName]);

  return {
    typingUsers,
    startTyping,
    stopTyping
  };
};
