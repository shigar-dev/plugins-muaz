# Contributing a plugin

Submit **plugin sources only**. Never a `.zip`, never a `.minisig`, never an
edit to `index.json` — those are built and signed by CI from what you submit,
and a PR that touches them will be rejected. That is what makes the signature
on a published archive mean something: it can only ever cover bytes that were
produced from reviewed sources in this repository.

## Adding a plugin

Create `plugins/<name>/` with a `manifest.yaml`:

```yaml
manifest_version: 2
name: acme-tools          # lowercase kebab-case: this is what users type
version: 1.0.0            # semver, required
description: What it does, in one line
muaz: ">=0.3"             # the muaz versions it works with

permissions:
  network: false
  tools: [read_file, search]
  mcp: []
```

Alongside it, whatever the plugin provides: `agents/`, `skills/`, `pipelines/`,
`prompts/`, `commands/`.

Check it locally before opening a PR:

```bash
muaz plugins pack plugins/acme-tools
muaz plugins verify acme-tools-1.0.0.zip
```

`pack` validates the manifest and prints the sha256 that will end up in the
index. It is reproducible, so the hash you see is the hash CI will publish.

## Rules

- **Bump the version for every change.** Published versions are immutable; the
  build fails if source changes without a version bump.
- **Declare every permission you use.** `permissions:` is what the user is
  shown before they trust the plugin, and undeclared access is refused at
  runtime rather than silently granted.
- **Lifecycle hooks get extra scrutiny.** `hooks:` runs arbitrary commands on
  a trusted install; expect to justify them.
- **No secrets in the repo.** Anything the plugin needs at runtime belongs in
  its `config:` schema as a `secret` setting, which muaz stores in the OS
  keychain and never writes to disk.

## What review looks for

A signature attests distribution, not safety. Review is the control that
covers safety, so expect questions about what your tools do with the access
they ask for, what your hooks execute, and where your MCP servers connect.
