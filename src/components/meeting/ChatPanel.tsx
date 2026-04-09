import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Send, MessageCircle, SmilePlus } from 'lucide-react';
import { ChatMessage } from '@/hooks/useChatMessages';
import { MessageReaction, AVAILABLE_EMOJIS } from '@/hooks/useMessageReactions';

interface TypingUser {
  id: string;
  name: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => Promise<void>;
  currentUserId: string;
  isLoading?: boolean;
  typingUsers?: TypingUser[];
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  reactions?: MessageReaction[];
  onToggleReaction?: (messageId: string, emoji: string) => void;
}

const ChatPanel = ({ messages, onSendMessage, currentUserId, isLoading, typingUsers = [], onTypingStart, onTypingStop, reactions = [], onToggleReaction }: ChatPanelProps) => {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;

    setIsSending(true);
    onTypingStop?.();
    try {
      await onSendMessage(inputValue);
      setInputValue('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (e.target.value.trim()) {
      onTypingStart?.();
    } else {
      onTypingStop?.();
    }
  };

  const getTypingText = () => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0].name} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0].name} and ${typingUsers[1].name} are typing...`;
    return `${typingUsers.length} people are typing...`;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getMessageReactions = (messageId: string) => {
    const messageReactions = reactions.filter(r => r.message_id === messageId);
    const grouped: Record<string, { count: number; users: string[]; hasOwn: boolean }> = {};
    
    messageReactions.forEach(r => {
      if (!grouped[r.emoji]) {
        grouped[r.emoji] = { count: 0, users: [], hasOwn: false };
      }
      grouped[r.emoji].count++;
      grouped[r.emoji].users.push(r.user_name);
      if (r.user_id === currentUserId) {
        grouped[r.emoji].hasOwn = true;
      }
    });
    
    return grouped;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Chat</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {messages.length} messages
        </span>
      </div>

      <ScrollArea className="flex-1 pr-4 -mr-4" ref={scrollRef}>
        <div className="space-y-3 min-h-[200px]">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Loading messages...
            </p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No messages yet. Start the conversation!
            </p>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.user_id === currentUserId;
              const messageReactions = getMessageReactions(msg.id);
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} group`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {isOwn ? 'You' : msg.user_name}
                    </span>
                    <span className="text-xs text-muted-foreground/60">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {isOwn && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <SmilePlus className="w-3 h-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" side="left">
                          <div className="flex gap-1">
                            {AVAILABLE_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => onToggleReaction?.(msg.id, emoji)}
                                className="text-lg hover:bg-muted p-1 rounded transition-colors"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                        isOwn
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {msg.message}
                    </div>
                    {!isOwn && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <SmilePlus className="w-3 h-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" side="right">
                          <div className="flex gap-1">
                            {AVAILABLE_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => onToggleReaction?.(msg.id, emoji)}
                                className="text-lg hover:bg-muted p-1 rounded transition-colors"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  {/* Reaction display */}
                  {Object.keys(messageReactions).length > 0 && (
                    <div className={`flex gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      {Object.entries(messageReactions).map(([emoji, data]) => (
                        <button
                          key={emoji}
                          onClick={() => onToggleReaction?.(msg.id, emoji)}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                            data.hasOwn
                              ? 'bg-primary/20 border-primary/40'
                              : 'bg-muted border-border hover:bg-muted/80'
                          }`}
                          title={data.users.join(', ')}
                        >
                          <span>{emoji}</span>
                          <span className="text-muted-foreground">{data.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-2 py-2 px-1">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-muted-foreground italic">
            {getTypingText()}
          </span>
        </div>
      )}

      <div className="flex gap-2 mt-2 pt-4 border-t border-border">
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          disabled={isSending}
          className="flex-1"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!inputValue.trim() || isSending}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatPanel;
