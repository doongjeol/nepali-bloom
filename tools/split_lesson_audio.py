#!/usr/bin/env python3
from __future__ import annotations
import argparse
import math
import os
import shutil
import sys
from pathlib import Path

# ⚠️ Pydub 임포트 전후로 경로 설정을 확실히 하기 위해 위치 조정
from pydub import AudioSegment
from pydub.silence import detect_nonsilent


def _clamp_int(value: int, min_value: int, max_value: int) -> int:
    return max(min_value, min(max_value, int(value)))


def split_on_detected_silence(
        audio: AudioSegment,
        *,
        min_silence_len_ms: int,
        silence_thresh_dbfs: float,
        seek_step_ms: int,
        keep_silence_ms: int,
        min_clip_len_ms: int,
        max_clip_len_ms: int | None,
) -> list[AudioSegment]:
    non_silent_ranges = detect_nonsilent(
        audio,
        min_silence_len=min_silence_len_ms,
        silence_thresh=silence_thresh_dbfs,
        seek_step=seek_step_ms,
    )
    clips: list[AudioSegment] = []
    for start_ms, end_ms in non_silent_ranges:
        padded_start = _clamp_int(start_ms - keep_silence_ms, 0, len(audio))
        padded_end = _clamp_int(end_ms + keep_silence_ms, 0, len(audio))
        if padded_end <= padded_start: continue
        clip = audio[padded_start:padded_end]
        if len(clip) < min_clip_len_ms: continue
        if max_clip_len_ms is not None and len(clip) > max_clip_len_ms: continue
        clips.append(clip)
    return clips


def process_single_file(input_path: Path, args, ffmpeg_path, ffprobe_path):
    AudioSegment.converter = ffmpeg_path
    from pydub import utils
    utils.get_prober_name = lambda: ffprobe_path

    print(f"\n--- Processing: {input_path.name} ---")
    try:
        audio = AudioSegment.from_file(str(input_path))
    except Exception as e:
        print(f"Error loading {input_path.name}: {e}")
        return

    silence_thresh = args.silence_thresh if args.silence_thresh is not None else audio.dBFS - 16

    # ⚠️ 수정 포인트: --lesson이 없으면 원본 파일명(stem)을 사용
    prefix = args.lesson if args.lesson else input_path.stem

    clips = split_on_detected_silence(
        audio,
        min_silence_len_ms=max(1, args.min_silence_len),
        silence_thresh_dbfs=float(silence_thresh),
        seek_step_ms=max(1, args.seek_step),
        keep_silence_ms=max(0, args.keep_silence),
        min_clip_len_ms=max(1, args.min_clip_len),
        max_clip_len_ms=args.max_clip_len
    )

    if not clips:
        print(f"No clips found for {input_path.name}.")
        return

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    for i, clip in enumerate(clips, start=args.start_index):
        # ⚠️ 결과물 파일명 규칙: [원래파일명]_[번호].mp3
        filename = f"{prefix}_{i:0{args.pad}d}.{args.format}"
        out_path = output_dir / filename
        clip.export(out_path, format=args.format, bitrate=args.bitrate if args.format == "mp3" else None)
        print(f"Wrote {out_path} ({len(clip)}ms)")


def main() -> int:
    parser = argparse.ArgumentParser(description="Split audio files by silence.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", default="public/audio")
    parser.add_argument("--lesson")
    parser.add_argument("--silence-only", action="store_true")
    parser.add_argument("--min-silence-len", type=int, default=350)
    parser.add_argument("--silence-thresh", type=float, default=None)
    parser.add_argument("--keep-silence", type=int, default=120)
    parser.add_argument("--min-clip-len", type=int, default=250)
    parser.add_argument("--max-clip-len", type=int, default=None)
    parser.add_argument("--start-index", type=int, default=1)
    parser.add_argument("--pad", type=int, default=2)
    parser.add_argument("--format", default="mp3")
    parser.add_argument("--bitrate", default="192k")
    parser.add_argument("--ffmpeg", required=True)
    parser.add_argument("--ffprobe", required=True)
    parser.add_argument("--seek-step", type=int, default=1)

    args = parser.parse_args()

    # 경로를 절대 경로로 변환하여 전달
    ffmpeg_path = str(Path(args.ffmpeg).absolute())
    ffprobe_path = str(Path(args.ffprobe).absolute())

    # Pydub 글로벌 설정
    AudioSegment.converter = ffmpeg_path

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Path not found: {input_path}")
        return 1

    if input_path.is_dir():
        files = sorted(list(input_path.glob("*.mp3")) + list(input_path.glob("*.wav")))
        for f in files:
            process_single_file(f, args, ffmpeg_path, ffprobe_path)
    else:
        process_single_file(input_path, args, ffmpeg_path, ffprobe_path)

    return 0


if __name__ == "__main__":
    sys.exit(main())