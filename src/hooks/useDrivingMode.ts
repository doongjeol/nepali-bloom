import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getVocabAudioPath, getDialogueAudioPath } from "@/lib/getAudioPath";

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
  description?: string; // UI 표시용 설명
  wordIndex?: number; // 해당 task가 속한 단어 인덱스
  isNepaliTTS?: boolean; // 네팔어를 TTS로 읽어야 할 경우
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
      // ignore (permission, unsupported, etc.)
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

      // Swipe left -> next, swipe right -> prev
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

export function useDrivingMode(
  lessonId: string | number,
  vocabulary: VocabularyItem[],
  options?: { enableWakeLock?: boolean; enableSwipe?: boolean; ttsSpeed?: number },
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(-1);
  const [tasks, setTasks] = useState<PlaybackTask[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isPlayingRef = useRef(false); // 이벤트 콜백에서 최신 재생 상태 참조용

  const ttsSpeedRef = useRef(options?.ttsSpeed ?? 0.9);
  useEffect(() => {
    ttsSpeedRef.current = options?.ttsSpeed ?? 0.9;
  }, [options?.ttsSpeed]);

  // 운전 중 화면 꺼짐 방지 (best-effort)
  useWakeLock(Boolean(options?.enableWakeLock ?? true) && isPlaying);

  // 단어 인덱스 -> 해당 단어의 첫 task 인덱스
  const wordStartTaskIndex = useMemo(() => {
    const map = new Map<number, number>();
    tasks.forEach((t, idx) => {
      if (typeof t.wordIndex === "number" && !map.has(t.wordIndex)) map.set(t.wordIndex, idx);
    });
    return map;
  }, [tasks]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    isPlayingRef.current = false;

    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const processNextTask = useCallback(
    (index: number) => {
      if (!isPlayingRef.current) return;

      if (index >= tasks.length) {
        setIsPlaying(false);
        isPlayingRef.current = false;
        setCurrentTaskIndex(-1);
        return;
      }

      setCurrentTaskIndex(index);
      const task = tasks[index];
      if (typeof task.wordIndex === "number") setCurrentWordIndex(task.wordIndex);

      if (task.type === "delay") {
        timeoutRef.current = setTimeout(() => {
          processNextTask(index + 1);
        }, task.payload as number);
        return;
      }

      if (task.type === "audio") {
        const audio = audioRef.current ?? new Audio();
        audioRef.current = audio;
        audio.src = task.payload as string;
        audio.volume = 1.0; // 네팔어 원어민 오디오는 항상 최대 음량 유지
        
        let isDone = false;
        const finish = () => {
          if (isDone) return;
          isDone = true;
          processNextTask(index + 1);
        };

        audio.onended = finish;
        audio.onerror = () => {
          console.warn("오디오 파일을 찾을 수 없습니다:", task.payload);
          finish();
        };
        audio.play().catch((e) => {
          console.error("자동 재생이 차단되었습니다:", e);
          finish(); // pause() 대신 다음 태스크로 자연스럽게 넘어감
        });
        return;
      }

      // speech
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(task.payload as string);
        utteranceRef.current = utterance;
        utterance.lang = "ko-KR";
        utterance.rate = ttsSpeedRef.current;
        
        // 음량 조절: 네팔어 오디오(mp3)가 상대적으로 작게 들리는 것을 막기 위해 한국어 TTS 볼륨을 0.5로 낮춥니다.
        // 네팔어를 TTS로 직접 읽어야 하는 예외적인 경우에는 볼륨을 1.0으로 유지합니다.
        utterance.volume = task.isNepaliTTS ? 1.0 : 0.5;
        
        let isDone = false;
        const finish = () => {
          if (isDone) return;
          isDone = true;
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          processNextTask(index + 1);
        };

        utterance.onend = finish;
        utterance.onerror = finish;
        window.speechSynthesis.speak(utterance);
        
        // 브라우저의 TTS onend 버그로 인해 멈추는 현상 대비 fallback 타이머
        const estimatedDuration = Math.max(2000, (task.payload as string).length * 200 + 1500);
        timeoutRef.current = setTimeout(() => {
          window.speechSynthesis.cancel();
          finish();
        }, estimatedDuration);
      } else {
        timeoutRef.current = setTimeout(() => processNextTask(index + 1), 1000);
      }
    },
    [pause, tasks],
  );

  const jumpToWord = useCallback(
    (nextWordIndex: number) => {
      const clamped = Math.max(0, Math.min(vocabulary.length - 1, nextWordIndex));
      setCurrentWordIndex(clamped);

      const taskIdx = wordStartTaskIndex.get(clamped);
      if (typeof taskIdx !== "number") return;

      setCurrentTaskIndex(taskIdx);
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (utteranceRef.current) {
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      
      // 이전/다음 이동 시 무조건 자동 재생 시작
      setIsPlaying(true);
      isPlayingRef.current = true;
      processNextTask(taskIdx);
    },
    [processNextTask, vocabulary.length, wordStartTaskIndex],
  );

  const nextWord = useCallback(
    () => jumpToWord(currentWordIndex + 1),
    [currentWordIndex, jumpToWord],
  );
  const prevWord = useCallback(
    () => jumpToWord(currentWordIndex - 1),
    [currentWordIndex, jumpToWord],
  );

  const swipeHandlers = useSwipeNavigation({
    enabled: Boolean(options?.enableSwipe ?? true),
    onNext: nextWord,
    onPrev: prevWord,
  });

  // 1) 학습 큐(Playback Queue) 생성
  useEffect(() => {
    const newTasks: PlaybackTask[] = [];

    vocabulary.forEach((word, index) => {
      const type = word.type || "vocab";
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

        if (word.example) {
          const actualLessonId = word.lessonId ?? lessonId;
          const exRomanized = typeof word.example === 'string' ? '' : word.example.romanized || word.romanized;
          newTasks.push({
            type: "audio",
            payload: `/audio/lesson_${actualLessonId}/${exRomanized}_example.mp3`,
            description: `예문: ${typeof word.example === 'string' ? word.example : word.example.nepali}`,
            wordIndex: index,
          });
          newTasks.push({ type: "delay", payload: 2000, description: "예문 후 대기", wordIndex: index });
        }
      } else if (type === "dialogue") {
        const cleanKorean = word.korean.replace(/^\[.*?\]\s*/, ""); // '[A] ' 와 같은 화자 표시 제거
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
  }, [lessonId, vocabulary]);

  const play = useCallback(() => {
    if (tasks.length === 0) return;
    setIsPlaying(true);
    isPlayingRef.current = true;

    const startIndex = currentTaskIndex > -1 ? currentTaskIndex : 0;
    processNextTask(startIndex);
  }, [currentTaskIndex, processNextTask, tasks.length]);

  const stop = useCallback(() => {
    pause();
    setCurrentTaskIndex(-1);
    setCurrentWordIndex(0);
  }, [pause]);

  useEffect(() => () => pause(), [pause]);

  return {
    isPlaying,
    currentTask: currentTaskIndex > -1 ? tasks[currentTaskIndex] : null,
    progress: tasks.length > 0 ? Math.max(0, currentTaskIndex) / tasks.length : 0,
    currentWordIndex,
    currentWord: vocabulary[currentWordIndex] ?? null,
    play,
    pause,
    stop,
    nextWord,
    prevWord,
    swipeHandlers,
  };
}

/*
Background audio notes (mobile):
- 화면이 꺼져도 오디오를 계속 재생하려면 결국 "미디어 재생"으로 인식되어야 합니다.
  `new Audio()`도 가능하지만, iOS/Android 정책상 최초 사용자 제스처(탭)로 재생을 시작해야 하고,
  PWA(홈 화면 설치) + Media Session API 설정이 가장 안정적입니다.
- Service Worker는 오디오를 '대신' 재생할 수 없습니다. (SW는 UI 없는 백그라운드 스레드)
  SW는 캐싱/오프라인 지원에 도움을 주지만, 백그라운드 재생의 핵심은 <audio> 재생 + OS 정책입니다.
*/
