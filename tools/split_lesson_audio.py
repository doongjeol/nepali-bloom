#!/usr/bin/env python3
"""
Split a long lesson MP3 into per-word/per-phrase clips by detecting silence.

Requires:
  - pydub
  - ffmpeg (must be installed and available on PATH)

Example:
  python tools/split_lesson_audio.py ^
    --input audio\\raw\\lesson1.mp3 ^
    --lesson lesson1 ^
    --output public\\audio ^
    --min-silence-len 350 ^
    --keep-silence 120
"""

from __future__ import annotations

import argparse
import math
import os
import shutil
import tempfile
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pydub import AudioSegment  # pragma: no cover


def _clamp_int(value: int, min_value: int, max_value: int) -> int:
    return max(min_value, min(max_value, int(value)))


def split_on_detected_silence(
    audio: "AudioSegment",
    *,
    min_silence_len_ms: int,
    silence_thresh_dbfs: float,
    seek_step_ms: int,
    keep_silence_ms: int,
    min_clip_len_ms: int,
    max_clip_len_ms: int | None,
) -> list["AudioSegment"]:
    from pydub.silence import detect_nonsilent

    non_silent_ranges = detect_nonsilent(
        audio,
        min_silence_len=min_silence_len_ms,
        silence_thresh=silence_thresh_dbfs,
        seek_step=seek_step_ms,
    )

    clips: list["AudioSegment"] = []
    for start_ms, end_ms in non_silent_ranges:
        padded_start = _clamp_int(start_ms - keep_silence_ms, 0, len(audio))
        padded_end = _clamp_int(end_ms + keep_silence_ms, 0, len(audio))
        if padded_end <= padded_start:
            continue

        clip = audio[padded_start:padded_end]
        if len(clip) < min_clip_len_ms:
            continue
        if max_clip_len_ms is not None and len(clip) > max_clip_len_ms:
            continue
        clips.append(clip)

    return clips


def _normalize_marker_text(text: str) -> str:
    return " ".join("".join(ch.lower() if ch.isalnum() else " " for ch in text).split())


def _detect_lesson_boundaries_whisper(
    input_path: Path,
    *,
    markers: list[str],
    model_name: str,
    language: str | None,
    min_gap_s: float,
) -> list[tuple[str, int]]:
    """
    Returns a list of (marker, start_ms) ordered by first appearance.
    Uses segment-level timestamps (good enough for cutting "lesson two" intros).
    """
    try:
        import whisper  # type: ignore
    except Exception as e:  # pragma: no cover
        raise SystemExit(
            "STT requested but `openai-whisper` is not installed.\n"
            "Install: pip install -U openai-whisper\n"
            f"Import error: {e}"
        )

    model = whisper.load_model(model_name)

    # Whisper is generally happiest with standard audio formats; we pass the original file path.
    # (ffmpeg must be available, which this script already ensures.)
    result = model.transcribe(
        str(input_path),
        language=language,
        task="transcribe",
        fp16=False,
        verbose=False,
    )

    normalized_markers = [(m, _normalize_marker_text(m)) for m in markers]
    found: list[tuple[str, int]] = []
    last_ms = -10_000_000
    min_gap_ms = int(max(0.0, min_gap_s) * 1000)

    for seg in result.get("segments", []) or []:
        seg_text = _normalize_marker_text(seg.get("text", ""))
        if not seg_text:
            continue

        seg_start_ms = int(float(seg.get("start", 0.0)) * 1000)
        if seg_start_ms - last_ms < min_gap_ms:
            continue

        for original, normalized in normalized_markers:
            if normalized and normalized in seg_text:
                found.append((original, seg_start_ms))
                last_ms = seg_start_ms
                break

    # De-dupe markers while keeping first occurrence
    seen: set[str] = set()
    deduped: list[tuple[str, int]] = []
    for marker, start_ms in found:
        key = _normalize_marker_text(marker)
        if key in seen:
            continue
        seen.add(key)
        deduped.append((marker, start_ms))
    return deduped


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Detect silence in a long audio file and export numbered MP3 clips.",
        epilog=(
            "Examples:\n"
            "  python tools\\split_lesson_audio.py --input audio\\raw\\lesson1.mp3 --lesson lesson1\n"
            "  python tools\\split_lesson_audio.py --input audio\\raw\\lesson1.mp3 --output public\\audio\n"
            "  python tools\\split_lesson_audio.py --dry-run\n"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--ffmpeg",
        default=None,
        help=(
            "Path to ffmpeg executable (e.g. C:\\ffmpeg\\bin\\ffmpeg.exe). "
            "If omitted, script looks for ffmpeg on PATH."
        ),
    )
    parser.add_argument(
        "--ffprobe",
        default=None,
        help=(
            "Path to ffprobe executable. If omitted, script looks on PATH; "
            "if --ffmpeg is provided, also tries to use a sibling ffprobe.exe."
        ),
    )
    parser.add_argument(
        "--input",
        required=False,
        help="Input audio path (e.g. audio\\raw\\lesson1.mp3)",
    )
    parser.add_argument(
        "--silence-only",
        action="store_true",
        help=(
            "Ignore lesson boundaries and split by silence only into a single sequence "
            "(equivalent to --stt none)."
        ),
    )
    parser.add_argument(
        "--stt",
        default="none",
        choices=["none", "whisper"],
        help="Use STT to detect lesson boundaries (default: none).",
    )
    parser.add_argument(
        "--stt-model",
        default="small",
        help="Whisper model name (default: small).",
    )
    parser.add_argument(
        "--stt-language",
        default="en",
        help="STT language code (default: en). Use empty string for auto-detect.",
    )
    parser.add_argument(
        "--lesson-markers",
        default="lesson one,lesson two,lesson three,lesson four,lesson five",
        help=(
            "Comma-separated phrases that indicate lesson starts (default: "
            "\"lesson one,lesson two,...\")."
        ),
    )
    parser.add_argument(
        "--marker-min-gap",
        type=float,
        default=30.0,
        help="Minimum gap between detected markers, in seconds (default: 30).",
    )
    parser.add_argument(
        "--lesson",
        required=False,
        help=(
            "Lesson prefix for output files (e.g. lesson1 -> lesson1_01.mp3). "
            "Ignored when --stt is enabled (lesson1, lesson2... are auto-assigned)."
        ),
    )
    parser.add_argument(
        "--output",
        default=os.path.join("public", "audio"),
        help="Output directory (default: public\\audio)",
    )
    parser.add_argument(
        "--format",
        default="mp3",
        choices=["mp3", "wav", "ogg", "flac"],
        help="Export format (default: mp3)",
    )
    parser.add_argument(
        "--bitrate",
        default="192k",
        help="MP3 bitrate (default: 192k). Ignored for non-mp3 formats.",
    )
    parser.add_argument(
        "--min-silence-len",
        type=int,
        default=350,
        help="Minimum silence length to be treated as a split point, in ms (default: 350).",
    )
    parser.add_argument(
        "--silence-thresh",
        type=float,
        default=None,
        help=(
            "Silence threshold in dBFS (e.g. -38). "
            "Default: (audio.dBFS - 16)."
        ),
    )
    parser.add_argument(
        "--seek-step",
        type=int,
        default=1,
        help="Step size for silence detection scan, in ms (default: 1).",
    )
    parser.add_argument(
        "--keep-silence",
        type=int,
        default=120,
        help="Keep this much leading/trailing silence around each clip, in ms (default: 120).",
    )
    parser.add_argument(
        "--min-clip-len",
        type=int,
        default=250,
        help="Drop clips shorter than this, in ms (default: 250).",
    )
    parser.add_argument(
        "--max-clip-len",
        type=int,
        default=None,
        help="Drop clips longer than this, in ms (default: no limit).",
    )
    parser.add_argument(
        "--start-index",
        type=int,
        default=1,
        help="Starting number for suffix (default: 1).",
    )
    parser.add_argument(
        "--pad",
        type=int,
        default=2,
        help="Zero-pad width for suffix numbers (default: 2 -> 01, 02...).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Detect and report clips, but do not export files.",
    )

    args = parser.parse_args()

    ffmpeg_path: str | None
    if args.ffmpeg:
        ffmpeg_candidate = Path(args.ffmpeg)
        if not ffmpeg_candidate.exists():
            raise SystemExit(f"--ffmpeg not found: {ffmpeg_candidate}")
        ffmpeg_path = str(ffmpeg_candidate)
    else:
        ffmpeg_path = shutil.which("ffmpeg") or shutil.which("ffmpeg.exe")

    if not ffmpeg_path:
        raise SystemExit(
            "ffmpeg not found on PATH.\n"
            "- Install ffmpeg (Windows: winget install Gyan.FFmpeg)\n"
            "- Then re-open your terminal, and try again.\n"
            "Tip: `where ffmpeg` should print a path."
        )

    ffprobe_path: str | None
    if args.ffprobe:
        ffprobe_candidate = Path(args.ffprobe)
        if not ffprobe_candidate.exists():
            raise SystemExit(f"--ffprobe not found: {ffprobe_candidate}")
        ffprobe_path = str(ffprobe_candidate)
    else:
        ffprobe_path = shutil.which("ffprobe") or shutil.which("ffprobe.exe")
        if not ffprobe_path and args.ffmpeg:
            sibling = Path(args.ffmpeg).with_name("ffprobe.exe")
            if sibling.exists():
                ffprobe_path = str(sibling)

    if not ffprobe_path:
        raise SystemExit(
            "ffprobe not found on PATH (required by pydub for reading metadata).\n"
            "- If you installed ffmpeg, make sure ffprobe.exe is in the same bin folder.\n"
            "- Or pass --ffprobe \"C:\\path\\to\\ffprobe.exe\"\n"
            "Tip: `where ffprobe` should print a path."
        )

    # pydub's probing (mediainfo_json -> get_prober_name) uses PATH lookups.
    # Ensure the ffmpeg bin directory is on PATH so ffprobe can be found.
    ffmpeg_bin = str(Path(ffmpeg_path).parent)
    current_path = os.environ.get("PATH", "")
    if ffmpeg_bin not in current_path.split(os.pathsep):
        os.environ["PATH"] = ffmpeg_bin + os.pathsep + current_path

    from pydub import AudioSegment

    input_path: Path
    if args.input:
        input_path = Path(args.input)
    else:
        candidates = sorted(Path("audio").joinpath("raw").glob("*.mp3"))
        if len(candidates) == 1:
            input_path = candidates[0]
            print(f"--input not provided; using {input_path}")
        elif len(candidates) == 0:
            raise SystemExit(
                "--input not provided and no '*.mp3' found under audio\\raw\\\n"
                "Provide --input (e.g. --input audio\\raw\\lesson1.mp3)."
            )
        else:
            shown = "\n".join(f"- {c}" for c in candidates[:20])
            raise SystemExit(
                "--input not provided; multiple MP3 files found under audio\\raw\\\n"
                f"{shown}\n"
                "Please specify one with --input."
            )

    if not input_path.exists():
        raise SystemExit(f"Input not found: {input_path}")

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    markers = [m.strip() for m in str(args.lesson_markers).split(",") if m.strip()]
    stt_language: str | None = str(args.stt_language)
    if stt_language == "":
        stt_language = None

    effective_stt = "none" if args.silence_only else args.stt

    # Ensure pydub uses the chosen ffmpeg/ffprobe (conversion path).
    AudioSegment.converter = ffmpeg_path
    AudioSegment.ffprobe = ffprobe_path

    audio = AudioSegment.from_file(input_path)

    # If the file is essentially silent, dBFS can be -inf.
    if not math.isfinite(audio.dBFS):
        raise SystemExit("Input audio appears to be silent (dBFS = -inf).")

    silence_thresh = args.silence_thresh
    if silence_thresh is None:
        silence_thresh = audio.dBFS - 16

    lesson_ranges: list[tuple[str, int, int]] = []
    if effective_stt != "none":
        if effective_stt == "whisper":
            boundaries = _detect_lesson_boundaries_whisper(
                input_path,
                markers=markers,
                model_name=str(args.stt_model),
                language=stt_language,
                min_gap_s=float(args.marker_min_gap),
            )
        else:  # pragma: no cover
            boundaries = []

        if not boundaries:
            raise SystemExit(
                "STT enabled but no lesson markers were detected.\n"
                "- Try changing --lesson-markers (exact phrases spoken)\n"
                "- Or set --stt-language \"\" to auto-detect\n"
                "- Or use a larger --stt-model (e.g. medium)\n"
            )

        # Convert boundaries into contiguous ranges.
        # We assign lesson numbers in the order markers were detected (lesson1, lesson2...).
        starts = sorted({ms for _, ms in boundaries})
        # Ensure the first lesson starts at 0ms if the first marker is near the beginning.
        if starts and starts[0] > 5_000:
            starts = [0] + starts

        for idx, start_ms in enumerate(starts, start=1):
            end_ms = starts[idx] if idx < len(starts) else len(audio)
            lesson_ranges.append((f"lesson{idx}", start_ms, end_ms))

        print("Detected lesson boundaries (ms):")
        for name, start_ms, end_ms in lesson_ranges:
            print(f"- {name}: {start_ms} -> {end_ms}")
    else:
        lesson_prefix = args.lesson or input_path.stem
        if not lesson_prefix:
            raise SystemExit("--lesson is required (or input filename must have a stem).")
        lesson_ranges.append((lesson_prefix, 0, len(audio)))

    total_ms = len(audio)
    for lesson_prefix, start_ms, end_ms in lesson_ranges:
        lesson_audio = audio[start_ms:end_ms]
        clips = split_on_detected_silence(
            lesson_audio,
            min_silence_len_ms=max(1, args.min_silence_len),
            silence_thresh_dbfs=float(silence_thresh),
            seek_step_ms=max(1, args.seek_step),
            keep_silence_ms=max(0, args.keep_silence),
            min_clip_len_ms=max(1, args.min_clip_len),
            max_clip_len_ms=args.max_clip_len if args.max_clip_len else None,
        )

        if not clips:
            print(
                f"No clips found for {lesson_prefix}. "
                "Try adjusting --silence-thresh or --min-silence-len."
            )
            continue

        clips_ms = sum(len(c) for c in clips)
        print(
            f"{lesson_prefix}: Detected {len(clips)} clips "
            f"(kept {clips_ms/1000:.1f}s out of {total_ms/1000:.1f}s)."
        )

        if args.dry_run:
            for i, clip in enumerate(clips, start=args.start_index):
                name = f"{lesson_prefix}_{i:0{args.pad}d}.{args.format}"
                print(f"[dry-run] {name} ({len(clip)}ms)")
            continue

        for i, clip in enumerate(clips, start=args.start_index):
            filename = f"{lesson_prefix}_{i:0{args.pad}d}.{args.format}"
            out_path = output_dir / filename

            export_kwargs: dict[str, object] = {}
            if args.format == "mp3":
                export_kwargs["bitrate"] = args.bitrate

            clip.export(out_path, format=args.format, **export_kwargs)
            print(f"Wrote {out_path} ({len(clip)}ms)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())


# py -3.12 tools\\split_lesson_audio.py --stt whisper --stt-model small --lesson-markers "lesson one,lesson two,lesson three,lesson four,lesson five,lesson six,lesson seven,lesson eight,lesson nine,lesson ten,lesson eleven,lesson twelve,lesson thirteen,lesson fourteen,lesson fifteen,lesson sixteen,lesson seventeen,lesson eighteen,lesson nineteen,lesson twenty,lesson twenty-one,lesson twenty-two,lesson twenty-three,lesson twenty-four,lesson twenty-five,lesson twenty-six,lesson twenty-seven,lesson twenty-eight,lesson twenty-nine,lesson thirty,lesson thirty-one,lesson thirty-two,lesson thirty-three,lesson thirty-four,lesson thirty-five,lesson thirty-six,lesson thirty-seven" --ffmpeg "C:\\Users\\kimdain\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1-full_build\\bin\\ffmpeg.exe" --ffprobe "C:\\Users\\kimdain\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1-full_build\\bin\\ffprobe.exe" --input "D:\\workspace\\nepali-bloom\\audio_file\\Basic Course in Spoken Nepali-1.mp3"
# py -3.12 tools\\split_lesson_audio.py --silence-only --ffmpeg "C:\\Users\\kimdain\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1-full_build\\bin\\ffmpeg.exe" --ffprobe "C:\\Users\\kimdain\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1-full_build\\bin\\ffprobe.exe" --input "D:\\workspace\\nepali-bloom\\audio_file\\Basic Course in Spoken Nepali-1.mp3"
