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
  // 5. 디버깅용 로그 강화: error 이벤트에서 상세 로깅, 상태 변경은 playItem 훅 내에서 제어하도록 위임
  el.addEventListener("error", (e) => {
    const target = e.target as HTMLAudioElement;
    console.warn(`[오디오 미디어 에러] 브라우저 파일 로드 실패. (에러 코드: ${target.error?.code}) 요청 경로: ${target.src}`);
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

  // 4. 다중 시도 로직 (Fallback): 확장자 대문자 변경 또는 원본 복구 시도
  const fallbacks = Array.from(
    new Set([
      src,
      src.replace(/\.mp3$/i, ".MP3"),
      src.replace(/\.mp3$/i, ".mp3"),
      decodeURI(src) // 인코딩 관련 서버 이슈 대비 디코딩된 버전 추가 시도
    ])
  );

  let playSuccess = false;

  for (const targetSrc of fallbacks) {
    try {
      el.pause();
      el.currentTime = 0;
      el.src = targetSrc;
      setState({ currentItemId: itemId, currentSrc: targetSrc, isLoading: true, isPlaying: false });
      el.load();
      await el.play();
      playSuccess = true;
      break; // 성공하면 루프 탈출
    } catch (e) {
      console.warn(`[오디오 Fallback 시도 실패] 요청 경로: ${targetSrc}`, e);
    }
  }

  if (!playSuccess) {
    const message = "음성 파일을 찾을 수 없습니다";
    console.error(`[오디오 최종 실패] 모든 Fallback 경로에서 파일을 찾지 못했습니다. 원본 경로: ${src}`);
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
