import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getDialogueAudioPath, getVocabAudioPath } from "@/lib/getAudioPath";
import { CheckCircle2, Volume2, VolumeX, XCircle } from "lucide-react";
import globalVocab from "@/data/vocabulary.json";
import type { UseAudioPlayerResult } from "@/hooks/useAudioPlayer";

type DialogueLineWithMeta = {
  dIdx: number;
  lIdx: number;
  korean: string;
  nepali: string;
  romanized: string;
  parsedWords: string[];
};

type DialogueLine = {
  korean: string;
  nepali: string;
  romanized: string;
};

type Dialogue = {
  lines: DialogueLine[];
};

type WordToken = {
  id: string;
  word: string;
};

type VocabularyItem = {
  romanized: string;
  korean: string;
};

function normalizeRomanizedWord(word: string) {
  // Keep unicode letters (훮 카 큰 챰 etc.), remove punctuation/numbers/spaces.
  return word
    .normalize("NFKD")
    .replace(/[^\p{L}]/gu, "")
    .toLowerCase();
}

type HiddenMeaningRule = {
  tokenKey: string;
  whenRomanizedMatches: RegExp;
};

const HIDDEN_MEANING_RULES_BY_LESSON: Record<string, HiddenMeaningRule[]> = {
  // lesson 4: "sanchai chha"의 chha는 (있다/괜찮다) 용법이라, 단어장(6) 뜻을 보여주면 혼동됨
  "4": [
    { tokenKey: "chha", whenRomanizedMatches: /sanchai\s+chha\b/i },
    { tokenKey: "chha", whenRomanizedMatches: /\bderaa\b.*\bchha\b/i },
    { tokenKey: "chha", whenRomanizedMatches: /\bderaamaa\b.*\bchha\b/i },
    { tokenKey: "chhan", whenRomanizedMatches: /\bderaamaa\b.*\bchhan\b/i },
  ],
};

function shouldHideMeaningToken(lessonId: number | string, lineRomanized: string, rawToken: string) {
  const rules = HIDDEN_MEANING_RULES_BY_LESSON[String(lessonId)];
  if (!rules || rules.length === 0) return false;
  const tokenKey = normalizeRomanizedWord(rawToken);
  return rules.some((r) => r.tokenKey === tokenKey && r.whenRomanizedMatches.test(lineRomanized));
}

// 유틸리티: 배열 랜덤 셔플
export function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// 유틸리티: 전체 대화문에서 로마자 단어가 2개 이상인 문장만 추출 후 최대 10개 랜덤 선택
export function extractQuizLines(dialogues: Dialogue[]): DialogueLineWithMeta[] {
  const allLines: DialogueLineWithMeta[] = [];
  dialogues.forEach((d, dIdx) => {
    d.lines.forEach((l: DialogueLine, lIdx: number) => {
      // 구두점 제거 후 공백 기준으로 로마자 단어 추출
      const clean = l.romanized.replace(/[?!.,;:]/g, "").trim();
      const words = clean.split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        allLines.push({ ...l, dIdx, lIdx, parsedWords: words });
      }
    });
  });
  return shuffleArray(allLines).slice(0, 10);
}

export function DialogueGeneralQuiz({
  dialogues,
  lessonId,
  vocabulary,
  audioPlayer,
  onClose,
}: {
  dialogues: Dialogue[];
  lessonId: number | string;
  vocabulary?: VocabularyItem[];
  audioPlayer: UseAudioPlayerResult;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "playing" | "finished">("idle");
  const [quizLines, setQuizLines] = useState<DialogueLineWithMeta[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [score, setScore] = useState(0);

  const [pool, setPool] = useState<WordToken[]>([]);
  const [answer, setAnswer] = useState<WordToken[]>([]);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [didRevealAnswer, setDidRevealAnswer] = useState(false);
  const [didScoreOnCurrent, setDidScoreOnCurrent] = useState(false);
  const [hasErrorOnCurrent, setHasErrorOnCurrent] = useState(false); // 현재 문제에서 틀린 적이 있는지 추적
  const [clickedTokenId, setClickedTokenId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const muteStorageKey = "nepali-bloom:dialogue-quiz-muted:v1";

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(muteStorageKey);
      if (saved === "1") setIsMuted(true);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(muteStorageKey, isMuted ? "1" : "0");
    } catch {
      // ignore
    }
  }, [isMuted]);

  useEffect(() => {
    startQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startQuiz = () => {
    const lines = extractQuizLines(dialogues);
    if (lines.length === 0) {
      alert("퀴즈를 진행할 수 있는 대화문 데이터가 부족합니다.");
      onClose();
      return;
    }
    setQuizLines(lines);
    setCurrentStep(0);
    setScore(0);
    setStatus("playing");
    initStep(lines[0]);
  };

  const initStep = (line: DialogueLineWithMeta) => {
    // 같은 단어가 있을 수 있으므로 고유 ID 부여
    const tokens = line.parsedWords.map((word, i) => ({ id: `${i}-${word}`, word }));
    setPool(shuffleArray(tokens));
    setAnswer([]);
    setIsError(false);
    setIsSuccess(false);
    setDidRevealAnswer(false);
    setHasErrorOnCurrent(false);
    setDidScoreOnCurrent(false);
  };

  const playTokenAudio = (token: WordToken) => {
    // 시각적 피드백 제공 (애니메이션)
    setClickedTokenId(token.id);
    setTimeout(() => setClickedTokenId(null), 150);

    if (isMuted) return;

    // 4. 성능 및 예외 처리: 에러를 뱉지 않고 조용히 넘어가도록 try-catch 적용
    try {
      // 특수문자 제거 후 파일명 규칙에 맞게 소문자로 변환 (예: /audio/lesson_1/kholnu.mp3)
      const cleanWord = normalizeRomanizedWord(token.word);
      const itemId = `token-${token.id}`;
      const src = getVocabAudioPath(lessonId, cleanWord);

      // 1 & 2. 로마자 단어 클릭 시 오디오 즉시 재생 (이전 소리는 자동 중단)
      void audioPlayer.play(itemId, src, { silentError: true });

      /* 
        [선택 사항] 만약 단어별로 쪼개진 파일(.mp3)이 준비되어 있지 않아 에러가 나는 경우,
        클릭 시 현재 문제로 출제된 전체 문장(Dialogue Line)의 오디오가 나오도록 대체하려면
        위 audioPlayer.play(...) 코드를 지우고 아래 코드를 활성화하세요:
        
        const line = quizLines[currentStep];
        const sentenceId = `dial-quiz-${lessonId}-${line.dIdx}-${line.lIdx}`;
        const sentenceSrc = getDialogueAudioPath(lessonId, line.dIdx, line.lIdx);
        void audioPlayer.play(sentenceId, sentenceSrc, { silentError: true });
      */
    } catch (e) {
      // 파일을 찾을 수 없거나 재생 권한이 막힌 경우 조용히 무시합니다.
    }
  };

  const handleAdd = (token: WordToken) => {
    if (isSuccess) return;
    setIsError(false);
    playTokenAudio(token);
    setPool((prev) => prev.filter((t) => t.id !== token.id));
    setAnswer((prev) => {
      const next = [...prev, token];
      checkAnswer(next);
      return next;
    });
  };

  const handleRemove = (token: WordToken) => {
    if (isSuccess) return;
    setIsError(false);
    playTokenAudio(token);
    setAnswer((prev) => prev.filter((t) => t.id !== token.id));
    setPool((prev) => [...prev, token]);
  };

  const handleReset = () => {
    setIsError(false);
    setIsSuccess(false);
    setDidRevealAnswer(false);
    const line = quizLines[currentStep];
    const tokens = line.parsedWords.map((word, i) => ({ id: `${i}-${word}`, word }));
    setPool(shuffleArray(tokens));
    setAnswer([]);
  };

  const handleRevealAnswer = () => {
    const line = quizLines[currentStep];
    const correctTokens = line.parsedWords.map((word, i) => ({ id: `${i}-${word}`, word }));
    setPool([]);
    setAnswer(correctTokens);
    setIsError(false);
    setIsSuccess(true);
    setDidRevealAnswer(true);
    setHasErrorOnCurrent(true);
  };

  const checkAnswer = (currentAnswer: WordToken[]) => {
    const line = quizLines[currentStep];
    if (currentAnswer.length === line.parsedWords.length) {
      const isCorrect = currentAnswer.map((t) => t.word).join(" ") === line.parsedWords.join(" ");
      if (isCorrect) {
        setIsSuccess(true);
        if (!hasErrorOnCurrent && !didScoreOnCurrent) {
          setScore((s) => s + 1);
          setDidScoreOnCurrent(true);
        }
        // 정답 시 오디오 자동 재생은 하지 않음 (파일 누락/소음 방지)
      } else {
        setIsError(true);
        setHasErrorOnCurrent(true);
      }
    }
  };

  const handleNext = () => {
    if (currentStep < quizLines.length - 1) {
      setCurrentStep((c) => c + 1);
      initStep(quizLines[currentStep + 1]);
    } else {
      setStatus("finished");
    }
  };

  if (status === "idle") {
    return null;
  }

  if (status === "finished") {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center shadow-sm sm:p-10">
        <div className="mb-3 text-4xl sm:text-5xl">🎉</div>
        <h2 className="mb-2 text-xl font-bold text-foreground sm:text-2xl">대화문 퀴즈 완료!</h2>
        <p className="mb-6 text-base text-muted-foreground sm:text-lg">
          <span className="font-semibold text-primary">{score}</span> / {quizLines.length} 정답
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={startQuiz} size="lg" variant="default">
            다시 하기
          </Button>
          <Button onClick={onClose} size="lg" variant="secondary">
            대화문으로 돌아가기{" "}
          </Button>
        </div>
      </div>
    );
  }

  const line = quizLines[currentStep];
  const vocabMap = new Map<string, string>();
  for (const v of globalVocab as Array<Record<string, unknown>>) {
    const romanized = typeof v.romanized === "string" ? v.romanized : null;
    const korean = typeof v.korean === "string" ? v.korean : null;
    if (!romanized || !korean) continue;
    vocabMap.set(normalizeRomanizedWord(romanized), korean);
  }
  for (const v of vocabulary ?? []) {
    vocabMap.set(normalizeRomanizedWord(v.romanized), v.korean);
  }

  const uniqueTokens = Array.from(new Set(line.parsedWords.map((w) => w.trim()).filter(Boolean))).filter(
    (raw) => !shouldHideMeaningToken(lessonId, line.romanized, raw),
  );

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      {/* 스텝 */}
      <div className="mb-5 flex items-center justify-between">
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground sm:text-sm">
          문제 {currentStep + 1} / {quizLines.length}
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsMuted((v) => {
                const next = !v;
                if (next) audioPlayer.stop?.();
                return next;
              });
            }}
            className="h-8 px-2 text-xs"
            aria-pressed={isMuted}
            aria-label={isMuted ? "음소거 해제" : "음소거"}
            title={isMuted ? "음소거 해제" : "음소거"}
          >
            {isMuted ? <VolumeX className="mr-1 h-4 w-4" /> : <Volume2 className="mr-1 h-4 w-4" />}
            {isMuted ? "음소거" : "소리"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 px-2 text-xs">
            그만두기
          </Button>
        </div>
      </div>

      {/* 프롬프트 (한국어 해석) */}
      <div className="mb-6 text-center">
        <h3 className="text-lg font-bold text-foreground sm:text-xl">{line.korean}</h3>
        <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
          로마자 조각을 순서대로 선택해 문장을 완성하세요.
        </p>
      </div>

      {/* 정답 조립 영역 */}
      <div
        className={cn(
          "mb-5 flex min-h-[3.5rem] flex-wrap items-center gap-2 rounded-xl p-3 transition-colors",
          isError
            ? "border-2 border-destructive/50 bg-destructive/5"
            : "border border-border bg-muted/30",
          isSuccess ? "border-2 border-success/50 bg-success/5" : "",
        )}
      >
        {answer.length === 0 && !isSuccess && (
          <span className="ml-1 text-xs sm:text-sm text-muted-foreground">
            단어를 눌러 문장을 완성해보세요.
          </span>
        )}
        {answer.map((t) => (
          <button
            key={t.id}
            onClick={() => handleRemove(t)}
            disabled={isSuccess}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium shadow-sm transition-all duration-200 active:scale-95",
              isError
                ? "animate-shake bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground hover:opacity-90",
              isSuccess ? "bg-success text-success-foreground" : "",
              clickedTokenId === t.id && "scale-110 brightness-110 ring-2 ring-primary/40",
            )}
          >
            {t.word}
          </button>
        ))}
      </div>

      {isSuccess && (
        <div className="mb-6 rounded-xl border bg-muted/20 p-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">단어 뜻</p>
          <div className="flex flex-wrap gap-2">
            {uniqueTokens.map((raw) => {
              const key = normalizeRomanizedWord(raw);
              const meaning = vocabMap.get(key) ?? "뜻 없음";
              return (
                <span key={raw} className="rounded-lg border bg-card px-3 py-1.5 text-sm">
                  <span className="font-semibold text-foreground">{raw}</span>
                  <span className="mx-1 text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{meaning}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 단어 풀 영역 */}
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {pool.map((t) => (
          <button
            key={t.id}
            onClick={() => handleAdd(t)}
            className={cn(
              "rounded-lg border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-all duration-200 hover:bg-accent active:scale-95",
              clickedTokenId === t.id &&
                "scale-110 border-primary bg-primary/10 text-primary ring-2 ring-primary/30",
            )}
          >
            {t.word}
          </button>
        ))}
      </div>

      {/* 컨트롤 패널 */}
      <div className="flex items-center justify-between border-t pt-4 min-h-[3.5rem]">
        <div className="flex items-center gap-2">
          {isError && !isSuccess && (
            <>
              <XCircle className="h-5 w-5 text-destructive" />
              <span className="text-sm font-semibold text-destructive">순서가 맞지 않습니다</span>
            </>
          )}
          {isSuccess && (
            <>
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="text-sm font-semibold text-success">{didRevealAnswer ? "정답 공개" : "정답입니다"}</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {!isSuccess && (
            <Button variant="secondary" size="sm" onClick={handleReset}>
              초기화
            </Button>
          )}
          {isError && !isSuccess && (
            <Button variant="outline" size="sm" onClick={handleRevealAnswer}>
              정답 보기
            </Button>
          )}
          {isSuccess && (
            <>
              <Button variant="secondary" size="sm" onClick={handleReset}>
                다시 풀기
              </Button>
              <Button onClick={handleNext}>
                {currentStep === quizLines.length - 1 ? "결과 보기" : "다음 문제"}
              </Button>
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
}
