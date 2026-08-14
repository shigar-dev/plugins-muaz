# plugins-muaz

The official plugin registry for [muaz](https://github.com/shigar-dev/muaz).

muaz reads `index.json` from this repository's **`registry`** branch and verifies
it against the publisher key compiled into the binary. Every published plugin
archive is signed with the same key, so `muaz plugins install <name>` installs
verified code or refuses.

Sources live on `main`; the generated index lives on `registry`. Splitting them
is what lets `main` carry real review requirements — required approvals,
code-owner review — while CI still publishes without a bypass, because it never
writes to `main` at all.

```bash
muaz plugins search <query>
muaz plugins install <name>
```

Running your own registry — for a team, or for plugins that must not leave your
network — is a supported, first-class setup, and **this repository is the
reference implementation to copy from**. Take `scripts/build-index.mjs`,
`.github/workflows/publish.yml`, `CODEOWNERS`, and an empty `yanked.json`;
generate your own keypair, replace `publisher.pub`, and point your clients at
your index with your key in `trusted_keys`. A registry that declares its own
keys is trusted only for its own plugins, so your key gives you no standing
anywhere else — and muaz's key gives it none in your registry.

[Run an internal plugin registry](https://shigar-dev.github.io/muaz/docs/guides/internal-plugin-registry/)
walks through it.

## Layout

`main` — reviewed sources:

```
plugins/<name>/manifest.yaml   # + agents/ skills/ pipelines/ prompts/ …
scripts/build-index.mjs        # previous index + dist/ → new index.json
publisher.pub                  # public half of the signing key
yanked.json                    # ["name@version", …] withdrawn versions
```

`registry` — generated, orphan branch, written only by CI:

```
index.json
index.json.minisig
```

## Contributing a plugin

See [CONTRIBUTING.md](CONTRIBUTING.md). Submit sources only — archives,
signatures, and `index.json` are built by CI from what is reviewed and merged,
which is the whole reason a signature on a published archive means anything.

## Maintainer setup

The publish workflow needs two things before it can run.

**1. A `publish` environment holding the signing key.**

Settings → Environments → New environment → `publish`. Add yourself as a
**required reviewer**, then add its secrets:

| Secret | Value |
|---|---|
| `MINISIGN_SECRET_KEY` | `base64 -i muaz-publisher-1.key \| tr -d '\n'` |
| `MINISIGN_PASSWORD` | its passphrase (empty for a password-less key) |

Optionally add an environment variable `PUBLISHER_KEY_ID` = `D22CF2698E75D426`
so index entries record which key signed them.

Put these on the **environment**, not in repo-wide secrets. That is what makes
merging a PR insufficient on its own to produce a signature — someone still has
to approve the deployment.

**2. Branch protection.**

On **`main`** — require a pull request. Set required approvals and code-owner
review to whatever your maintainer count supports; CI never writes to `main`, so
nothing here can deadlock a publish. A solo maintainer should use **0** required
approvals, because GitHub will not let you approve your own pull request and you
would otherwise be unable to merge anything.

On **`registry`** — block force pushes and block deletion. Do **not** require a
pull request: CI is its only writer, and the branch is append-only by design.
Its history is the record of every index this registry has ever served.

Do not add a GitHub Actions bypass to either. That would let any workflow on any
branch write to a protected branch, which removes the review gate the protection
exists for. The publish workflow needs no bypass and no
`pull-requests: write` — it pushes to `registry` and nothing else.

The gate that actually stops an unreviewed signature is the `publish`
environment's reviewer, not branch protection. Environment approvals *can* be
self-approved, which is exactly why the gate belongs there.

**3. Bootstrap the index.** Run the workflow once (Actions → publish → Run
workflow). It creates the orphan `registry` branch and signs an empty
`index.json` — then go back and add that branch's protection, which cannot be
configured before the branch exists.

Do this early: muaz clients fetch `index.json` from `registry`, and until it
exists every `muaz plugins search` reports this registry as unreachable.

## Operating rules

These are enforced by the build, not left to memory:

- **A published version is immutable.** Changing `plugins/<name>/` without
  bumping its version fails the build rather than rewriting bytes people have
  already installed and verified.
- **Nothing ships unsigned.** An archive with no `.minisig` fails the build
  instead of being indexed as community tier.
- **Never delete a release.** Pinned installs (`name@version`) and every
  recorded `sha256` depend on those bytes staying reachable. To retract a
  version, add it to `yanked.json`:

  ```json
  ["acme-tools@1.2.0"]
  ```

  muaz then skips it when resolving the newest version, refuses it when pinned,
  hides it from search, and warns anyone still running it. Removing the line
  un-yanks it.
- **Never rewrite the `registry` branch.** Its `serial` only moves forward, and
  clients refuse a lower one — that is the anti-rollback check working. Restoring
  an old index, force-pushing, or deleting and recreating the branch all land in
  the same place: every user has to run `muaz plugins forget-registry muaz`
  before they can install anything again.
- **Never hand-edit the index.** An index is trusted because of its signature,
  not because of where it sits. Editing it on the branch produces a file no
  client will accept; re-run the workflow instead.

## What a signature proves

That an archive was built and published from this repository. **Not** that the
plugin is safe. Review is what covers safety, and muaz still shows the user
every permission a plugin declares before they trust it.
