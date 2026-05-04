import type { Lesson } from "@/data/lesson";

export type LessonIndexItem = {
  id: number;
  title: string;
  titleKo: string;
  description?: string;
  counts?: {
    vocabulary?: number;
    examples?: number;
    grammar?: number;
    quiz?: number;
    dialogues?: number;
  };
};

import lessonsIndexJson from "./index.json";
const extraLessons: LessonIndexItem[] = [
  { id: 28, title: "Lesson 28", titleKo: "제28과", description: "과거 완료 시제와 'hunubhandaa pahile'의 결합, 그리고 'rahechha'를 통한 새로운 사실 인지 표현을 배웁니다." },
  { id: 29, title: "Lesson 29", titleKo: "제29과", description: "과거 진행 시제(-dai thiyo / -iraheko)와 명사를 수식하는 '-eko' 형용사 용법을 배웁니다." },
  { id: 30, title: "Lesson 30", titleKo: "제30과", description: "현재 진행 시제(-iraheko form)의 형태와 쓰임, 그리고 구직 활동 및 안부 묻기와 관련된 표현을 배웁니다." },
  { id: 31, title: "Lesson 31", titleKo: "제31과", description: "조건절 'bhane'(~한다면)의 사용법과 물건의 특성/가격을 나타내는 접미사 'walaa'를 배우고, 우체국 대화를 연습합니다." },
  { id: 32, title: "Lesson 32", titleKo: "제32과", description: "숙박과 식사를 요청하는 표현과 다양한 의문사에 '-pani'를 붙여 만드는 부정 대명사의 활용법을 배웁니다." },
  { id: 33, title: "Lesson 33", titleKo: "제33과", description: "이유의 표현(-ekole / -ekohunaale)과 간접 화법 종결 어미(re)를 배웁니다." },
  { id: 34, title: "Lesson 34", titleKo: "제34과", description: "명사를 수식하는 형용사절(Relative Clauses)을 만드는 방법과 'chiyaa siyaa' 같은 중첩 표현(Echo Words)을 배웁니다." },
  { id: 35, title: "Lesson 35", titleKo: "제35과", description: "대조와 양보의 표현('-bhaepani', '-bhaetaa pani')과 의문사를 활용한 조건/양보 구문을 배웁니다." },
  { id: 36, title: "Lesson 36", titleKo: "제36과", description: "네팔어에서 빈번하게 사용되는 수동태 표현(-inchha, -aainchha)과 행위자를 나타내는 '-dwaaraa'를 배웁니다." },
  { id: 37, title: "Lesson 37", titleKo: "제37과", description: "네팔의 일반적인 정보(인구, 직업, 교통 등)와 간접 화법(Reported Speech), 그리고 미래 시제 표현을 배웁니다." },
  { id: 38, title: "Lesson 38", titleKo: "제38과", description: "강한 의무 표현(-nai parchha)과 의식(hosh) 관련 표현, 긴급 상황에서의 대화를 배웁니다." },
  { id: 39, title: "Lesson 39", titleKo: "제39과", description: "'jhandai'(하마터면 ~할 뻔했다), 'baani parnu'(익숙해지다) 등 과거 경험과 익숙함에 대해 묘사하는 표현을 배웁니다." },
  { id: 40, title: "Lesson 40", titleKo: "제40과", description: "미래의 불확실한 행동이나 화자의 추측을 나타내는 어미(-laa)와 'holaa', 'bhannai sakindaina' 등의 표현을 배웁니다." }
];

export const lessonsIndex = [
  ...(lessonsIndexJson as LessonIndexItem[]).filter((l) => l.id < 28),
  ...extraLessons,
];

const lessonModules = import.meta.glob("./lessons/lesson_*.json", { import: "default" }) as Record<
  string,
  () => Promise<Lesson>
>;

export const availableLessonIds = Object.keys(lessonModules)
  .map((k) => {
    const m = k.match(/lesson_(\d+)\.json$/);
    return m ? Number(m[1]) : null;
  })
  .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
  .sort((a, b) => a - b);

export async function loadLesson(id: number): Promise<Lesson> {
  const key = `./lessons/lesson_${id}.json`;
  const loader = lessonModules[key];
  if (!loader) {
    throw new Error(`Lesson JSON not found for id=${id} (expected ${key})`);
  }
  return await loader();
}

export async function loadLessons(ids: number[]): Promise<Lesson[]> {
  return await Promise.all(ids.map((id) => loadLesson(id)));
}

export async function loadLessonsInRange(start: number, end: number): Promise<Lesson[]> {
  const s = Math.min(start, end);
  const e = Math.max(start, end);
  const ids = Array.from({ length: e - s + 1 }, (_, i) => s + i);
  const existingIds = ids.filter((id) => Boolean(lessonModules[`./lessons/lesson_${id}.json`]));
  const missingIds = ids.filter((id) => !lessonModules[`./lessons/lesson_${id}.json`]);
  if (missingIds.length > 0) {
    // eslint-disable-next-line no-console
    console.warn("[lessonLoader] missing lesson files:", missingIds);
  }
  if (existingIds.length === 0) {
    throw new Error(`No lesson JSON files found in range ${s}..${e}`);
  }
  return await loadLessons(existingIds);
}
