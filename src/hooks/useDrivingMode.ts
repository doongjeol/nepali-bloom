import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDialogueAudioPath, getPronunciationAudioPath, getVocabAudioPath } from "@/lib/getAudioPath";

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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const isPlayingRef = useRef(false);
  const runIdRef = useRef(0);
  const currentTaskIndexRef = useRef(-1);
  useEffect(() => {
    currentTaskIndexRef.current = currentTaskIndex;
  }, [currentTaskIndex]);

  const ttsSpeedRef = useRef(options?.ttsSpeed ?? 0.9);
  useEffect(() => {
    ttsSpeedRef.current = options?.ttsSpeed ?? 0.9;
  }, [options?.ttsSpeed]);

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
    audioRef.current = null;
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
    clearTimer();
    stopAudio();
    stopSpeech();
  }, [clearTimer, stopAudio, stopSpeech]);

  const stop = useCallback(() => {
    pause();
    setCurrentTaskIndex(-1);
    setCurrentWordIndex(0);
    setIsFinished(false);
  }, [pause]);

  useEffect(() => () => pause(), [pause]);

  const unlockAudio = useCallback(async () => {
    if (typeof window === "undefined") return;
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AudioCtx) return;

    try {
      const ctx = audioContextRef.current ?? new AudioCtx();
      audioContextRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();

      // play 1-frame silent buffer to "unlock" audio output under autoplay policy (must be called in user gesture)
      const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      source.stop(0);
    } catch {
      // ignore
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
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
    if (tasks.length === 0) return;
    runIdRef.current += 1;
    setIsFinished(false);
    setIsPlaying(true);
    isPlayingRef.current = true;
    const startIndex = currentTaskIndexRef.current > -1 ? currentTaskIndexRef.current : 0;
    console.log(`[DM] play() startIndex=${startIndex} totalTasks=${tasks.length}`);
    setCurrentTaskIndex(startIndex);
  }, [tasks.length]);

  const jumpToWord = useCallback(
    (nextWordIndex: number) => {
      const clamped = Math.max(0, Math.min(vocabulary.length - 1, nextWordIndex));
      setCurrentWordIndex(clamped);

      const taskIdx = wordStartTaskIndex.get(clamped);
      if (typeof taskIdx !== "number") return;

      setCurrentTaskIndex(taskIdx);
      clearTimer();
      stopAudio();
      stopSpeech();

      runIdRef.current += 1;
      setIsFinished(false);
      setIsPlaying(true);
      isPlayingRef.current = true;
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

  const isIOS = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const iOSDevice = /iPad|iPhone|iPod/.test(ua);
    const iPadOS13Plus = navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1;
    return iOSDevice || iPadOS13Plus;
  }, []);

  // Build playback tasks whenever vocabulary changes
  useEffect(() => {
    const newTasks: PlaybackTask[] = [];

    vocabulary.forEach((word, index) => {
      const type = word.type || "vocab";
      const mode = options?.studyMode;
      const audioOnly = Boolean(options?.audioOnly);
      let label = "단어";
      if (type === "grammar") label = "문법";
      else if (type === "dialogue") label = "대화문";
      else if (type === "quiz") label = "퀴즈";

      if (!audioOnly) newTasks.push({
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

        // dialogue 모드에서는 [네팔어 문장 -> 한국어 해석] 순으로 재생
        if (mode === "dialogue") {
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
          newTasks.push({ type: "delay", payload: 1000, description: "대기", wordIndex: index });
          newTasks.push({
            type: "speech",
            payload: cleanKorean,
            description: speaker ? `[${speaker}] 해석` : "해석",
            wordIndex: index,
          });
          newTasks.push({ type: "delay", payload: 2000, description: "대기", wordIndex: index });
        } else {
          // 기본(혼합) 흐름은 기존대로 [한국어 -> 네팔어] 유지
          newTasks.push({
            type: "speech",
            payload: cleanKorean,
            description: `뜻: ${cleanKorean}`,
            wordIndex: index,
          });
          newTasks.push({ type: "delay", payload: 1500, description: "대기", wordIndex: index });

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
      payload: "학습이 모두 끝났습니다. 처음부터 다시 시작하려면 이전 버튼을 눌러주세요.",
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
    const cleanup = () => {
      cancelled = true;
      clearTimer();
      stopSpeech();
      stopAudio();
      // 규칙 1: 오디오 새로 만들면 기존 pause+null 처리(우리는 재사용하지만 cleanup에서 확실히 멈춤)
      // audioRef.current는 유지하되, 다음 effect에서 src 변경 전 상태 누수 방지
    };

    if (task.type === "delay") {
      clearTimer();
      const rawMs = task.payload as number;
      // iOS Safari는 user-gesture 컨텍스트가 setTimeout 지연에 매우 민감해서
      // 긴 대기 후 다음 오디오 재생이 차단될 수 있습니다.
      // 안전하게 900ms 이하로 클램프합니다.
      const ms = isIOS ? Math.min(rawMs, 900) : rawMs;
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

      const utterance = new SpeechSynthesisUtterance(task.payload as string);
      utteranceRef.current = utterance;
      utterance.lang = "ko-KR";
      utterance.rate = ttsSpeedRef.current;
      utterance.volume = task.isNepaliTTS ? 1.0 : 0.5;

      utterance.onstart = () => console.log(`[DM] speech start idx=${index}`);
      utterance.onend = () => {
        if (cancelled) return;
        if (runIdRef.current !== runId) return;
        console.log(`[DM] speech end idx=${index}`);
        advanceIndex(index, "speech-end");
      };
      utterance.onerror = (e) => {
        if (cancelled) return;
        if (runIdRef.current !== runId) return;
        console.log(`[DM] speech error idx=${index}`, e);
        advanceIndex(index, "speech-error");
      };

      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.log(`[DM] speech speak threw idx=${index}`, e);
        advanceIndex(index, "speech-throw");
      }
      return cleanup;
    }

    // audio
    stopSpeech();
    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    audio.onended = null;
    audio.onerror = null;
    audio.oncanplaythrough = null;

    const src = task.payload as string;
    console.log(`[DM] audio load try idx=${index} src=${src}`);

    let didStartPlay = false;
    const handleCanPlay = () => {
      if (cancelled) return;
      if (runIdRef.current !== runId) return;
      if (didStartPlay) return;
      didStartPlay = true;
      clearTimer();
      console.log(`[DM] audio canplaythrough idx=${index} src=${src}`);

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
        })
        .catch((e) => {
          console.log(`[DM] audio play rejected idx=${index}`, e);
          // autoplay 정책 등으로 재생이 거부될 수 있음.
          // 이 경우 "다음으로 스킵"하면 이후 음성이 전부 건너뛰어질 수 있으므로,
          // 세션을 일시정지 상태로 두고 사용자의 재생/다음 입력을 기다립니다.
          setIsPlaying(false);
          isPlayingRef.current = false;
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

    return cleanup;
  }, [advanceIndex, clearTimer, currentTaskIndex, isPlaying, pause, stopAudio, stopSpeech, tasks]);

  return {
    isPlaying,
    isFinished,
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
