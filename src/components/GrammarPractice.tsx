import type React from "react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type GrammarPracticeCard = {
  title: string;
  category: string;
  details: string[];
  examples: string[];
  hasComparisonTable: boolean;
};

type FormulaToken = {
  label: string;
  tooltip: string;
  emphasis?: boolean;
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

function buildFormula(card: GrammarPracticeCard, kind: PracticeKind): FormulaToken[] {
  if (kind === "possessive-ko") {
    return [
      { label: "[명사/대명사]", tooltip: "소유를 나타내고 싶은 대상(‘~의’) 앞부분" },
      { label: "+", tooltip: "결합" },
      { label: "[-ko]", tooltip: "소유(~의)를 나타내는 접미사", emphasis: true },
      { label: "->", tooltip: "결과" },
      { label: "[소유격 형태]", tooltip: "예: ma -> mero, tapaaï -> tapaaïko" },
    ];
  }

  if (kind === "ergative-le") {
    return [
      { label: "[주어]", tooltip: "행동을 한 주체(과거 타동사에서 -le가 붙을 수 있음)" },
      { label: "+", tooltip: "결합" },
      { label: "[-le]", tooltip: "과거 시제의 타동사에서 주어를 표시하는 마커", emphasis: true },
      { label: "+", tooltip: "결합" },
      { label: "[목적어]", tooltip: "행동의 대상" },
      { label: "+", tooltip: "결합" },
      { label: "[타동사(과거)]", tooltip: "목적어를 필요로 하는 동사의 과거 표현" },
    ];
  }

  if (kind === "copula-contrast") {
    return [
      { label: "[명사/대명사]", tooltip: "문장의 주어(대상)" },
      { label: "+", tooltip: "결합" },
      { label: "[ho]", tooltip: "정의/식별", emphasis: true },
      { label: "|", tooltip: "상황에 따라 선택" },
      { label: "[chha]", tooltip: "위치/상태", emphasis: true },
      { label: "|", tooltip: "상황에 따라 선택" },
      { label: "[hunchha]", tooltip: "일반적 진리", emphasis: true },
    ];
  }

  // Generic fallback: show a compact “rule skeleton” so every card has something visual.
  return [
    { label: `[${card.category}]`, tooltip: "이 문법 항목의 분류" },
    { label: "+", tooltip: "결합" },
    { label: "[핵심 규칙]", tooltip: "설명에 있는 핵심 원리를 확인하세요", emphasis: true },
    { label: "->", tooltip: "적용" },
    { label: "[예문/의미]", tooltip: "규칙이 문장에 어떻게 적용되는지" },
  ];
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
          : {
              title: "핵심 원리 (한글 해설)",
              lines: [
                "이 항목은 아직 자동 퀴즈가 준비되지 않았어요.",
                "노트에서 규칙 문장을 먼저 읽고, 예문에서 적용을 확인하는 방식으로 학습해보세요.",
              ],
            };

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

  const generateQuestion = () => {
    const pronouns = Object.keys(possessiveMap);
    const from = pick(pronouns);
    const to = pick(pronouns.filter((p) => p !== from));
    const answer = possessiveMap[to] ?? "";
    const distractors = shuffle(
      pronouns.map((p) => possessiveMap[p]!).filter((v) => v !== answer),
    ).slice(0, 3);
    const options = shuffle([answer, ...distractors]).slice(0, 4);
    return { from, to, answer, options };
  };
  const [question, setQuestion] = useState(() => generateQuestion());

  const excerpt = useNoteExcerpt(card, ["-ko", "소유", "mero", "tapaaïko"]);
  const revealAnswer = wrongCount >= 3;

  const reset = () => {
    setWrongCount(0);
    setAnswered(null);
    setQuestion(generateQuestion());
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
          주어를 <span className="font-semibold text-[#8A5A2B]">{question.from}</span> 에서{" "}
          <span className="font-semibold text-[#8A5A2B]">{question.to}</span> 로 바꾸면 소유격은
          무엇이 될까요?
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

function DragChip({
  word,
  bucket,
  onMove,
}: {
  word: string;
  bucket: Bucket;
  onMove: (word: string, to: Bucket) => void;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ word, bucket }));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => {
        if (bucket === "pool") onMove(word, "transitive");
        else onMove(word, "pool");
      }}
      className="rounded-lg border border-[#DCCFC4] bg-white/75 px-2.5 py-1.5 text-sm font-medium text-[#333D29] hover:bg-white"
    >
      {word}
    </button>
  );
}

function DropZone({
  title,
  hint,
  words,
  onDropTo,
  children,
}: {
  title: string;
  hint: string;
  words: string[];
  onDropTo: (payload: { word: string; bucket: Bucket }) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border border-[#DCCFC4] bg-white/55 p-3"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        try {
          const payload = JSON.parse(e.dataTransfer.getData("text/plain")) as {
            word: string;
            bucket: Bucket;
          };
          if (!payload?.word || !payload?.bucket) return;
          onDropTo(payload);
        } catch {
          // ignore
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#333D29]">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <Badge className="shrink-0 rounded-full border-[#CDB9A8] bg-[#EEF1E6]/70 px-2 py-0.5 text-[10px] text-[#5A4636]">
          {words.length}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
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

  const move = (word: string, to: Bucket) => {
    setChecked(null);
    setPool((prev) => prev.filter((w) => w !== word));
    setTransitive((prev) => prev.filter((w) => w !== word));
    setIntransitive((prev) => prev.filter((w) => w !== word));

    if (to === "pool") setPool((prev) => [...prev, word]);
    if (to === "transitive") setTransitive((prev) => [...prev, word]);
    if (to === "intransitive") setIntransitive((prev) => [...prev, word]);
  };

  const onDropTo = (to: Bucket) => (payload: { word: string; bucket: Bucket }) => {
    if (payload.bucket === to) return;
    move(payload.word, to);
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
          어떤 동사가 <span className="font-semibold text-[#8A5A2B]">타동사</span>인지 구분해보세요.
          (과거 타동사면 주어에 <span className="font-semibold text-[#8A5A2B]">-le</span>가 붙을 수
          있어요)
        </p>
      </div>

      <DropZone
        title="대기"
        hint="여기서 드래그해서 분류하세요"
        words={pool}
        onDropTo={onDropTo("pool")}
      >
        {pool.map((w) => (
          <DragChip key={w} word={w} bucket="pool" onMove={move} />
        ))}
      </DropZone>

      <div className="grid gap-3 sm:grid-cols-2">
        <DropZone
          title="타동사"
          hint="목적어가 필요한 동사"
          words={transitive}
          onDropTo={onDropTo("transitive")}
        >
          {transitive.map((w) => (
            <DragChip key={w} word={w} bucket="transitive" onMove={move} />
          ))}
        </DropZone>
        <DropZone
          title="자동사"
          hint="목적어가 필요 없는 동사"
          words={intransitive}
          onDropTo={onDropTo("intransitive")}
        >
          {intransitive.map((w) => (
            <DragChip key={w} word={w} bucket="intransitive" onMove={move} />
          ))}
        </DropZone>
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
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [picked, setPicked] = useState<null | { value: string; correct: boolean }>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [showPrinciple, setShowPrinciple] = useState(false);

  const scenario = copulaScenarios[scenarioIndex]!;
  const excerpt = useNoteExcerpt(card, ["ho", "chha", "hunchha", "정의", "위치", "진리"]);
  const revealAnswer = wrongCount >= 3;

  const next = () => {
    setPicked(null);
    setWrongCount(0);
    setShowPrinciple(false);
    setScenarioIndex((i) => (i + 1) % copulaScenarios.length);
  };

  const onPick = (value: string) => {
    if (picked) return;
    const correct = value === scenario.answer;
    setPicked({ value, correct });
    if (!correct) setWrongCount((c) => c + 1);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#DCCFC4] bg-[#F7EFE5]/60 p-3">
        <p className="text-xs font-medium text-[#6B5D4F]">상황 대조</p>
        <p className="mt-1 text-sm text-[#333D29]">{scenario.context}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {scenario.options.map((opt) => {
          const selected = picked?.value === opt;
          const isAnswer = opt === scenario.answer;
          const showCorrect = revealAnswer || (picked?.correct && isAnswer);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onPick(opt)}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                "bg-white/75 hover:bg-white",
                selected && "border-[#8A5A2B] bg-[#F5EBE0]",
                showCorrect && isAnswer && "border-success bg-success/10",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {picked && picked.correct && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-success bg-success/10 p-3">
          <p className="text-sm text-success">정답이에요.</p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="rounded-xl"
              onClick={() => setShowPrinciple(true)}
            >
              원리 보기
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="rounded-xl"
              onClick={next}
            >
              다음
            </Button>
          </div>
        </div>
      )}

      {picked && !picked.correct && (
        <HintPanel
          title="이 문법 규칙을 다시 읽어보세요"
          detail={
            wrongCount <= 1
              ? "정체(ho) / 위치-상태(chha) / 일반적 진리(hunchha) 중 무엇인지 먼저 판단해보세요."
              : "문장 맥락이 ‘정의’, ‘존재/상태’, ‘항상 성립’ 중 어디에 가까운지 다시 확인해보세요."
          }
          noteExcerpt={excerpt}
        />
      )}

      {picked && !picked.correct && wrongCount >= 2 && !revealAnswer && (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-xl"
            onClick={() => setWrongCount(3)}
          >
            정답 보기
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-xl"
            onClick={() => setPicked(null)}
          >
            다시 시도
          </Button>
        </div>
      )}

      {revealAnswer && picked && !picked.correct && (
        <div className="rounded-xl border border-[#DCCFC4] bg-white/60 p-3 text-sm text-[#333D29]">
          정답: <span className="font-semibold text-[#8A5A2B]">{scenario.answer}</span>
        </div>
      )}

      <AlertDialog open={showPrinciple} onOpenChange={setShowPrinciple}>
        <AlertDialogContent className="grid max-h-[85dvh] max-w-[92vw] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl border-[#DCCFC4] bg-[#FFFDF9] p-0 text-[#333D29] sm:max-h-[80vh] sm:max-w-lg">
          <AlertDialogHeader className="px-4 pb-3 pt-4 text-left sm:px-6 sm:pt-6">
            <AlertDialogTitle>{scenario.principleTitle}</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              {scenario.principle}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 [-webkit-overflow-scrolling:touch] sm:px-6">
            <p className="rounded-xl border border-[#DCCFC4] bg-white/60 p-3 text-base leading-relaxed text-[#333D29]">
              {scenario.principle}
            </p>
          </div>
          <AlertDialogFooter className="sticky bottom-0 border-t border-[#DCCFC4] bg-[#FFFDF9]/95 px-4 py-3 sm:px-6">
            <AlertDialogCancel className="rounded-xl">닫기</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl" onClick={next}>
              다음 문제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GenericDrill({ card }: { card: GrammarPracticeCard }) {
  const excerpt = useNoteExcerpt(card, [card.category, card.title]);
  return (
    <div className="space-y-3">
      <HintPanel
        title="핵심 원리 요약"
        detail="이 항목은 변형형 퀴즈가 준비되지 않았어요. 아래 노트를 읽고 예문을 확인해보세요."
        noteExcerpt={excerpt}
      />
    </div>
  );
}

export function GrammarPractice({ card }: { card: GrammarPracticeCard }) {
  const kind = inferPracticeKind(card);
  const formula = useMemo(() => buildFormula(card, kind), [card, kind]);

  const hasPossessive = kind === "possessive-ko";
  const hasErgative = kind === "ergative-le";
  const hasCopula = kind === "copula-contrast";

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#DCCFC4] bg-white/55 p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#6B5D4F]">문법 공식</p>
            <p className="mt-0.5 text-sm font-semibold text-[#333D29]">{card.title}</p>
          </div>
          <Badge className="shrink-0 rounded-full border-[#CDB9A8] bg-[#F5EBE0]/70 px-2 py-0.5 text-[10px] text-[#5A4636]">
            {card.category}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {formula.map((t, idx) => (
            <span
              key={`${t.label}-${idx}`}
              aria-label={`${t.label}: ${t.tooltip}`}
              className={cn(
                "rounded-xl border px-2.5 py-1 text-sm font-semibold",
                "bg-white/70",
                t.emphasis && "border-[#D4A373]/60 bg-[#D4A373]/15 text-[#8A5A2B]",
                !t.emphasis && "border-[#DCCFC4] text-[#333D29]",
              )}
            >
              {t.label}
            </span>
          ))}
        </div>
      </section>

      <PrincipleKorean kind={kind} />

      <Tabs
        defaultValue={
          hasPossessive ? "transform" : hasErgative ? "classify" : hasCopula ? "contrast" : "notes"
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
        <TabsContent value="notes" className="mt-3">
          <NotesView card={card} />
        </TabsContent>
      </Tabs>

      {(kind === "generic" || (!hasPossessive && !hasErgative && !hasCopula)) && (
        <GenericDrill card={card} />
      )}
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
