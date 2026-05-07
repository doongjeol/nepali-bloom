import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDialogueAudioPath, getPronunciationAudioPath, getVocabAudioPath } from "@/lib/getAudioPath";
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

type TaskType = "audio" | "speech" | "delay";

export interface PlaybackTask {
  type: TaskType;
  payload: string | number; // audio src, speech text, or delay ms
  description?: string;
  wordIndex?: number;
  isNepaliTTS?: boolean;
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
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const bufferSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const isPlayingRef = useRef(false);
  const runIdRef = useRef(0);
  const currentTaskIndexRef = useRef(-1);
  const didUnlockHtmlAudioRef = useRef(false);
  const didUnlockSpeechRef = useRef(false);
  const unlockAudioElRef = useRef<HTMLAudioElement | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const processingKeyRef = useRef<string | null>(null);
  const pendingAutoplayRef = useRef(false);
  useEffect(() => {
    currentTaskIndexRef.current = currentTaskIndex;
  }, [currentTaskIndex]);

  const ttsSpeedRef = useRef(options?.ttsSpeed ?? 0.9);
  useEffect(() => {
    ttsSpeedRef.current = options?.ttsSpeed ?? 0.9;
  }, [options?.ttsSpeed]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const updateVoices = () => {
      try {
        voicesRef.current = synth.getVoices?.() ?? [];
      } catch {
        voicesRef.current = [];
      }
    };
    updateVoices();
    try {
      synth.addEventListener?.("voiceschanged", updateVoices);
    } catch {
      // ignore
    }
    return () => {
      try {
        synth.removeEventListener?.("voiceschanged", updateVoices);
      } catch {
        // ignore
      }
    };
  }, []);

  const pickTtsVoice = useCallback((preferredLang: string) => {
    const voices = voicesRef.current ?? [];
    if (!voices.length) return null;
    const exact = voices.find((v) => v.lang === preferredLang);
    if (exact) return exact;
    const prefix = preferredLang.split("-")[0]!;
    const starts = voices.find((v) => v.lang?.toLowerCase?.().startsWith(prefix.toLowerCase()));
    return starts ?? null;
  }, []);

  const pickNepaliCapableVoice = useCallback(() => {
    // Nepali voices are often missing on mobile browsers; fall back to Devanagari-friendly voices (e.g. hi-IN).
    return (
      pickTtsVoice("ne-NP") ??
      pickTtsVoice("ne") ??
      pickTtsVoice("hi-IN") ??
      pickTtsVoice("hi") ??
      null
    );
  }, [pickTtsVoice]);

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

  const stopSpeech = useCallback(() => {
    const u = utteranceRef.current;
    if (u) {
      u.onstart = null;
      u.onend = null;
      u.onerror = null;
    }
    utteranceRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }, []);

  const pause = useCallback(() => {
    runIdRef.current += 1; // cancel in-flight awaits
    setIsPlaying(false);
    isPlayingRef.current = false;
    setIsFinished(false);
    setAutoplayBlocked(false);
    pendingAutoplayRef.current = false;
    clearTimer();
    stopAudio();
    stopSpeech();
  }, [clearTimer, stopAudio, stopSpeech]);

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

    // 3) SpeechSynthesis unlock
    // NOTE: 무음 utterance를 speak()하면 일부 환경(데스크톱/모바일)에서 이후 media/WebAudio 볼륨이
    // 잠깐 ducking 되었다가 1~2초 후 올라오는 현상이 발생할 수 있어 speak()는 하지 않는다.
    if (!didUnlockSpeechRef.current && "speechSynthesis" in window) {
      try {
        void window.speechSynthesis.getVoices?.();
        didUnlockSpeechRef.current = true;
      } catch {
        // ignore
      }
    }
  }, []);

  const advanceIndex = useCallback(
    (fromIndex: number, reason: string) => {
      // 규칙 1: 인덱스 증가는 "완료 이벤트 핸들러"에서만 발생
      setCurrentTaskIndex((prev) => {
        if (prev !== fromIndex) return prev;
        const next = fromIndex + 1;
        console.log(`[DM] index++ ${fromIndex} -> ${next} (${reason})`);
        return next;
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
      stopSpeech();

      runIdRef.current += 1;
      setIsFinished(false);
      setIsPlaying(true);
      isPlayingRef.current = true;
      setAutoplayBlocked(false);
      console.log(`[DM] jumpToWord word=${clamped} taskIdx=${taskIdx}`);
      setCurrentTaskIndex(taskIdx);
    },
    [clearTimer, stopAudio, stopSpeech, vocabulary.length, wordStartTaskIndex],
  );

  const nextWord = useCallback(() => jumpToWord(currentWordIndex + 1), [currentWordIndex, jumpToWord]);
  const prevWord = useCallback(() => jumpToWord(currentWordIndex - 1), [currentWordIndex, jumpToWord]);

  const swipeHandlers = useSwipeNavigation({
    enabled: Boolean(options?.enableSwipe ?? true),
    onNext: nextWord,
    onPrev: prevWord,
  });

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
          newTasks.push({
            type: "speech",
            payload: meaningText,
            description: `뜻: ${meaningText}`,
            wordIndex: index,
          });
          newTasks.push({ type: "delay", payload: 2500, description: "대기", wordIndex: index });
        } else if (type === "dialogue") {
          const cleanKorean = word.korean.replace(/^\[.*?\]\s*/, "");
          const speakerPrefixMatch = word.korean.match(/^\[(.*?)\]\s*/);
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
            } else {
              newTasks.push({
                type: "speech",
                payload: word.nepali,
                description: `네팔어: ${word.nepali}`,
                wordIndex: index,
                isNepaliTTS: true,
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
        newTasks.push({
          type: "speech",
          payload: meaningText,
          description: `뜻: ${meaningText}`,
          wordIndex: index,
        });
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
          // 기본(혼합) 흐름은 기존대로 [한국어 -> 네팔어] 유지
          newTasks.push({
            type: "speech",
            payload: cleanKorean,
            description: `뜻: ${cleanKorean}`,
            wordIndex: index,
          });
          // speechSynthesis 이후 오디오 볼륨 램프(ducking 복구) 방지용 여유
          newTasks.push({ type: "delay", payload: 2200, description: "대기", wordIndex: index });

          if (typeof word.dIdx === "number" && typeof word.lIdx === "number") {
            newTasks.push({
              type: "audio",
              payload: getDialogueAudioPath(word.lessonId ?? lessonId, word.dIdx, word.lIdx),
              description: `네팔어: ${word.nepali}`,
              wordIndex: index,
            });
          } else {
            newTasks.push({
              type: "speech",
              payload: word.nepali,
              description: `네팔어: ${word.nepali}`,
              wordIndex: index,
              isNepaliTTS: true,
            });
          }
          newTasks.push({ type: "delay", payload: 2500, description: "대기", wordIndex: index });
        }
      } else {
        newTasks.push({
          type: "speech",
          payload: word.korean,
          description: `내용: ${word.korean}`,
          wordIndex: index,
        });
        newTasks.push({ type: "delay", payload: 2500, description: "대기", wordIndex: index });
      }
    });

    newTasks.push({
      type: "speech",
      payload: "학습이 모두 끝났습니다.",
      description: "세션 종료 안내",
    });

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
    stopSpeech();

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
  }, [clearTimer, lessonId, options?.studyMode, stopAudio, stopSpeech, vocabulary]);

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
      stopSpeech();
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

	    if (task.type === "speech") {
	      stopAudio();
	      console.log(`[DM] speech task payload="${String(task.payload ?? "")}" isNepaliTTS=${Boolean(task.isNepaliTTS)}`);
	      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        clearTimer();
        timerRef.current = setTimeout(() => {
          if (cancelled) return;
          if (runIdRef.current !== runId) return;
          console.log(`[DM] speech fallback done idx=${index}`);
          advanceIndex(index, "speech-fallback");
        }, 800);
        return cleanup;
	      }

	      const synth = window.speechSynthesis;
	      const speechState = {
	        attempt: 1 as 1 | 2,
	        didStart: false,
	        didFinish: false,
	        startWatchdog: null as ReturnType<typeof setTimeout> | null,
	        hardWatchdog: null as ReturnType<typeof setTimeout> | null,
	      };

	      const clearSpeechWatchdogs = () => {
	        if (speechState.startWatchdog) clearTimeout(speechState.startWatchdog);
	        if (speechState.hardWatchdog) clearTimeout(speechState.hardWatchdog);
	        speechState.startWatchdog = null;
	        speechState.hardWatchdog = null;
	      };

	      const startSpeechAttempt = (attempt: 1 | 2) => {
	        if (cancelled) return;
	        if (runIdRef.current !== runId) return;
	        if (speechState.didFinish) return;
	        if (speechState.attempt === 2 && attempt === 2) return; // prevent duplicate attempt-2 starts

	        speechState.attempt = attempt;
	        speechState.didStart = false;
	        clearSpeechWatchdogs();

	        console.log(`[DM] speech attempt start idx=${index} attempt=${attempt}`);

	        const utterance = new SpeechSynthesisUtterance(task.payload as string);
	        utteranceRef.current = utterance;

	        if (task.isNepaliTTS) {
	          const chosenVoice = pickNepaliCapableVoice();
	          if (chosenVoice) {
	            try {
	              utterance.voice = chosenVoice;
	              utterance.lang = chosenVoice.lang || "ne-NP";
	            } catch {
	              utterance.lang = "ne-NP";
	            }
	          } else {
	            utterance.lang = "ne-NP";
	          }
	        } else {
	          // Korean: let the browser choose the best available voice.
	          // Forcing a specific voice can be silent/buggy on some devices.
	          const allVoices = voicesRef.current ?? synth.getVoices?.() ?? [];
	          const koVoice = allVoices.find((v) => (v.lang || "").toLowerCase().startsWith("ko"));
	          if (koVoice) {
	            utterance.lang = "ko-KR";
	            // do not force utterance.voice unless we have a matching ko voice
	            try {
	              utterance.voice = koVoice;
	            } catch {
	              // ignore
	            }
	          } else if (allVoices.length > 0) {
	            // No Korean voice installed: force *some* voice so it is at least audible.
	            const fallbackVoice = allVoices[0]!;
	            try {
	              utterance.voice = fallbackVoice;
	            } catch {
	              // ignore
	            }
	            utterance.lang = fallbackVoice.lang || "en-US";
	          } else {
	            // As a last resort, don't set voice; allow browser defaults.
	            utterance.lang = "ko-KR";
	          }
	        }

	        utterance.rate = ttsSpeedRef.current;
	        utterance.volume = 1.0;
	        try {
	          utterance.pitch = 1.05;
	        } catch {
	          // ignore
	        }

	        if (!task.isNepaliTTS) {
	          try {
	            const allVoices = synth.getVoices?.() ?? [];
	            const koVoices = allVoices.filter((v) => (v.lang || "").toLowerCase().startsWith("ko"));
	            console.log(
	              `[DM] speech config idx=${index} attempt=${attempt} lang=${utterance.lang} voice=${utterance.voice?.name ?? "auto"} voices=${allVoices.length} koVoices=${koVoices.length}`,
	            );
	          } catch {
	            // ignore
	          }
	        }

	        const text = String(task.payload ?? "");
	        const hardWatchdogMs = Math.min(10000, 2000 + text.length * 80);

	        speechState.startWatchdog = setTimeout(() => {
	          if (cancelled) return;
	          if (runIdRef.current !== runId) return;
	          if (speechState.didStart) return;
	          if (synth.speaking) return;
	          console.log(`[DM] speech start TIMEOUT idx=${index} attempt=${attempt}`);
	          if (attempt === 1) {
	            try {
	              void synth.getVoices?.();
	            } catch {
	              // ignore
	            }
	            startSpeechAttempt(2);
	          } else {
	            speechState.didFinish = true;
	            advanceIndex(index, "speech-start-timeout");
	          }
	        }, attempt === 1 ? 1200 : 800);

	        speechState.hardWatchdog = setTimeout(() => {
	          if (cancelled) return;
	          if (runIdRef.current !== runId) return;
	          if (speechState.didFinish) return;
	          console.log(`[DM] speech hard TIMEOUT idx=${index} ms=${hardWatchdogMs} attempt=${attempt}`);
	          if (attempt === 1) {
	            try {
	              void synth.getVoices?.();
	            } catch {
	              // ignore
	            }
	            startSpeechAttempt(2);
	          } else {
	            speechState.didFinish = true;
	            advanceIndex(index, "speech-hard-timeout");
	          }
	        }, hardWatchdogMs);

	        utterance.onstart = () => {
	          if (cancelled) return;
	          if (runIdRef.current !== runId) return;
	          speechState.didStart = true;
	          try {
	            console.log(
	              `[DM] speech start idx=${index} attempt=${attempt} speaking=${synth.speaking} pending=${(synth as any).pending ?? "n/a"}`,
	            );
	          } catch {
	            console.log(`[DM] speech start idx=${index} attempt=${attempt}`);
	          }
	        };
	        utterance.onend = () => {
	          if (cancelled) return;
	          if (runIdRef.current !== runId) return;
	          if (speechState.didFinish) return;
	          speechState.didFinish = true;
	          clearSpeechWatchdogs();
	          try {
	            console.log(
	              `[DM] speech end idx=${index} attempt=${attempt} speaking=${synth.speaking} pending=${(synth as any).pending ?? "n/a"}`,
	            );
	          } catch {
	            console.log(`[DM] speech end idx=${index} attempt=${attempt}`);
	          }
	          advanceIndex(index, "speech-end");
	        };
	        utterance.onerror = (e) => {
	          if (cancelled) return;
	          if (runIdRef.current !== runId) return;
	          if (speechState.didFinish) return;
	          clearSpeechWatchdogs();
	          console.log(`[DM] speech error idx=${index} attempt=${attempt}`, e);
	          // "canceled" is common when we cancel during retry; treat as retryable once.
	          if (attempt === 1) {
	            startSpeechAttempt(2);
	          } else {
	            speechState.didFinish = true;
	            advanceIndex(index, "speech-error");
	          }
	        };

	        try {
	          try {
	            void synth.getVoices?.();
	          } catch {
	            // ignore
	          }
	          // Always cancel before speak to avoid queued/pending utterances causing silent/no-op behavior
	          // on some browsers/devices.
	          try {
	            synth.cancel();
	          } catch {
	            // ignore
	          }
	          synth.speak(utterance);
	        } catch (e) {
	          clearSpeechWatchdogs();
	          console.log(`[DM] speech speak threw idx=${index} attempt=${attempt}`, e);
	          if (attempt === 1) startSpeechAttempt(2);
	          else {
	            speechState.didFinish = true;
	            advanceIndex(index, "speech-throw");
	          }
	        }
	      };

	      startSpeechAttempt(1);
	      return () => {
	        clearSpeechWatchdogs();
	        cleanup();
	      };
	    }

    // audio
    stopSpeech();
    // iOS Safari에서 SpeechSynthesis 이후 media element 볼륨이 "작게 시작했다가 점점 커지는" 현상을 줄이기 위해
    // audio 재생 직전에 speechSynthesis를 확실히 종료한다.
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }

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

    const canUseWebAudioInForeground =
      Boolean(audioContextRef.current) &&
      (typeof document === "undefined" || document.visibilityState === "visible");
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
          // 규칙 3: onerror는 건너뛰되 루프는 진행
          advanceIndex(index, "audio-error");
        };

        audio
          .play()
          .then(() => {
            console.log(`[DM] audio play started idx=${index}`);
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
  }, [advanceIndex, clearTimer, currentTaskIndex, isPlaying, pause, stopAudio, stopSpeech, tasks]);

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
