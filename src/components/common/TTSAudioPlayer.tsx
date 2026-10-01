import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Pause, Play, Square, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../utils/api';

interface TTSAudioPlayerProps {
  text: string;
  language?: string;
  className?: string;
}

export const TTSAudioPlayer: React.FC<TTSAudioPlayerProps> = ({
  text,
  language = 'en',
  className = ''
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setSpeechSupported(false);
    }
    return () => {
      stopSpeech();
    };
  }, []);

  const stopSpeech = () => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    setIsPlaying(false);
    setIsPaused(false);
    setIsLoading(false);
  };

  const handlePlaySpeech = async () => {
    if (!speechSupported) return;

    if (isPlaying && !isPaused) {
      // Pause
      window.speechSynthesis.pause();
      setIsPaused(true);
      return;
    }

    if (isPaused) {
      // Resume
      window.speechSynthesis.resume();
      setIsPaused(false);
      return;
    }

    setIsLoading(true);

    try {
      // Fetch sanitized text and speech settings from backend synthesis endpoint
      let cleanText = text;
      let targetLocale = language === 'te' ? 'te-IN' : language === 'hi' ? 'hi-IN' : 'en-US';

      try {
        const response = await apiFetch('/api/voice/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, language })
        });
        if (response.ok) {
          const synthData = await response.json();
          if (synthData.clean_text) {
            cleanText = synthData.clean_text;
          }
          if (synthData.locale) {
            targetLocale = synthData.locale;
          }
        }
      } catch (err) {
        console.warn('[TTS] Backend synthesis preparation failed, using local cleaning fallback', err);
        cleanText = text.replace(/```[\s\S]*?```/g, '').replace(/\|.*?\|/g, '').replace(/[#\*`]/g, '').trim();
      }

      if (!cleanText) {
        setIsLoading(false);
        return;
      }

      window.speechSynthesis.cancel(); // Stop any existing speech

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = targetLocale;
      utterance.rate = language === 'te' || language === 'hi' ? 0.95 : 1.0;
      utterance.pitch = 1.0;

      // Select appropriate voice if available
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const matchVoice = voices.find(v => v.lang.toLowerCase() === targetLocale.toLowerCase() || v.lang.toLowerCase().startsWith(language));
        if (matchVoice) {
          utterance.voice = matchVoice;
        }
      }

      utterance.onstart = () => {
        setIsLoading(false);
        setIsPlaying(true);
        setIsPaused(false);
      };

      utterance.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setIsLoading(false);
      };

      utterance.onerror = (event) => {
        console.warn('[TTS] SpeechSynthesis error:', event);
        setIsPlaying(false);
        setIsPaused(false);
        setIsLoading(false);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('[TTS] Synthesis playback error:', e);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  if (!speechSupported) {
    return null;
  }

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={handlePlaySpeech}
        disabled={isLoading}
        title={isPlaying ? (isPaused ? 'Resume speech' : 'Pause speech') : 'Listen to response audio'}
        aria-label="Text to speech response player"
        className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
          isPlaying
            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-md shadow-cyan-500/20'
            : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
        }`}
      >
        {isLoading ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
        ) : isPlaying && !isPaused ? (
          <Pause className="w-3.5 h-3.5 text-cyan-400" />
        ) : (
          <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
        )}

        <span>
          {isLoading
            ? 'Loading...'
            : isPlaying
            ? isPaused
              ? 'Paused'
              : 'Speaking...'
            : 'Listen'}
        </span>
      </button>

      {isPlaying && (
        <button
          type="button"
          onClick={stopSpeech}
          title="Stop audio playback"
          className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <Square className="w-3 h-3 fill-current" />
        </button>
      )}
    </div>
  );
};
