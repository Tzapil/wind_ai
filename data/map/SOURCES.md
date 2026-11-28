# Map sources

Downloaded 2026-11-28 from [Natural Earth](https://www.naturalearthdata.com/). Both datasets are public domain. Source ZIP files are cached locally in `tools/mapgen/.cache/` and are excluded from Git; `pnpm map:build` downloads them if absent and verifies their SHA-256 hashes.

| Dataset | Version | Archive | SHA-256 |
|---|---|---|---|
| `ne_10m_land` | 5.1.1 | `https://naciscdn.org/naturalearth/10m/physical/ne_10m_land.zip` | `e547d749445eaa0964aba76738090ec88f5e63c4585122170f98c67a7ea922dc` |
| `ne_10m_minor_islands` | 4.1.0 | `https://naciscdn.org/naturalearth/10m/physical/ne_10m_minor_islands.zip` | `47c0b3ce26df7b4dbabdbb251023918cb2f5c83462a426288f1f253da7284db2` |
