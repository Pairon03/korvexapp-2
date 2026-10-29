# Continuous human mesh

This model derives exclusively from graphical data bundled with MakeHuman, released under **CC0 1.0 Universal**, including commercial use. No MakeHuman AGPL program code is included in this project. The original preparation script is maintained in `scripts/prepare-human-model.py`.

Source: https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482

Included graphical inputs: `makehuman/data/3dobjs/base.obj`, `makehuman/data/rigs/default.mhskel`, `default_weights.mhw`, and the four adult male morph data files listed in `athletic-human.json`. Each graphical input explicitly declares CC0; source hashes are preserved in the JSON.

Copyright at source release: Data Collection AB, Joel Palmius, Jonas Hauquier; target files additionally credit Manuel Bastioni and record the transfer of rights. CC0 does not require attribution, but provenance is preserved here. `CC0-1.0.txt` and `SOURCE-LICENSE.md` reproduce the source licensing declarations.

FitCore adaptations: adult athletic morph blend, body-only filtering, metric normalization, reduced skinning weights, and editorial color/garment region masks. The `gripPositions` morph articulates the original CC0 finger weights using original project rotation logic; it does not change the body or use a proprietary animation. The mesh has continuous human face, fingers and feet; helper geometry is excluded. This is a graphical human model, not a clinical anatomical atlas. `anatomicalRegions` preserves the coarse editorial muscle map before the opaque clothing and hair masks in `regions`. Region 9 is restricted to the posterior hip; the front of the shorts is not marked as a gluteal region.

Reproduce after obtaining the pinned source revision:

```bash
python scripts/prepare-human-model.py --source /path/to/makehuman --out public/models/human
```
