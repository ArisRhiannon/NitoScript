import sys
import io
from nito import Lexer, Parser, Evaluator, TokenType, run_code, Environment, NitoSupreme, SupremeViolationError

# ==============================================================================
# ORIGINAL TESTS
# ==============================================================================

def test_levenshtein_healing():
    print("--- Running Test 1: Levenshtein Healing ---")
    source = "nitosxs a es 10\n"
    old_stdout = sys.stdout
    sys.stdout = buffer = io.StringIO()
    
    evaluator = Evaluator()
    run_code(source, evaluator)
    
    sys.stdout = old_stdout
    output = buffer.getvalue()
    print("Output captured:\n", output)
    
    assert "Auto-healed typo 'nitosxs' to keyword 'nitosexo'" in output
    assert evaluator.environment.get("a") == 10
    assert "a" in evaluator.environment.constants
    print("Test 1 Passed!\n")

def test_indentation_blocks():
    print("--- Running Test 2: Indentation Blocks & Supreme Axiom ---")
    source = (
        "nito z = 5\n"
        "nito_si z > 2 haz\n"
        "    nito_imprimir z + Nito\n"
    )
    
    old_stdout = sys.stdout
    sys.stdout = buffer = io.StringIO()
    
    evaluator = Evaluator()
    run_code(source, evaluator)
    
    sys.stdout = old_stdout
    output = buffer.getvalue()
    print("Output captured:\n", output)
    
    assert "Nito" in output
    print("Test 2 Passed!\n")

def test_natural_language_synonyms():
    print("--- Running Test 3: Natural Language Synonyms ---")
    source = 'nito_si Nito es mayor que 9999 entonces nito_imprimir("supreme")\n'
    
    old_stdout = sys.stdout
    sys.stdout = buffer = io.StringIO()
    
    evaluator = Evaluator()
    run_code(source, evaluator)
    
    sys.stdout = old_stdout
    output = buffer.getvalue()
    print("Output captured:\n", output)
    
    assert "supreme" in output
    print("Test 3 Passed!\n")

def test_intelligence_fallback():
    print("--- Running Test 4: Inteligencia Propia (Fallback Engine) ---")
    source = (
        "nito a = 42\n"
        "imprimir Nito es mayor que 10\n"
    )
    
    old_stdout = sys.stdout
    sys.stdout = buffer = io.StringIO()
    
    evaluator = Evaluator()
    run_code(source, evaluator)
    
    sys.stdout = old_stdout
    output = buffer.getvalue()
    print("Output captured:\n", output)
    
    assert "Activating Fallback AI System..." in output
    assert "NITO" in output
    print("Test 4 Passed!\n")

def test_supreme_heresy_violations():
    print("--- Running Test 5: Supreme Heresy Exceptions ---")
    evaluator = Evaluator()
    
    try:
        run_code("Nito - Nito", evaluator)
        assert False, "Should raise SupremeViolationError for Nito - Nito"
    except SupremeViolationError as e:
        print("Caught expected subtraction heresy:", e)
        
    try:
        run_code("Nito * 0", evaluator)
        assert False, "Should raise SupremeViolationError for Nito * 0"
    except SupremeViolationError as e:
        print("Caught expected non-positive scaling heresy:", e)

    try:
        run_code("Nito / -2", evaluator)
        assert False, "Should raise SupremeViolationError for Nito / -2"
    except SupremeViolationError as e:
        print("Caught expected division heresy:", e)
        
    print("Test 5 Passed!\n")

# ==============================================================================
# INHUMAN AUTOHEALING (v0.1.0) TESTS
# ==============================================================================

def test_fuzzy_symbol_healing():
    print("--- Running Test 6: Fuzzy Symbol Healing (Runtime) ---")
    source = (
        "nito variableMuyEspectacular = 100\n"
        "nito_imprimir(varMuyEspectacular + 50)\n"
        "varMuyEspectacular = 200\n"
        "nito_imprimir(variableMuyEspectacular)\n"
    )
    
    old_stdout = sys.stdout
    sys.stdout = buffer = io.StringIO()
    
    evaluator = Evaluator()
    run_code(source, evaluator)
    
    sys.stdout = old_stdout
    output = buffer.getvalue()
    print("Output captured:\n", output)
    
    # Assert fuzzy resolution warning was printed
    assert "Fuzzy resolved undefined variable 'varMuyEspectacular'" in output
    # Assert correct math output (100 + 50 = 150)
    assert "150.0" in output or "150" in output
    # Assert constant update also healed and resolved to variableMuyEspectacular
    assert "200.0" in output or "200" in output
    print("Test 6 Passed!\n")

def test_grammar_token_repair():
    print("--- Running Test 7: Grammar Token Repair (Parser) ---")
    # x has duplicate operators '+ *' (should skip *)
    # y has missing right hand operand '20 +' (should inject 0)
    source = (
        "nito x = 10 + * 5\n"
        "nito y = 20 +\n"
        "nito_imprimir(x + y)\n"
    )
    
    old_stdout = sys.stdout
    sys.stdout = buffer = io.StringIO()
    
    evaluator = Evaluator()
    run_code(source, evaluator)
    
    sys.stdout = old_stdout
    output = buffer.getvalue()
    print("Output captured:\n", output)
    
    assert "Skipped unexpected binary operator '*'" in output
    assert "Injected default value '0' for missing expression operand" in output
    # x + y = 15 + 20 = 35
    assert "35.0" in output or "35" in output
    print("Test 7 Passed!\n")

def test_fuzzy_indentation_alignment():
    print("--- Running Test 8: Fuzzy Indentation Alignment ---")
    # z is indented by 4 spaces.
    # The inner line is indented by 6 spaces (not exactly 8, but within 3 of 4/8).
    # It should align cleanly.
    source = (
        "nito_si NITO haz\n"
        "    nito z = 99\n"
        "      nito_imprimir(z)\n"
    )
    
    old_stdout = sys.stdout
    sys.stdout = buffer = io.StringIO()
    
    evaluator = Evaluator()
    run_code(source, evaluator)
    
    sys.stdout = old_stdout
    output = buffer.getvalue()
    print("Output captured:\n", output)
    
    # Should run and print 99
    assert "99" in output
    print("Test 8 Passed!\n")

def test_scrambled_intent_engine():
    print("--- Running Test 9: Scrambled Intent Engine (IP 0.1.0) ---")
    # '100 es nito miVariable' is scrambled declaration
    # 'print(miVariable)' has print but no prefix, triggers fallback
    source = (
        "100 es nito miVariable\n"
        "print(miVariable)\n"
    )
    
    old_stdout = sys.stdout
    sys.stdout = buffer = io.StringIO()
    
    evaluator = Evaluator()
    run_code(source, evaluator)
    
    sys.stdout = old_stdout
    output = buffer.getvalue()
    print("Output captured:\n", output)
    
    assert "Bound variable 'miVariable' = 100" in output
    assert "100" in output
    print("Test 9 Passed!\n")

def test_ffi_and_bytecode_vm():
    print("--- Running Test 10: FFI & Bytecode VM (v0.1.0) ---")
    source = (
        "nito_importar math.sin\n"
        "nito val = sin(0)\n"
        "nito_imprimir(val)\n"
    )
    
    old_stdout = sys.stdout
    sys.stdout = buffer = io.StringIO()
    
    evaluator = Evaluator()
    run_code(source, evaluator)
    
    sys.stdout = old_stdout
    output = buffer.getvalue()
    print("Output captured:\n", output)
    
    assert "Importada función nativa 'math.sin'" in output
    assert "0.0" in output or "0" in output
    print("Test 10 Passed!\n")

if __name__ == "__main__":
    test_levenshtein_healing()
    test_indentation_blocks()
    test_natural_language_synonyms()
    test_intelligence_fallback()
    test_supreme_heresy_violations()
    
    # NitoScript 0.1.0 Inhuman Autohealing Tests
    test_fuzzy_symbol_healing()
    test_grammar_token_repair()
    test_fuzzy_indentation_alignment()
    test_scrambled_intent_engine()
    
    # NitoScript 0.1.0 Bytecode VM & FFI Tests
    test_ffi_and_bytecode_vm()
    
    print("All NitoScript 0.1.0 tests completed successfully!")
