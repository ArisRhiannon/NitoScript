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
    print("\nAll NitoScript v0.2.0 tests passed.")
