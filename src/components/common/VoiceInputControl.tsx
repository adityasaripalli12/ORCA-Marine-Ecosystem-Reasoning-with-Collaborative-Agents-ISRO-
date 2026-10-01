import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Square, RefreshCw, Volume2, AlertCircle, Check, Sparkles, Languages } from 'lucide-react';
import { apiFetch } from '../../utils/api';

export interface TranscriptionResponse {
  transcript: string;
  detected_language: string;
  language_name: string;
  confidence: number;
  normalized_query: string;
  input_mode: string;
  duration_seconds?: number;
}

interface VoiceInputControlProps {
  onTranscriptReady: (transcript: string, language: string, normalizedQuery: string) => void;
  disabled?: boolean;
  className?: string;
  clientLanguageHint?: string;
}

export const VoiceInputControl: React.FC<VoiceInputControlProps> = ({
  onTranscriptReady,
  disabled = false,
  className = '',
  clientLanguageHint
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [detectedLang, setDetectedLang] = useState<string>('en');
  const [langName, setLangName] = useState<string>('English');
  const [confidence, setConfidence] = useState<number>(0.95);
  const [audioVolume, setAudioVolume] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      stopRecordingCleanup();
    };
  }, []);

  const stopRecordingCleanup = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
  };

  const startRecording = async () => {
    setErrorMessage(null);
    setLiveTranscript('');
    audioChunksRef.current = [];

    // Check browser compatibility
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage('Voice input is not supported in this browser. Please type your query.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Audio visualizer setup
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const updateVolume = () => {
            analyser.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((acc, val) => acc + val, 0);
            const avg = sum / dataArray.length;
            setAudioVolume(Math.min(100, Math.round((avg / 128) * 100)));
            animationFrameRef.current = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        }
      } catch (e) {
        console.warn('[VOICE] Could not initialize audio visualizer context', e);
      }

      // Try browser native SpeechRecognition for instant live transcript preview
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          if (clientLanguageHint === 'te') recognition.lang = 'te-IN';
          else if (clientLanguageHint === 'hi') recognition.lang = 'hi-IN';
          else recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            let current = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              current += event.results[i][0].transcript;
            }
            if (current.trim()) {
              setLiveTranscript(current.trim());
            }
          };
          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {
          console.warn('[VOICE] Web SpeechRecognition init skipped', e);
        }
      }

      // MediaRecorder for backend STT provider upload
      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus' }
        : MediaRecorder.isTypeSupported('audio/webm')
        ? { mimeType: 'audio/webm' }
        : undefined;

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stopRecordingCleanup();
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm'
        });

        if (audioBlob.size < 200 && !liveTranscript.trim()) {
          setErrorMessage('Audio recording was too short or empty. Please try speaking again.');
          setIsRecording(false);
          setIsTranscribing(false);
          return;
        }

        await processAudioUpload(audioBlob);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
    } catch (err: any) {
      console.error('[VOICE] Microphone permission or capture error:', err);
      setIsRecording(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone access was denied. Please allow microphone permissions in browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No microphone device was found. Please connect a microphone and try again.');
      } else {
        setErrorMessage('Could not activate microphone. Please check system permissions.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setIsTranscribing(true);
      mediaRecorderRef.current.stop();
    } else {
      setIsRecording(false);
    }
  };

  const processAudioUpload = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'voice_recording.webm');
      if (clientLanguageHint) {
        formData.append('client_language', clientLanguageHint);
      }

      const response = await apiFetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let errorDetail = 'Failed to transcribe voice audio.';
        try {
          const errJson = await response.json();
          errorDetail = errJson.detail || errorDetail;
        } catch (e) {}
        throw new Error(errorDetail);
      }

      const data: TranscriptionResponse = await response.json();

      setDetectedLang(data.detected_language);
      setLangName(data.language_name);
      setConfidence(data.confidence);

      const finalTranscript = data.transcript || liveTranscript;

      if (!finalTranscript.trim()) {
        setErrorMessage('No speech could be recognized in the recording. Please try speaking again.');
        setIsTranscribing(false);
        setIsRecording(false);
        return;
      }

      // Deliver transcript and normalized query to parent form
      onTranscriptReady(finalTranscript, data.detected_language, data.normalized_query);
    } catch (err: any) {
      console.warn('[VOICE] STT Backend endpoint error, attempting client fallback transcript', err);
      if (liveTranscript.trim()) {
        onTranscriptReady(liveTranscript, clientLanguageHint || 'en', liveTranscript);
      } else {
        setErrorMessage(err.message || "Sorry, I couldn't understand the voice input. Please try again.");
      }
    } finally {
      setIsRecording(false);
      setIsTranscribing(false);
    }
  };

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      {/* Microphone Toggle Button */}
      {!isRecording && !isTranscribing && (
        <button
          type="button"
          onClick={startRecording}
          disabled={disabled}
          aria-label="Start Voice Recording"
          title="Speak your question (English, Telugu, Hindi)"
          className="p-2.5 rounded-xl border transition-all flex items-center justify-center gap-1.5 bg-slate-800/80 hover:bg-cyan-500/20 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 border-slate-700 disabled:opacity-40"
        >
          <Mic className="w-4 h-4 text-cyan-400" />
        </button>
      )}

      {/* Recording State Modal Overlay or Bar */}
      {isRecording && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 animate-pulse shadow-lg shadow-cyan-500/20">
          <div className="relative flex items-center justify-center w-3 h-3">
            <span className="absolute inline-flex w-full h-full rounded-full bg-rose-500 opacity-75 animate-ping" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-rose-500" />
          </div>

          <span className="text-xs font-semibold text-cyan-200">Listening...</span>

          {/* Sound wave visualizer bar */}
          <div className="flex items-center gap-0.5 h-3">
            <div className="w-0.5 bg-cyan-400 rounded-full transition-all duration-75" style={{ height: `${Math.max(4, audioVolume * 0.12)}px` }} />
            <div className="w-0.5 bg-cyan-400 rounded-full transition-all duration-75" style={{ height: `${Math.max(6, audioVolume * 0.18)}px` }} />
            <div className="w-0.5 bg-cyan-400 rounded-full transition-all duration-75" style={{ height: `${Math.max(4, audioVolume * 0.10)}px` }} />
          </div>

          <button
            type="button"
            onClick={stopRecording}
            className="ml-2 p-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 transition-colors"
            title="Stop recording"
          >
            <Square className="w-3 h-3 fill-current" /> Stop
          </button>
        </div>
      )}

      {/* Transcribing State */}
      {isTranscribing && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-cyan-500/40 text-cyan-300 text-xs">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
          <span>Processing voice...</span>
        </div>
      )}

      {/* Error Notice Dropdown / Toast */}
      {errorMessage && (
        <div className="absolute bottom-full mb-2 right-0 z-50 p-2.5 rounded-xl bg-slate-900 border border-rose-500/40 text-rose-300 text-xs shadow-xl max-w-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-slate-200">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-slate-400 hover:text-white font-bold ml-1 text-xs"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};
