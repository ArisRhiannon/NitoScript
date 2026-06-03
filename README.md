# NitoScript

![NitoScript Banner](assets/nitoscript_banner.png)

<p align="left">
  <a href="https://github.com/ArisRhiannon/NitoScript"><img src="https://img.shields.io/badge/Version-0.2.1-blueviolet?style=flat-square" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License"></a>
  <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.8%2B-brightgreen?style=flat-square" alt="Python"></a>
  <a href="run_tests.py"><img src="https://img.shields.io/badge/Tests-17%2F17-success?style=flat-square" alt="Tests"></a>
</p>

**A comfy, beginner-friendly language where every program is a *Chain* of *Blocks* — a
deterministic, replayable state machine. The same code that teaches you to count is, at its
core, already a verifiable ledger.**

NitoScript is small on purpose: a handful of logical keywords, one obvious way to do things,
and clear errors instead of magic. You write little **Blocks** (named actions) and snap them
together into **Chains**. Because chains are deterministic and hash-linked, they can prove
their own history by *replay* — the lightweight, no-mining foundation that NitoChain will
build on later.

```nito
chain Wallet:
    state:
        balance = 0
    block deposit(amount):
        balance = balance + amount
    block withdraw(amount):
        if balance >= amount:
            balance = balance - amount
        else:
            fail "Insufficient funds"

let w = new Wallet()
w.deposit(100)
w.withdraw(30)

show w.balance      # 70
show w.root         # a SHA-256 fingerprint of the whole history
show w.verify()     # true — re-runs the chain and checks every hash-link
```

---

## Quick start

NitoScript needs only **Python 3.8+** — no dependencies to install.

```bash
python3 nito.py examples/01_basics.nito   # run a file
python3 nito.py                           # interactive REPL
python3 run_tests.py                      # run the test suite (14/14)
```

Start with the guided tutorials in [`examples/`](examples/):
`01_basics.nito` → `02_blocks_and_flow.nito` → `03_chain_wallet.nito`.

---

## Nito — the central value

Everything turns around one value: **`Nito`**. It is the empty value, the origin of all
state, and the *absence that propagates safely* so missing data never crashes a program.

```nito
show Nito                      # Nito
show Nito + 5                  # Nito   (absence flows through math)
show Nito or "default"         # default   (collapse absence with 'or')
let city = user.address.city or "unknown"   # safe navigation, never crashes
```

A value that is missing stays `Nito` until you decide what to do with it. (A *misspelled
name*, on the other hand, is a clear error — that catches typos instead of hiding them.)

---

## Language tour

```nito
# variables and output
let x = 10
show x

# conditionals (indentation blocks, ':' opens a body)
if x > 5:
    show "big"
elif x == 5:
    show "five"
else:
    show "small"

# loops
let i = 0
while i < 3:
    show i
    i = i + 1

# blocks (functions): inputs in, one value out via 'give'
block square(n):
    give n * n

show square(8)                 # 64

# flow chains: pipe a value through blocks, left to right
show 4 |> square |> square     # 256

# borrow safe, deterministic helpers from Python with 'use'
use math.sqrt
show sqrt(144)                 # 12
```

The whole keyword set is intentionally tiny:
`let · if · elif · else · while · block · give · show · fail · use · chain · state · new ·
and · or · not · true · false · Nito`.

---

## Chains & the NitoSupremeExecutor

A **State Chain** is a thing that remembers (`state`) and the actions that may change it
(`block` transitions). It is, structurally, a tiny ledger — and a wallet of balances is
already a token contract.

- **Atomic transitions.** If a transition `fail`s, the state and history roll back: a failed
  action changes nothing.
- **Hash-linked history.** Every transition produces a state root linked to the previous one:
  `root_n = sha256(root_{n-1} :: action :: args :: new_state)`.
- **Verify-by-replay.** `chain.verify()` re-executes the entire history from genesis and
  confirms every hash-link *and* that the live state matches the replay. Tampering with a past
  action, a recorded root, or the current state is detected. Cost is one deterministic run plus
  one hash per step — **no proof-of-work; a single machine can validate a chain**.
- **Determinism guard.** A transition (and any block it calls) may not invoke external `use`d
  functions, which is what makes replay sound.

This is the real job of the **NitoSupremeExecutor**: the deterministic bytecode VM that
executes blocks and chains and produces those verifiable state roots.

```nito
let w = new Wallet()
w.deposit(100)
show w.verify()                # true
show w.replay() == w.root      # true — replay deterministically reproduces the head
```

---

## NitoChain (not yet — but the core is ready)

NitoChain will distribute and co-sign chains across machines. NitoScript v0.2.0 deliberately
ships only the **local, verifiable core** that makes that a switch-flip later: deterministic
execution, hash-linked state roots, and verify-by-replay. Signatures on transitions,
networking, multi-validator agreement, lattice/CRDT merge of independent chains, and the
native **Nito** token are **designed-for but not implemented yet**. Nothing about them requires
changing the chain semantics shown above.

Security comes from hashing and deterministic replay, not from mining — that is what keeps it
lightweight.

---

## Project layout

```
nito.py                 # the entire language: lexer, parser, compiler, VM
run_tests.py            # 14 tests, all run through the real VM (no fallback)
examples/               # guided tutorials (.nito)
docs/v0.2.0-design.md   # the design & roadmap behind this release
```

## Status

Working and tested today (v0.2.0): the language core, Blocks, flow chains, State Chains, and
verify-by-replay. Earlier esoteric releases and the NitoBlocks visual IDE are preserved at the
`v0.1.3` git tag. What's next is NitoChain (see above).

## License

MIT — see [LICENSE](LICENSE). Copyright &copy; 2026 ArisRhiannon
