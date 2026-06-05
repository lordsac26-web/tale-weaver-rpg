import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import useSpeechToText from './useSpeechToText';

// Microphone toggle for the reply/act window. Uses the browser's built-in
// speech-to-text. Appends each transcribed phrase to the current input value
// via onTranscript. Renders nothing in browsers without Web Speech support.
export default function MicButton({ value, onTranscript, disabled }) {
  const { supported, listening, start, stop } = useSpeechToText({
    onResult: (transcript) => {
      const next = value?.trim() ? `${value.trim()} ${transcript}` : transcript;
      onTranscript(next);
    },
  });

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      disabled={disabled}
      title={listening ? 'Listening… click to stop' : 'Speak your action'}
      className="px-3 py-2.5 rounded-xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
      style={listening ? {
        background: 'rgba(80,5,5,0.7)',
        border: '1px solid rgba(220,60,40,0.6)',
        color: '#fca5a5',
      } : {
        background: 'rgba(30,20,8,0.6)',
        border: '1px solid rgba(180,140,90,0.25)',
        color: 'rgba(201,169,110,0.7)',
      }}>
      {listening
        ? <Mic className="w-4 h-4 animate-pulse" />
        : <MicOff className="w-4 h-4" />}
    </button>
  );
}