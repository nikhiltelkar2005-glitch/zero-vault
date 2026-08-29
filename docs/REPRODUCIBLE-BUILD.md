# Reproducible Build Guide

## Overview

ZeroVault uses a deterministic, cross-platform build process implemented entirely
in Node.js standard library primitives. The build produces a `.tar` archive whose
SHA-256 hash is identical across multiple runs, on any machine, without timestamps
or environment variables influencing the output.

## Why Reproducibility Matters

A reproducible build proves that the artifact you receive is identical to what was
built from the published source code. It eliminates an entire class of supply-chain
attacks where a build system produces a different (potentially malicious) binary
than the reviewed source.

## How It Works

The build script (`tools/reproducible-build.js`) implements a minimal **POSIX ustar
tar format** entirely in Node.js buffers — no OS `tar` CLI, no zlib, no external
tools. This eliminates the most common sources of non-determinism:

| Source of Non-Determinism | How We Eliminate It |
|---|---|
| File timestamps | Fixed to Unix epoch `1704067200` (2024-01-01T00:00:00Z) |
| File ordering | Files sorted alphabetically by relative path |
| File permissions | Fixed to `0644` for all files |
| Owner UID/GID | Fixed to `0` |
| OS `tar` version differences | Not used — we write the binary format directly in JS |
| Random padding / metadata | Deterministic 512-byte block alignment |

## Build Command

```bash
npm run build
# or
node tools/reproducible-build.js
```

## Output Artifact

```
zerovault-release.tar
```

Located at the repository root after a successful build. Contains the full
application source (`src/`, `public/`, `bin/`, `docs/`, root config files).

## Verified Hashes

> Run 1:

```
ARTIFACT SHA-256: e5c89ca4ed7567604cb86cbe437029c450bc8bcbd689dacffd716a792a84b1a0
```

> Run 2 (immediately after, same machine):

```
ARTIFACT SHA-256: e5c89ca4ed7567604cb86cbe437029c450bc8bcbd689dacffd716a792a84b1a0
```

**Result: MATCH ✓**

## To Verify Yourself

```bash
# Clone and build
git clone https://github.com/nikhiltelkar2005-glitch/zero-vault.git
cd zero-vault
node tools/reproducible-build.js

# Note the SHA-256. Run again:
node tools/reproducible-build.js

# Both hashes must be identical.
```

To compare the hash against a known-good build:

```bash
shasum -a 256 zerovault-release.tar
```

## Limitations

- The `.tar` is not compressed (no zlib) to keep the build script zero-dependency.
  Compress with `gzip` if a smaller artifact is needed (gzip output is not
  deterministic without `--no-name` flags, so we omit compression by default).
- The build packages source files only. It does not run transpilation or bundling
  since ZeroVault requires no build step to run.
