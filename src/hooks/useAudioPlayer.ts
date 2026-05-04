import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type PlayerState = {
  currentItemId: string | null;
  currentSrc: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  silentError: boolean;
};

type Listener = (state: PlayerState) => void;

const state: PlayerState = {
  currentItemId: null,
  currentSrc: null,
  isPlaying: false,
  isLoading: false,
  error: null,
  silentError: false,
};

const listeners = new Set<Listener>();

let audio: HTMLAudioElement | null = null;
let initialized = false;
let lastErrorToastAt = 0;
const ERROR_TOAST_DEDUP_MS = 1200;

function toastMissingAudioOnce() {
  const now = Date.now();
  if (now - lastErrorToastAt < ERROR_TOAST_DEDUP_MS) return;
  lastErrorToastAt = now;
  toast.error("음성 파일을 찾을 수 없습니다");
}

function emit() {
  for (const listener of listeners) listener({ ...state });
}

function setState(patch: Partial<PlayerState>) {
  Object.assign(state, patch);
  emit();
}

function ensureAudio() {
  if (audio) return audio;
  if (typeof window === "undefined") return null;
  audio = new Audio();
  audio.preload = "none";
  return audio;
}

function initOnce() {
  if (initialized) return;
  initialized = true;
  const el = ensureAudio();
  if (!el) return;

  el.addEventListener("playing", () => setState({ isPlaying: true, isLoading: false }));
  el.addEventListener("pause", () => setState({ isPlaying: false, isLoading: false }));
  el.addEventListener("ended", () =>
    setState({ isPlaying: false, isLoading: false, currentItemId: null, currentSrc: null }),
  );
  el.addEventListener("canplay", () => setState({ isLoading: false }));
  el.addEventListener("waiting", () => setState({ isLoading: true }));
  el.addEventListener("error", () => {
    console.error(`[오디오 로드 실패] 브라우저가 파일을 찾지 못했습니다. 요청 경로: ${el?.src}`);
    setState({ isPlaying: false, isLoading: false, currentItemId: null, currentSrc: null });
    const message = "음성 파일을 찾을 수 없습니다";
    setState({ error: message });
    if (!state.silentError) {
      toastMissingAudioOnce();
    }
  });
}

async function playItem(itemId: string, src: string, options?: { silentError?: boolean }) {
  initOnce();
  const el = ensureAudio();
  if (!el) return;

  setState({ error: null, silentError: options?.silentError ?? false });

  const isSameItem = state.currentItemId === itemId && state.currentSrc === src;
  if (isSameItem && state.isPlaying) {
    el.pause();
    return;
  }

  try {
    if (!isSameItem) {
      el.pause();
      el.currentTime = 0;
      el.src = src;
      setState({ currentItemId: itemId, currentSrc: src, isLoading: true, isPlaying: false });
      el.load();
    }

    await el.play();
  } catch (e) {
    const message = "음성 파일을 찾을 수 없습니다";
    console.error(`[오디오 재생 실패] 요청 경로: ${src}`, e);
    setState({
      error: message,
      isPlaying: false,
      isLoading: false,
      currentItemId: null,
      currentSrc: null,
    });
    if (!state.silentError) {
      toastMissingAudioOnce();
    }
  }
}

function stop() {
  initOnce();
  const el = ensureAudio();
  if (!el) return;
  el.pause();
  el.currentTime = 0;
  el.src = "";
  setState({ isPlaying: false, isLoading: false, currentItemId: null, currentSrc: null });
}

export type UseAudioPlayerResult = PlayerState & {
  play: (itemId: string, src: string, options?: { silentError?: boolean }) => Promise<void>;
  stop: () => void;
};

export function useAudioPlayer(): UseAudioPlayerResult {
  const [snapshot, setSnapshot] = useState<PlayerState>({ ...state });

  useEffect(() => {
    initOnce();
    const listener: Listener = (next) => setSnapshot(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return useMemo(
    () => ({
      ...snapshot,
      play: playItem,
      stop,
    }),
    [snapshot],
  );
}
