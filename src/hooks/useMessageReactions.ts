import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  user_name: string;
  emoji: string;
  created_at: string;
}

export const AVAILABLE_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

const toReactionKey = (reaction: Pick<MessageReaction, 'message_id' | 'user_id' | 'emoji'>) =>
  `${reaction.message_id}:${reaction.user_id}:${reaction.emoji}`;

const mergeReactions = (base: MessageReaction[], incoming: MessageReaction[]) => {
  const merged = [...base];

  incoming.forEach((nextReaction) => {
    const existingIndex = merged.findIndex(
      (reaction) =>
        reaction.id === nextReaction.id || toReactionKey(reaction) === toReactionKey(nextReaction)
    );

    if (existingIndex === -1) {
      merged.push(nextReaction);
      return;
    }

    merged[existingIndex] = nextReaction;
  });

  return merged;
};

export const useMessageReactions = (meetingId: string, userId: string, userName: string) => {
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const reactionsRef = useRef<MessageReaction[]>([]);
  const userIdRef = useRef(userId);
  const pendingToggleKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // Keep ref in sync
  useEffect(() => {
    reactionsRef.current = reactions;
  }, [reactions]);

  // Fetch existing reactions for all messages in this meeting
  useEffect(() => {
    if (!meetingId) return;

    const fetchReactions = async () => {
      const { data, error } = await supabase
        .from('message_reactions')
        .select(`
          *,
          chat_messages!inner(meeting_id)
        `)
        .eq('chat_messages.meeting_id', meetingId);

      if (error) {
        console.error('Error fetching reactions:', error);
      } else {
        const fetchedReactions =
          data?.map((reaction) => ({
            id: reaction.id,
            message_id: reaction.message_id,
            user_id: reaction.user_id,
            user_name: reaction.user_name,
            emoji: reaction.emoji,
            created_at: reaction.created_at,
          })) || [];

        setReactions((prev) => mergeReactions(prev, fetchedReactions));
      }
    };

    fetchReactions();
  }, [meetingId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!meetingId) return;

    const channel = supabase
      .channel(`reactions-${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reactions',
        },
        (payload) => {
          const newReaction = payload.new as MessageReaction;
          setReactions((prev) => mergeReactions(prev, [newReaction]));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message_reactions',
        },
        (payload) => {
          const deletedReaction = payload.old as MessageReaction;
          setReactions((prev) =>
            prev.filter(
              (reaction) =>
                reaction.id !== deletedReaction.id &&
                toReactionKey(reaction) !== toReactionKey(deletedReaction)
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    const currentUserId = userIdRef.current;
    if (!messageId || !emoji || !currentUserId) return;

    const toggleKey = `${messageId}:${currentUserId}:${emoji}`;
    if (pendingToggleKeysRef.current.has(toggleKey)) return;
    pendingToggleKeysRef.current.add(toggleKey);

    try {
      const currentReactions = reactionsRef.current;
      const existingReaction = currentReactions.find(
        (reaction) =>
          reaction.message_id === messageId &&
          reaction.user_id === currentUserId &&
          reaction.emoji === emoji
      );

      if (existingReaction) {
        // Optimistic remove
        setReactions((prev) => prev.filter((reaction) => reaction.id !== existingReaction.id));

        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existingReaction.id);

        if (error) {
          // Rollback
          setReactions((prev) => mergeReactions(prev, [existingReaction]));
          console.error('Error removing reaction:', error);
        }
        return;
      }

      // Optimistic add
      const optimisticId = crypto.randomUUID();
      const optimisticReaction: MessageReaction = {
        id: optimisticId,
        message_id: messageId,
        user_id: currentUserId,
        user_name: userName,
        emoji,
        created_at: new Date().toISOString(),
      };

      setReactions((prev) => mergeReactions(prev, [optimisticReaction]));

      let savedReaction: MessageReaction | null = null;
      let insertError: { code?: string; message?: string } | null = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        const { data, error } = await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: currentUserId,
            user_name: userName,
            emoji,
          })
          .select('*')
          .single();

        if (!error && data) {
          savedReaction = data as MessageReaction;
          insertError = null;
          break;
        }

        insertError = error;

        // Message may still be in-flight (foreign key race), retry with incremental backoff
        if (insertError?.code === '23503' && attempt < 4) {
          await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
          continue;
        }

        // Already exists in DB (race/duplicate click): fetch existing row
        if (insertError?.code === '23505') {
          const { data: existing } = await supabase
            .from('message_reactions')
            .select('*')
            .eq('message_id', messageId)
            .eq('user_id', currentUserId)
            .eq('emoji', emoji)
            .maybeSingle();

          if (existing) {
            savedReaction = existing as MessageReaction;
            insertError = null;
          }
        }

        break;
      }

      if (savedReaction) {
        setReactions((prev) =>
          prev.map((reaction) =>
            reaction.id === optimisticId ? savedReaction! : reaction
          )
        );
        return;
      }

      if (insertError) {
        // Rollback on genuine failures
        setReactions((prev) => prev.filter((reaction) => reaction.id !== optimisticId));
        console.error('Error adding reaction:', insertError);
      }
    } finally {
      pendingToggleKeysRef.current.delete(toggleKey);
    }
  }, [userName]);

  const getReactionsForMessage = useCallback(
    (messageId: string) => {
      return reactions.filter((reaction) => reaction.message_id === messageId);
    },
    [reactions]
  );

  return {
    reactions,
    toggleReaction,
    getReactionsForMessage,
  };
};
