import { useState, useCallback, useRef, useEffect } from 'react';
import { sendMessage, fetchChatHistory, getSessionId } from '../lib/api.js';

function getWelcomeMessage() {
  const name = localStorage.getItem('kyronmed-firstName');
  if (name) {
    return `Hi ${name}! I'm Kyra, your patient assistant at KyronMed. I can help you book appointments, refill prescriptions, or answer questions about our practice. What can I do for you today?`;
  }
  return "Hi there! I'm Kyra, your patient assistant at KyronMed. I can help you book appointments, refill prescriptions, or answer questions about our practice. What can I do for you today?";
}

export function useChat() {
  const [messages, setMessages] = useState([
    { id: 'welcome', role: 'assistant', content: getWelcomeMessage(), timestamp: Date.now() },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionState, setSessionState] = useState('greeting');
  const abortRef = useRef(null);

  // Restore chat history from server on mount
  useEffect(() => {
    const sid = getSessionId();
    if (!sid) return;
    fetchChatHistory(sid).then(session => {
      if (!session?.messages?.length) return;
      const history = session.messages
        .filter(m => m.content?.trim())
        .map((m, i) => ({
          id: `history-${i}`,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp).getTime(),
        }));
      if (history.length > 0) {
        setMessages(history);
        if (session.state) setSessionState(session.state);
      }
    }).catch(() => {
      // Keep welcome message if history fetch fails
    });
  }, []);

  const send = useCallback(async (text) => {
    if (!text.trim() || isLoading) return;

    // Add user message
    const userMsg = { id: `user-${Date.now()}`, role: 'user', content: text.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Placeholder for assistant response
    const assistantId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: Date.now(), streaming: true }]);

    try {
      let fullContent = '';

      for await (const chunk of sendMessage(text.trim())) {
        if (chunk.type === 'text') {
          fullContent += chunk.content;
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m)
          );
        }

        if (chunk.type === 'done') {
          setSessionState(chunk.state || 'greeting');

          // Inject slot picker when a doctor has been matched but not yet booked
          if (chunk.matchedDoctor && !chunk.booking) {
            setMessages(prev => {
              const alreadyShown = prev.some(
                m => m.type === 'slot_picker' && m.doctorId === chunk.matchedDoctor.id && !m.dismissed
              );
              if (alreadyShown) return prev;
              const withoutOldPicker = prev.filter(m => m.type !== 'slot_picker');
              return [...withoutOldPicker, {
                id: `slot-picker-${chunk.matchedDoctor.id}`,
                type: 'slot_picker',
                doctorId: chunk.matchedDoctor.id,
                doctorName: chunk.matchedDoctor.name,
                timestamp: Date.now(),
              }];
            });
          }

          // Remove booking confirmation card if appointment was cancelled (e.g. by admin)
          if (chunk.bookingCancelled) {
            setMessages(prev => prev.filter(m => m.type !== 'booking_confirm'));
          }

          // Replace slot picker with booking confirmation once booked
          if (chunk.booking) {
            setMessages(prev => {
              const withoutPicker = prev.filter(m => m.type !== 'slot_picker');
              const alreadyConfirmed = withoutPicker.some(m => m.type === 'booking_confirm');
              if (alreadyConfirmed) return withoutPicker;
              return [...withoutPicker, {
                id: `booking-confirm-${Date.now()}`,
                type: 'booking_confirm',
                booking: chunk.booking,
                timestamp: Date.now(),
              }];
            });
            // Notify admin panel so it updates immediately
            window.dispatchEvent(new CustomEvent('kyronmed:booking-confirmed', { detail: chunk.booking }));
          }
        }

        if (chunk.type === 'error') {
          fullContent = chunk.message || 'Sorry, something went wrong. Please try again.';
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: fullContent, error: true } : m)
          );
        }
      }

      // Mark streaming complete
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m)
      );
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: 'Sorry, I had trouble connecting. Please try again.', streaming: false, error: true }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const dismissMessage = useCallback((id) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, dismissed: true } : m));
  }, []);

  const clearChat = useCallback(() => {
    setMessages([
      { id: 'welcome', role: 'assistant', content: getWelcomeMessage(), timestamp: Date.now() },
    ]);
    setSessionState('greeting');
  }, []);

  return { messages, isLoading, sessionState, send, clearChat, dismissMessage };
}
