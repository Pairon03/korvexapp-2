# Human graphical assets and provenance

The model in `athletic-human.json` derives only from graphical assets bundled with the official [MakeHuman source repository at revision a8bc2d54ff0ac92e78ff71431b1023eda42bf482](https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482).

The upstream [`LICENSE.md`, section C](https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/LICENSE.md#c-the-license-for-the-bundled-assets) explicitly releases the bundled base mesh, targets and graphical outputs under **CC0 1.0 Universal**, including commercial use. The base OBJ, morph files, rig JSON and weights JSON also carry their own explicit CC0 declarations. The full CC0 text is preserved in `CC0-1.0.txt`; the upstream separation between graphical-data and program-code licenses is preserved in `SOURCE-LICENSE.md`.

Included data inputs:

- `makehuman/data/3dobjs/base.obj`: only its connected `body` surface, with helper groups excluded.
- `makehuman/data/rigs/default.mhskel` and `default_weights.mhw`: graphical rig descriptions and vertex weights, explicitly licensed CC0.
- Four CC0 adult male morph datasets listed in the model metadata: the three evenly blended official ethnic targets and the athletic muscle/weight target.

No MakeHuman Python program, shader, tool code or other AGPL program logic was copied into the application. `scripts/prepare-human-model.py` is an original project converter that reads these graphical data files, filters the body, triangulates it, normalizes scale and prepares the web asset. The JSON preserves the revision and SHA-256 hashes of every upstream data input and licensing declaration.

`anatomicalRegions` is a coarse **illustrative classification**, not a clinical anatomical segmentation, biomechanical validation or measured muscle-activation map. It is stored separately from the opaque shorts and hair masks in `regions`. The gluteal display region is restricted to the posterior hip: tinting it does not label the front of the shorts as gluteal, and does not remove the clothing mask.

The user's reference video was used solely to assess the desired visual direction. No proprietary Fitness Online video frame, texture, model, branding, watermark or animation was included in this asset.

## Relaxed grip morph

`gripPositions` is a second position array for the same surface. The original project converter articulates the three phalanx chains of each finger with its own hierarchical rotation logic and blends the original CC0 finger weights. This creates a relaxed cylindrical grip while leaving the wrist, face and all vertices without finger influence unchanged. It copies neither MakeHuman program logic nor proprietary reference-video animation. The default finger flexion angles are 52°, 72° and 48°; the thumb uses 32°, 40° and 30°. The client may blend between the open hand and this target according to the exercise. This is a graphical grip pose, not a collision-solved or clinically validated hand simulation.
