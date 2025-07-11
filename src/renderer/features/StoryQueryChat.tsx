import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, Book, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: Array<{
    chapter_id: string;
    chapter_title: string;
    relevant_text: string;
    similarity: number;
    chunk_index: number;
  }>;
}

interface StoryQueryResponse {
  response: string;
  citations: Array<{
    chapter_id: string;
    chapter_title: string;
    relevant_text: string;
    similarity: number;
    chunk_index: number;
  }>;
  search_results: Array<{
    chapter_id: string;
    chapter_title: string;
    text: string;
    similarity: number;
  }>;
  query_used: string;
}

export const StoryQueryChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [embeddingsStatus, setEmbeddingsStatus] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Load embeddings status on component mount
    loadEmbeddingsStatus();
    
    // Add welcome message
    setMessages([{
      id: 'welcome',
      type: 'assistant',
      content: 'Hi! I can help you explore your story. Ask me about characters, plot points, settings, or anything else from your chapters. What would you like to know?',
      timestamp: new Date(),
    }]);
  }, []);

  const loadEmbeddingsStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/embeddings/status');
      if (response.ok) {
        const status = await response.json();
        setEmbeddingsStatus(status);
      }
    } catch (error) {
      console.warn('Could not load embeddings status:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/story_query_chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          top_k: 5,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.error || 'Failed to get response');
      }

      const data: StoryQueryResponse = await response.json();

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        content: data.response,
        timestamp: new Date(),
        citations: data.citations,
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure the AI service is running and try again.`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Error",
        description: "Failed to get response from story query chat.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-background">
        <MessageCircle className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Story Query Chat</h2>
          <p className="text-sm text-muted-foreground">
            Ask questions about your story chapters
            {embeddingsStatus && (
              <span className="ml-2">
                • {embeddingsStatus.chapters_with_embeddings}/{embeddingsStatus.total_chapters} chapters indexed
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.type === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {/* Citations */}
              {message.citations && message.citations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="text-xs font-medium mb-2 flex items-center gap-1">
                    <Book className="h-3 w-3" />
                    Sources:
                  </div>
                  <div className="space-y-1">
                    {message.citations.map((citation, idx) => (
                      <div
                        key={idx}
                        className="text-xs p-2 bg-background/50 rounded border"
                      >
                        <div className="font-medium">{citation.chapter_title}</div>
                        <div className="text-muted-foreground mt-1">
                          {citation.relevant_text}
                        </div>
                        <div className="text-muted-foreground mt-1">
                          Similarity: {(citation.similarity * 100).toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="text-xs opacity-70 mt-2">
                {formatTimestamp(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your story... (e.g., 'What is the main character like?')"
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        
        {embeddingsStatus && embeddingsStatus.total_chapters === 0 && (
          <div className="mt-2 text-sm text-muted-foreground">
            No chapters found. Add some chapters to start querying your story.
          </div>
        )}
        
        {embeddingsStatus && embeddingsStatus.chapters_with_embeddings < embeddingsStatus.total_chapters && (
          <div className="mt-2 text-sm text-yellow-600">
            {embeddingsStatus.total_chapters - embeddingsStatus.chapters_with_embeddings} chapters 
            don't have embeddings yet. They won't be included in search results.
          </div>
        )}
      </div>
    </div>
  );
}; 