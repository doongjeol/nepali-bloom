import { useState, useEffect, useRef, useCallback } from "react";

interface UseAudioResult {
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  currentTime: number;
  duration: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
}

export function useAudio(src: string | null): UseAudioResult {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // 오디오 소스가 없으면 초기화
    if (!src) {
      setError(null);
      setIsLoading(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    // Next.js SSR 에러를 방지하기 위해 useEffect 내부(클라이언트)에서만 Audio 객체 생성
    const audio = new Audio(src);
    audioRef.current = audio;
    setIsLoading(true);
    setError(null);

    const handleCanPlay = () => {
      setIsLoading(false);
      setDuration(audio.duration);
    };
    const handlePlaying = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleError = (e: Event) => {
      setIsLoading(false);
      setIsPlaying(false);
      const errorMessage = `오디오 파일을 로드하는 중 오류가 발생했습니다: ${src}`;
      console.error(errorMessage, e);
      setError("오디오를 불러올 수 없습니다. 경로를 확인해 주세요.");
    };

    // 이벤트 리스너 등록
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("error", handleError);

    audio.load();

    // 클린업 함수: 컴포넌트가 언마운트되거나 src가 변경될 때 실행
    return () => {
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("error", handleError);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [src]);

  const play = useCallback(() => {
    if (audioRef.current && !error) {
      audioRef.current.play().catch((err) => {
        console.error("오디오 재생 실패:", err);
        setError("오디오 재생 권한이 없거나 지원하지 않는 형식입니다.");
      });
    }
  }, [error]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  return { isPlaying, isLoading, error, currentTime, duration, play, pause, toggle, seek };
}