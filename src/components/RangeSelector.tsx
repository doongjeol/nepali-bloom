import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type RangeSelectorProps = {
  min: number;
  max: number;
  initialStart?: number;
  initialEnd?: number;
  onSubmit: (range: { start: number; end: number }) => void;
  className?: string;
};

export function RangeSelector({ min, max, initialStart, initialEnd, onSubmit, className }: RangeSelectorProps) {
  const [startText, setStartText] = useState(String(initialStart ?? min));
  const [endText, setEndText] = useState(String(initialEnd ?? max));
  const [touched, setTouched] = useState(false);

  const validate = (start: number, end: number): string | null => {
    if (!Number.isInteger(start) || !Number.isInteger(end)) return "숫자만 입력해 주세요.";
    if (start < min || start > max) return `시작 레슨은 ${min}~${max} 범위여야 합니다.`;
    if (end < min || end > max) return `종료 레슨은 ${min}~${max} 범위여야 합니다.`;
    if (start > end) return "시작 레슨은 종료 레슨보다 클 수 없습니다.";
    return null;
  };

  const parsed = useMemo(() => {
    const start = Number.parseInt(startText, 10);
    const end = Number.parseInt(endText, 10);
    return {
      start: Number.isFinite(start) ? start : NaN,
      end: Number.isFinite(end) ? end : NaN,
    };
  }, [startText, endText]);

  const error = useMemo(() => {
    if (!touched) return null;
    return validate(parsed.start, parsed.end);
  }, [touched, parsed.start, parsed.end, min, max]);

  return (
    <div className={cn("rounded-2xl border bg-card p-5 shadow-sm", className)}>
      <h2 className="text-base font-semibold text-foreground">레슨 범위 선택</h2>
      <p className="mt-1 text-sm text-muted-foreground">예: {min} ~ {Math.min(max, min + 4)}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">시작 레슨</span>
          <input
            value={startText}
            onChange={(e) => { setTouched(true); setStartText(e.target.value); }}
            type="number"
            min={min}
            max={max}
            step={1}
            inputMode="numeric"
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            placeholder={`${min}`}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">종료 레슨</span>
          <input
            value={endText}
            onChange={(e) => { setTouched(true); setEndText(e.target.value); }}
            type="number"
            min={min}
            max={max}
            step={1}
            inputMode="numeric"
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            placeholder={`${max}`}
          />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <button
        type="button"
        className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-60"
        disabled={touched && !!error}
        onClick={() => {
          setTouched(true);
          const nextError = validate(parsed.start, parsed.end);
          if (nextError) return;
          // eslint-disable-next-line no-console
          console.log("[RangeSelector] submit:", { start: parsed.start, end: parsed.end });
          onSubmit({ start: parsed.start, end: parsed.end });
        }}
      >
        적용하기
      </button>
    </div>
  );
}
