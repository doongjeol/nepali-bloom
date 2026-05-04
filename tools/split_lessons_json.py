#!/usr/bin/env python3
"""
Split src/data/lessons.json into per-lesson JSON files:
  - src/data/lessons/lesson_{id}.json
and generate a minimal index:
  - src/data/index.json

Run:
  python tools/split_lessons_json.py
"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src" / "data"
IN_PATH = SRC / "lessons.json"
OUT_DIR = SRC / "lessons"
INDEX_PATH = SRC / "index.json"


def main() -> int:
    if not IN_PATH.exists():
        raise SystemExit(f"Input not found: {IN_PATH}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    lessons = json.loads(IN_PATH.read_text(encoding="utf-8"))
    if not isinstance(lessons, list):
        raise SystemExit("src/data/lessons.json must be a JSON array")

    index = []
    for lesson in lessons:
        if not isinstance(lesson, dict) or "id" not in lesson:
            raise SystemExit("Each lesson must be an object with an 'id'")
        lesson_id = int(lesson["id"])

        out_path = OUT_DIR / f"lesson_{lesson_id}.json"
        out_path.write_text(json.dumps(lesson, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        vocab = lesson.get("vocabulary") or []
        examples = lesson.get("examples") or []
        grammar = lesson.get("grammar") or []
        quiz = lesson.get("quiz") or []
        dialogues = lesson.get("dialogues") or []

        index.append(
            {
                "id": lesson_id,
                "title": lesson.get("title", f"Lesson {lesson_id}"),
                "titleKo": lesson.get("titleKo", ""),
                "description": lesson.get("description", ""),
                "counts": {
                    "vocabulary": len(vocab),
                    "examples": len(examples),
                    "grammar": len(grammar) if isinstance(grammar, list) else 0,
                    "quiz": len(quiz),
                    "dialogues": len(dialogues),
                },
            }
        )

    index.sort(key=lambda x: x["id"])
    INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote {len(index)} lessons to {OUT_DIR}")
    print(f"Wrote index to {INDEX_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

