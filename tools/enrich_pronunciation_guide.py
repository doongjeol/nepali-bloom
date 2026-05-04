#!/usr/bin/env python3
"""
Enrich src/data/lessons/pronunciation_00.json with detailed guides/examples
from src/data/raw/lesson 00.txt (Introduction to the Nepali sound system).

Run:
  python tools/enrich_pronunciation_guide.py
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RAW_PATH = ROOT / "src" / "data" / "raw" / "lesson 00.txt"
PRON_PATH = ROOT / "src" / "data" / "lessons" / "pronunciation_00.json"


@dataclass
class Example:
    nepali: str
    romanized: str
    meaning: str


def parse_vowel_block(lines: list[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}

    vowel_header = "A BRIEF GUIDE TO THE PRODUCTION OF THE NEPALI SOUNDS"
    try:
        start = next(i for i, l in enumerate(lines) if l.strip() == vowel_header)
    except StopIteration:
        raise SystemExit(f"Could not find header in {RAW_PATH}")

    section: str | None = None
    i = start + 1
    while i < len(lines):
        s = lines[i].rstrip("\n")
        t = s.strip()
        if t == "VOWELS":
            section = "vowels"
            i += 1
            continue
        if t == "CONSONANTS":
            break
        if section != "vowels":
            i += 1
            continue

        m = re.match(r"^\s*\d+\.\s*([अआइईउऊएऐओऔ])\s*\(([^)]+)\)\s*-\s*(.+)\s*$", s)
        if not m:
            i += 1
            continue

        char = m.group(1)
        romanized = m.group(2).strip()
        guide = m.group(3).strip()

        examples: list[Example] = []
        j = i + 1
        while j < len(lines):
            ex_line = lines[j].strip()
            if not ex_line:
                break
            if re.match(r"^\d+\.\s*", ex_line):
                break
            exm = re.match(r"^-+\s*(.+?)\s*\(([^)]+)\)\s*-\s*(.+)\s*$", ex_line)
            if exm:
                nep = exm.group(1).strip()
                rom = exm.group(2).strip()
                meaning = exm.group(3).strip().rstrip(".")
                examples.append(Example(nepali=nep, romanized=rom, meaning=meaning))
            j += 1

        out[char] = {
            "book_romanized": romanized,
            "book_guide": guide,
            "book_examples": [e.__dict__ for e in examples],
        }
        i = j
        continue

    return out


def parse_consonant_block(lines: list[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}

    header = "CONSONANTS"
    try:
        start = next(i for i, l in enumerate(lines) if l.strip() == header)
    except StopIteration:
        raise SystemExit(f"Could not find CONSONANTS section in {RAW_PATH}")

    # Start parsing from the second CONSONANTS (after the guide header)
    # We find the one that comes after "A BRIEF GUIDE..."
    guide_header = "A BRIEF GUIDE TO THE PRODUCTION OF THE NEPALI SOUNDS"
    try:
        guide_start = next(i for i, l in enumerate(lines) if l.strip() == guide_header)
    except StopIteration:
        raise SystemExit(f"Could not find header in {RAW_PATH}")
    start = next(i for i in range(guide_start, len(lines)) if lines[i].strip() == header)

    i = start + 1
    while i < len(lines):
        s = lines[i].rstrip("\n")
        t = s.strip()
        if not t:
            i += 1
            continue

        # Stop after compound consonant sounds section
        if t.startswith("NOTE:"):
            break

        m = re.match(r"^\s*\d+\.\d+\s*([^\s]+)\s*\(([^)]+)\)\s*-\s*(.+)$", s)
        if not m:
            i += 1
            continue

        char = m.group(1).strip()
        romanized = m.group(2).strip()
        rest = m.group(3).strip()

        guide = rest
        examples_part = ""
        if "Ex:" in rest:
            guide, examples_part = rest.split("Ex:", 1)
            guide = guide.strip().rstrip(".")
            examples_part = examples_part.strip()

        examples: list[Example] = []
        if examples_part:
            # Split on commas, but keep the meaning segment intact
            parts = [p.strip() for p in examples_part.split(",") if p.strip()]
            for p in parts:
                p = p.rstrip(".")
                exm = re.match(r"^(.+?)\s*\(([^)]+)\)\s*-\s*(.+)$", p)
                if exm:
                    nep = exm.group(1).strip()
                    rom = exm.group(2).strip()
                    meaning = exm.group(3).strip().rstrip(".")
                    examples.append(Example(nepali=nep, romanized=rom, meaning=meaning))

        out[char] = {
            "book_romanized": romanized,
            "book_guide": guide,
            "book_examples": [e.__dict__ for e in examples],
        }
        i += 1

    return out


def main() -> int:
    if not RAW_PATH.exists():
        raise SystemExit(f"Missing raw file: {RAW_PATH}")
    if not PRON_PATH.exists():
        raise SystemExit(f"Missing pronunciation json: {PRON_PATH}")

    raw_lines = RAW_PATH.read_text(encoding="utf-8").splitlines()
    vowels = parse_vowel_block(raw_lines)
    consonants = parse_consonant_block(raw_lines)

    data = json.loads(PRON_PATH.read_text(encoding="utf-8"))

    def enrich_items(items: list[dict]):
        for item in items:
            char = item.get("char")
            if not isinstance(char, str):
                continue
            src = vowels.get(char) or consonants.get(char)
            if not src:
                continue
            item["book_guide"] = src["book_guide"]
            item["book_examples"] = src["book_examples"]

    enrich_items(data.get("vowels", []))
    enrich_items(data.get("consonants", []))
    enrich_items(data.get("special_characters", []))

    PRON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {PRON_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

