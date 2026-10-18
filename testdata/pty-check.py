"""Exercise real Pi with a local provider, using an isolated tmux server and config.
Requires pi, tmux and Python 3. No model credentials or Python packages are needed.
Run from the package root: python3 testdata/pty-check.py
"""
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)
SOCKET = "animation-check-" + str(os.getpid())


def tmux(*args):
    return subprocess.check_output(["tmux", "-L", SOCKET, "-f", "/dev/null", *args], text=True)


def pane():
    return tmux("capture-pane", "-p", "-e", "-t", "check:0.0")


def plain(text):
    return re.sub(r"\x1b\[[0-9;?]*[a-zA-Z]", "", text)


def wait_for(check, label, timeout=12):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        text = pane()
        if check(plain(text)):
            return text
        time.sleep(0.1)
    (ARTIFACTS / "pty-failure.ansi").write_text(pane())
    raise AssertionError("Timed out: " + label)


def send(text):
    tmux("send-keys", "-t", "check:0.0", "-l", text)
    tmux("send-keys", "-t", "check:0.0", "Enter")
    if text.startswith("/animation "):
        # Pi's first Enter accepts the argument completion; the second submits the command.
        tmux("send-keys", "-t", "check:0.0", "Enter")


def capture(name):
    text = pane()
    (ARTIFACTS / (name + ".ansi")).write_text(text)
    (ARTIFACTS / (name + ".txt")).write_text(plain(text))
    return text


def block_lines(text):
    return [line for line in plain(text).splitlines() if len(re.findall("[▀▄█]", line)) >= 20]


def has_blocks(text):
    return bool(block_lines(text))


def ocean_signature(text):
    return [line for line in block_lines(text) if "▀" in line]


def has_ocean(text):
    return bool(ocean_signature(text))


def run(mode, config):
    command = ["pi", "--offline", "--no-approve", "--no-extensions",
               "--no-skills", "--no-prompt-templates", "--no-context-files",
               "--extension", str(ROOT / "index.ts"),
               "--extension", str(ROOT / "test/provider.ts"),
               "--model", "animation-test/fixture", "--tui-mode", mode]
    env = ["env", "PI_CODING_AGENT_DIR=" + config, "COLORTERM=truecolor", "TERM=xterm-256color"]
    tmux("new-session", "-d", "-s", "check", "-x", "90", "-y", "38", "-c", str(ROOT), shlex.join(env + command))
    tmux("pipe-pane", "-t", "check:0.0", "cat > " + shlex.quote(str(ARTIFACTS / (mode + "-raw.ansi"))))
    wait_for(lambda text: "fixture" in text.lower(), "startup")
    send("/animation preview")
    wait_for(lambda text: "Preview" in text and has_blocks(text), "colored Aurora preview")
    first = capture(mode + "-preview-1")
    time.sleep(0.7)
    second = capture(mode + "-preview-2")
    assert first != second, "Aurora preview did not animate"
    assert re.search(r"\x1b\[38;[25];", second), "No terminal colors in preview"
    tmux("send-keys", "-t", "check:0.0", "x")
    wait_for(lambda text: "Preview" not in text and not has_blocks(text), "preview cleanup")

    send("long-test")
    wait_for(lambda text: "Working" in text and has_blocks(text), "working Aurora animation")
    capture(mode + "-working")
    tmux("resize-window", "-t", "check:0", "-x", "240", "-y", "38")
    wide = wait_for(lambda text: any(re.search("[▀▄█]", line[220:]) for line in text.splitlines()), "Aurora expands beyond 220 columns")
    capture(mode + "-wide")
    assert all(len(line.rstrip()) <= 240 for line in plain(wide).splitlines()), "Wide output overflow"
    tmux("resize-window", "-t", "check:0", "-x", "24", "-y", "30")
    time.sleep(0.5)
    narrow = capture(mode + "-narrow")
    assert has_blocks(narrow)
    assert all(len(line.rstrip()) <= 24 for line in plain(narrow).splitlines()), "Narrow output overflow"
    tmux("send-keys", "-t", "check:0.0", "Escape")
    wait_for(lambda text: "aborted" in text.lower() and not re.search(r"─.*Working", text) and not has_blocks(text), "abort cleanup")
    capture(mode + "-aborted")
    tmux("resize-window", "-t", "check:0", "-x", "90", "-y", "38")
    send("/animation ocean")
    wait_for(lambda text: "Working animation: ocean" in text, "ocean selection")
    send("/reload")
    time.sleep(1)
    send("/animation preview")
    wait_for(lambda text: "Preview" in text and has_ocean(text), "selected Ocean preview after reload")
    first = capture(mode + "-ocean-1")
    time.sleep(0.5)
    second = capture(mode + "-ocean-2")
    assert ocean_signature(first) != ocean_signature(second), "Persisted Ocean pixels did not animate after reload"
    assert all(not re.search(r"[.:-=+*#%@]{8}", line) for line in ocean_signature(second)), "Ocean output contains ASCII density shading"
    ocean_ansi_lines = [line for line in second.splitlines() if len(re.findall("▀", line)) >= 20]
    assert any(re.search(r"\x1b\[38;2;", line) and re.search(r"\x1b\[[0-9;]*48;2;", line) for line in ocean_ansi_lines), "Ocean cells lack foreground or background truecolor"
    ocean_colors = {color for line in ocean_ansi_lines for color in re.findall(r"\x1b\[(?:38|48);2;(\d+);(\d+);(\d+)m", line)}
    assert len(ocean_colors) >= 10, "Ocean lacks distinct underwater color contours"
    assert max(int(color[2]) for color in ocean_colors) - min(int(color[2]) for color in ocean_colors) >= 120, "Ocean lacks both cyan and deep-blue colors"
    tmux("resize-window", "-t", "check:0", "-x", "240", "-y", "38")
    wide_ocean = wait_for(lambda text: "Preview" in text and any("▀" in line[220:] for line in plain(text).splitlines()), "wide Ocean output")
    assert all(len(line.rstrip()) <= 240 for line in plain(wide_ocean).splitlines()), "Wide Ocean preview overflow"
    tmux("resize-window", "-t", "check:0", "-x", "24", "-y", "30")
    narrow_ocean = wait_for(lambda text: "Preview" in text and has_ocean(text), "narrow Ocean preview")
    assert all(len(line.rstrip()) <= 24 for line in plain(narrow_ocean).splitlines()), "Narrow Ocean preview overflow"
    tmux("resize-window", "-t", "check:0", "-x", "90", "-y", "38")
    tmux("send-keys", "-t", "check:0.0", "x")
    wait_for(lambda text: "Preview" not in text, "Ocean preview cleanup")
    send("/animation aurora")
    wait_for(lambda text: "Working animation: aurora" in text, "animation enabled")
    send("tool-test")
    wait_for(lambda text: "tool-ok" in text, "tool result")
    wait_for(lambda text: "fixture-ok" in text and not re.search(r"─.*Working", text) and not has_blocks(text), "settled cleanup")
    capture(mode + "-tool-settled")
    send("/animation off")
    wait_for(lambda text: "Working animation: off" in text, "off selection")
    send("long-test")
    wait_for(lambda text: re.search(r"─.*Working", text) and "deliberately" in text, "native working indicator")
    assert not has_blocks(capture(mode + "-off")), "Off mode still drew Aurora"
    tmux("send-keys", "-t", "check:0.0", "Escape")
    wait_for(lambda text: not re.search(r"─.*Working", text), "off abort")
    tmux("kill-session", "-t", "check")
    print(mode + ": preview, motion, colors, resize, abort, reload, selection, tool, settle and off passed", flush=True)


try:
    with tempfile.TemporaryDirectory(prefix="pi-aurora-check-") as config:
        Path(config, "settings.json").write_text(json.dumps({"theme": "dark"}))
        env = {**os.environ, "PI_CODING_AGENT_DIR": config}
        subprocess.run(["pi", "install", str(ROOT)], env=env, check=True)
        installed = subprocess.check_output(["pi", "list"], env=env, text=True)
        assert str(ROOT) in installed
        (ARTIFACTS / "local-install.txt").write_text(installed)
        for mode in ["regular", "fullscreen"]:
            run(mode, config)
finally:
    subprocess.run(["tmux", "-L", SOCKET, "kill-server"], capture_output=True)
