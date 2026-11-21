"""Record visual anchors from the approved sprite rasters for seam-free playback.

The largest connected silhouette excludes detached props. The horizontal
median is more stable than a bounding box when the tail or a paw sticks out.
The upper mass position follows the head without treating ears as camera shake.
This only produces metadata. It leaves the source sprite images byte-identical.
"""
from pathlib import Path
import json

import numpy as np
from PIL import Image
from scipy.ndimage import label

ROOT = Path(__file__).resolve().parents[1]
EXTENSION = ROOT / "extension"


def data(path):
    return json.loads(path.read_text())


def measure(image):
    alpha = np.asarray(image.getchannel("A")) > 160
    labels, count = label(alpha, structure=np.ones((3, 3), dtype=int))
    if not count:
        raise ValueError("Sprite cell contains no character")
    sizes = np.bincount(labels.ravel())[1:]
    ys, xs = np.nonzero(labels == np.argmax(sizes) + 1)
    return [round(float(value), 2) for value in [np.median(xs), np.quantile(ys, .12), np.mean(ys)]]


def main():
    sprites = data(ROOT / "art" / "renderer-base.json")["sprites"]
    for name in ["manifest.json", "supplemental-manifest.json"]:
        sprites.update(data(EXTENSION / "assets" / "refinement" / name)["sprites"])
    atlases = {}
    anchors = {}
    for name, spec in sprites.items():
        if spec["src"] not in atlases:
            atlases[spec["src"]] = Image.open(EXTENSION / spec["src"]).convert("RGBA")
        image = atlases[spec["src"]]
        anchors[name] = [
            measure(image.crop((frame["x"], frame["y"], frame["x"] + frame.get("w", 256),
                                frame["y"] + frame.get("h", 256))))
            for frame in spec["frames"]
        ]
    target = ROOT / "art" / "sprite-registration.json"
    target.write_text(json.dumps(anchors, separators=(",", ":")) + "\n")
    print(f"Registered {sum(map(len, anchors.values()))} approved frames")


if __name__ == "__main__":
    main()
