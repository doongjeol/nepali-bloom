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
let playSeq = 0; // incremented for each play/stop to cancel in-flight play attempts

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
  // 5. ?붾쾭源낆슜 濡쒓렇 媛뺥솕: error ?대깽?몄뿉???곸꽭 濡쒓퉭, ?곹깭 蹂寃쎌? playItem ???댁뿉???쒖뼱?섎룄濡??꾩엫
  el.addEventListener("error", (e) => {
    const target = e.target as HTMLAudioElement;
    console.warn(
      `[?ㅻ뵒??誘몃뵒???먮윭] 釉뚮씪?곗? ?뚯씪 濡쒕뱶 ?ㅽ뙣. (?먮윭 肄붾뱶: ${target.error?.code}) ?붿껌 寃쎈줈: ${target.src}`,
    );
  });
}

async function playItem(itemId: string, src: string, options?: { silentError?: boolean }) {
  initOnce();
  const el = ensureAudio();
  if (!el) return;

  const seq = ++playSeq;

  setState({ error: null, silentError: options?.silentError ?? false });

  const isSameItem = state.currentItemId === itemId && state.currentSrc === src;
  if (isSameItem && state.isPlaying) {
    el.pause();
    return;
  }

  // 4. ?ㅼ쨷 ?쒕룄 濡쒖쭅 (Fallback): ?뺤옣???臾몄옄 蹂寃??먮뒗 ?먮낯 蹂듦뎄 ?쒕룄
  const fallbacks = Array.from(
    new Set([
      src,
      src.replace(/\.mp3$/i, ".MP3"),
      src.replace(/\.mp3$/i, ".mp3"),
      decodeURI(src), // ?몄퐫??愿???쒕쾭 ?댁뒋 ?鍮??붿퐫?⑸맂 踰꾩쟾 異붽? ?쒕룄
    ]),
  );

  let playSuccess = false;

  for (const targetSrc of fallbacks) {
    if (seq !== playSeq) return; // cancelled (stop pressed or another item started)
    try {
      el.pause();
      el.currentTime = 0;
      el.src = targetSrc;
      setState({ currentItemId: itemId, currentSrc: targetSrc, isLoading: true, isPlaying: false });
      el.load();
      await el.play();
      if (seq !== playSeq) return;
      playSuccess = true;
      break; // ?깃났?섎㈃ 猷⑦봽 ?덉텧
    } catch (e) {
      if (seq !== playSeq) return;
      console.warn(`[?ㅻ뵒??Fallback ?쒕룄 ?ㅽ뙣] ?붿껌 寃쎈줈: ${targetSrc}`, e);
    }
  }

  if (!playSuccess) {
    if (seq !== playSeq) return;
    const message = "음성 파일을 찾을 수 없습니다";
    console.error(
      `[?ㅻ뵒??理쒖쥌 ?ㅽ뙣] 紐⑤뱺 Fallback 寃쎈줈?먯꽌 ?뚯씪??李얠? 紐삵뻽?듬땲?? ?먮낯 寃쎈줈: ${src}`,
    );
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
  playSeq++; // cancel any in-flight playItem attempts
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
