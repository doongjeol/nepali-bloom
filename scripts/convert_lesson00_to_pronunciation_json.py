#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Tuple


ROOT = Path(__file__).resolve().parents[1]
RAW_PATH = ROOT / "src" / "data" / "raw" / "lesson 00.txt"
OUT_PATH = ROOT / "src" / "data" / "pronunciation_00.json"


ROMAN_TO_PHONETIC: Dict[str, str] = {
    # vowels
    "a": "아",
    "aa": "아(길게)",
    "i": "이",
    "u": "우",
    "e": "에",
    "ai": "아이",
    "o": "오",
    "au": "아우",
    # consonants (approx.)
    "k": "카",
    "kh": "카(거센)",
    "g": "가",
    "gh": "가(거센)",
    "ng": "응",
    "ch": "차",
    "chh": "차(거센)",
    "j": "자",
    "jh": "자(거센)",
    "n": "나",
    "T": "타(권설)",
    "Th": "타(권설 거센)",
    "D": "다(권설)",
    "Dh": "다(권설 거센)",
    "t": "타",
    "th": "타(거센)",
    "d": "다",
    "dh": "다(거센)",
    "p": "파",
    "ph": "파(거센)",
    "b": "바",
    "bh": "바(거센)",
    "m": "마",
    "y": "야",
    "r": "라",
    "l": "라",
    "w": "와",
    "sh": "샤",
    "s": "사",
    "h": "하",
    "ksh": "크샤",
    "tra": "트라",
    "gyn": "갼",
}


def slugify(value: str) -> str:
    v = value.strip().lower()
    v = re.sub(r"[^a-z0-9]+", "_", v)
    v = re.sub(r"_+", "_", v).strip("_")
    return v or "unknown"


def default_audio_path(romanized: str) -> str:
    # Requirement: if missing, auto-generate: char_name.mp3
    return f"/audio/pronunciation/00/{slugify(romanized)}.mp3"


def phonetic_from_romanized(romanized: str) -> str:
    r = romanized.strip()
    return ROMAN_TO_PHONETIC.get(r, r)


def extract_section(text: str, header: str, until_regex: str) -> str:
    m = re.search(rf"\n{re.escape(header)}\n", text)
    if not m:
        return ""
    after = text[m.end() :]
    m2 = re.search(until_regex, after)
    return after[: m2.start()] if m2 else after


ITEM_RE = re.compile(r"(?P<char>[^,\s]+)\s*\((?P<roman>[^)]+)\)")


def parse_items(block: str) -> List[Tuple[str, str]]:
    items: List[Tuple[str, str]] = []
    for m in ITEM_RE.finditer(block):
        char = m.group("char").strip()
        roman = m.group("roman").strip()
        if char and roman:
            items.append((char, roman))
    return items


def build_entries(pairs: List[Tuple[str, str]]) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    for char, roman in pairs:
        out.append(
            {
                "char": char,
                "romanized": roman,
                "phonetic": phonetic_from_romanized(roman),
                "audio": default_audio_path(roman),
            }
        )
    return out


def main() -> None:
    raw = RAW_PATH.read_text(encoding="utf-8")

    vowels_block = extract_section(raw, "VOWELS", r"\n\n")
    consonants_block = extract_section(raw, "CONSONANTS", r"\nNOTE:|\n\n")

    vowels = build_entries(parse_items(vowels_block))
    consonants = build_entries(parse_items(consonants_block))

    data = {
        "vowels": vowels,
        "consonants": consonants,
        "special_characters": [],
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote: {OUT_PATH.relative_to(ROOT)}")
    print(f"- vowels: {len(vowels)}")
    print(f"- consonants: {len(consonants)}")


if __name__ == "__main__":
    main()

