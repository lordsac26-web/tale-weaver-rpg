// Centralized narration kill-switch.
//
// The browser SpeechSynthesis engine lives on `window` — it keeps speaking even
// after the React component that started it unmounts. This utility force-stops
// all speech reliably, so it can be called from anywhere (StoryPanel cleanup,
// the Game page unmount, navigation away, or the browser tab closing).

// Stops any in-progress narration immediately and flushes the queue.
// Some browsers need a deferred second cancel() to fully clear utterances
// that were queued right before teardown — hence the setTimeout follow-up.
export function stopAllNarration() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    setTimeout(() => {
      try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    }, 0);
  } catch {
    /* noop — speechSynthesis can throw on some locked-down browsers */
  }
}