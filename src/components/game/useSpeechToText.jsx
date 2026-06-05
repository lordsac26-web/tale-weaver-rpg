import { useRef, useState, useCallback, useEffect } from 'react';

// Lightweight wrapper around the browser's Web Speech API (SpeechRecognition).
// Taps the microphone and returns live transcribed text via onResult.
// Gracefully reports unsupported browsers (e.g. Firefox) so the UI can hide the mic.
export default function useSpeechToText({ onResult } = {}) {
  const SpeechRecognition =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  const supported = !!SpeechRecognition;

  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!supported || listening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false; // only final, clean transcripts
    recognition.continuous = false;     // one phrase per activation
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join(' ')
        .trim();
      if (transcript) onResult?.(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [supported, listening, onResult, SpeechRecognition]);

  // Cleanup on unmount — never leave the mic hot.
  useEffect(() => () => recognitionRef.current?.abort?.(), []);

  return { supported, listening, start, stop };
}