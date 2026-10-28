export function studySound(correct: boolean) {
  if (document.documentElement.dataset.sound !== "on") return;
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    const close = () => {
      if (context.state !== "closed") void context.close().catch(() => {});
    };
    oscillator.type = "sine";
    oscillator.frequency.value = correct ? 660 : 330;
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.13);
    oscillator.onended = close;
    void context.resume().catch(close);
  } catch {
    /* Audio remains optional on restricted browsers. */
  }
}
