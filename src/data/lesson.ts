export interface Vocabulary {
  nepali: string;
  romanized: string;
  korean: string;
}

export interface Quiz {
  question: string;
  options: string[];
  answer: number;
}

export interface DialogueLine {
  speaker: string;
  nepali: string;
  romanized: string;
  korean: string;
}

export interface Dialogue {
  title: string;
  lines: DialogueLine[];
}

export interface Lesson {
  id: number;
  title: string;
  titleKo: string;
  description: string;
  vocabulary: Vocabulary[];
  quiz: Quiz[];
  dialogues: Dialogue[];
}