#!/usr/bin/env python3
"""Extract the exact approved concept art. Requires Pillow, never accesses games."""
import argparse, hashlib, json
from pathlib import Path
from PIL import Image
parser=argparse.ArgumentParser()
parser.add_argument("reference",type=Path)
parser.add_argument("output",type=Path)
args=parser.parse_args()
spec=json.loads((Path(__file__).resolve().parent.parent/"docs"/"NEGRESCO-TOOLS-REFERENCE.json").read_text(encoding="utf8"))
raw=args.reference.read_bytes()
if hashlib.sha256(raw).hexdigest()!=spec["sha256"]:
    raise SystemExit("Reference digest mismatch; refusing to crop a different design.")
im=Image.open(args.reference).convert("RGB")
if im.size!=(spec["width"],spec["height"]):
    raise SystemExit("Reference dimensions mismatch.")
args.output.mkdir(parents=True,exist_ok=True)
for name,box in spec["regions"].items():
    im.crop(tuple(box)).save(args.output/(name+".webp"),format="WEBP",lossless=True)
print("Six original crops extracted. No visual parity or installation certified.")
