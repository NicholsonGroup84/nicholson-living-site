"""Assembles the static pages from src/*.html into their published folders.

Run: python3 build.py   (the web app in app/ is exported separately from the nicholson-living repo)
"""
from pathlib import Path

ROOT = Path(__file__).parent
PAGES = {
    "index": ("index.html", "Nicholson Living", "The tenant app from Nicholson Lettings.", "lake-night", "A Nicholson building by the lake at night"),
    "privacy": ("privacy/index.html", "Privacy notice · Nicholson Living", "How Nicholson Lettings uses personal information in the Nicholson Living app.", "kitchen-evening", "A Nicholson apartment in the evening"),
    "delete-account": ("delete-account/index.html", "Delete your account · Nicholson Living", "How to delete your Nicholson Living app account and what happens to your data.", "kitchen-day", "A Nicholson apartment kitchen"),
    "staff-privacy": ("staff-privacy/index.html", "Staff apps privacy notice · NicoNet and NicoMGT", "How Nicholson Group uses personal information in the NicoNet and NicoMGT staff apps.", "living-lake", "A Nicholson apartment living room overlooking the lake"),
    "support": ("support/index.html", "Help and support · Nicholson Living", "Help with the Nicholson Living tenant app.", "living-lake", "A Nicholson apartment living room overlooking the lake"),
}

TEMPLATE = """<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#050607">
<link rel="icon" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600&family=Fraunces:opsz@9..144&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<div class="wrap">
<header class="site"><a href="/"><img src="/logo.png" alt="Nicholson"></a></header>
<div class="rule">Nicholson Living</div>
<figure class="hero"><img src="/img/{img}.jpg" alt="{alt}" loading="eager"></figure>
<main>
{body}
</main>
<footer>
<p><a href="/support/">Support</a><a href="/privacy/">Privacy</a><a href="/delete-account/">Delete account</a></p>
<p>Nicholson Lettings Limited · 116 Duke Street, Liverpool L1 5JW · Company no. 13369529 · ICO registration ZC289932</p>
</footer>
</div>
</body>
</html>
"""

for name, (out, title, desc, img, alt) in PAGES.items():
    body = (ROOT / "src" / f"{name}.html").read_text().strip()
    target = ROOT / out
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(TEMPLATE.format(title=title, desc=desc, body=body, img=img, alt=alt))
    print("wrote", out)
