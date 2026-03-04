"""
EasyOCR worker script.

Reads an image file path from argv[1], runs EasyOCR with the English model,
and writes a JSON object to stdout:
  {
    "text": "<full OCR text, one detection per line>",
    "detections": [
      { "bbox": { "x0": N, "y0": N, "x1": N, "y1": N }, "text": "...", "confidence": 95.2 },
      ...
    ]
  }

EasyOCR returns 4-corner polygons per detection; we convert to axis-aligned
bounding boxes by taking min/max of all corners.
Confidence is scaled from [0, 1] to [0, 100] to match Tesseract's range.
"""

import sys
import os
import json

# Support installs into a custom --target directory (e.g. /tmp/easyocr_deps)
_extra = os.environ.get('EASYOCR_DEPS')
if _extra and _extra not in sys.path:
    sys.path.insert(0, _extra)

import easyocr

if len(sys.argv) < 2:
    json.dump({"text": "", "detections": [], "error": "No image path provided"}, sys.stdout)
    sys.exit(1)

image_path = sys.argv[1]

try:
    reader = easyocr.Reader(['en'], gpu=False, verbose=False)
    raw = reader.readtext(image_path)

    detections = []
    for corners, text, conf in raw:
        xs = [float(c[0]) for c in corners]
        ys = [float(c[1]) for c in corners]
        detections.append({
            "bbox": {
                "x0": min(xs),
                "y0": min(ys),
                "x1": max(xs),
                "y1": max(ys),
            },
            "text": text,
            "confidence": round(conf * 100, 1),
        })

    full_text = '\n'.join(d["text"] for d in detections)
    json.dump({"text": full_text, "detections": detections}, sys.stdout)

except Exception as e:
    json.dump({"text": "", "detections": [], "error": str(e)}, sys.stdout)
    sys.exit(1)
