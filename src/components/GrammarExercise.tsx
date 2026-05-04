import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { GrammarPracticeCard } from "@/components/GrammarPractice";

type Difficulty = "beginner" | "intermediate";

type ExerciseKind = "fill-blank" | "sentence-completion" | "ox";

type Exercise = {
  id: string;
  kind: ExerciseKind;
  title: string;
  koreanHint: string;
  prompt: string;
  choices: string[];
  answer: string;
  explanation: string;
};

const possessiveMap: Record<string, string> = {
  ma: "mero",
  u: "usko",
  haami: "haamro",
  tapaaï: "tapaaïko",
  wahãã: "wahããko",
};

const possessiveKoreanMap: Record<string, string> = {
  ma: "나의",
  u: "그의",
  haami: "우리의",
  tapaaï: "당신의",
  wahãã: "그분의",
};

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function shuffle<T>(arr: T[]) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function inferKind(card: GrammarPracticeCard) {
  const blob = normalizeText([card.title, ...card.details].join(" "));
  if (blob.includes("'-ko'") || blob.includes("-ko") || blob.includes("소유")) return "possessive-ko";
  if (blob.includes("'-le'") || blob.includes("-le") || blob.includes("타동사")) return "ergative-le";
  if (blob.includes(" ho ") && blob.includes(" chha ") && blob.includes(" hunchha ")) return "copula-contrast";
  return "generic";
}

function buildExercise(card: GrammarPracticeCard, difficulty: Difficulty): Exercise {
  const kind = inferKind(card);
  
  let validExamples = (card.examples ?? []).filter(Boolean);
  if (kind === "generic") {
    validExamples = validExamples.filter((ex) => {
      const nepaliMatch = ex.match(/^[^(]+/);
      const nepaliText = nepaliMatch ? nepaliMatch[0].trim() : ex;
      const words = nepaliText.split(/\s+/).filter((w) => w.replace(/[^a-zA-Z]/g, "").length >= 2);
      return words.length > 0;
    });
  }

  const pickedExample = validExamples.length > 0 ? pick(validExamples) : "";

  const kinds: ExerciseKind[] = ["fill-blank", "sentence-completion", "ox"];
  const exerciseKind = pick(kinds);

  if (kind === "possessive-ko") {
    const pronouns = Object.keys(possessiveMap);
    const pronoun = pick(pronouns);
    const correct = possessiveMap[pronoun]!;
    const distractors = shuffle(Object.values(possessiveMap).filter((v) => v !== correct)).slice(0, 3);
    const choices = shuffle([correct, ...distractors]).slice(0, 4);

    if (exerciseKind === "ox") {
      const wrong =
        pronoun === "ma"
          ? "ma ko"
          : pronoun === "haami"
            ? "haami ko"
            : `${pronoun} ko`;
      const good = `${correct} kitaab ho.`;
      const bad = `${wrong} kitaab ho.`;
      const answer = Math.random() < 0.5 ? good : bad;
      const isCorrect = answer === good;
      return {
        id: `pos-ox-${pronoun}`,
        kind: "ox",
        title: "OX 퀴즈",
        koreanHint: "소유격(-ko)은 대명사에 따라 형태가 바뀝니다.",
        prompt: difficulty === "intermediate" && pickedExample ? pickedExample : "올바른 문장을 고르세요.",
        choices: shuffle([good, bad]),
        answer: good,
        explanation: isCorrect
          ? "정답: 소유격은 대명사마다 고정된 형태(mero/usko/haamro/...)를 사용해요."
          : "정답: 'ma ko' 같은 형태 대신 'mero'처럼 소유격 형태를 사용해요.",
      };
    }

    if (exerciseKind === "sentence-completion") {
      return {
        id: `pos-comp-${pronoun}`,
        kind: "sentence-completion",
        title: "문장 완성",
        koreanHint: `‘${possessiveKoreanMap[pronoun]}’를 뜻하는 알맞은 형태를 고르세요.`,
        prompt: `빈칸에 들어갈 알맞은 형태를 고르세요:\n____ kitaab ho.`,
        choices,
        answer: correct,
        explanation: `${pronoun}의 소유격은 ${correct} 입니다.`,
      };
    }

    // fill-blank
    return {
      id: `pos-blank-${pronoun}`,
      kind: "fill-blank",
      title: "빈칸 채우기",
      koreanHint: "‘-ko’는 소유(~의)를 나타냅니다.",
      prompt: `다음 한국어 뜻에 맞게 빈칸을 채우세요:\n${possessiveKoreanMap[pronoun]} 집은 어디입니까?\n____ ghar kahãã ho?`,
      choices,
      answer: correct,
      explanation: `${pronoun}의 소유격은 ${correct} 입니다.`,
    };
  }

  if (kind === "ergative-le") {
    const choices = shuffle(["-le", "-ko", "ho", "chha"]).slice(0, 4);
    const correct = "-le";
    const prompt =
      difficulty === "intermediate" && pickedExample
        ? `예문을 참고해서 빈칸을 채우세요:\n${pickedExample}\n\n____`
        : "과거 타동사 문장에서 주어에 붙는 마커를 고르세요:\nma____ kitaab kholeko.";
    return {
      id: "erg-blank",
      kind: "fill-blank",
      title: "빈칸 채우기",
      koreanHint: "과거 타동사 문장에서 주어에 -le가 붙을 수 있어요.",
      prompt,
      choices,
      answer: correct,
      explanation: "과거 타동사 문장에서 주어를 표시할 때 -le를 사용합니다.",
    };
  }

  if (kind === "copula-contrast") {
    const choices = shuffle(["ho", "chha", "hunchha"]).slice(0, 3);
    const answer = "ho";
    return {
      id: "copula-choice",
      kind: "fill-blank",
      title: "빈칸 채우기",
      koreanHint: "정체/식별은 ho, 상태/존재는 chha, 일반적 진리는 hunchha.",
      prompt:
        difficulty === "intermediate" && pickedExample
          ? `예문을 참고해 알맞은 것을 고르세요:\n${pickedExample}`
          : "다음 문장을 완성하세요:\nYo mero ghar ____.",
      choices,
      answer,
      explanation: "정체/식별(‘A는 B다’)을 말할 때는 ho를 사용합니다.",
    };
  }

  if (kind === "generic" && pickedExample) {
    const nepaliMatch = pickedExample.match(/^[^(]+/);
    const nepaliText = nepaliMatch ? nepaliMatch[0].trim() : pickedExample;
    const words = nepaliText.split(/\s+/).filter((w) => w.replace(/[^a-zA-Z]/g, "").length >= 2);
    if (words.length > 0) {
      const answer = pick(words);
      const blanked = pickedExample.replace(answer, "____");
      const distractors = shuffle(["ho", "chha", "mero", "ramro", "dherai", "ali", "tapaaïko", "tyo", "yo", "kasto", "kasko"])
        .filter((w) => w !== answer)
        .slice(0, 3);
      const choices = shuffle([answer, ...distractors]);
      return {
        id: `generic-blank-${Date.now()}`,
        kind: "fill-blank",
        title: "빈칸 채우기",
        koreanHint: "예문의 문맥에 맞는 단어를 고르세요.",
        prompt: `다음 문장의 빈칸을 채우세요:\n${blanked}`,
        choices,
        answer,
        explanation: `정답은 '${answer}' 입니다.`,
      };
    }
  }

  // generic fallback: use whatever example exists
  return {
    id: "generic",
    kind: "fill-blank",
    title: "연습",
    koreanHint: "노트를 먼저 읽고 예문에서 적용을 확인해보세요.",
    prompt: pickedExample ? `예문을 읽고 확인하세요:\n${pickedExample}` : "아직 이 문법 항목의 자동 문제 생성 데이터가 부족해요.",
    choices: ["확인"],
    answer: "확인",
    explanation: "이 항목은 현재 자동 퀴즈가 준비되지 않았습니다.",
  };
}

export function GrammarExercise({ card }: { card: GrammarPracticeCard }) {
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [exercise, setExercise] = useState<Exercise>(() => buildExercise(card, "beginner"));
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const hasDifficultyDistinction = useMemo(() => {
    const kind = inferKind(card);
    if (kind === "generic") return false;
    const validExamples = (card.examples ?? []).filter(Boolean);
    return validExamples.length > 0;
  }, [card]);

  // 현재 출제된 문제 외에 다른 형태의 문제(프롬프트나 정답이 다른 문제)가 존재하는지 미리 판별합니다.
  const hasNext = useMemo(() => {
    for (let i = 0; i < 20; i++) {
      const ex = buildExercise(card, difficulty);
      if (ex.prompt !== exercise.prompt || ex.answer !== exercise.answer) {
        return true;
      }
    }
    return false;
  }, [card, difficulty, exercise.prompt, exercise.answer]);

  const isCorrect = revealed && picked === exercise.answer;

  const questionView = useMemo(() => {
    return (
      <div className="rounded-2xl border border-[#E7D7CF] bg-[#FDF2F0] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-xl bg-white/60 px-3 py-2 text-[#7A4F3B] shadow-sm">
            <span className="text-lg font-extrabold">Q.</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#7A4F3B]/80">{exercise.title}</p>
            <div className="mt-3 border-l-4 border-[#B28471] pl-4">
              <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-[#3A2B22] sm:text-base">
                {exercise.prompt}
              </p>
            </div>
            <p className="mt-3 text-sm text-[#7A4F3B]/80">{exercise.koreanHint}</p>
          </div>
        </div>
      </div>
    );
  }, [exercise.koreanHint, exercise.prompt, exercise.title]);

  const handlePick = (c: string) => {
    if (revealed) return;
    setPicked(c);
    setRevealed(true);
  };

  const next = () => {
    let nextEx = buildExercise(card, difficulty);
    let attempts = 0;
    // 같은 문제가 나오지 않도록 최대 20번까지 다시 뽑습니다.
    while (
      nextEx.prompt === exercise.prompt &&
      nextEx.answer === exercise.answer &&
      attempts < 20
    ) {
      nextEx = buildExercise(card, difficulty);
      attempts++;
    }
    setExercise(nextEx);
    setPicked(null);
    setRevealed(false);
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex items-center gap-2",
          hasDifficultyDistinction ? "justify-between" : "justify-end",
        )}
      >
        {hasDifficultyDistinction && (
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(
                "rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                difficulty === "beginner"
                  ? "border-[#DCCFC4] bg-white/70 text-[#333D29]"
                  : "border-[#DCCFC4] bg-white/40 text-[#333D29]/70 hover:bg-white/60",
              )}
              onClick={() => {
                setDifficulty("beginner");
                setExercise(buildExercise(card, "beginner"));
                setPicked(null);
                setRevealed(false);
              }}
            >
              초급
            </button>
            <button
              type="button"
              className={cn(
                "rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                difficulty === "intermediate"
                  ? "border-[#DCCFC4] bg-white/70 text-[#333D29]"
                  : "border-[#DCCFC4] bg-white/40 text-[#333D29]/70 hover:bg-white/60",
              )}
              onClick={() => {
                setDifficulty("intermediate");
                setExercise(buildExercise(card, "intermediate"));
                setPicked(null);
                setRevealed(false);
              }}
            >
              중급
            </button>
          </div>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="rounded-xl"
          onClick={() => {
            setExercise(buildExercise(card, difficulty));
            setPicked(null);
            setRevealed(false);
          }}
          disabled={!hasNext}
        >
          새로 만들기
        </Button>
      </div>

      {questionView}

      <div className="grid gap-2">
        {exercise.choices.map((c) => {
          const selected = picked === c;
          const correct = revealed && c === exercise.answer;
          const wrong = revealed && selected && c !== exercise.answer;
          return (
            <button
              key={c}
              type="button"
              disabled={revealed}
              onClick={() => handlePick(c)}
              className={cn(
                "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all active:scale-[0.99]",
                !revealed && "bg-white/70 hover:bg-white",
                selected && !revealed && "border-[#8A5A2B] bg-[#F7EFE5]",
                correct && "border-2 border-success bg-success/10",
                wrong && "border-2 border-destructive bg-destructive/10",
                revealed && !correct && !wrong && "opacity-70",
              )}
            >
              {c}
            </button>
          );
        })}
      </div>

      {hasNext && (
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" className="rounded-xl" onClick={next} disabled={!revealed}>
            다음 문제
          </Button>
        </div>
      )}

      {revealed && (
        <div
          className={cn(
            "rounded-xl border p-3 text-sm",
            isCorrect ? "border-success bg-success/10 text-success" : "border-[#DCCFC4] bg-white/60 text-[#333D29]",
          )}
        >
          {isCorrect ? "정답이에요." : `정답: ${exercise.answer}`}
          <div className="mt-1 text-xs text-muted-foreground">{exercise.explanation}</div>
        </div>
      )}
    </div>
  );
}
