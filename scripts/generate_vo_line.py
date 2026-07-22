"""
Generate one Keeper VO line with the LOCKED voice: Kokoro TTS, voice "am_michael"
(the American-male "Michael" voice), 0.65x speed, natural pitch.

Runs entirely on this machine (installed 2026-07-21) -- no rate limit, no website,
works offline after the one-time model download. See
site/_content/keeper-vo-script.md -> "Voice production notes" for full context and
the separate pause-insertion step this does NOT do (run that by hand afterward,
per-line, since where the extra pause belongs depends on the sentence).

MUST be run with the Python 3.12 install, not the default Python 3.13 -- Kokoro's
numpy pin (numpy==1.26.4) has no prebuilt wheel for 3.13 and fails to build from
source on this machine (broken MSVC toolchain). Python 3.12 has prebuilt wheels for
everything, so just works.

Usage (from anywhere, using the exact interpreter path):
  "C:\\Users\\danhe\\AppData\\Local\\Programs\\Python\\Python312\\python.exe" generate_vo_line.py "Some line of text." out.wav
  "C:\\Users\\danhe\\AppData\\Local\\Programs\\Python\\Python312\\python.exe" generate_vo_line.py "Some line." out.wav --speed 0.7 --voice am_michael

First run only: downloads the ~82M-parameter model + an English NLP model
(en_core_web_sm) to the Hugging Face cache and pip's local package dir --
one-time, then fully offline.
"""
import argparse
import sys

from kokoro import KPipeline
import soundfile as sf


def main():
    parser = argparse.ArgumentParser(description="Generate one Keeper VO line locally with Kokoro.")
    parser.add_argument("text", help="The line to speak, exactly as it should be captioned.")
    parser.add_argument("out_wav", help="Output .wav path.")
    # CORRECTED 2026-07-22: fingerprint analysis proved the Dan-approved reference is
    # bm_george @ 0.8 — the old am_michael/0.65 defaults were mis-recorded lore.
    parser.add_argument("--voice", default="bm_george", help="Kokoro voice id (default: bm_george, the TRUE locked Keeper voice).")
    parser.add_argument("--speed", type=float, default=0.8, help="Speed multiplier (default: 0.8, the locked pace).")
    args = parser.parse_args()

    pipeline = KPipeline(lang_code="a")  # 'a' = American English
    generator = pipeline(args.text, voice=args.voice, speed=args.speed)

    wrote = False
    for i, result in enumerate(generator):
        # Kokoro can split very long text into multiple chunks; VO lines are short
        # so this normally yields exactly one chunk. If it ever yields more than
        # one, each gets its own numbered file -- concatenate them by hand.
        path = args.out_wav if i == 0 else args.out_wav.replace(".wav", f"_{i}.wav")
        sf.write(path, result.audio, 24000)
        print(f"wrote {path} ({len(result.audio) / 24000:.2f}s)")
        wrote = True

    if not wrote:
        print("ERROR: Kokoro produced no audio for this text.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
