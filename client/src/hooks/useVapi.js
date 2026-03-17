import { useState, useCallback, useRef, useEffect } from 'react';
import { getVapiContext, getSessionId } from '../lib/api.js';

/**
 * Hook for Vapi.ai Web SDK integration.
 * Handles: start/stop calls, context injection, volume levels, live transcript, mute.
 */
export function useVapi() {
  const [callState, setCallState] = useState('idle'); // idle | connecting | active | ended | error
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);     // 0-1 for visualizer
  const [transcript, setTranscript] = useState([]);       // live transcript entries
  const [error, setError] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const vapiRef = useRef(null);
  const timerRef = useRef(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (vapiRef.current) {
        try { vapiRef.current.stop(); } catch (e) { /* ignore */ }
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCall = useCallback(async () => {
    try {
      setError(null);
      setCallState('connecting');
      setTranscript([]);
      setCallDuration(0);

      // 1. Fetch chat context from our backend
      const contextData = await getVapiContext();

      // 2. Load Vapi SDK
      const { default: Vapi } = await import('@vapi-ai/web');

      const apiKey = import.meta.env.VITE_VAPI_PUBLIC_KEY;
      if (!apiKey) {
        setError('Voice calling is not configured. Add VITE_VAPI_PUBLIC_KEY to your .env');
        setCallState('error');
        setTimeout(() => setCallState('idle'), 4000);
        return;
      }

      const vapi = new Vapi(apiKey);
      vapiRef.current = vapi;

      // 3. Set up event listeners
      vapi.on('call-start', () => {
        setCallState('active');
        // Start duration timer
        const start = Date.now();
        timerRef.current = setInterval(() => {
          setCallDuration(Math.floor((Date.now() - start) / 1000));
        }, 1000);
      });

      vapi.on('call-end', () => {
        setCallState('ended');
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeout(() => {
          setCallState('idle');
          setVolumeLevel(0);
          setTranscript([]);
        }, 4000);
      });

      vapi.on('volume-level', (level) => {
        setVolumeLevel(Math.min(1, level));
      });

      vapi.on('speech-start', () => {
        // Assistant started speaking
      });

      vapi.on('speech-end', () => {
        setVolumeLevel(0);
      });

      vapi.on('message', (msg) => {
        // Capture transcript updates
        if (msg.type === 'transcript') {
          if (msg.transcriptType === 'final') {
            setTranscript(prev => [
              ...prev.slice(-10), // keep last 10 entries
              { role: msg.role, text: msg.transcript, timestamp: Date.now() },
            ]);
          }
        }
        // Capture conversation updates (alternative event format)
        if (msg.type === 'conversation-update' && msg.conversation) {
          const last = msg.conversation[msg.conversation.length - 1];
          if (last) {
            setTranscript(prev => {
              const existing = prev.find(t => t.text === last.content);
              if (existing) return prev;
              return [
                ...prev.slice(-10),
                { role: last.role, text: last.content, timestamp: Date.now() },
              ];
            });
          }
        }
      });

      vapi.on('error', (err) => {
        console.error('[Vapi] Error event:', JSON.stringify(err, null, 2));
        const msg = err?.error?.message || err?.message || err?.errorMessage ||
                    (typeof err === 'string' ? err : 'Voice call failed');
        setError(msg);
        setCallState('error');
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeout(() => {
          setCallState('idle');
          setError(null);
        }, 5000);
      });

      // 4. Start the call
      const assistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID;

      console.log('[Vapi] Starting call...', assistantId ? 'with assistant ID' : 'with transient config');

      if (assistantId) {
        // Use a pre-configured Vapi assistant (override context)
        await vapi.start(assistantId, {
          metadata: { sessionId: getSessionId() },
          variableValues: { chatContext: contextData.context },
        });
      } else {
        // Transient assistant — clean config from our server
        const config = contextData.assistantConfig;
        console.log('[Vapi] Transient config:', JSON.stringify({
          firstMessage: config.firstMessage?.substring(0, 50) + '...',
          model: { provider: config.model?.provider, model: config.model?.model },
          voice: config.voice,
          transcriber: config.transcriber,
        }));
        await vapi.start(config);
      }
    } catch (err) {
      console.error('[Vapi] start() failed:', err);
      const msg = err?.error?.message || err?.message ||
                  (typeof err === 'string' ? err : 'Could not start voice call');
      setError(msg);
      setCallState('error');
      setTimeout(() => {
        setCallState('idle');
        setError(null);
      }, 5000);
    }
  }, []);

  const endCall = useCallback(() => {
    if (vapiRef.current) {
      try { vapiRef.current.stop(); } catch (e) { /* ignore */ }
      vapiRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setCallState('ended');
    setTimeout(() => {
      setCallState('idle');
      setVolumeLevel(0);
    }, 3000);
  }, []);

  const toggleMute = useCallback(() => {
    if (vapiRef.current) {
      const newMuted = !isMuted;
      vapiRef.current.setMuted(newMuted);
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  return {
    callState,
    isMuted,
    volumeLevel,
    transcript,
    error,
    callDuration,
    startCall,
    endCall,
    toggleMute,
  };
}
