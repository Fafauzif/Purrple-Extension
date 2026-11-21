# Build Purrple from source

Extract `Purrple_Complete_Source.zip` into a fresh directory. The archive opens at the repository root with `extension/`, `art/`, `scripts/`, `tests/`, and `package.json`. If moving changes into an existing checkout, review local changes and keep the Git history.

Python 3.10 or later can build all three archives using the standard library and local files.

```sh
python3 scripts/build_release.py
python3 tests/release_integrity.py
```

| File in `dist/` | Contents |
| --- | --- |
| `Purrple_Complete_Source.zip` | Repository-root contents, including art masters, the Calendar helper, the lockfile, and tests. |
| `Purrple_Firefox_Extension.zip` | Firefox MV3 runtime with an event background and sidebar. |
| `Purrple_Chromium_Extension.zip` | Shared MV3 runtime with a service worker and a side panel declaration for Brave and Chrome. |
| `release.json` | Local build record with each archive’s byte count and SHA-256, plus runtime file hashes. |

Both runtime manifests sit at the root of their ZIP. The builder applies the Chromium manifest differences to the Firefox source manifest. The verification script rebuilds the extracted source and compares the runtime ZIPs byte for byte. Use Node 20 or later for the JavaScript test suite.

[Install and update instructions](INSTALL-3.0.md)
