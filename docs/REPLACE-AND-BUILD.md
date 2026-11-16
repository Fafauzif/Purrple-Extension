# Replace the repository contents and rebuild

The source ZIP contains repository-root contents directly: `extension/`,
`art/`, `scripts/`, `tests/`, documentation, and the package configuration.
There is no extra enclosing `Purrple/` folder.

The user confirmed that the previously supplied source had not been edited.
To update that checkout, extract `Purrple_Complete_Source.zip` into the folder
that already contains `extension/` and `package.json`, and choose **Replace**
for matching files. Keep your `.git/` directory. If you have made edits since
that confirmation, save or commit them before replacing anything.

The linked repository is `https://github.com/Fafauzif/Purrple-Extension`.
Its current remote contents were not independently retrieved during this run;
the archive layout follows the local project and the confirmed previous ZIP.
No remote push or repository modification was performed.

## Build both ZIPs

```sh
python scripts/build_release.py
```

The builder uses Python’s standard library and no network. Outputs:

- `dist/Purrple_Firefox_Extension.zip`, with `manifest.json` at the archive root.
- `dist/Purrple_Complete_Source.zip`, with repository-root contents directly.
- `dist/release.json`, containing version, byte counts and SHA-256 hashes.

Stable ZIP metadata makes identical input files produce identical archives.
The builder copies the installation guide to the source root with correct local
asset paths. It excludes browser binaries, disposable profiles, dependencies,
credentials, private critique exchanges and distribution artifacts themselves.

Rebuilding a source ZIP after adding test evidence changes its hash. The runtime
hash changes only when runtime input files change. Test the exact runtime ZIP
you intend to distribute, not merely a similar source directory.

## Preserve progress

Export a JSON backup from Settings. Replace files in the existing extracted
runtime folder, choose **Reload** in `about:debugging`, and refresh website tabs.
Keep the same Firefox profile and stable Gecko ID. Temporary loading is still
temporary; use the signed-XPI route only after Mozilla actually signs a release.
