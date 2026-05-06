import type React from "react";
import { useMemo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GrammarExercise } from "@/components/GrammarExercise";

export type GrammarPracticeCard = {
  title: string;
  category: string;
  details: string[];
  examples: string[];
  hasComparisonTable: boolean;
};

type PracticeKind = "possessive-ko" | "ergative-le" | "copula-contrast" | "generic";

const possessiveMap: Record<string, string> = {
  ma: "mero",
  u: "usko",
  haami: "haamro",
  tapaaï: "tapaaïko",
  wahãã: "wahããko",
};

const copulaScenarios: Array<{
  id: string;
  context: string;
  options: Array<"ho" | "chha" | "hunchha">;
  answer: "ho" | "chha" | "hunchha";
  principleTitle: string;
  principle: string;
}> = [
  {
    id: "identity",
    context: "이것은 제 집입니다. (정체/식별)",
    options: ["ho", "chha", "hunchha"],
    answer: "ho",
    principleTitle: "정의/식별",
    principle: "사람/사물의 정체를 말할 때는 ho를 사용합니다. 부정은 hoina 입니다.",
  },
  {
    id: "location",
    context: "펜이 책상 위에 있습니다. (위치)",
    options: ["ho", "chha", "hunchha"],
    answer: "chha",
    principleTitle: "위치/상태",
    principle:
      "어딘가에 '존재한다/있다' 또는 성질/상태를 말할 때는 chha를 사용합니다. 부정은 chhaina 입니다.",
  },
  {
    id: "truth",
    context: "우유는 흰색입니다. (일반적 진리)",
    options: ["ho", "chha", "hunchha"],
    answer: "hunchha",
    principleTitle: "일반적 진리",
    principle:
      "항상 성립하는 사실이나 습관처럼 '일반적 진리'에는 hunchha를 사용합니다. 부정은 hũdaina 입니다.",
  },
];

function normalizeText(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function inferPracticeKind(card: GrammarPracticeCard): PracticeKind {
  const blob = normalizeText([card.title, ...card.details].join(" "));
  if (blob.includes("'-ko'") || blob.includes("-ko") || blob.includes("소유"))
    return "possessive-ko";
  if (blob.includes("'-le'") || blob.includes("-le") || blob.includes("타동사"))
    return "ergative-le";
  if (
    card.hasComparisonTable ||
    (blob.includes(" ho ") && blob.includes(" chha ") && blob.includes(" hunchha "))
  ) {
    return "copula-contrast";
  }
  return "generic";
}

function PrincipleKorean({ kind }: { kind: PracticeKind }) {
  const content =
    kind === "possessive-ko"
      ? {
          title: "핵심 원리 (한글 해설)",
          lines: [
            "‘-ko’는 소유(~의)를 나타내는 접미사예요.",
            "대명사는 소유격이 ‘그냥 -ko를 붙이는’ 게 아니라 형태가 바뀝니다. (ma -> mero, tapaaï -> tapaaïko)",
            "주어/화자가 바뀌면 소유격도 함께 바뀌는지 먼저 확인하세요.",
          ],
        }
      : kind === "ergative-le"
        ? {
            title: "핵심 원리 (한글 해설)",
            lines: [
              "‘-le’는 (특히 과거 시제에서) 타동사 문장에서 주어에 붙을 수 있는 마커예요.",
              "타동사 = 목적어가 필요한 동사 / 자동사 = 목적어가 필요 없는 동사.",
              "먼저 동사가 타동사인지 자동사인지 판별한 뒤, -le 적용 여부를 결정하세요.",
            ],
          }
        : kind === "copula-contrast"
          ? {
              title: "핵심 원리 (한글 해설)",
              lines: [
                "ho: 정체/식별(‘A는 B다’)을 말할 때",
                "chha: 위치/존재/상태(‘있다/어디에 있다/상태가 ~하다’)를 말할 때",
                "hunchha: 일반적으로 성립하는 진리/습관 같은 ‘보편적 사실’을 말할 때",
              ],
            }
          : null;

  if (!content) return null;

  return (
    <div className="rounded-xl border border-[#DCCFC4] bg-white/60 p-3">
      <p className="text-sm font-semibold text-[#333D29]">{content.title}</p>
      <div className="mt-2 space-y-1">
        {content.lines.map((line) => (
          <p key={line} className="text-sm text-[#333D29]/85">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

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

function extractVerbLists(card: GrammarPracticeCard) {
  const text = card.details.join("\n");
  const transitiveMatch = text.match(/타동사\s*예\s*:\s*([^\n]+)/);
  const intransitiveMatch = text.match(/자동사\s*예\s*(?:\(.*\))?\s*:\s*([^\n]+)/);

  const parse = (raw: string | undefined) =>
    (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.split("(")[0]!.trim())
      .filter(Boolean);

  const transitive = parse(transitiveMatch?.[1]);
  const intransitive = parse(intransitiveMatch?.[1]);
  return { transitive, intransitive };
}

function HintPanel({
  title,
  detail,
  noteExcerpt,
}: {
  title: string;
  detail: string;
  noteExcerpt?: string[];
}) {
  return (
    <div className="rounded-xl border border-[#DCCFC4] bg-white/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#333D29]">{title}</p>
          <p className="mt-1 text-sm text-[#333D29]/80">{detail}</p>
        </div>
        <Badge className="shrink-0 rounded-full border-[#CDB9A8] bg-[#F5EBE0]/70 px-2 py-0.5 text-[10px] text-[#5A4636]">
          힌트
        </Badge>
      </div>
      {noteExcerpt && noteExcerpt.length > 0 && (
        <div className="mt-2 space-y-1">
          {noteExcerpt.slice(0, 3).map((line, idx) => (
            <p key={idx} className="text-xs text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function useNoteExcerpt(card: GrammarPracticeCard, keywords: string[]) {
  return useMemo(() => {
    const lowerKeywords = keywords.map((k) => normalizeText(k));
    const lines = card.details.map((d) => d.trim()).filter(Boolean);
    const hits = lines.filter((line) => lowerKeywords.some((k) => normalizeText(line).includes(k)));
    return hits.length > 0 ? hits : lines.slice(0, 4);
  }, [card, keywords]);
}

function PossessiveDrill({ card }: { card: GrammarPracticeCard }) {
  const [wrongCount, setWrongCount] = useState(0);
  const [answered, setAnswered] = useState<null | {
    correct: boolean;
    picked: string;
    answer: string;
  }>(null);

  const generateQuestion = useCallback((excludeTarget?: string) => {
    const pronouns = Object.keys(possessiveMap);
    let target = pick(pronouns);
    if (excludeTarget && pronouns.length > 1) {
      while (target === excludeTarget) {
        target = pick(pronouns);
      }
    }
    const answer = possessiveMap[target]!;
    const distractors = shuffle(
      pronouns.map((p) => possessiveMap[p]!).filter((v) => v !== answer),
    ).slice(0, 3);
    const options = shuffle([answer, ...distractors]).slice(0, 4);
    return { target, answer, options };
  }, []);
  const [question, setQuestion] = useState(() => generateQuestion());

  const excerpt = useNoteExcerpt(card, ["-ko", "소유", "mero", "tapaaïko"]);
  const revealAnswer = wrongCount >= 3;

  const reset = () => {
    setWrongCount(0);
    setAnswered(null);
    setQuestion(generateQuestion(question.target));
  };

  const onPickOption = (picked: string) => {
    if (answered) return;
    const correct = picked === question.answer;
    setAnswered({ correct, picked, answer: question.answer });
    if (!correct) setWrongCount((c) => c + 1);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#DCCFC4] bg-[#F5EBE0]/60 p-3">
        <p className="text-xs font-medium text-[#6B5D4F]">변형 과제</p>
        <p className="mt-1 text-sm text-[#333D29]">
          대명사 <span className="font-semibold text-[#8A5A2B]">{question.target}</span> 의 소유격 형태는 무엇일까요?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {question.options.map((opt) => {
          const selected = answered?.picked === opt;
          const correct = answered?.answer === opt;
          const showCorrect = revealAnswer || (answered?.correct && correct);

          return (
            <button
              key={opt}
              type="button"
              onClick={() => onPickOption(opt)}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                "bg-white/75 hover:bg-white",
                selected && "border-[#8A5A2B] bg-[#F7EFE5]",
                showCorrect && correct && "border-success bg-success/10",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {answered && !answered.correct && (
        <HintPanel
          title="이 문법 규칙을 다시 읽어보세요"
          detail={
            wrongCount <= 1
              ? "소유격(-ko)은 대명사에 따라 형태가 바뀝니다."
              : "대명사별 소유격 대응표를 떠올려보세요."
          }
          noteExcerpt={excerpt}
        />
      )}

      {answered && answered.correct && (
        <div className="rounded-xl border border-success bg-success/10 p-3 text-sm text-success">
          정답이에요. 대명사가 바뀌면 소유격 형태도 함께 바뀝니다.
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {answered && !answered.correct && wrongCount >= 2 && !revealAnswer && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-xl"
            onClick={() => setWrongCount(3)}
          >
            정답 보기
          </Button>
        )}
        <Button type="button" variant="secondary" size="sm" className="rounded-xl" onClick={reset}>
          다시 풀기
        </Button>
      </div>

      {revealAnswer && answered && !answered.correct && (
        <div className="rounded-xl border border-[#DCCFC4] bg-white/60 p-3 text-sm text-[#333D29]">
          정답: <span className="font-semibold text-[#8A5A2B]">{question.answer}</span>
        </div>
      )}
    </div>
  );
}

type Bucket = "pool" | "transitive" | "intransitive";

function TapChip({
  word,
  bucket,
  onClick,
}: {
  word: string;
  bucket: Bucket;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-all active:scale-95",
        bucket === "pool" && "border-[#DCCFC4] bg-white/75 text-[#333D29] hover:bg-white",
        bucket === "transitive" && "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
        bucket === "intransitive" && "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
      )}
    >
      {word}
    </button>
  );
}

function TapZone({
  title,
  hint,
  count,
  className,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-[#DCCFC4] p-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#333D29]">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <Badge className="shrink-0 rounded-full border-[#CDB9A8] bg-[#EEF1E6]/70 px-2 py-0.5 text-[10px] text-[#5A4636]">
          {count}
        </Badge>
      </div>
      <div className="mt-2 flex min-h-[2.5rem] flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ErgativeDrill({ card }: { card: GrammarPracticeCard }) {
  const lists = useMemo(() => extractVerbLists(card), [card]);
  const words = useMemo(() => {
    const fallback = ["khaanu", "banda", "garnu", "sutnu", "jaanu"];
    const merged = [...lists.transitive, ...lists.intransitive];
    return merged.length >= 4 ? merged : fallback;
  }, [lists.intransitive, lists.transitive]);

  const [pool, setPool] = useState<string[]>(() => shuffle(words));
  const [transitive, setTransitive] = useState<string[]>([]);
  const [intransitive, setIntransitive] = useState<string[]>([]);
  const [checked, setChecked] = useState<null | { ok: boolean; wrong: string[] }>(null);
  const [wrongCount, setWrongCount] = useState(0);

  const excerpt = useNoteExcerpt(card, ["-le", "타동사", "자동사"]);
  const revealAnswer = wrongCount >= 3;

  const correctTransitive = new Set(
    lists.transitive.length ? lists.transitive : ["khaanu", "banda garnu", "garnu"],
  );
  const correctIntransitive = new Set(
    lists.intransitive.length ? lists.intransitive : ["sutnu", "jaanu"],
  );

  const handleTap = (word: string, currentBucket: Bucket) => {
    setChecked(null);
    setPool((prev) => prev.filter((w) => w !== word));
    setTransitive((prev) => prev.filter((w) => w !== word));
    setIntransitive((prev) => prev.filter((w) => w !== word));

    if (currentBucket === "pool") setTransitive((prev) => [...prev, word]);
    if (currentBucket === "transitive") setIntransitive((prev) => [...prev, word]);
    if (currentBucket === "intransitive") setPool((prev) => [...prev, word]);
  };

  const reset = () => {
    setPool(shuffle(words));
    setTransitive([]);
    setIntransitive([]);
    setChecked(null);
    setWrongCount(0);
  };

  const check = () => {
    const wrong: string[] = [];
    transitive.forEach((w) => {
      if (!correctTransitive.has(w)) wrong.push(w);
    });
    intransitive.forEach((w) => {
      if (!correctIntransitive.has(w)) wrong.push(w);
    });
    const ok = wrong.length === 0 && pool.length === 0;
    setChecked({ ok, wrong });
    if (!ok) setWrongCount((c) => c + 1);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#DCCFC4] bg-[#E8EDDF]/55 p-3">
        <p className="text-xs font-medium text-[#6B5D4F]">분류 과제</p>
        <p className="mt-1 text-sm text-[#333D29]">
          단어를 <strong>터치</strong>해서 <span className="font-semibold text-[#8A5A2B]">타동사</span>인지 <span className="font-semibold text-[#8A5A2B]">자동사</span>인지 분류해보세요.
        </p>
      </div>

      <TapZone
        title="대기"
        hint="터치하면 타동사로 이동해요"
        count={pool.length}
        className="bg-white/55"
      >
        {pool.map((w) => (
          <TapChip key={w} word={w} bucket="pool" onClick={() => handleTap(w, "pool")} />
        ))}
      </TapZone>

      <div className="grid gap-3 sm:grid-cols-2">
        <TapZone
          title="타동사"
          hint="목적어가 필요 (터치 시 자동사로 이동)"
          count={transitive.length}
          className="bg-blue-50/40"
        >
          {transitive.map((w) => (
            <TapChip key={w} word={w} bucket="transitive" onClick={() => handleTap(w, "transitive")} />
          ))}
        </TapZone>
        <TapZone
          title="자동사"
          hint="목적어 불필요 (터치 시 대기로 이동)"
          count={intransitive.length}
          className="bg-emerald-50/40"
        >
          {intransitive.map((w) => (
            <TapChip key={w} word={w} bucket="intransitive" onClick={() => handleTap(w, "intransitive")} />
          ))}
        </TapZone>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          className="rounded-xl"
          onClick={check}
          disabled={checked?.ok === true}
        >
          채점
        </Button>
        <Button type="button" variant="secondary" size="sm" className="rounded-xl" onClick={reset}>
          초기화
        </Button>
      </div>

      {checked && !checked.ok && (
        <HintPanel
          title="이 문법 규칙을 다시 읽어보세요"
          detail={
            wrongCount <= 1
              ? "타동사는 목적어가 필요하고, 과거형 문장에서 주어에 -le가 붙을 수 있어요."
              : "‘타동사 예 / 자동사 예’ 목록을 다시 보고 분류 기준을 떠올려보세요."
          }
          noteExcerpt={excerpt}
        />
      )}

      {checked?.ok && (
        <div className="rounded-xl border border-success bg-success/10 p-3 text-sm text-success">
          좋아요. 분류 기준이 맞아요.
        </div>
      )}

      {revealAnswer && checked && !checked.ok && (
        <div className="rounded-xl border border-[#DCCFC4] bg-white/60 p-3 text-sm text-[#333D29]">
          정답 예시: 타동사({Array.from(correctTransitive).join(", ")}), 자동사(
          {Array.from(correctIntransitive).join(", ")})
        </div>
      )}

      {checked && !checked.ok && wrongCount >= 2 && !revealAnswer && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-xl"
            onClick={() => setWrongCount(3)}
          >
            정답 보기
          </Button>
        </div>
      )}
    </div>
  );
}

function CopulaContrastDrill({ card }: { card: GrammarPracticeCard }) {
  const [activeTab, setActiveTab] = useState<"ho" | "chha" | "hunchha">("ho");
  const activeItem = copulaScenarios.find((s) => s.answer === activeTab)!;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#DCCFC4] bg-[#F7EFE5]/60 p-3">
        <p className="text-xs font-medium text-[#6B5D4F]">세 가지 동사 대조</p>
        <p className="mt-1 text-sm text-[#333D29]">
          아래 항목을 눌러 각각의 쓰임새와 차이점을 확인해보세요.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(["ho", "chha", "hunchha"] as const).map((opt) => {
          const selected = activeTab === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setActiveTab(opt)}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                selected
                  ? "border-[#8A5A2B] bg-[#F5EBE0] text-[#5A4636]"
                  : "bg-white/75 text-[#333D29]/70 hover:bg-white hover:text-[#333D29]"
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>

      <div
        key={activeTab}
        className="animate-in fade-in-0 slide-in-from-bottom-1 rounded-xl border border-[#DCCFC4] bg-white p-4 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-[#8A5A2B]">{activeItem.answer}</h3>
          <Badge className="border-[#CDB9A8] bg-[#EEF1E6]/70 text-[#5A4636] hover:bg-[#EEF1E6]/70">
            {activeItem.principleTitle}
          </Badge>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[#333D29]">
          {activeItem.principle}
        </p>
        <div className="mt-4 rounded-lg bg-muted/40 p-3">
          <p className="mb-1 text-xs font-semibold text-muted-foreground">예문 상황</p>
          <p className="text-sm font-medium text-[#333D29]">{activeItem.context}</p>
        </div>
      </div>
    </div>
  );
}

export function GrammarPractice({ card }: { card: GrammarPracticeCard }) {
  const kind = inferPracticeKind(card);

  const hasPossessive = kind === "possessive-ko";
  const hasErgative = kind === "ergative-le";
  const hasCopula = kind === "copula-contrast";
  const hasExercise = (() => {
    const examples = (card.examples ?? []).filter(Boolean);
    for (const ex of examples) {
      const nepaliMatch = ex.match(/^[^(]+/);
      const nepaliText = nepaliMatch ? nepaliMatch[0].trim() : ex;
        const words = nepaliText
          .split(/\s+/)
          .map((w) => w.replace(/[?!.,;:'"()\[\]]/g, ""))
          .filter((w) => w.length >= 2 && /^[a-zA-Z]+$/.test(w));
      if (words.length > 0) return true;
    }
    return false;
  })();

  return (
    <div className="space-y-4">
      <PrincipleKorean kind={kind} />

      <Tabs
        defaultValue={
          hasPossessive ? "transform" : hasErgative ? "classify" : hasCopula ? "contrast" : hasExercise ? "exercise" : "notes"
        }
      >
        <TabsList className="w-full rounded-xl bg-[#EFE7E1] p-1">
          {hasPossessive && (
            <TabsTrigger value="transform" className="w-full rounded-lg text-sm">
              변형
            </TabsTrigger>
          )}
          {hasErgative && (
            <TabsTrigger value="classify" className="w-full rounded-lg text-sm">
              분류
            </TabsTrigger>
          )}
          {hasCopula && (
            <TabsTrigger value="contrast" className="w-full rounded-lg text-sm">
              대조
            </TabsTrigger>
          )}
          {hasExercise && (
            <TabsTrigger value="exercise" className="w-full rounded-lg text-sm">
              문제
            </TabsTrigger>
          )}
          <TabsTrigger value="notes" className="w-full rounded-lg text-sm">
            노트
          </TabsTrigger>
        </TabsList>

        {hasPossessive && (
          <TabsContent value="transform" className="mt-3">
            <PossessiveDrill card={card} />
          </TabsContent>
        )}
        {hasErgative && (
          <TabsContent value="classify" className="mt-3">
            <ErgativeDrill card={card} />
          </TabsContent>
        )}
        {hasCopula && (
          <TabsContent value="contrast" className="mt-3">
            <CopulaContrastDrill card={card} />
          </TabsContent>
        )}
        {hasExercise && (
          <TabsContent value="exercise" className="mt-3">
            <GrammarExercise card={card} />
          </TabsContent>
        )}
        <TabsContent value="notes" className="mt-3">
          <NotesView card={card} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NotesView({ card }: { card: GrammarPracticeCard }) {
  const lines = useMemo(() => card.details.map((d) => d.trim()).filter(Boolean), [card.details]);
  return (
    <div className="space-y-2">
      {lines.slice(0, 8).map((line, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-[#DCCFC4] bg-white/60 px-3 py-2 text-sm text-[#333D29]"
        >
          {line}
        </div>
      ))}
      {lines.length > 8 && (
        <div className="rounded-xl border border-[#DCCFC4] bg-white/40 px-3 py-2 text-xs text-muted-foreground">
          노트가 더 있어요. 문법 카드 본문에서 이어서 확인하세요.
        </div>
      )}
    </div>
  );
}
