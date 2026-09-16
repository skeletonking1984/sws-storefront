"""
Choose each article's hero widget from what the ARTICLE IS ABOUT.

Todd, 2026-09-15: "each blog needs a relevant image. like if it talks about a
widget, should be somewhere in the hero, same with chat."

The previous mapping was hand-written and then shuffled to spread widget usage,
which optimised the wrong thing: an article titled "Why Every Twitch Streamer
Should Have a Goal Widget" ended up showing a chat box. Relevance is the
constraint; variety only breaks ties inside the relevant set.

    python3 assign_widgets.py            report what would change
    python3 assign_widgets.py --apply    rewrite map.json
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
STAGE = "/Users/todd/Documents/orgs/SWS/repos/sws-widget-stage/widgets"

# Candidate pools, ordered best first. Every id verified against the stage.
GOAL_ANY = ["moon-jar-goal", "star-goal", "potion-bottle-1", "lotus-glass-goal",
            "potion-bottle-4", "lotus-butterfly-goal", "celestial-moon-goal"]
GOAL_CELESTIAL = ["celestial-moon-goal", "moon-jar-goal", "star-goal"]
MULTI = ["multistreamchatwidget-final", "sws-neon-multichat", "celestial-multistream-chat"]
CHAT_CELESTIAL = ["celestial-multistream-chat", "moonflower-chat", "lotus-glass-chat", "sparkling-chat"]
# cyber-bear-chat-h (1830x551, 3.3:1) and khepri-chat (2200x983, 2.2:1) are
# deliberately NOT here. build_heroes.py rejects anything past 2:1 because it
# shrinks to an illegible sliver in the art zone, and a widget this picker
# chooses but the builder then drops leaves the article with NO hero at all,
# silently keeping its old one. Candidates must satisfy both stages.
CHAT_NEON = ["neon-chat", "sws-neon-multichat", "cyber-bear-chat", "soul-blade-chat", "waylay-chat"]
CHAT_COZY = ["froggy-starlight", "lotus-butterfly-chat", "blueberry-milk-chat", "cloud-chat"]
CHAT_PASTEL = ["pastel-chat", "blueberry-milk-chat", "y2k-chat", "gradient-cloud-chat"]
CHAT_SPOOKY = ["spooky-neon-chat", "halloween-chat", "tarot-chat", "alchemist-chat"]
CHAT_ANY = ["neon-chat", "pastel-chat", "sparkling-chat", "y2k-chat", "waylay-chat",
            "gradient-cloud-chat", "cloud-chat", "tarot-chat", "alchemist-chat",
            "khepri-chat", "lotus-glass-chat", "moonflower-chat", "soul-blade-chat"]

# First match wins, so the most specific patterns come first.
#
# \b ON "witch". Without it "witch" matches inside "Twitch" and, since nearly
# every handle on this blog contains Twitch, the spooky bucket swallowed the
# blog: "how-to-make-money-on-twitch" and "best-twitch-and-kick-chat-widgets"
# both came out spooky on the first run. This is the same substring trap already
# written up in app/lib/blogCrossSell.js and it was reintroduced here within the
# hour. \b works because t and w are both word characters, so "twitch" has no
# boundary before "witch".
RULES = [
    (r"goal", "goal"),            # "goal widget", "goal bar", "star bottle goal"
    (r"money|monetiz|donation", "goal"),
    (r"multistream|multi-stream", "multi"),
    (r"youtube.*kick|kick.*youtube|twitch-and-kick", "multi"),
    (r"celestial|moon|dreamy|cosmic", "chat_celestial"),
    (r"cozy|cottagecore|frog|spring|anime", "chat_cozy"),
    (r"cyberpunk|neon|futuristic|sci-fi|star-wars|mandalorian", "chat_neon"),
    (r"kawaii|vtuber|pastel|aesthetic", "chat_pastel"),
    (r"spooky|halloween|\bwitch|tarot", "chat_spooky"),
    (r"chat", "chat_any"),
]

POOLS = {
    "goal": GOAL_ANY, "multi": MULTI, "chat_celestial": CHAT_CELESTIAL,
    "chat_cozy": CHAT_COZY, "chat_neon": CHAT_NEON, "chat_pastel": CHAT_PASTEL,
    "chat_spooky": CHAT_SPOOKY, "chat_any": CHAT_ANY,
}


def bucket(handle):
    for pat, b in RULES:
        if re.search(pat, handle):
            # A celestial GOAL article should get a celestial goal, not a generic one.
            if b == "goal" and re.search(r"celestial|moon|star|butterfly", handle):
                return "goal_celestial"
            return b
    return "chat_any"


POOLS["goal_celestial"] = GOAL_CELESTIAL

rows = json.load(open(f"{HERE}/map.json"))
have = set(os.listdir(STAGE))

used = {}
out = []
for handle, theme, kicker, title, old in rows:
    pool = [w for w in POOLS[bucket(handle)] if w in have]
    # Least-used candidate wins, so relevance holds and usage still spreads.
    pick = min(pool, key=lambda w: (used.get(w, 0), pool.index(w)))
    used[pick] = used.get(pick, 0) + 1
    out.append([handle, theme, kicker, title, pick])

changed = sum(1 for a, b in zip(rows, out) if a[4] != b[4])
print(f"{changed} of {len(rows)} reassigned for relevance")
from collections import Counter
c = Counter(r[4] for r in out)
print(f"distinct widgets: {len(c)}   max reuse: {c.most_common(1)[0]}")
print()
for (h, _, _, _, o), (_, _, _, _, n) in zip(rows, out):
    if o != n:
        print(f"  {bucket(h):15} {o:28} -> {n:28} {h[:42]}")

if "--apply" in sys.argv:
    json.dump(out, open(f"{HERE}/map.json", "w"), indent=0)
    print("\nmap.json rewritten")
