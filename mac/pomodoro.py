#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""
A pomodoro timer that turns on a macOS Focus mode for the duration of the
session, then turns it off and shows a centered "time's up" modal.

Focus toggling is done through the macOS Shortcuts app, since macOS has no
supported CLI for Focus. You create two shortcuts per Focus mode you want to
use (an "On" and an "Off"); this script just invokes them by name. Run with
--setup for step-by-step instructions.

Usage:
    ./pomodoro.py                       # 25 min, Do Not Disturb
    ./pomodoro.py -m 50                 # 50 min session
    ./pomodoro.py -f "Work"             # use a Focus named "Work"
    ./pomodoro.py --no-focus            # just the timer, no Focus toggling
    ./pomodoro.py --setup               # print shortcut setup instructions
"""

import argparse
import re
import signal
import subprocess
import sys
import time


def parse_duration(text: str) -> float:
    """Parse a duration into seconds.

    A bare number is minutes ("25" -> 25 min) for backwards compatibility;
    otherwise a unit string like "90s", "1h30m", "15s" is accepted.
    """
    s = text.strip().lower()
    try:
        return float(s) * 60  # bare number == minutes
    except ValueError:
        pass
    if not re.fullmatch(r"(\d+(?:\.\d+)?\s*[hms]\s*)+", s):
        raise argparse.ArgumentTypeError(
            f"invalid duration: {text!r} (use e.g. 25, 25m, 1h30m, 90s)"
        )
    units = {"h": 3600, "m": 60, "s": 1}
    return sum(float(a) * units[u] for a, u in re.findall(r"(\d+(?:\.\d+)?)\s*([hms])", s))


def format_duration(seconds: float) -> str:
    """Human-friendly label, e.g. '25 minutes', '1 hour 30 minutes', '15 seconds'."""
    total = int(round(seconds))
    parts = []
    for amount, unit in ((total // 3600, "hour"), (total % 3600 // 60, "minute"),
                         (total % 60, "second")):
        if amount:
            parts.append(f"{amount} {unit}" + ("s" if amount != 1 else ""))
    return " ".join(parts) or "0 seconds"


def shortcut_names(focus: str) -> tuple[str, str]:
    """The On/Off shortcut names this script expects for a given Focus."""
    return (f"{focus} On", f"{focus} Off")


def list_shortcuts() -> set[str]:
    try:
        out = subprocess.run(
            ["shortcuts", "list"], capture_output=True, text=True, check=True
        )
        return {line.strip() for line in out.stdout.splitlines() if line.strip()}
    except (subprocess.CalledProcessError, FileNotFoundError):
        return set()


def run_shortcut(name: str) -> None:
    subprocess.run(["shortcuts", "run", name], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def print_setup(focus: str) -> None:
    on, off = shortcut_names(focus)
    print(f"""\
Focus toggling uses the macOS Shortcuts app. Create these two shortcuts:

  1. Open the Shortcuts app, click + to make a new shortcut.
  2. Add the "Set Focus" action.
  3. Configure it to: Turn  Do Not Disturb  On   (pick your Focus: "{focus}")
  4. Name the shortcut exactly:  {on!r}
  5. Repeat for a second shortcut that turns the Focus Off, named:  {off!r}

To use a different Focus mode, create the same pair named "<Focus> On" /
"<Focus> Off" and pass it with -f, e.g.  -f "Work".

Then re-run this script. Use --no-focus to skip Focus toggling entirely.""")


def show_done_modal(duration_label: str) -> None:
    """Centered, always-on-top modal that blocks until dismissed."""
    script = f'''
    tell application "System Events"
        activate
        display dialog "Your {duration_label} focus session is over." \
            with title "⏱  Focus Time Over" buttons {{"Done"}} default button "Done" \
            with icon note
    end tell
    '''
    # Play a sound in the background so it fires immediately alongside the modal.
    subprocess.Popen(["afplay", "/System/Library/Sounds/Glass.aiff"])
    subprocess.run(["osascript", "-e", script],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def countdown(total_seconds: int, quiet: bool = False) -> None:
    end = time.monotonic() + total_seconds
    while True:
        remaining = round(end - time.monotonic())
        if remaining <= 0:
            break
        if not quiet:
            hrs, rem = divmod(remaining, 3600)
            mins, secs = divmod(rem, 60)
            clock = f"{hrs}:{mins:02d}:{secs:02d}" if hrs else f"{mins:02d}:{secs:02d}"
            print(f"\r  Focusing… {clock} remaining ", end="", flush=True)
        # Sleep until the next whole-second boundary so the display stays crisp.
        time.sleep(min(1.0, end - time.monotonic()))
    if not quiet:
        print("\r" + " " * 40 + "\r", end="", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="A focus-mode pomodoro timer for macOS.")
    parser.add_argument("-m", "--minutes", "-d", "--duration", dest="seconds",
                        type=parse_duration, default=25 * 60, metavar="DURATION",
                        help="session length: a bare number is minutes, or use "
                             "units like 90s, 25m, 1h30m (default: 25m)")
    parser.add_argument("-f", "--focus", default="Do Not Disturb",
                        help='Focus mode to enable (default: "Do Not Disturb")')
    parser.add_argument("--no-focus", action="store_true",
                        help="run the timer without toggling any Focus mode")
    parser.add_argument("-q", "--quiet", action="store_true",
                        help="suppress timer/status output (the end modal still shows)")
    parser.add_argument("--setup", action="store_true",
                        help="print Shortcuts setup instructions and exit")
    args = parser.parse_args()

    if args.setup:
        print_setup(args.focus)
        return 0

    on, off = shortcut_names(args.focus)
    use_focus = not args.no_focus

    if use_focus:
        existing = list_shortcuts()
        missing = [s for s in (on, off) if s not in existing]
        if missing:
            print(f"Missing Shortcuts: {', '.join(repr(m) for m in missing)}\n")
            print_setup(args.focus)
            return 1

    focus_on = False

    def restore_focus() -> None:
        nonlocal focus_on
        if focus_on:
            try:
                run_shortcut(off)
            except subprocess.CalledProcessError:
                print(f"\n⚠️  Failed to turn off Focus — disable {args.focus!r} manually.")
            focus_on = False

    # Make sure an interrupt or kill still turns Focus back off.
    def on_signal(signum, frame):
        print("\nInterrupted.")
        restore_focus()
        sys.exit(130)

    signal.signal(signal.SIGINT, on_signal)
    signal.signal(signal.SIGTERM, on_signal)

    if use_focus:
        run_shortcut(on)
        focus_on = True
        if not args.quiet:
            print(f"🔕  {args.focus} on.")

    try:
        countdown(int(round(args.seconds)), quiet=args.quiet)
    finally:
        restore_focus()

    show_done_modal(format_duration(args.seconds))
    if not args.quiet:
        print("✅  Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
