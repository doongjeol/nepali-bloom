import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDialogueAudioPath, getPronunciationAudioPath, getVocabAudioPath } from "@/lib/getAudioPath";

function ttsHash(text: string): string {
  // Fast stable hash for filenames (djb2-ish).
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  // convert to unsigned base36
  return (hash >>> 0).toString(36);
}

// 파이썬 스크립트의 safe_filename과 동일한 치환 로직
function safeFilename(name: string): string {
  return (name || "").trim().replace(/\.\./g, ".").replace(/[<>:"/\\|?*]/g, "_");
}

function getKoreanTtsAudioPath(lessonId: string | number, text: string, word?: VocabularyItem): string {
  if (word) {
    if (word.type === "dialogue" && typeof word.dIdx === "number" && typeof word.lIdx === "number") {
      return getPronunciationAudioPath(`/audio/lesson_${lessonId}/dial_${word.dIdx}_${word.lIdx}_ko.mp3`);
    }
    if ((!word.type || word.type === "vocab") && word.romanized) {
      return getPronunciationAudioPath(`/audio/lesson_${lessonId}/${safeFilename(word.romanized)}_ko.mp3`);
    }
  }
  // 단어 데이터가 없는 시스템 안내(예: "학습이 모두 끝났습니다")는 해시명 유지
  const id = ttsHash(text.trim());
  return getPronunciationAudioPath(`/audio/lesson_${lessonId}/ko_${id}.mp3`);
}
import { getSharedAudioElement } from "@/hooks/useAudioPlayer";

export type VocabularyItem = {
  nepali: string;
  romanized: string;
  korean: string;
  example?: any;
  lessonId?: string | number;
  type?: string;
  dIdx?: number;
  lIdx?: number;
};

type TaskType = "audio" | "delay";

export interface PlaybackTask {
  type: TaskType;
  payload: string | number; // audio src or delay ms
  description?: string;
  wordIndex?: number;
}

type SwipeHandlers = {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
};

type WakeLockSentinelLike = { release: () => Promise<void> };

function useWakeLock(enabled: boolean) {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  const release = useCallback(async () => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    try {
      await sentinel?.release();
    } catch {
      // ignore
    }
  }, []);

  const request = useCallback(async () => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const wakeLockApi = (
      navigator as unknown as {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
      }
    ).wakeLock;
    if (!wakeLockApi) return;

    try {
      sentinelRef.current = await wakeLockApi.request("screen");
    } catch {
      // ignore
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      void release();
      return;
    }

    void request();

    const onVisibility = () => {
      if (document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void release();
    };
  }, [enabled, release, request]);
}

function useSwipeNavigation({
  enabled,
  onNext,
  onPrev,
  thresholdPx = 60,
  maxOffAxisPx = 80,
}: {
  enabled: boolean;
  onNext: () => void;
  onPrev: () => void;
  thresholdPx?: number;
  maxOffAxisPx?: number;
}): SwipeHandlers {
  const startRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      startRef.current = { x: e.clientX, y: e.clientY, active: true };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [enabled],
  );

  const onPointerMove = useCallback((_e: React.PointerEvent) => {
    // decide on pointer up to avoid accidental triggers
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      const start = startRef.current;
      startRef.current.active = false;
      if (!start.active) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;

      if (Math.abs(dy) > maxOffAxisPx) return;
      if (Math.abs(dx) < thresholdPx) return;

      if (dx < 0) onNext();
      else onPrev();
    },
    [enabled, maxOffAxisPx, onNext, onPrev, thresholdPx],
  );

  const onPointerCancel = useCallback(() => {
    startRef.current.active = false;
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}

type UseDrivingModeOptions = {
  enableWakeLock?: boolean;
  enableSwipe?: boolean;
  ttsSpeed?: number;
  onSessionComplete?: () => void;
  studyMode?: "word" | "dialogue";
  audioOnly?: boolean;
};

export function useDrivingMode(lessonId: string | number, vocabulary: VocabularyItem[], options?: UseDrivingModeOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(-1);
  const [tasks, setTasks] = useState<PlaybackTask[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const bufferSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const isPlayingRef = useRef(false);
  const runIdRef = useRef(0);
  const currentTaskIndexRef = useRef(-1);
  const lastAdvanceKeyRef = useRef<string | null>(null);
  const didUnlockHtmlAudioRef = useRef(false);
  const unlockAudioElRef = useRef<HTMLAudioElement | null>(null);
  const processingKeyRef = useRef<string | null>(null);
  const pendingAutoplayRef = useRef(false);
  useEffect(() => {
    currentTaskIndexRef.current = currentTaskIndex;
  }, [currentTaskIndex]);

  const onSessionCompleteRef = useRef(options?.onSessionComplete);
  useEffect(() => {
    onSessionCompleteRef.current = options?.onSessionComplete;
  }, [options?.onSessionComplete]);

  useWakeLock(Boolean(options?.enableWakeLock ?? true) && isPlaying);

  const wordStartTaskIndex = useMemo(() => {
    const map = new Map<number, number>();
    tasks.forEach((t, idx) => {
      if (typeof t.wordIndex === "number" && !map.has(t.wordIndex)) map.set(t.wordIndex, idx);
    });
    return map;
  }, [tasks]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const stopAudio = useCallback(() => {
    try {
      bufferSourceRef.current?.stop?.();
    } catch {
      // ignore
    }
    bufferSourceRef.current = null;
    try {
      gainNodeRef.current?.disconnect?.();
    } catch {
      // ignore
    }
    gainNodeRef.current = null;

    const audio = audioRef.current;
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audio.oncanplaythrough = null;
    // canplaythrough가 안 뜨는 브라우저(모바일) 대응
    (audio as any).oncanplay = null;
    (audio as any).onloadeddata = null;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // ignore
    }
  }, []);

  const pause = useCallback(() => {
    runIdRef.current += 1; // cancel in-flight awaits
    setIsPlaying(false);
    isPlayingRef.current = false;
    setIsFinished(false);
    setAutoplayBlocked(false);
    pendingAutoplayRef.current = false;
    try {
      const ms = (navigator as any)?.mediaSession as MediaSession | undefined;
      if (ms) ms.playbackState = "paused";
    } catch {
      // ignore
    }
    clearTimer();
    stopAudio();
  }, [clearTimer, stopAudio]);

  const stop = useCallback(() => {
    pause();
    setCurrentTaskIndex(-1);
    setCurrentWordIndex(0);
    setIsFinished(false);
    processingKeyRef.current = null;
  }, [pause]);

  useEffect(() => () => pause(), [pause]);

  const unlockAudio = useCallback(() => {
    if (typeof window === "undefined") return;

    // 1) HTMLAudioElement "gesture lock" 해제:
    // iOS Safari는 user gesture 안에서 생성/재생된 audio 인스턴스를 이후에도 재생 가능한 경우가 많다.
    // (setTimeout/Promise 체인에서 만들어진 audio는 play()가 계속 reject될 수 있음)
    if (!didUnlockHtmlAudioRef.current) {
      try {
        const a = new Audio();
        unlockAudioElRef.current = a;
        a.preload = "auto";
        a.src =
          "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
        a.volume = 1.0;
        const p = a.play();
        if (p && typeof (p as any).catch === "function") (p as Promise<void>).catch(() => {});
        a.pause();
        a.currentTime = 0;
        didUnlockHtmlAudioRef.current = true;
      } catch {
        // ignore
      }
    }

    // 2) WebAudio unlock (mute switch 대응 포함)
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (AudioCtx) {
      try {
        const ctx = audioContextRef.current ?? new AudioCtx();
        audioContextRef.current = ctx;
        if (ctx.state === "suspended") void ctx.resume();

        const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        source.stop(0);
      } catch {
        // ignore
      }
    }

  }, []);

  const advanceIndex = useCallback(
    (fromIndex: number, reason: string) => {
      // 규칙 1: 인덱스 증가는 "완료 이벤트 핸들러"에서만 발생
      const key = `${runIdRef.current}:${fromIndex}`;
      if (lastAdvanceKeyRef.current === key) return;
      lastAdvanceKeyRef.current = key;
      console.log(`[DM] index++ ${fromIndex} -> ${fromIndex + 1} (${reason})`);
      setCurrentTaskIndex((prev) => {
        if (prev !== fromIndex) return prev;
        return fromIndex + 1;
      });
    },
    [],
  );

  const play = useCallback(() => {
    // If tasks haven't been built yet for the current vocabulary, defer start until tasks are ready.
    if (tasks.length <= 1) {
      pendingAutoplayRef.current = true;
      console.log(`[DM] play() deferred (tasks not ready) tasks=${tasks.length} vocab=${vocabulary.length}`);
      return;
    }
    pendingAutoplayRef.current = false;
    runIdRef.current += 1;
    processingKeyRef.current = null;
    setIsFinished(false);
    setIsPlaying(true);
    isPlayingRef.current = true;
    setAutoplayBlocked(false);
    const startIndex = currentTaskIndexRef.current > -1 ? currentTaskIndexRef.current : 0;
    console.log(`[DM] play() startIndex=${startIndex} totalTasks=${tasks.length}`);
    setCurrentTaskIndex(startIndex);
  }, [tasks.length, vocabulary.length]);

  const jumpToWord = useCallback(
    (nextWordIndex: number) => {
      const clamped = Math.max(0, Math.min(vocabulary.length - 1, nextWordIndex));
      setCurrentWordIndex(clamped);

      const taskIdx = wordStartTaskIndex.get(clamped);
      if (typeof taskIdx !== "number") return;

      clearTimer();
      stopAudio();

      runIdRef.current += 1;
      setIsFinished(false);
      setIsPlaying(true);
      isPlayingRef.current = true;
      setAutoplayBlocked(false);
      console.log(`[DM] jumpToWord word=${clamped} taskIdx=${taskIdx}`);
      setCurrentTaskIndex(taskIdx);
    },
    [clearTimer, stopAudio, vocabulary.length, wordStartTaskIndex],
  );

  const nextWord = useCallback(() => jumpToWord(currentWordIndex + 1), [currentWordIndex, jumpToWord]);
  const prevWord = useCallback(() => jumpToWord(currentWordIndex - 1), [currentWordIndex, jumpToWord]);

  const swipeHandlers = useSwipeNavigation({
    enabled: Boolean(options?.enableSwipe ?? true),
    onNext: nextWord,
    onPrev: prevWord,
  });

  /*
  const buildTasks = useCallback(
    (words: VocabularyItem[]): PlaybackTask[] => {
      const newTasks: PlaybackTask[] = [];

      words.forEach((word, index) => {
        const type = word.type || "vocab";
        const mode = options?.studyMode;
        let label = "단어";
        if (type === "grammar") label = "문법";
        else if (type === "dialogue") label = "대화문";
        else if (type === "quiz") label = "퀴즈";

        newTasks.push({
          type: "speech",
          payload: `${label} ${index + 1}번`,
          description: `${label} ${index + 1}번 안내`,
          wordIndex: index,
        });

        if (type === "vocab") {
          newTasks.push({
            type: "audio",
            payload: getVocabAudioPath(word.lessonId ?? lessonId, word.romanized),
            description: `네팔어 발음: ${word.nepali}`,
            wordIndex: index,
          });
          newTasks.push({ type: "delay", payload: 1500, description: "대기", wordIndex: index });

          const meaningText = word.korean.split("(")[1]?.replace(")", "") || word.korean;
        pushKoAudio(meaningText, `뜻: ${meaningText}`, index);
          newTasks.push({ type: "delay", payload: 2500, description: "대기", wordIndex: index });
        } else if (type === "dialogue") {
          const cleanKorean = word.korean.replace(/^\[.*?\]\s* /, "");
          const speakerPrefixMatch = word.korean.match(/^\[(.*?)\]\s* /);
          const speaker = speakerPrefixMatch?.[1];

          if (mode === "dialogue") {
            // 요구사항: 대화문은 한글을 먼저 재생하고 네팔어를 재생
            newTasks.push({
              type: "speech",
              payload: cleanKorean,
              description: speaker ? `[${speaker}] 해석` : "해석",
              wordIndex: index,
            });
            // 한글 TTS 직후 iOS에서 오디오가 "ducking" 된 상태로 시작해 점점 커지는 것처럼 들릴 수 있어
            // 약간 더 쉬었다가 네팔어를 재생한다.
            newTasks.push({ type: "delay", payload: 1200, description: "대기", wordIndex: index });

            if (typeof word.dIdx === "number" && typeof word.lIdx === "number") {
              newTasks.push({
                type: "audio",
                payload: getDialogueAudioPath(word.lessonId ?? lessonId, word.dIdx, word.lIdx),
                description: speaker ? `[${speaker}] 네팔어` : "네팔어",
                wordIndex: index,
              });
            } else {
              newTasks.push({
                type: "speech",
                payload: word.nepali,
                description: speaker ? `[${speaker}] 네팔어` : "네팔어",
                wordIndex: index,
                isNepaliTTS: true,
              });
            }
            newTasks.push({ type: "delay", payload: 1200, description: "대기", wordIndex: index });
          } else {
            newTasks.push({
              type: "speech",
              payload: cleanKorean,
              description: `뜻: ${cleanKorean}`,
              wordIndex: index,
            });
            newTasks.push({ type: "delay", payload: 900, description: "대기", wordIndex: index });

          if (typeof word.dIdx === "number" && typeof word.lIdx === "number") {
            newTasks.push({
              type: "audio",
              payload: getDialogueAudioPath(word.lessonId ?? lessonId, word.dIdx, word.lIdx),
              description: `네팔어: ${word.nepali}`,
              wordIndex: index,
            });
          }
            newTasks.push({ type: "delay", payload: 1200, description: "대기", wordIndex: index });
          }
        } else {
          newTasks.push({
            type: "speech",
            payload: word.korean,
            description: `내용: ${word.korean}`,
            wordIndex: index,
          });
          // speechSynthesis 이후 일부 환경에서 다음 오디오가 1.5~2초 정도 작게 시작했다가 커지는(ducking 복구) 현상이 있어
          // 충분히 회복 시간을 준 뒤 네팔어를 재생한다.
          newTasks.push({ type: "delay", payload: 2200, description: "대기", wordIndex: index });
        }
      });

      newTasks.push({
        type: "speech",
        payload: "학습을 모두 마쳤습니다. 처음부터 다시 시작하려면 이전 버튼을 눌러주세요.",
        description: "세션 종료 안내",
      });

      return newTasks;
    },
    [lessonId, options?.studyMode],
  );
  */

  const isIOS = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const iOSDevice = /iPad|iPhone|iPod/.test(ua);
    const iPadOS13Plus = navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1;
    return iOSDevice || iPadOS13Plus;
  }, []);

  useEffect(() => {
    try {
      if (typeof navigator === "undefined") return;
      console.log(
        `[DM] platform ua=${navigator.userAgent} platform=${(navigator as any).platform ?? "n/a"} maxTouchPoints=${(navigator as any).maxTouchPoints ?? "n/a"} isIOS=${isIOS}`,
      );
    } catch {
      // ignore
    }
  }, [isIOS]);

  // Build playback tasks whenever vocabulary changes
  useEffect(() => {
    const newTasks: PlaybackTask[] = [];

    const pushKoreanAudio = (
      text: string,
      description: string,
      wordIndex?: number,
      lessonIdOverride?: string | number,
    ) => {
      const actualLessonId =
        lessonIdOverride ??
        (typeof vocabulary[wordIndex ?? -1]?.lessonId !== "undefined"
          ? (vocabulary[wordIndex ?? -1] as any).lessonId
          : undefined) ??
        vocabulary.find((v) => typeof (v as any).lessonId !== "undefined")?.lessonId ??
        lessonId;

      const word = typeof wordIndex === "number" ? vocabulary[wordIndex] : undefined;

      newTasks.push({
        type: "audio",
        payload: getKoreanTtsAudioPath(actualLessonId ?? lessonId, text, word),
        description,
        wordIndex,
      });
    };

    vocabulary.forEach((word, index) => {
      const type = word.type || "vocab";
      const mode = options?.studyMode;

      if (type === "vocab") {
        newTasks.push({
          type: "audio",
          payload: getVocabAudioPath(word.lessonId ?? lessonId, word.romanized),
          description: `네팔어 발음: ${word.nepali}`,
          wordIndex: index,
        });
        newTasks.push({ type: "delay", payload: 1500, description: "대기", wordIndex: index });

        const meaningText = word.korean.split("(")[1]?.replace(")", "") || word.korean;
        pushKoreanAudio(meaningText, `뜻: ${meaningText}`, index, word.lessonId ?? lessonId);
        newTasks.push({ type: "delay", payload: 2500, description: "대기", wordIndex: index });

        if (false && word.example) {
          const actualLessonId = word.lessonId ?? lessonId;
          const exRomanized =
            typeof word.example === "string" ? word.romanized : word.example.romanized || word.romanized;
          const exampleText = typeof word.example === "string" ? word.example : word.example.nepali;
          newTasks.push({
            type: "audio",
            payload: getPronunciationAudioPath(`/audio/lesson_${actualLessonId}/${exRomanized}_example.mp3`),
            description: `예문: ${exampleText}`,
            wordIndex: index,
          });
          newTasks.push({ type: "delay", payload: 2000, description: "예문 후 대기", wordIndex: index });
        }
      } else if (type === "dialogue") {
        const cleanKorean = word.korean.replace(/^\[.*?\]\s*/, "");
        const speakerPrefixMatch = word.korean.match(/^\[(.*?)\]\s*/);
        const speaker = speakerPrefixMatch?.[1];

        // 대화문만 듣기(dialogue)에서는 [한국어 해석 -> 네팔어] 순으로 재생
        if (mode === "dialogue") {
          pushKoreanAudio(cleanKorean, speaker ? `[${speaker}] 해석` : "해석", index, word.lessonId ?? lessonId);
          // 한글 TTS 직후 iOS에서 오디오가 "ducking" 된 상태로 시작해 점점 커지는 것처럼 들릴 수 있어
          // 약간 더 쉬었다가 네팔어를 재생한다.
          newTasks.push({ type: "delay", payload: 1200, description: "대기", wordIndex: index });

          if (typeof word.dIdx === "number" && typeof word.lIdx === "number") {
            newTasks.push({
              type: "audio",
              payload: getDialogueAudioPath(word.lessonId ?? lessonId, word.dIdx, word.lIdx),
              description: speaker ? `[${speaker}] 네팔어` : "네팔어",
              wordIndex: index,
            });
          }
          newTasks.push({ type: "delay", payload: 1200, description: "대기", wordIndex: index });
        } else {
          // 기본(혼합) 흐름은 기존대로 [한국어 -> 네팔어] 유지
          pushKoreanAudio(cleanKorean, `뜻: ${cleanKorean}`, index, word.lessonId ?? lessonId);
          newTasks.push({ type: "delay", payload: 2200, description: "대기", wordIndex: index });

          if (typeof word.dIdx === "number" && typeof word.lIdx === "number") {
            newTasks.push({
              type: "audio",
              payload: getDialogueAudioPath(word.lessonId ?? lessonId, word.dIdx, word.lIdx),
              description: `네팔어: ${word.nepali}`,
              wordIndex: index,
            });
          }
          newTasks.push({ type: "delay", payload: 2500, description: "대기", wordIndex: index });
        }
      } else {
        pushKoreanAudio(word.korean, `내용: ${word.korean}`, index, word.lessonId ?? lessonId);
        newTasks.push({ type: "delay", payload: 2500, description: "대기", wordIndex: index });
      }
    });

    pushKoreanAudio("학습이 모두 끝났습니다.", "세션 종료 안내");

    setTasks(newTasks);
    setCurrentWordIndex(0);
    setCurrentTaskIndex(newTasks.length > 0 ? 0 : -1);
    // 큐가 바뀌면 재생은 중단(중복 effect 방지)
    runIdRef.current += 1;
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsFinished(false);
    clearTimer();
    stopAudio();

    // If a play was requested before tasks were ready, start now.
    if (pendingAutoplayRef.current && newTasks.length > 1) {
      pendingAutoplayRef.current = false;
      runIdRef.current += 1;
      processingKeyRef.current = null;
      setIsFinished(false);
      setIsPlaying(true);
      isPlayingRef.current = true;
      setAutoplayBlocked(false);
      console.log(`[DM] autoplay resumed after tasks built totalTasks=${newTasks.length}`);
      setCurrentTaskIndex(0);
    }
  }, [clearTimer, lessonId, options?.studyMode, stopAudio, vocabulary]);

  // 규칙 1/2/3을 만족하는 재생 엔진:
  // - effect는 현재 index의 task를 "시작만" 한다.
  // - 다음 index로의 전환은 delay/tts/audio의 완료 핸들러에서만 수행한다.
  useEffect(() => {
    if (!isPlaying) return;
    if (tasks.length === 0) return;
    if (currentTaskIndex < 0) return;

    const runId = runIdRef.current;
    const index = currentTaskIndex;
    const processingKey = `${runId}:${index}`;
    if (processingKeyRef.current === processingKey) return;
    processingKeyRef.current = processingKey;

    // 종료 판정은 "마지막 인덱스로 advance 된 후"에만
    if (index >= tasks.length) {
      console.log(`[DM] finished trigger index=${index} tasks=${tasks.length}`);
      setIsPlaying(false);
      isPlayingRef.current = false;
      setIsFinished(true);
      setCurrentTaskIndex(-1);
      onSessionCompleteRef.current?.();
      return;
    }

    const task = tasks[index];
    if (typeof task.wordIndex === "number") setCurrentWordIndex(task.wordIndex);

    console.log(`[DM] task start idx=${index} type=${task.type} wordIndex=${task.wordIndex ?? "n/a"}`);

    // Cleanup: effect 중복 실행/StrictMode 재실행에서도 안전하게 이전 오브젝트 정리
    let cancelled = false;
    let webAudioStartTimeout: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      cancelled = true;
      if (webAudioStartTimeout) clearTimeout(webAudioStartTimeout);
      webAudioStartTimeout = null;
      clearTimer();
      stopAudio();
      if (processingKeyRef.current === processingKey) processingKeyRef.current = null;
      // 규칙 1: 오디오 새로 만들면 기존 pause+null 처리(우리는 재사용하지만 cleanup에서 확실히 멈춤)
      // audioRef.current는 유지하되, 다음 effect에서 src 변경 전 상태 누수 방지
    };

    if (task.type === "delay") {
      clearTimer();
      const rawMs = task.payload as number;
      // iOS Safari는 user-gesture 컨텍스트가 setTimeout 지연에 매우 민감해서
      // iOS Safari에서 user-gesture 컨텍스트가 지연(setTimeout) 후 약해지면 다음 play()가 막힐 수 있습니다.
      // 하지만 너무 짧게 자르면(TTS 직후) 오디오가 "ducking" 상태에서 시작해 볼륨이 점점 커지는 듯 들릴 수 있어
      // 상한을 1.5s로 완화합니다.
      const ms = isIOS ? Math.min(rawMs, 1500) : rawMs;
      timerRef.current = setTimeout(() => {
        if (cancelled) return;
        if (runIdRef.current !== runId) return;
        console.log(`[DM] delay done idx=${index} ms=${ms}`);
        advanceIndex(index, "delay");
      }, ms);
      return cleanup;
    }

    // audio
    // iOS에서는 TTS 직후 media element 오디오가 "ducking"된 상태로 시작해 점점 커지는 듯 들리는 경우가 있어,
    // 드라이브 모드는 모바일 잠금화면에서도 안정적으로 이어지는 "media element" 경로를 우선한다.
    // (레슨 대화문 전체재생과 동일한 HTMLAudioElement 기반)
    //
    // 다만 iOS에서는 SpeechSynthesis 직후 media element 오디오가 "작게 시작했다가 커지는" 현상이 종종 있어,
    // 화면이 켜져(visible) 있는 동안에는 WebAudio로 재생해 볼륨 램프를 줄이고,
    // 잠금화면/백그라운드(visibilityState=hidden)에서는 HTMLAudioElement로 폴백한다.
    // AudioContext는 user gesture에서 unlockAudio()로 열리는 것이 가장 좋지만,
    // 여기서도 존재하지 않으면 생성만 해둬서(WebAudio decode/play 경로) HTMLAudioElement 폴백 비율을 줄인다.
    if (!audioContextRef.current && typeof window !== "undefined") {
      try {
        const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
        if (AudioCtx) audioContextRef.current = new AudioCtx();
      } catch {
        // ignore
      }
    }

    // Lock-screen / background playback works most reliably with a single shared HTMLAudioElement.
    // WebAudio playback is intentionally disabled here to keep MediaSession + lockscreen controls stable.
    const canUseWebAudioInForeground = false;
    if (isIOS) {
      try {
        console.log(
          `[DM] webaudio gate idx=${index} isIOS=${isIOS} hasCtx=${Boolean(audioContextRef.current)} ctxState=${audioContextRef.current?.state ?? "n/a"} vis=${typeof document !== "undefined" ? document.visibilityState : "n/a"} canUseWebAudio=${canUseWebAudioInForeground}`,
        );
      } catch {
        // ignore
      }
    }

    const startHtmlAudio = (src: string) => {
      const audio = getSharedAudioElement() ?? audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.onended = null;
      audio.onerror = null;
      audio.oncanplaythrough = null;

      console.log(`[DM] audio load try idx=${index} src=${src}`);

      // iOS Safari에서 잠금화면/백그라운드 재생 안정성을 높이기 위해 가능한 한 동일한 element를 재사용한다.
      try {
        (audio as any).playsInline = true;
        audio.setAttribute?.("playsinline", "true");
      } catch {
        // ignore
      }

      let didStartPlay = false;
      const handleCanPlay = () => {
        if (cancelled) return;
        if (runIdRef.current !== runId) return;
        if (didStartPlay) return;
        didStartPlay = true;
        clearTimer();
        console.log(`[DM] audio canplaythrough idx=${index} src=${src}`);

        // iOS에서 시작 볼륨이 낮게 붙는 경우가 있어 재생 직전에 한 번 더 명시
        try {
          audio.muted = false;
          audio.volume = 1.0;
        } catch {
          // ignore
        }

        audio.onended = () => {
          if (cancelled) return;
          if (runIdRef.current !== runId) return;
          console.log(`[DM] audio ended idx=${index} src=${src}`);
          advanceIndex(index, "audio-ended");
        };
        audio.onerror = (e) => {
          if (cancelled) return;
          if (runIdRef.current !== runId) return;
          console.log(`[DM] audio error idx=${index} src=${src}`, e);
          advanceIndex(index, "audio-error");
        };

        audio
          .play()
          .then(() => {
            console.log(`[DM] audio play started idx=${index}`);
            try {
              const ms = (navigator as any)?.mediaSession as MediaSession | undefined;
              if (ms) ms.playbackState = "playing";
            } catch {
              // ignore
            }
            try {
              audio.muted = false;
              audio.volume = 1.0;
              setTimeout(() => {
                try {
                  audio.muted = false;
                  audio.volume = 1.0;
                } catch {
                  // ignore
                }
              }, 50);
            } catch {
              // ignore
            }
            setAutoplayBlocked(false);
          })
          .catch((e) => {
            console.log(`[DM] audio play rejected idx=${index}`, e);
            // autoplay 정책 등으로 재생이 거부될 수 있음.
            // 이 경우 "다음으로 스킵"하면 이후 음성이 전부 건너뛰어질 수 있으므로,
            // 세션을 일시정지 상태로 두고 사용자의 재생/다음 입력을 기다립니다.
            setIsPlaying(false);
            isPlayingRef.current = false;
            setAutoplayBlocked(true);
          });
      };

      audio.oncanplaythrough = handleCanPlay;
      (audio as any).oncanplay = handleCanPlay;
      (audio as any).onloadeddata = handleCanPlay;

      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // ignore
      }

      audio.preload = "auto";
      audio.src = src;
      audio.muted = false;
      audio.volume = 1.0;
      audio.load();

      queueMicrotask(() => {
        if (cancelled) return;
        if (runIdRef.current !== runId) return;
        if (didStartPlay) return;
        if (audio.readyState >= 2) handleCanPlay();
      });

      const loadTimeoutMs = 5000;
      clearTimer();
      timerRef.current = setTimeout(() => {
        if (cancelled) return;
        if (runIdRef.current !== runId) return;
        if (didStartPlay) return;
        console.log(`[DM] audio load TIMEOUT idx=${index} src=${src}`);
        // 규칙 2: 5초 내 로드 안되면 로그 + 다음 단어로(다음 인덱스로) 진행
        advanceIndex(index, "audio-load-timeout");
      }, loadTimeoutMs);

    };

    const src = task.payload as string;

    if (canUseWebAudioInForeground) {
      const audioCtx = audioContextRef.current!;
      console.log(`[DM] webaudio(fg) try idx=${index} src=${src}`);

      // WebAudio가 iOS에서 볼륨 "페이드업" 현상을 줄이는 핵심 경로라서,
      // 로딩이 조금 느려도 HTMLAudioElement로 빠르게 폴백하지 않도록 타임아웃을 넉넉히 잡는다.
      webAudioStartTimeout = setTimeout(() => {
        if (cancelled) return;
        if (runIdRef.current !== runId) return;
        console.log(`[DM] webaudio(fg) start TIMEOUT idx=${index} src=${src}`);
        // WebAudio가 너무 늦어지면 HTMLAudioElement로 폴백한다.
        // (볼륨 램프가 재발할 수 있지만, 소리가 안 나는 것보다는 낫다)
        startHtmlAudio(src);
      }, 10000);

      void (async () => {
        try {
          if (audioCtx.state === "suspended") await audioCtx.resume();

          let buffer = audioBufferCacheRef.current.get(src);
          if (!buffer) {
            const res = await fetch(src);
            const arr = await res.arrayBuffer();
            buffer = await audioCtx.decodeAudioData(arr.slice(0));
            audioBufferCacheRef.current.set(src, buffer);
          }

          if (cancelled) return;
          if (runIdRef.current !== runId) return;

          if (webAudioStartTimeout) clearTimeout(webAudioStartTimeout);
          webAudioStartTimeout = null;

          stopAudio();
          const gain = audioCtx.createGain();
          gain.gain.value = 1.0;
          gain.connect(audioCtx.destination);
          gainNodeRef.current = gain;

          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(gain);
          bufferSourceRef.current = source;

          source.onended = () => {
            if (cancelled) return;
            if (runIdRef.current !== runId) return;
            console.log(`[DM] webaudio(fg) ended idx=${index} src=${src}`);
            advanceIndex(index, "webaudio-fg-ended");
          };

          setAutoplayBlocked(false);
          console.log(`[DM] webaudio(fg) start idx=${index} src=${src}`);
          source.start(0);
        } catch (e) {
          if (cancelled) return;
          if (runIdRef.current !== runId) return;
          console.log(`[DM] webaudio(fg) error idx=${index} src=${src}`, e);
          if (webAudioStartTimeout) clearTimeout(webAudioStartTimeout);
          webAudioStartTimeout = null;
          // WebAudio가 실패하면 HTMLAudioElement로 폴백.
          // (iOS에서는 볼륨 램프가 재발할 수 있지만, "소리가 안 나는 것"보다는 낫다고 보고 폴백을 허용한다)
          startHtmlAudio(src);
        }
      })();
    } else {
      startHtmlAudio(src);
    }
    return cleanup;
  }, [advanceIndex, clearTimer, currentTaskIndex, isPlaying, pause, stopAudio, tasks]);

  // MediaSession: lockscreen / headset controls
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ms = (navigator as any).mediaSession as MediaSession | undefined;
    if (!ms || typeof ms.setActionHandler !== "function") return;

    const onPlay = () => {
      try {
        void unlockAudio();
      } catch {
        // ignore
      }
      play();
    };
    const onPause = () => pause();
    const onNext = () => nextWord();
    const onPrev = () => prevWord();

    try {
      ms.setActionHandler("play", onPlay);
      ms.setActionHandler("pause", onPause);
      ms.setActionHandler("nexttrack", onNext);
      ms.setActionHandler("previoustrack", onPrev);
    } catch {
      // ignore
    }

    try {
      const title = currentTaskIndex > -1 ? tasks[currentTaskIndex]?.description : "Driving Mode";
      ms.metadata = new MediaMetadata({
        title: typeof title === "string" ? title : "Driving Mode",
      });
    } catch {
      // ignore
    }

    return () => {
      try {
        ms.setActionHandler("play", null);
        ms.setActionHandler("pause", null);
        ms.setActionHandler("nexttrack", null);
        ms.setActionHandler("previoustrack", null);
      } catch {
        // ignore
      }
    };
  }, [currentTaskIndex, nextWord, pause, play, prevWord, tasks, unlockAudio]);

  return {
    isPlaying,
    isFinished,
    autoplayBlocked,
    currentTask: currentTaskIndex > -1 ? tasks[currentTaskIndex] : null,
    progress: tasks.length > 0 ? Math.max(0, currentTaskIndex) / tasks.length : 0,
    currentWordIndex,
    currentWord: vocabulary[currentWordIndex] ?? null,
    unlockAudio,
    play,
    pause,
    stop,
    nextWord,
    prevWord,
    swipeHandlers,
  };
}
