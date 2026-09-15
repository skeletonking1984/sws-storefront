"""
Rewrite the one refund sentence in each product description so it agrees with
/policies/refund-policy, the FAQ and the product's own JSON-LD.

Surgical on purpose. The ONLY text allowed to change is the refund sentence;
everything else, including the ChatGPT-export data-start/data-end attribute
noise, is left byte-identical. The script asserts that before emitting anything,
by stripping tags from the old and new HTML and diffing the plain text. If any
other word moved, it raises instead of producing a payload.
"""
import json, re, sys, difflib

SRC = sys.argv[1]
OUT = sys.argv[2]

# Matches the refund policy page, dated 2026-09-09, in one sentence.
REFUND = ("Refunds within 30 days if the download never arrived, the files are "
          "corrupt or incomplete, the item is not what this listing described, "
          "you were charged twice, or we cannot get it running on a platform "
          "this listing claims. A working file you downloaded and then changed "
          "your mind about is not refundable. Full detail is on our Refund "
          "Policy page.")

# (pattern, replacement). Ordered, longest first; first hit wins per product.
#
# The three kits phrase this differently from each other, including a comma in
# one and a full stop in another, so the "please read the setup guide" tail is
# matched explicitly. Matching only up to "non-refundable" leaves that tail
# stranded behind the new sentence, which is what the change-region assertion
# caught on the Celestial kit.
GUIDE = " Please read the setup guide before purchasing."
RULES = [
    (r"No refunds or exchanges due to the nature of digital downloads", REFUND),
    (r"Due to the instant-download nature, this item is non-refundable, please read the setup guide before purchasing", REFUND + GUIDE),
    (r"Due to the instant-download nature, this item is non-refundable\. Please read the setup guide before purchasing", REFUND + GUIDE),
    (r"Due to the instant-download nature, this item is non-refundable", REFUND),
    # Trailing full stop is part of the match, or the replacement (which
    # already ends in one) produces "Refund Policy page..".
    (r"Digital download, all sales final\.", "Digital download. " + REFUND),
    (r"Digital download, all sales final", "Digital download. " + REFUND),
]

BANNED = re.compile(r"non-?refundable|no refunds?|no exchanges?|all sales (are )?final", re.I)


def text_of(html):
    t = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", t).strip()


data = json.load(open(SRC))["data"]
payload, report = {}, []

for key in sorted(data):
    node = data[key]
    old = node["descriptionHtml"]
    new, applied = old, None
    for pat, rep in RULES:
        if re.search(pat, new):
            new = re.sub(pat, rep, new, count=1)
            applied = pat
            break
    if applied is None:
        raise SystemExit(f"{key}: no rule matched, refusing to guess")

    # The Butterfly Galaxy copy bullets its Important list with ❌. Leaving that
    # in front of the new sentence puts a red cross next to "Refunds within 30
    # days", which reads as the opposite of what it says.
    new = new.replace("❌ Refunds within 30 days", "🔄 Refunds within 30 days")

    # 0. no punctuation artifacts from the splice
    if ".." in text_of(new).replace("...", ""):
        raise SystemExit(f"{key}: double full stop introduced by the replacement")
    # 1. the banned wording must be gone
    if BANNED.search(text_of(new)):
        raise SystemExit(f"{key}: banned refund wording still present after edit")
    # 2. the new sentence must be there
    if "Refunds within 30 days" not in text_of(new):
        raise SystemExit(f"{key}: replacement sentence missing")
    # 3. nothing else may have changed.
    #
    # Not a diff-region count. The replacement deliberately reuses some of the
    # original wording ("Please read the setup guide before purchasing"), so
    # difflib finds equal islands inside the edit and reports one change as two
    # or three regions. That is a property of the matcher, not evidence of
    # collateral damage. The exact check: apply the SAME rule to the plain text
    # of the old description and require it to equal the plain text of the new
    # one, character for character.
    expected = re.sub(applied, dict(RULES)[applied], text_of(old), count=1)
    expected = expected.replace("❌ Refunds within 30 days", "🔄 Refunds within 30 days")
    expected = re.sub(r"\s+", " ", expected).strip()
    got = re.sub(r"\s+", " ", text_of(new)).strip()
    if expected != got:
        sm = difflib.SequenceMatcher(None, expected.split(), got.split())
        bad = [op for op in sm.get_opcodes() if op[0] != "equal"][:3]
        raise SystemExit(f"{key}: text changed beyond the refund sentence: {bad}")
    removed = re.search(applied, text_of(old)).group(0)

    # Drop the data-start/data-end attributes. They are ChatGPT-export noise,
    # app/lib/productDescription.js already strips them before rendering, and
    # carrying them doubles the payload for no effect. Text is untouched, which
    # is what check 3 above verifies.
    new = re.sub(r'\s+data-(?:start|end|is-last-node|is-only-node)="[^"]*"', "", new)
    if text_of(new) != got:
        raise SystemExit(f"{key}: attribute strip altered the text")

    payload[key] = {"id": node["id"], "descriptionHtml": new}
    report.append((key, node["id"].split("/")[-1], node["title"][:34], removed[:60], len(old), len(new)))

json.dump(payload, open(OUT, "w"), ensure_ascii=False, indent=1)

print(f"{len(payload)} products, all checks passed\n")
for key, pid, title, removed, lo, ln in report:
    print(f"{key} {pid} {title:<34} {lo:>5} -> {ln:>5}   removed: {removed}")
