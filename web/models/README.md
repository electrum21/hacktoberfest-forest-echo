# On-device models

This folder is filled by `python api/scripts/fetch_ondevice_assets.py` (see `docs/ON_DEVICE.md`). It is not stored in git:
the BirdNET models are about 67 MB and licensed CC BY-NC-SA 4.0 (non-commercial, share-alike, attribution).

After running the script it contains the BirdNET V2.4 acoustic model, the BirdNET location model (patched to a fixed batch
size), the species labels, the licence text and `manifest.json`.
