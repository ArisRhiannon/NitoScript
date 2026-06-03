"""NitoScript v0.2.0 test suite — runs everything through the real VM.
There is no fallback interpreter, so any failure is a real failure."""
import io
import sys
from contextlib import redirect_stdout

from nito import run_code, Interpreter, Nito, NitoError, NitoSyntaxError


def run(source: str) -> str:
    """Run source on a fresh interpreter and return captured stdout."""
    buf = io.StringIO()
    with redirect_stdout(buf):
        run_code(source, Interpreter())
    return buf.getvalue()


def expect_error(source, exc):
    try:
        run(source)
    except exc:
        return True
    raise AssertionError(f"expected {exc.__name__} for: {source!r}")


def test_let_and_arithmetic():
    assert run("let x = 2 + 3 * 4\nshow x\n").strip() == "14"
    assert run("show (2 + 3) * 4\n").strip() == "20"
    print("ok  1 let + arithmetic precedence")


def test_strings_and_booleans():
    assert run('show "hi" + " " + "there"\n').strip() == "hi there"
    assert run('show 1 + 1 == 2\n').strip() == "true"
    assert run('show 3 < 1\n').strip() == "false"
    # number formatting: integer-valued floats print without ".0"
    assert run("show 10 / 2\n").strip() == "5"
    print("ok  2 strings + booleans + number formatting")


def test_if_elif_else():
    src = ("let x = 10\n"
           "if x == 5:\n    show \"five\"\n"
           "elif x == 10:\n    show \"ten\"\n"
           "else:\n    show \"other\"\n")
    assert run(src).strip() == "ten"
    # inline single-statement form
    assert run("if true: show \"yes\"\n").strip() == "yes"
    print("ok  3 if / elif / else (+ inline form)")


def test_while_and_reassignment():
    src = ("let i = 0\n"
           "while i < 3:\n    show i\n    i = i + 1\n"
           "show i\n")
    assert [l for l in run(src).splitlines() if l] == ["0", "1", "2", "3"]
    print("ok  4 while loop + reassignment (the v0.1 underflow bug stays dead)")


def test_blocks_and_recursion():
    assert run("block double(x):\n    give x * 2\nshow double(21)\n").strip() == "42"
    fac = ("block fact(n):\n"
           "    if n <= 1:\n        give 1\n"
           "    give n * fact(n - 1)\n"
           "show fact(5)\n")
    assert run(fac).strip() == "120"
    # lexical closure
    clo = ("block adder(step):\n"
           "    block add(v):\n        give v + step\n"
           "    give add\n"
           "let add5 = adder(5)\n"
           "show add5(10)\n")
    assert run(clo).strip() == "15"
    print("ok  5 blocks + recursion + closures")


def test_flow_chain_pipe():
    assert run("block double(x):\n    give x * 2\nshow 5 |> double |> double\n").strip() == "20"
    # pipe prepends the value as the first argument
    add = ("block add(a, b):\n    give a + b\nshow 10 |> add(5)\n")
    assert run(add).strip() == "15"
    print("ok  6 flow chains with |>")


def test_nito_is_central():
    assert run("show Nito\n").strip() == "Nito"
    # absence propagates through arithmetic
    assert run("show Nito + 5\n").strip() == "Nito"
    assert run("show 2 * Nito\n").strip() == "Nito"
    # collapse with `or`
    assert run('show Nito or "default"\n').strip() == "default"
    assert run('show "real" or "default"\n').strip() == "real"
    # Nito is falsy
    assert run('if Nito:\n    show "a"\nelse:\n    show "b"\n').strip() == "b"
    # safe navigation: a missing property is Nito, not a crash
    assert run('let name = Nito.user.name or "Guest"\nshow name\n').strip() == "Guest"
    print("ok  7 Nito is the central value (empty, propagating, safe, collapsible)")


def test_ffi_allowlist():
    assert run("use math.sqrt\nshow sqrt(9)\n").strip() == "3"
    print("ok  8 FFI: allowed module works")


def test_errors_are_real_not_healed():
    expect_error("show 5 / 0\n", NitoError)              # uncorrectable math fault
    expect_error("use os.system\n", NitoError)           # FFI security denial
    expect_error("let x = \nshow x\n", NitoSyntaxError)  # real syntax error, no placeholder
    expect_error("show undefined_name\n", NitoError)     # typo -> clear error, not silent
    expect_error('fail "boom"\n', NitoError)             # explicit failure
    print("ok  9 errors surface honestly (no silent healing / fallback)")


WALLET = (
    "chain Wallet:\n"
    "    state:\n        balance = 0\n"
    "    block deposit(amount):\n        balance = balance + amount\n"
    "    block withdraw(amount):\n"
    "        if balance >= amount:\n            balance = balance - amount\n"
    "        else:\n            fail \"Insufficient funds\"\n"
)


def test_state_chain_basics():
    src = WALLET + ("let w = new Wallet()\nw.deposit(100)\nw.withdraw(30)\nshow w.balance\n")
    assert run(src).strip() == "70"
    print("ok 10 state chain: state + transitions")


def test_transition_atomicity():
    # An overdraw fails and must leave state AND history untouched.
    src = WALLET + (
        "let w = new Wallet()\n"
        "w.deposit(50)\n"
        "if w.withdraw(999) == Nito:\n    show \"no\"\n"  # never reached; the line fails
    )
    try:
        run(src)
        assert False, "overdraw should have failed"
    except NitoError:
        pass
    # Inspect via the Python API that state/history rolled back.
    from nito import Interpreter
    interp = Interpreter()
    interp.run(WALLET + "let w = new Wallet()\nw.deposit(50)\n")
    w = interp.global_env.get("w")
    before = (dict(w.state), list(w.history), w.root)
    try:
        w.apply_transition("withdraw", [999])
    except NitoError:
        pass
    assert (w.state, w.history, w.root) == before, "failed transition must not mutate the chain"
    print("ok 11 transitions are atomic (failed action changes nothing)")


def test_verify_by_replay_and_tamper():
    from nito import Interpreter, next_root
    interp = Interpreter()
    interp.run(WALLET + "let w = new Wallet()\nw.deposit(100)\nw.withdraw(40)\n")
    w = interp.global_env.get("w")
    assert w.state["balance"] == 60
    assert w.verify() is True
    assert w.replay() == w.root           # deterministic replay reproduces the head
    assert len(w.root) == 64              # sha-256 hex
    # Tamper with current state -> head no longer matches the replayed history.
    w.state["balance"] = 9999
    assert w.verify() is False
    print("ok 12 verify-by-replay holds, and tampering is detected")


def test_history_tamper_detected():
    from nito import Interpreter
    interp = Interpreter()
    interp.run(WALLET + "let w = new Wallet()\nw.deposit(100)\nw.withdraw(40)\n")
    w = interp.global_env.get("w")
    # Rewrite a past transition's argument (40 -> 1) but keep the old roots.
    name, args, root = w.history[1]
    w.history[1] = (name, [1], root)
    assert w.verify() is False
    print("ok 13 rewriting past history breaks the hash-link")


def test_chain_determinism_guard():
    # A transition may not call external (FFI) functions, even indirectly.
    src = (
        "use math.sqrt\n"
        "chain C:\n    state:\n        x = 0\n"
        "    block bad(n):\n        x = sqrt(n)\n"
        "let c = new C()\n"
        "c.bad(4)\n"
    )
    expect_error(src, NitoError)
    print("ok 14 determinism guard blocks external calls inside transitions")


if __name__ == "__main__":
    test_let_and_arithmetic()
    test_strings_and_booleans()
    test_if_elif_else()
    test_while_and_reassignment()
    test_blocks_and_recursion()
    test_flow_chain_pipe()
    test_nito_is_central()
    test_ffi_allowlist()
    test_errors_are_real_not_healed()
    test_state_chain_basics()
    test_transition_atomicity()
    test_verify_by_replay_and_tamper()
    test_history_tamper_detected()
    test_chain_determinism_guard()
    print("\nAll NitoScript v0.2.0 tests passed.")
