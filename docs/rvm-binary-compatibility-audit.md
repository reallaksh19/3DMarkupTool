# RVM Binary Compatibility Audit

## Scope

This note records the Core C6 RVM binary compatibility gate. It is based on the project writer and a non-committed reference inspection of the uploaded `RHBG.RVM` sample.

The reference file is **not** committed to this repository. It was used only to confirm the chunk grammar and header-marker pattern.

## RHBG-style reference observations

The uploaded reference RVM uses the same high-level chunk grammar targeted by this project:

```text
HEAD
MODL
CNTB
PRIM
CNTE
END:
```

The inspected reference also uses:

```text
- 32-bit big-endian character words for 4-character chunk IDs
- the next-chunk byte offset stored at chunk header byte 16
- Review-style chunk marker value `1` at chunk header byte 20
- a terminal `END:` chunk
- balanced `CNTB` / `CNTE` container chunks
```

## Project writer contract after C6

`src/rvm-writer.js` now emits Review-style marker `1` in every chunk header and writes a small marker body for `END:`.

Required generated chunk checks:

```text
first chunk      = HEAD
second chunk     = MODL
terminal chunk   = END:
chunk marker     = 1 for every generated chunk
END: body length = 4 bytes
CNTB/CNTE        = balanced
PRIM count       = export primitive count
trailing bytes   = none for generated project output
```

The reference file may contain trailing zero padding after `END:`. The project writer does not emit trailing padding; this is intentionally stricter and easier to audit.

## New helper

```text
src/rvm-binary-audit.js
```

Exports:

```js
auditRvmBinary(buffer, options)
assertRvmBinaryCompatibility(buffer, expectations)
```

The helper scans chunk headers without interpreting every primitive payload. It validates stream structure, required chunks, chunk markers, `CNTB` / `CNTE` balance, and `PRIM` count.

## CI gate

```text
tests/rvm-binary-compatibility.test.mjs
```

The gate verifies:

```text
- writer emits HEAD / MODL / CNTB / PRIM / CNTE / END:
- all generated chunk header markers equal 1
- END: includes a 4-byte body marker
- CNTB and CNTE are balanced
- generated output has no trailing bytes after END:
- PRIM chunk count equals export primitive count
- CI sample artifact includes binary audit summary
```

## Artifact impact

The C5 CI artifact audit now includes:

```text
rvmBinaryAudit
summary.rvmBinary
```

This makes the uploaded `rvm-catalogue-sample` artifact useful for checking both catalogue parity and binary RVM chunk compatibility.

## Non-goals

C6 does not claim:

```text
- full AVEVA RVM specification coverage
- ASME/rating-size dimensional database backing
- byte-for-byte identity with RHBG.RVM
- Native frustum/torus primitive support
```

C6 only tightens the writer to match the observed Review chunk stream structure and keeps the writer-supported primitive set unchanged:

```text
cylinder / box / pyramid / sphere
```
