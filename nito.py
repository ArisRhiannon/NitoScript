import sys
import re
import math
from enum import Enum, auto
from typing import List, Dict, Set, Optional, Tuple, Any

# ==============================================================================
# AST NODES
# ==============================================================================

class ASTNode:
    pass

class ProgramNode(ASTNode):
    def __init__(self, statements: List[ASTNode]):
        self.statements = statements

class VarDeclNode(ASTNode):
    def __init__(self, name: str, initializer: ASTNode, is_const: bool):
        self.name = name
        self.initializer = initializer
        self.is_const = is_const

class FunDeclNode(ASTNode):
    def __init__(self, name: str, params: List[str], body: 'BlockNode'):
        self.name = name
        self.params = params
        self.body = body

class BlockNode(ASTNode):
    def __init__(self, statements: List[ASTNode]):
        self.statements = statements

class IfNode(ASTNode):
    def __init__(self, cond: ASTNode, then_b: BlockNode, elifs: List[Tuple[ASTNode, BlockNode]], else_b: Optional[BlockNode]):
        self.condition = cond
        self.then_branch = then_b
        self.elif_branches = elifs
        self.else_branch = else_b

class WhileNode(ASTNode):
    def __init__(self, cond: ASTNode, body: BlockNode):
        self.condition = cond
        self.body = body

class ReturnNode(ASTNode):
    def __init__(self, value: Optional[ASTNode]):
        self.value = value

class PrintNode(ASTNode):
    def __init__(self, expression: ASTNode):
        self.expression = expression

class ImportNode(ASTNode):
    def __init__(self, module: str, name: str):
        self.module = module
        self.name = name

class ExprStmtNode(ASTNode):
    def __init__(self, expression: ASTNode):
        self.expression = expression

class AssignNode(ASTNode):
    def __init__(self, name: str, value: ASTNode):
        self.name = name
        self.value = value

class BinaryOpNode(ASTNode):
    def __init__(self, left: ASTNode, op: str, right: ASTNode):
        self.left = left
        self.op = op
        self.right = right

class UnaryOpNode(ASTNode):
    def __init__(self, op: str, operand: ASTNode):
        self.op = op
        self.operand = operand

class CallNode(ASTNode):
    def __init__(self, callee: ASTNode, arguments: List[ASTNode]):
        self.callee = callee
        self.arguments = arguments

class VariableNode(ASTNode):
    def __init__(self, name: str):
        self.name = name

class LiteralNode(ASTNode):
    def __init__(self, value: Any):
        self.value = value

class GetNode(ASTNode):
    def __init__(self, obj: ASTNode, name: str):
        self.obj = obj
        self.name = name

# ==============================================================================
# TOKENS & LEXER
# ==============================================================================

class TokenType(Enum):
    # Keywords
    NITO_VAR = auto()          # nito
    NITO_CONST = auto()        # nitosexo
    NITO_FUN = auto()          # nitosegs
    NITO_SI = auto()           # nito_si
    NITO_SINO_SI = auto()      # nito_sino_si
    NITO_SINO = auto()         # nito_sino
    NITO_MIENTRAS = auto()     # nito_mientras
    NITO_RETORNA = auto()      # nito_retorna
    NITO_IMPRIMIR = auto()     # nito_imprimir
    NITO_IMPORTAR = auto()     # nito_importar
    NITO_AND = auto()          # nito_y
    NITO_OR = auto()           # nito_o
    NITO_NOT = auto()          # nito_no
    
    # Literals
    LIT_TRUE = auto()          # NITO
    LIT_FALSE = auto()         # NO_NITO
    LIT_SUPREME = auto()       # Nito
    IDENTIFIER = auto()
    NUMBER = auto()
    STRING = auto()
    
    # Punctuators & Operators
    ASSIGN = auto()            # =
    PLUS = auto()              # +
    MINUS = auto()             # -
    STAR = auto()              # *
    SLASH = auto()             # /
    MODULO = auto()            # %
    EQ = auto()                # ==
    NEQ = auto()               # !=
    LT = auto()                # <
    GT = auto()                # >
    LTE = auto()               # <=
    GTE = auto()               # >=
    LPAREN = auto()            # (
    RPAREN = auto()            # )
    LBRACE = auto()            # {
    RBRACE = auto()            # }
    COMMA = auto()             # ,
    SEMICOLON = auto()         # ;
    DOT = auto()               # .
    
    # Indentation & Block structure
    NEWLINE = auto()
    INDENT = auto()
    DEDENT = auto()
    
    # Natural language block initiators
    ENTONCES = auto()          # entonces
    HAZ = auto()               # haz
    
    EOF = auto()

KEYWORDS = {
    "nito": TokenType.NITO_VAR,
    "nitosexo": TokenType.NITO_CONST,
    "nitosegs": TokenType.NITO_FUN,
    "nito_si": TokenType.NITO_SI,
    "nito_sino_si": TokenType.NITO_SINO_SI,
    "nito_sino": TokenType.NITO_SINO,
    "nito_mientras": TokenType.NITO_MIENTRAS,
    "nito_retorna": TokenType.NITO_RETORNA,
    "nito_imprimir": TokenType.NITO_IMPRIMIR,
    "nito_importar": TokenType.NITO_IMPORTAR,
    "nito_y": TokenType.NITO_AND,
    "nito_o": TokenType.NITO_OR,
    "nito_no": TokenType.NITO_NOT,
    "NITO": TokenType.LIT_TRUE,
    "NO_NITO": TokenType.LIT_FALSE,
    "Nito": TokenType.LIT_SUPREME,
    "entonces": TokenType.ENTONCES,
    "haz": TokenType.HAZ,
    "nito_mayor": TokenType.GT,
    "nito_menor": TokenType.LT
}

def levenshtein_distance(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
        
    return previous_row[-1]

def heal_token(word: str) -> Optional[TokenType]:
    if len(word) < 3:
        return None
    best_match = None
    min_dist = 999
    best_kw = None
    for kw, ttype in KEYWORDS.items():
        dist = levenshtein_distance(word, kw)
        # Limit distance depending on word length
        max_allowed = 2 if len(word) >= 5 else 1
        if dist <= max_allowed and dist < min_dist:
            min_dist = dist
            best_match = ttype
            best_kw = kw
    if best_match is not None:
        print(f"[Lexer Warning] Auto-healed typo '{word}' to keyword '{best_kw}' (Levenshtein distance {min_dist})")
        return best_match
    return None

class Token:
    def __init__(self, token_type: TokenType, value: str, line: int, column: int):
        self.type = token_type
        self.value = value
        self.line = line
        self.column = column

    def __repr__(self) -> str:
        return f"Token({self.type.name}, {repr(self.value)}, L{self.line}:C{self.column})"

class LexicalError(Exception):
    def __init__(self, message: str, line: int, column: int):
        super().__init__(f"Lexical Error at line {line}, column {column}: {message}")

class ParseError(Exception):
    def __init__(self, message: str, token: Token):
        super().__init__(f"Parse Error at line {token.line}, column {token.column}: {message} (found '{token.value}')")
        self.token = token

class Lexer:
    def __init__(self, source: str):
        self.source = source
        self.pos = 0
        self.line = 1
        self.column = 1
        self.length = len(source)
        
        # Indentation & context state
        self.indent_stack = [0]
        self.paren_depth = 0
        self.brace_depth = 0
        self.at_line_start = True

    def peek(self, offset: int = 0) -> str:
        index = self.pos + offset
        if index >= self.length:
            return ""
        return self.source[index]

    def advance(self) -> str:
        char = self.peek()
        self.pos += 1
        if char == '\n':
            self.line += 1
            self.column = 1
        else:
            self.column += 1
        return char

    def skip_comments_and_inline_whitespace(self):
        while self.pos < self.length:
            char = self.peek()
            if char in (' ', '\t', '\r'):
                self.advance()
            elif char == '/' and self.peek(1) == '/':
                # Single-line comment
                while self.peek() != '\n' and self.pos < self.length:
                    self.advance()
            elif char == '/' and self.peek(1) == '*':
                # Multi-line comment
                self.advance() # '/'
                self.advance() # '*'
                while self.pos < self.length:
                    if self.peek() == '*' and self.peek(1) == '/':
                        self.advance() # '*'
                        self.advance() # '/'
                        break
                    self.advance()
            else:
                break

    def read_number(self) -> Token:
        start_col = self.column
        num_str = ""
        while self.peek().isdigit():
            num_str += self.advance()
        if self.peek() == '.' and self.peek(1).isdigit():
            num_str += self.advance()
            while self.peek().isdigit():
                num_str += self.advance()
        return Token(TokenType.NUMBER, num_str, self.line, start_col)

    def read_string(self) -> Token:
        start_col = self.column
        self.advance()  # Open quote
        str_val = ""
        while self.pos < self.length:
            char = self.peek()
            if char == '"':
                self.advance()  # Close quote
                return Token(TokenType.STRING, str_val, self.line, start_col)
            elif char == '\\':
                self.advance()  # escape char
                escaped = self.advance()
                if escaped == 'n': str_val += '\n'
                elif escaped == 't': str_val += '\t'
                elif escaped == 'r': str_val += '\r'
                elif escaped == '"': str_val += '"'
                elif escaped == '\\': str_val += '\\'
                else: str_val += '\\' + escaped
            else:
                str_val += self.advance()
        raise LexicalError("Unterminated string literal.", self.line, start_col)

    def match_phrase(self) -> Optional[Token]:
        # Helper to check lookahead for natural language operators starting with "es"
        start_pos = self.pos
        start_line = self.line
        start_col = self.column
        
        # Read the word "es"
        word = ""
        while self.peek().isalnum() or self.peek() == '_':
            word += self.advance()
            
        if word != "es":
            self.pos = start_pos
            self.line = start_line
            self.column = start_col
            return None
            
        saved_pos = self.pos
        saved_line = self.line
        saved_col = self.column
        
        self.skip_comments_and_inline_whitespace()
        
        next_word = ""
        while self.peek().isalnum() or self.peek() == '_':
            next_word += self.advance()
            
        if next_word == "igual":
            self.skip_comments_and_inline_whitespace()
            third_word = ""
            while self.peek().isalnum() or self.peek() == '_':
                third_word += self.advance()
            if third_word == "a":
                return Token(TokenType.EQ, "es igual a", start_line, start_col)
                
        elif next_word == "mayor":
            self.skip_comments_and_inline_whitespace()
            third_word = ""
            while self.peek().isalnum() or self.peek() == '_':
                third_word += self.advance()
            if third_word == "que":
                return Token(TokenType.GT, "es mayor que", start_line, start_col)
            elif third_word == "o":
                self.skip_comments_and_inline_whitespace()
                fourth = ""
                while self.peek().isalnum() or self.peek() == '_':
                    fourth += self.advance()
                if fourth == "igual":
                    self.skip_comments_and_inline_whitespace()
                    fifth = ""
                    while self.peek().isalnum() or self.peek() == '_':
                        fifth += self.advance()
                    if fifth == "a":
                        return Token(TokenType.GTE, "es mayor o igual a", start_line, start_col)
                        
        elif next_word == "menor":
            self.skip_comments_and_inline_whitespace()
            third_word = ""
            while self.peek().isalnum() or self.peek() == '_':
                third_word += self.advance()
            if third_word == "que":
                return Token(TokenType.LT, "es menor que", start_line, start_col)
            elif third_word == "o":
                self.skip_comments_and_inline_whitespace()
                fourth = ""
                while self.peek().isalnum() or self.peek() == '_':
                    fourth += self.advance()
                if fourth == "igual":
                    self.skip_comments_and_inline_whitespace()
                    fifth = ""
                    while self.peek().isalnum() or self.peek() == '_':
                        fifth += self.advance()
                    if fifth == "a":
                        return Token(TokenType.LTE, "es menor o igual a", start_line, start_col)
                        
        self.pos = saved_pos
        self.line = saved_line
        self.column = saved_col
        return Token(TokenType.ASSIGN, "es", start_line, start_col)

    def read_identifier_or_keyword(self) -> Token:
        if self.peek() == 'e' and self.peek(1) == 's' and not (self.peek(2).isalnum() or self.peek(2) == '_'):
            phrase_tok = self.match_phrase()
            if phrase_tok is not None:
                return phrase_tok

        start_col = self.column
        ident_str = ""
        while self.peek().isalnum() or self.peek() == '_':
            ident_str += self.advance()
            
        if ident_str in KEYWORDS:
            return Token(KEYWORDS[ident_str], ident_str, self.line, start_col)
            
        healed_type = heal_token(ident_str)
        if healed_type is not None:
            return Token(healed_type, ident_str, self.line, start_col)
            
        return Token(TokenType.IDENTIFIER, ident_str, self.line, start_col)

    def tokenize(self) -> List[Token]:
        tokens = []
        
        while self.pos < self.length:
            if self.at_line_start:
                spaces = 0
                while self.peek() in (' ', '\t'):
                    char = self.advance()
                    spaces += 4 if char == '\t' else 1
                
                next_c = self.peek()
                if next_c in '\n\r' or (next_c == '/' and (self.peek(1) == '/' or self.peek(1) == '*')):
                    self.skip_comments_and_inline_whitespace()
                    if self.peek() in '\n\r':
                        self.advance()
                    continue
                
                current_indent = spaces
                last_indent = self.indent_stack[-1]
                
                # Fuzzy Indentation Alignment: If current indent is within 3 spaces of the active block level, align it
                if abs(current_indent - last_indent) < 3:
                    current_indent = last_indent
                
                if current_indent > last_indent:
                     self.indent_stack.append(current_indent)
                     tokens.append(Token(TokenType.INDENT, str(current_indent), self.line, 1))
                elif current_indent < last_indent:
                     # Fuzzy alignment for dedents as well
                     closest_level = min(self.indent_stack, key=lambda x: abs(x - current_indent))
                     if abs(closest_level - current_indent) < 3:
                         current_indent = closest_level
                         
                     while current_indent < self.indent_stack[-1]:
                         self.indent_stack.pop()
                         tokens.append(Token(TokenType.DEDENT, "", self.line, 1))
                     if current_indent != self.indent_stack[-1]:
                         print(f"[Lexer Warning] Indentation mismatch on line {self.line}. Auto-aligning.")
                         self.indent_stack.append(current_indent)
                self.at_line_start = False

            self.skip_comments_and_inline_whitespace()
            if self.pos >= self.length:
                break
                
            char = self.peek()
            line, col = self.line, self.column
            
            if char in '\n\r':
                self.advance()
                if char == '\r' and self.peek() == '\n':
                    self.advance()
                
                if self.paren_depth == 0 and self.brace_depth == 0:
                    if tokens and tokens[-1].type not in (TokenType.NEWLINE, TokenType.INDENT, TokenType.DEDENT, TokenType.SEMICOLON):
                        tokens.append(Token(TokenType.NEWLINE, "\n", line, col))
                    self.at_line_start = True
                continue

            if char.isdigit():
                tokens.append(self.read_number())
            elif char.isalpha() or char == '_':
                tokens.append(self.read_identifier_or_keyword())
            elif char == '"':
                tokens.append(self.read_string())
            elif char == '=':
                self.advance()
                if self.peek() == '=':
                    self.advance()
                    tokens.append(Token(TokenType.EQ, "==", line, col))
                else:
                    tokens.append(Token(TokenType.ASSIGN, "=", line, col))
            elif char == '!':
                self.advance()
                if self.peek() == '=':
                    self.advance()
                    tokens.append(Token(TokenType.NEQ, "!=", line, col))
                else:
                    raise LexicalError("Unexpected character '!'. Use 'nito_no' for logical negation.", line, col)
            elif char == '<':
                self.advance()
                if self.peek() == '=':
                    self.advance()
                    tokens.append(Token(TokenType.LTE, "<=", line, col))
                else:
                    tokens.append(Token(TokenType.LT, "<", line, col))
            elif char == '>':
                self.advance()
                if self.peek() == '=':
                    self.advance()
                    tokens.append(Token(TokenType.GTE, ">=", line, col))
                else:
                    tokens.append(Token(TokenType.GT, ">", line, col))
            elif char == '+':
                self.advance()
                tokens.append(Token(TokenType.PLUS, "+", line, col))
            elif char == '-':
                self.advance()
                tokens.append(Token(TokenType.MINUS, "-", line, col))
            elif char == '*':
                self.advance()
                tokens.append(Token(TokenType.STAR, "*", line, col))
            elif char == '/':
                self.advance()
                tokens.append(Token(TokenType.SLASH, "/", line, col))
            elif char == '%':
                self.advance()
                tokens.append(Token(TokenType.MODULO, "%", line, col))
            elif char == '.':
                self.advance()
                tokens.append(Token(TokenType.DOT, ".", line, col))
            elif char == '(':
                self.advance()
                self.paren_depth += 1
                tokens.append(Token(TokenType.LPAREN, "(", line, col))
            elif char == ')':
                self.advance()
                self.paren_depth = max(0, self.paren_depth - 1)
                tokens.append(Token(TokenType.RPAREN, ")", line, col))
            elif char == '{':
                self.advance()
                self.brace_depth += 1
                tokens.append(Token(TokenType.LBRACE, "{", line, col))
            elif char == '}':
                self.advance()
                self.brace_depth = max(0, self.brace_depth - 1)
                tokens.append(Token(TokenType.RBRACE, "}", line, col))
            elif char == ',':
                self.advance()
                tokens.append(Token(TokenType.COMMA, ",", line, col))
            elif char == ';':
                self.advance()
                tokens.append(Token(TokenType.SEMICOLON, ";", line, col))
            else:
                raise LexicalError(f"Unexpected character: {repr(char)}", line, col)

        while len(self.indent_stack) > 1:
            self.indent_stack.pop()
            tokens.append(Token(TokenType.DEDENT, "", self.line, self.column))
            
        if tokens and tokens[-1].type not in (TokenType.NEWLINE, TokenType.DEDENT, TokenType.SEMICOLON):
            tokens.append(Token(TokenType.NEWLINE, "\n", self.line, self.column))

        tokens.append(Token(TokenType.EOF, "", self.line, self.column))
        return tokens

# ==============================================================================
# PARSER
# ==============================================================================

class Parser:
    def __init__(self, tokens: List[Token]):
        self.tokens = tokens
        self.current = 0

    def peek(self) -> Token:
        return self.tokens[self.current]

    def previous(self) -> Token:
        return self.tokens[self.current - 1]

    def is_at_end(self) -> bool:
        return self.peek().type == TokenType.EOF

    def check(self, token_type: TokenType) -> bool:
        if self.is_at_end():
            return False
        return self.peek().type == token_type

    def advance(self) -> Token:
        if not self.is_at_end():
            self.current += 1
        return self.previous()

    def match(self, *types: TokenType) -> bool:
        for t in types:
            if self.check(t):
                self.advance()
                return True
        return False

    def consume(self, token_type: TokenType, err_msg: str) -> Token:
        if self.check(token_type):
            return self.advance()
        
        # Structural autohealing
        if token_type == TokenType.RPAREN:
            if self.check(TokenType.NEWLINE) or self.check(TokenType.SEMICOLON) or self.check(TokenType.LBRACE) or self.check(TokenType.ENTONCES) or self.check(TokenType.HAZ):
                print(f"[Parser Warning] Auto-inserted missing ')' on line {self.peek().line}")
                return Token(TokenType.RPAREN, ")", self.peek().line, self.peek().column)
        if token_type == TokenType.RBRACE:
            if self.is_at_end() or self.check(TokenType.DEDENT):
                print(f"[Parser Warning] Auto-inserted missing '}}' on line {self.peek().line}")
                return Token(TokenType.RBRACE, "}", self.peek().line, self.peek().column)
        
        raise ParseError(err_msg, self.peek())

    def consume_statement_terminator(self):
        if self.match(TokenType.SEMICOLON, TokenType.NEWLINE):
            while self.match(TokenType.SEMICOLON, TokenType.NEWLINE):
                pass
            return
        if self.check(TokenType.RBRACE) or self.check(TokenType.DEDENT) or self.is_at_end():
            return
        print(f"[Parser Warning] Auto-inserted missing statement terminator on line {self.peek().line}")

    def parse(self) -> ProgramNode:
        statements = []
        while not self.is_at_end():
            if self.match(TokenType.NEWLINE, TokenType.SEMICOLON):
                continue
            statements.append(self.statement())
        return ProgramNode(statements)

    def statement(self) -> ASTNode:
        if self.match(TokenType.NITO_VAR):
            return self.var_declaration(is_const=False)
        if self.match(TokenType.NITO_CONST):
            return self.var_declaration(is_const=True)
        if self.match(TokenType.NITO_FUN):
            return self.fun_declaration()
        if self.match(TokenType.NITO_SI):
            return self.if_statement()
        if self.match(TokenType.NITO_MIENTRAS):
            return self.while_statement()
        if self.match(TokenType.NITO_RETORNA):
            return self.return_statement()
        if self.match(TokenType.NITO_IMPRIMIR):
            return self.print_statement()
        if self.match(TokenType.NITO_IMPORTAR):
            return self.import_statement()
        if self.check(TokenType.LBRACE):
            return self.block_statement()
        return self.expression_statement()

    def var_declaration(self, is_const: bool) -> ASTNode:
        name_tok = self.consume(TokenType.IDENTIFIER, "Expect variable name.")
        if name_tok.value == "Nito":
            raise ParseError("Cannot declare variable with reserved name 'Nito'.", name_tok)
        self.consume(TokenType.ASSIGN, "Expect '=' or 'es' after variable name.")
        expr = self.expression()
        self.consume_statement_terminator()
        return VarDeclNode(name_tok.value, expr, is_const)

    def fun_declaration(self) -> ASTNode:
        name_tok = self.consume(TokenType.IDENTIFIER, "Expect function name.")
        if name_tok.value == "Nito":
            raise ParseError("Cannot declare function with reserved name 'Nito'.", name_tok)
            
        has_paren = self.match(TokenType.LPAREN)
        params = []
        if not self.check(TokenType.RPAREN) and not self.check(TokenType.LBRACE) and not self.check(TokenType.NEWLINE) and not self.check(TokenType.INDENT):
            while True:
                param = self.consume(TokenType.IDENTIFIER, "Expect parameter name.")
                params.append(param.value)
                if not self.match(TokenType.COMMA):
                    break
        if has_paren:
            self.consume(TokenType.RPAREN, "Expect ')' after parameter list.")
            
        self.match(TokenType.ENTONCES, TokenType.HAZ)
        body = self.block_statement()
        return FunDeclNode(name_tok.value, params, body)

    def if_statement(self) -> ASTNode:
        has_paren = self.match(TokenType.LPAREN)
        cond = self.expression()
        if has_paren:
            self.consume(TokenType.RPAREN, "Expect ')' after 'nito_si' condition.")
            
        self.match(TokenType.ENTONCES, TokenType.HAZ)
        then_branch = self.block_statement()
        
        elif_branches = []
        else_branch = None
        
        while self.match(TokenType.NITO_SINO_SI):
            has_elif_paren = self.match(TokenType.LPAREN)
            elif_cond = self.expression()
            if has_elif_paren:
                self.consume(TokenType.RPAREN, "Expect ')' after condition.")
            self.match(TokenType.ENTONCES, TokenType.HAZ)
            elif_block = self.block_statement()
            elif_branches.append((elif_cond, elif_block))
            
        if self.match(TokenType.NITO_SINO):
            self.match(TokenType.ENTONCES, TokenType.HAZ)
            else_branch = self.block_statement()
            
        return IfNode(cond, then_branch, elif_branches, else_branch)

    def while_statement(self) -> ASTNode:
        has_paren = self.match(TokenType.LPAREN)
        cond = self.expression()
        if has_paren:
            self.consume(TokenType.RPAREN, "Expect ')' after condition.")
        self.match(TokenType.ENTONCES, TokenType.HAZ)
        body = self.block_statement()
        return WhileNode(cond, body)

    def return_statement(self) -> ASTNode:
        expr = None
        if not self.check(TokenType.SEMICOLON) and not self.check(TokenType.NEWLINE) and not self.check(TokenType.DEDENT) and not self.check(TokenType.RBRACE) and not self.is_at_end():
            expr = self.expression()
        self.consume_statement_terminator()
        return ReturnNode(expr)

    def print_statement(self) -> ASTNode:
        has_paren = self.match(TokenType.LPAREN)
        expr = self.expression()
        if has_paren:
            self.consume(TokenType.RPAREN, "Expect ')' after print expression.")
        self.consume_statement_terminator()
        return PrintNode(expr)

    def import_statement(self) -> ASTNode:
        module_parts = []
        module_parts.append(self.consume(TokenType.IDENTIFIER, "Expect module or function name to import.").value)
        while self.match(TokenType.DOT):
            module_parts.append(self.consume(TokenType.IDENTIFIER, "Expect identifier after '.'.").value)
        self.consume_statement_terminator()
        
        if len(module_parts) > 1:
            module = ".".join(module_parts[:-1])
            name = module_parts[-1]
        else:
            module = ""
            name = module_parts[0]
        return ImportNode(module, name)

    def block_statement(self) -> BlockNode:
        while self.match(TokenType.NEWLINE):
            pass
            
        if self.match(TokenType.LBRACE):
            statements = []
            while not self.check(TokenType.RBRACE) and not self.is_at_end():
                if self.match(TokenType.NEWLINE, TokenType.SEMICOLON):
                    continue
                statements.append(self.statement())
            self.consume(TokenType.RBRACE, "Expect '}' to close block.")
            return BlockNode(statements)
            
        elif self.match(TokenType.INDENT):
            statements = []
            while not self.check(TokenType.DEDENT) and not self.is_at_end():
                if self.match(TokenType.NEWLINE, TokenType.SEMICOLON):
                    continue
                statements.append(self.statement())
            self.consume(TokenType.DEDENT, "Expect DEDENT to close block.")
            return BlockNode(statements)
            
        else:
            stmt = self.statement()
            return BlockNode([stmt])

    def expression_statement(self) -> ASTNode:
        expr = self.expression()
        self.consume_statement_terminator()
        return ExprStmtNode(expr)

    def expression(self) -> ASTNode:
        return self.assignment()

    def assignment(self) -> ASTNode:
        expr = self.logical_or()
        if self.match(TokenType.ASSIGN):
            equals = self.previous()
            value = self.assignment()
            if isinstance(expr, VariableNode):
                return AssignNode(expr.name, value)
            raise ParseError("Invalid assignment target.", equals)
        return expr

    def logical_or(self) -> ASTNode:
        expr = self.logical_and()
        while self.match(TokenType.NITO_OR):
            op = self.previous().value
            right = self.logical_and()
            expr = BinaryOpNode(expr, op, right)
        return expr

    def logical_and(self) -> ASTNode:
        expr = self.equality()
        while self.match(TokenType.NITO_AND):
            op = self.previous().value
            right = self.equality()
            expr = BinaryOpNode(expr, op, right)
        return expr

    def equality(self) -> ASTNode:
        expr = self.comparison()
        while self.match(TokenType.EQ, TokenType.NEQ):
            op = self.previous().value
            right = self.comparison()
            expr = BinaryOpNode(expr, op, right)
        return expr

    def comparison(self) -> ASTNode:
        expr = self.addition()
        while self.match(TokenType.LT, TokenType.GT, TokenType.LTE, TokenType.GTE):
            op = self.previous().value
            right = self.addition()
            expr = BinaryOpNode(expr, op, right)
        return expr

    def addition(self) -> ASTNode:
        expr = self.multiplication()
        while self.match(TokenType.PLUS, TokenType.MINUS):
            op = self.previous().value
            
            # HEALING: Skip redundant/unexpected duplicate binary operators (only strictly binary ones)
            while self.check(TokenType.STAR) or self.check(TokenType.SLASH) or self.check(TokenType.MODULO):
                bad_tok = self.advance()
                print(f"[Parser Warning] Skipped unexpected binary operator '{bad_tok.value}' on line {bad_tok.line}")
                
            right = self.multiplication()
            expr = BinaryOpNode(expr, op, right)
        return expr

    def multiplication(self) -> ASTNode:
        expr = self.unary()
        while self.match(TokenType.STAR, TokenType.SLASH, TokenType.MODULO):
            op = self.previous().value
            
            # HEALING: Skip redundant/unexpected duplicate binary operators (only strictly binary ones)
            while self.check(TokenType.STAR) or self.check(TokenType.SLASH) or self.check(TokenType.MODULO):
                bad_tok = self.advance()
                print(f"[Parser Warning] Skipped unexpected binary operator '{bad_tok.value}' on line {bad_tok.line}")
                
            right = self.unary()
            expr = BinaryOpNode(expr, op, right)
        return expr

    def _match_unary_not(self) -> bool:
        if self.check(TokenType.NITO_NOT):
            self.advance()
            return True
        if self.check(TokenType.IDENTIFIER) and self.peek().value == "no":
            self.advance()
            return True
        return False

    def unary(self) -> ASTNode:
        if self._match_unary_not() or self.match(TokenType.MINUS):
            op = self.previous().value
            operand = self.unary()
            return UnaryOpNode(op, operand)
        return self.call()

    def call(self) -> ASTNode:
        expr = self.primary()
        while True:
            if self.match(TokenType.LPAREN):
                args = []
                if not self.check(TokenType.RPAREN):
                    while True:
                        args.append(self.expression())
                        if not self.match(TokenType.COMMA):
                            break
                self.consume(TokenType.RPAREN, "Expect ')' after arguments.")
                expr = CallNode(expr, args)
            elif self.match(TokenType.DOT):
                name = self.consume(TokenType.IDENTIFIER, "Expect property name after '.'.").value
                expr = GetNode(expr, name)
            else:
                break
        return expr

    def primary(self) -> ASTNode:
        # HEALING: If expression is abruptly cut off by a terminator or EOF, inject placeholder '0'
        if self.check(TokenType.SEMICOLON) or self.check(TokenType.NEWLINE) or self.check(TokenType.EOF) or self.check(TokenType.RBRACE) or self.check(TokenType.DEDENT):
            print(f"[Parser Warning] Injected default value '0' for missing expression operand on line {self.peek().line}")
            return LiteralNode(0)

        if self.match(TokenType.LIT_TRUE):
            return LiteralNode(True)
        if self.match(TokenType.LIT_FALSE):
            return LiteralNode(False)
        if self.match(TokenType.LIT_SUPREME):
            return LiteralNode(NitoSupreme)
        if self.match(TokenType.NUMBER):
            val = self.previous().value
            return LiteralNode(float(val) if '.' in val else int(val))
        if self.match(TokenType.STRING):
            return LiteralNode(self.previous().value)
        if self.match(TokenType.IDENTIFIER):
            return VariableNode(self.previous().value)
        if self.match(TokenType.LPAREN):
            expr = self.expression()
            self.consume(TokenType.RPAREN, "Expect ')' after expression.")
            return expr
            
        raise ParseError("Expect expression.", self.peek())

# ==============================================================================
# EVALUATOR (SEMANTICS) & SUPREME VIOLATION
# ==============================================================================

class SupremeViolationError(RuntimeError):
    pass

class NitoSupremeType:
    def __repr__(self) -> str: return "Nito"
    def __str__(self) -> str: return "Nito"
    def __bool__(self) -> bool: return True

    def __eq__(self, other) -> bool: return isinstance(other, NitoSupremeType)
    def __ne__(self, other) -> bool: return not self.__eq__(other)
    
    def __gt__(self, other) -> bool:
        if isinstance(other, NitoSupremeType): return False
        return True

    def __ge__(self, other) -> bool: return True
    def __lt__(self, other) -> bool: return False
    
    def __le__(self, other) -> bool:
        if isinstance(other, NitoSupremeType): return True
        return False

    def __add__(self, other) -> 'NitoSupremeType':
        if isinstance(other, (int, float, str)):
            return self
        raise SupremeViolationError("Heresy: Invalid addition operation on Nito.")

    def __radd__(self, other) -> 'NitoSupremeType':
        return self.__add__(other)

    def __sub__(self, other) -> 'NitoSupremeType':
        if isinstance(other, NitoSupremeType):
            raise SupremeViolationError("Heresy: Cannot subtract Nito from Nito.")
        if isinstance(other, (int, float)):
            return self
        raise SupremeViolationError("Heresy: Invalid subtraction operation on Nito.")

    def __rsub__(self, other) -> Any:
        if isinstance(other, (int, float)):
            raise SupremeViolationError("Heresy: Cannot subtract Nito from a finite value.")
        raise SupremeViolationError("Heresy: Invalid subtraction operation on Nito.")

    def __mul__(self, other) -> 'NitoSupremeType':
        if isinstance(other, (int, float)):
            if other <= 0:
                raise SupremeViolationError("Heresy: Cannot scale Nito by a non-positive factor.")
            return self
        raise SupremeViolationError("Heresy: Invalid scaling operation on Nito.")

    def __rmul__(self, other) -> 'NitoSupremeType':
        return self.__mul__(other)

    def __truediv__(self, other) -> 'NitoSupremeType':
        if isinstance(other, (int, float)):
            if other <= 0:
                raise SupremeViolationError("Heresy: Cannot divide Nito by a non-positive factor.")
            return self
        raise SupremeViolationError("Heresy: Invalid division on Nito.")

    def __rtruediv__(self, other) -> float:
        if isinstance(other, (int, float)): return 0.0
        raise SupremeViolationError("Heresy: Cannot divide a non-numeric type by Nito.")

    def __floordiv__(self, other) -> 'NitoSupremeType':
        return self.__truediv__(other)

    def __rfloordiv__(self, other) -> int:
        if isinstance(other, (int, float)): return 0
        raise SupremeViolationError("Heresy: Cannot divide a non-numeric type by Nito.")

    def __mod__(self, other) -> Any:
        raise SupremeViolationError("Heresy: Remainder of Nito relative to another value is undefinable.")

    def __rmod__(self, other) -> Any:
        if isinstance(other, NitoSupremeType):
            raise SupremeViolationError("Heresy: Remainder of Nito relative to itself is undefinable.")
        return other

NitoSupreme = NitoSupremeType()

class QuantumNitoType:
    def __init__(self, value: Any, is_null: bool = False):
        self.value = value
        self.is_null = is_null

    def get_property(self, name: str) -> 'QuantumNitoType':
        if self.is_null or self.value is None:
            return QuantumNitoType(None, is_null=True)
        if isinstance(self.value, dict):
            if name in self.value:
                return QuantumNitoType(self.value[name])
            return QuantumNitoType(None, is_null=True)
        try:
            val = getattr(self.value, name)
            return QuantumNitoType(val)
        except AttributeError:
            return QuantumNitoType(None, is_null=True)

    def __getattr__(self, name: str) -> 'QuantumNitoType':
        return self.get_property(name)

    def unwrap(self) -> Any:
        if self.is_null:
            return None
        if isinstance(self.value, QuantumNitoType):
            return self.value.unwrap()
        return self.value

    def __bool__(self) -> bool:
        val = self.unwrap()
        return bool(val)

    def __repr__(self) -> str:
        if self.is_null:
            return "QuantumNito(Null)"
        return f"QuantumNito({self.unwrap()})"

def is_nito(value: Any) -> bool:
    return isinstance(value, NitoSupremeType)

def evaluate_binary_op(left: Any, op: str, right: Any) -> Any:
    if isinstance(left, QuantumNitoType): left = left.unwrap()
    if isinstance(right, QuantumNitoType): right = right.unwrap()

    if op == "es igual a": op = "=="
    elif op in ("es mayor que", "nito_mayor"): op = ">"
    elif op in ("es menor que", "nito_menor"): op = "<"
    elif op == "es mayor o igual a": op = ">="
    elif op == "es menor o igual a": op = "<="
    elif op == "es": op = "="
    
    if is_nito(left) or is_nito(right):
        if op == "==": return is_nito(left) and is_nito(right)
        elif op == "!=": return not (is_nito(left) and is_nito(right))
        elif op == ">":
            if is_nito(left): return not is_nito(right)
            return False
        elif op == ">=":
            if is_nito(left): return True
            return False
        elif op == "<":
            if is_nito(right): return not is_nito(left)
            return False
        elif op == "<=":
            if is_nito(right): return True
            return False

        try:
            if op == "+": return left + right
            elif op == "-":
                if is_nito(left): return left - right
                raise SupremeViolationError("Heresy: Cannot subtract Nito from a finite value.")
            elif op == "*": return left * right
            elif op == "/":
                if is_nito(left): return left / right
                return right.__rtruediv__(left)
            elif op == "%":
                if is_nito(left): raise SupremeViolationError("Heresy: Cannot compute modulo of Nito.")
                return right.__rmod__(left)
        except TypeError:
            raise SupremeViolationError(f"Heresy: Invalid arithmetic binary operation '{op}' involving Nito.")

    if op == "==": return left == right
    if op == "!=": return left != right
    if op == "<": return left < right
    if op == ">": return left > right
    if op == "<=": return left <= right
    if op == ">=": return left >= right
    if op == "+": return left + right
    if op == "-": return left - right
    if op == "*": return left * right
    if op == "/":
        if right == 0: raise ZeroDivisionError("Division by zero.")
        return left / right
    if op == "%":
        if right == 0: raise ZeroDivisionError("Modulo by zero.")
        return left % right
    if op == "nito_o": return left or right
    if op == "nito_y": return left and right

    raise RuntimeError(f"Unknown operator: {op}")

# ==============================================================================
# SCOPES & ENVIRONMENT
# ==============================================================================

class Environment:
    def __init__(self, parent: Optional['Environment'] = None):
        self.values: Dict[str, Any] = {}
        self.constants: Set[str] = set()
        self.parent = parent

    def _get_all_symbols(self) -> Dict[str, 'Environment']:
        symbols = {}
        curr = self
        while curr is not None:
            for k in curr.values.keys():
                if k not in symbols:
                    symbols[k] = curr
            curr = curr.parent
        return symbols

    def _fuzzy_resolve(self, name: str) -> Optional[Tuple[str, 'Environment']]:
        symbols_map = self._get_all_symbols()
        if not symbols_map:
            return None
        
        best_match = None
        min_dist = 999
        threshold = 2
        
        for decl_name, env in symbols_map.items():
            dist = levenshtein_distance(name, decl_name)
            if dist <= threshold and dist < min_dist:
                min_dist = dist
                best_match = (decl_name, env)
                
        if best_match is not None:
            print(f"[Runtime Warning] Fuzzy resolved undefined variable '{name}' to '{best_match[0]}' (Levenshtein distance {min_dist})")
            return best_match
        return None

    def define(self, name: str, value: Any, is_const: bool = False):
        if name in self.values:
            raise RuntimeError(f"Variable '{name}' already defined.")
        self.values[name] = value
        if is_const:
            self.constants.add(name)

    def assign(self, name: str, value: Any):
        if name == "Nito":
            raise SupremeViolationError("Heresy: Cannot assign to the Supreme literal 'Nito'.")
        if name in self.values:
            if name in self.constants:
                raise RuntimeError(f"Cannot reassign to constant '{name}'.")
            self.values[name] = value
            return
        if self.parent:
            self.parent.assign(name, value)
            return
            
        # Try Fuzzy Healing
        resolved = self._fuzzy_resolve(name)
        if resolved is not None:
            best_name, best_env = resolved
            if best_name in best_env.constants:
                raise RuntimeError(f"Cannot reassign to constant '{best_name}'.")
            best_env.values[best_name] = value
            return
            
        raise NameError(f"Undefined variable '{name}'.")

    def get(self, name: str) -> Any:
        if name == "Nito": return NitoSupreme
        if name in self.values: return self.values[name]
        if self.parent: return self.parent.get(name)
        
        # Try Fuzzy Healing
        resolved = self._fuzzy_resolve(name)
        if resolved is not None:
            best_name, best_env = resolved
            return best_env.values[best_name]
            
        raise NameError(f"Undefined variable '{name}'.")

class ReturnException(Exception):
    def __init__(self, value: Any): self.value = value

class NitoNativeFunction:
    def __init__(self, name: str, func: callable):
        self.name = name
        self.func = func
    def call(self, evaluator: 'Evaluator', args: List[Any]) -> Any:
        return self.func(*args)
    def __repr__(self) -> str:
        return f"<native function {self.name}>"

class NitoCompiledFunction:
    def __init__(self, name: str, params: List[str], bytecode: 'Bytecode', closure: Environment):
        self.name = name
        self.params = params
        self.bytecode = bytecode
        self.closure = closure
        
    def call(self, executor: 'NitoSupremeExecutor', args: List[Any]) -> Any:
        # Create execution frame
        env = Environment(self.closure)
        if len(args) != len(self.params):
            raise RuntimeError(f"Expected {len(self.params)} args, got {len(args)}.")
        for param, val in zip(self.params, args):
            env.define(param, val)
            
        # Nito walks the function frame
        nito = NitoSupremeExecutor(self.bytecode, env)
        nito.globals = executor.globals
        while nito.camina():
            pass
            
        if nito.stack:
            return nito.stack.pop()
        return None
        
    def __repr__(self) -> str:
        return f"<function {self.name}>"

class NitoFunction:
    def __init__(self, decl: FunDeclNode, closure: Environment):
        self.decl = decl
        self.closure = closure

    def call(self, evaluator: 'Evaluator', args: List[Any]) -> Any:
        env = Environment(self.closure)
        if len(args) != len(self.decl.params):
            raise RuntimeError(f"Expected {len(self.decl.params)} args, got {len(args)}.")
        for param, val in zip(self.decl.params, args):
            env.define(param, val)
        try:
            evaluator.execute_block(self.decl.body, env)
        except ReturnException as r:
            return r.value
        return None

# ==============================================================================
# BYTECODE & VM SPECIFICATION
# ==============================================================================

class Opcode(Enum):
    LOAD_CONST = auto()
    LOAD_NAME = auto()
    STORE_NAME = auto()
    DECLARE_NAME = auto()
    ADD = auto()
    SUB = auto()
    MUL = auto()
    DIV = auto()
    MOD = auto()
    COMPARE = auto()
    JUMP_IF_FALSE = auto()
    JUMP = auto()
    CALL = auto()
    RETURN_VALUE = auto()
    PRINT = auto()
    IMPORT_FFI = auto()
    POP_TOP = auto()
    GET_PROPERTY = auto()

class Instruction:
    def __init__(self, opcode: Opcode, arg: Any = None):
        self.opcode = opcode
        self.arg = arg
    def __repr__(self) -> str:
        return f"Instruction({self.opcode.name}, {self.arg})"

class Bytecode:
    def __init__(self):
        self.instructions: List[Instruction] = []
        self.constants: List[Any] = []
        self.names: List[str] = []

    def add_const(self, val: Any) -> int:
        for idx, c in enumerate(self.constants):
            if c is val: return idx
            if type(c) is type(val) and c == val: return idx
        self.constants.append(val)
        return len(self.constants) - 1

    def add_name(self, name: str) -> int:
        if name in self.names:
            return self.names.index(name)
        self.names.append(name)
        return len(self.names) - 1

    def emit(self, opcode: Opcode, arg: Any = None) -> int:
        self.instructions.append(Instruction(opcode, arg))
        return len(self.instructions) - 1

# ==============================================================================
# COMPILER
# ==============================================================================

class Compiler:
    def __init__(self):
        self.code = Bytecode()

    def compile(self, node: ASTNode):
        if isinstance(node, ProgramNode):
            for stmt in node.statements:
                self.compile(stmt)
        elif isinstance(node, VarDeclNode):
            self.compile(node.initializer)
            name_idx = self.code.add_name(node.name)
            self.code.emit(Opcode.DECLARE_NAME, (name_idx, node.is_const))
        elif isinstance(node, LiteralNode):
            const_idx = self.code.add_const(node.value)
            self.code.emit(Opcode.LOAD_CONST, const_idx)
        elif isinstance(node, VariableNode):
            name_idx = self.code.add_name(node.name)
            self.code.emit(Opcode.LOAD_NAME, name_idx)
        elif isinstance(node, AssignNode):
            self.compile(node.value)
            name_idx = self.code.add_name(node.name)
            self.code.emit(Opcode.STORE_NAME, name_idx)
        elif isinstance(node, BinaryOpNode):
            self.compile(node.left)
            self.compile(node.right)
            if node.op == "+": self.code.emit(Opcode.ADD)
            elif node.op == "-": self.code.emit(Opcode.SUB)
            elif node.op == "*": self.code.emit(Opcode.MUL)
            elif node.op == "/": self.code.emit(Opcode.DIV)
            elif node.op == "%": self.code.emit(Opcode.MOD)
            elif node.op in ("==", "!=", "<", ">", "<=", ">=", "nito_o", "nito_y"):
                self.code.emit(Opcode.COMPARE, node.op)
        elif isinstance(node, GetNode):
            self.compile(node.obj)
            name_idx = self.code.add_name(node.name)
            self.code.emit(Opcode.GET_PROPERTY, name_idx)
        elif isinstance(node, UnaryOpNode):
            if node.op == "-":
                # Emulate negative as 0 - val
                self.code.emit(Opcode.LOAD_CONST, self.code.add_const(0))
                self.compile(node.operand)
                self.code.emit(Opcode.SUB)
            elif node.op in ("nito_no", "no"):
                self.compile(node.operand)
                self.code.emit(Opcode.COMPARE, "nito_no")
        elif isinstance(node, PrintNode):
            self.compile(node.expression)
            self.code.emit(Opcode.PRINT)
        elif isinstance(node, ImportNode):
            name_idx = self.code.add_name(node.name)
            module_idx = self.code.add_const(node.module)
            self.code.emit(Opcode.IMPORT_FFI, (name_idx, module_idx))
        elif isinstance(node, BlockNode):
            for stmt in node.statements:
                self.compile(stmt)
        elif isinstance(node, IfNode):
            exit_jumps = []
            
            # 1. Rama then
            self.compile(node.condition)
            jump_next_idx = self.code.emit(Opcode.JUMP_IF_FALSE, 0)
            
            self.compile(node.then_branch)
            if node.elif_branches or node.else_branch:
                exit_jumps.append(self.code.emit(Opcode.JUMP, 0))
                
            # Parchear salto condicional principal
            self.code.instructions[jump_next_idx].arg = len(self.code.instructions)
            
            # 2. Ramas Elif
            for elif_cond, elif_body in node.elif_branches:
                self.compile(elif_cond)
                jump_next_idx = self.code.emit(Opcode.JUMP_IF_FALSE, 0)
                
                self.compile(elif_body)
                exit_jumps.append(self.code.emit(Opcode.JUMP, 0))
                
                # Parchear salto del condicional
                self.code.instructions[jump_next_idx].arg = len(self.code.instructions)
                
            # 3. Rama else
            if node.else_branch:
                self.compile(node.else_branch)
                
            # 4. Parchear saltos de salida
            end_address = len(self.code.instructions)
            for idx in exit_jumps:
                self.code.instructions[idx].arg = end_address
        elif isinstance(node, ExprStmtNode):
            self.compile(node.expression)
            self.code.emit(Opcode.POP_TOP)
        elif isinstance(node, WhileNode):
            start_loop = len(self.code.instructions)
            self.compile(node.condition)
            jump_false_idx = self.code.emit(Opcode.JUMP_IF_FALSE, 0)
            
            self.compile(node.body)
            self.code.emit(Opcode.JUMP, start_loop)
            
            self.code.instructions[jump_false_idx].arg = len(self.code.instructions)
        elif isinstance(node, FunDeclNode):
            # Compile body in nested context
            fn_compiler = Compiler()
            fn_compiler.compile(node.body)
            fn_compiler.code.emit(Opcode.LOAD_CONST, fn_compiler.code.add_const(None))
            fn_compiler.code.emit(Opcode.RETURN_VALUE)
            
            fn_obj = NitoCompiledFunction(node.name, node.params, fn_compiler.code, Environment())
            const_idx = self.code.add_const(fn_obj)
            name_idx = self.code.add_name(node.name)
            
            self.code.emit(Opcode.LOAD_CONST, const_idx)
            self.code.emit(Opcode.DECLARE_NAME, (name_idx, False))
        elif isinstance(node, CallNode):
            self.compile(node.callee)
            for arg in node.arguments:
                self.compile(arg)
            self.code.emit(Opcode.CALL, len(node.arguments))
        elif isinstance(node, ReturnNode):
            if node.value:
                self.compile(node.value)
            else:
                self.code.emit(Opcode.LOAD_CONST, self.code.add_const(None))
            self.code.emit(Opcode.RETURN_VALUE)
        else:
            raise RuntimeError(f"Unknown compiler node {type(node).__name__}")

# ==============================================================================
# NITO SUPREME EXECUTOR (BYTECODE VM)
# ==============================================================================

class NitoSupremeExecutor:
    def __init__(self, code: Bytecode, environment: Optional[Environment] = None):
        self.code = code
        self.ip = 0  # Instruction Pointer representing where Nito is walking
        self.stack = []
        self.globals = environment if environment else Environment()
        self.environment = self.globals

    def camina(self) -> bool:
        if self.ip >= len(self.code.instructions):
            return False
        instr = self.code.instructions[self.ip]
        self.ip += 1
        self.haz(instr)
        return True

    def pop_stack(self) -> Any:
        if not self.stack:
            raise RuntimeError("Stack underflow in NitoSupremeExecutor.")
        return self.stack.pop()

    def haz(self, instr: Instruction):
        op = instr.opcode
        arg = instr.arg
        
        if op == Opcode.LOAD_CONST:
            val = self.code.constants[arg]
            if isinstance(val, NitoCompiledFunction):
                # Vincular el entorno léxico actual creando una nueva instancia de cierre inmutable
                val = NitoCompiledFunction(val.name, val.params, val.bytecode, self.environment)
            self.stack.append(val)
        elif op == Opcode.LOAD_NAME:
            name = self.code.names[arg]
            self.stack.append(self.environment.get(name))
        elif op == Opcode.STORE_NAME:
            name = self.code.names[arg]
            val = self.pop_stack()
            self.environment.assign(name, val)
        elif op == Opcode.DECLARE_NAME:
            name_idx, is_const = arg
            name = self.code.names[name_idx]
            val = self.pop_stack()
            self.environment.define(name, val, is_const)
        elif op == Opcode.ADD:
            right = self.pop_stack()
            left = self.pop_stack()
            self.stack.append(evaluate_binary_op(left, "+", right))
        elif op == Opcode.SUB:
            right = self.pop_stack()
            left = self.pop_stack()
            self.stack.append(evaluate_binary_op(left, "-", right))
        elif op == Opcode.MUL:
            right = self.pop_stack()
            left = self.pop_stack()
            self.stack.append(evaluate_binary_op(left, "*", right))
        elif op == Opcode.DIV:
            right = self.pop_stack()
            left = self.pop_stack()
            self.stack.append(evaluate_binary_op(left, "/", right))
        elif op == Opcode.MOD:
            right = self.pop_stack()
            left = self.pop_stack()
            self.stack.append(evaluate_binary_op(left, "%", right))
        elif op == Opcode.COMPARE:
            right = self.pop_stack()
            left = self.pop_stack()
            if arg == "nito_no":
                self.stack.append(not bool(left))
            else:
                self.stack.append(evaluate_binary_op(left, arg, right))
        elif op == Opcode.JUMP:
            self.ip = arg
        elif op == Opcode.JUMP_IF_FALSE:
            val = self.pop_stack()
            if isinstance(val, QuantumNitoType):
                val = val.unwrap()
            if not bool(val):
                self.ip = arg
        elif op == Opcode.PRINT:
            val = self.pop_stack()
            if isinstance(val, QuantumNitoType):
                val = val.unwrap()
            if val is True: print("NITO")
            elif val is False: print("NO_NITO")
            else: print(val)
        elif op == Opcode.CALL:
            args = []
            for _ in range(arg):
                args.insert(0, self.pop_stack())
            callee = self.pop_stack()
            
            if isinstance(callee, NitoNativeFunction):
                res = callee.call(self, args)
            elif isinstance(callee, NitoCompiledFunction):
                res = callee.call(self, args)
            else:
                raise TypeError(f"'{callee}' is not callable.")
            self.stack.append(res)
        elif op == Opcode.RETURN_VALUE:
            self.ip = len(self.code.instructions)
        elif op == Opcode.IMPORT_FFI:
            name_idx, module_idx = arg
            name = self.code.names[name_idx]
            module_name = self.code.constants[module_idx]
            try:
                if module_name:
                    mod = __import__(module_name, fromlist=[name])
                    func = getattr(mod, name)
                else:
                    import builtins
                    func = getattr(builtins, name)
                self.environment.define(name, NitoNativeFunction(name, func))
                print(f"[FFI] Importada función nativa '{module_name + '.' if module_name else ''}{name}' con éxito.")
            except Exception as e:
                raise ImportError(f"Cannot import native function '{name}' from '{module_name}': {e}")
        elif op == Opcode.POP_TOP:
            self.pop_stack()
        elif op == Opcode.GET_PROPERTY:
            name = self.code.names[arg]
            obj = self.pop_stack()
            if isinstance(obj, QuantumNitoType):
                val = obj.get_property(name)
            elif isinstance(obj, dict):
                val = QuantumNitoType(obj.get(name, None)) if name not in obj else QuantumNitoType(obj[name])
            else:
                try:
                    val = QuantumNitoType(getattr(obj, name))
                except AttributeError:
                    val = QuantumNitoType(None, is_null=True)
            self.stack.append(val)
        else:
            raise RuntimeError(f"Unknown executor opcode {op.name}")

# ==============================================================================
# COMPATIBILITY WRAPPER (EVALUATOR)
# ==============================================================================

class Evaluator:
    def __init__(self, global_env: Optional[Environment] = None):
        self.global_env = global_env if global_env else Environment()
        self.environment = self.global_env
        
        # Inject native simulator functions
        self.global_env.define("iniciar_bot", NitoNativeFunction("iniciar_bot", self._native_iniciar_bot))
        self.global_env.define("responder", NitoNativeFunction("responder", self._native_responder))
        self.global_env.define("QuantumNito", NitoNativeFunction("QuantumNito", self._native_quantum_nito))
        self.global_env.define("crear_payload", NitoNativeFunction("crear_payload", self._native_crear_payload))

    def _native_iniciar_bot(self, token: Any) -> str:
        print(f"[Bot Simulator] Bot conectado exitosamente usando token: '{token}'")
        return "BOT_ACTIVE"

    def _native_responder(self, msg: Any):
        if is_nito(msg):
            print("[Bot Response] Nito (Absorbido)")
        else:
            print(f"[Bot Response] {msg}")

    def _native_quantum_nito(self, val: Any) -> QuantumNitoType:
        return QuantumNitoType(val)

    def _native_crear_payload(self, has_avatar: Any) -> dict:
        if has_avatar:
            return {"user": {"profile": {"avatar": "avatar_premium.png"}}}
        else:
            return {"user": {}}

    def evaluate(self, node: ASTNode) -> Any:
        # Compiler AST to bytecode
        compiler = Compiler()
        compiler.compile(node)
        compiler.code.emit(Opcode.RETURN_VALUE)
        
        # Run Nito walking the bytecode stream
        nito = NitoSupremeExecutor(compiler.code, self.environment)
        nito.globals = self.global_env
        while nito.camina():
            pass
            
        if nito.stack:
            return nito.stack[-1]
        return None

# ==============================================================================
# INTELIGENCIA PROPIA (FALLBACK ENGINE)
# ==============================================================================

def ai_fallback_interpreter(source_code: str, env: Environment) -> Any:
    print("\n[Inteligencia Propia] Traditional AST parser failed. Activating Fallback AI System...")
    lines = source_code.split('\n')
    last_val = None
    
    for idx, line in enumerate(lines):
        line = line.strip()
        if not line or line.startswith("//"):
            continue
            
        print(f"[Inteligencia Propia] Analyzing line {idx+1}: {repr(line)}")
        
        # Fallback Print Intent (anywhere in the line)
        if any(k in line.lower() for k in ("imprimir", "print", "nito_imprimir")):
            # Extract print content by removing keyword & parentheses
            expr_str = line
            for k in ("nito_imprimir", "imprimir", "print"):
                expr_str = re.sub(rf'\b{k}\b', '', expr_str, flags=re.IGNORECASE)
            expr_str = expr_str.strip().strip('()').strip(';')
            
            if expr_str.startswith('"') and expr_str.endswith('"'):
                val = expr_str[1:-1]
            elif expr_str in ("Nito", "NITO"):
                val = NitoSupreme
            else:
                val = evaluate_ai_expression(expr_str, env)
            
            if val is True: print("NITO")
            elif val is False: print("NO_NITO")
            else: print(val)
            last_val = None
            continue
            
        # Fallback Assignment / Declaration Intent (scrambled or ordered)
        if any(op in line for op in ("=", " es ", " es igual a ")):
            parts = re.split(r'=|\bes\b|\bes igual a\b', line, maxsplit=1)
            left = parts[0].strip()
            right = parts[1].strip().rstrip(';')
            
            var_name = left
            for kw in ("nito", "nitosexo"):
                var_name = re.sub(rf'\b{kw}\b', '', var_name, flags=re.IGNORECASE)
            var_name = var_name.strip()
            
            # Scrambled healing: If left-hand is not an identifier but right-hand contains one
            if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', var_name):
                potential_var = right
                for kw in ("nito", "nitosexo"):
                    potential_var = re.sub(rf'\b{kw}\b', '', potential_var, flags=re.IGNORECASE)
                potential_var = potential_var.strip()
                if re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', potential_var):
                    var_name = potential_var
                    right = left
            
            if re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', var_name):
                if right.startswith('"') and right.endswith('"'):
                    val = right[1:-1]
                else:
                    val = evaluate_ai_expression(right, env)
                
                try:
                    env.assign(var_name, val)
                except NameError:
                    is_const = "nitosexo" in line.lower()
                    env.define(var_name, val, is_const)
                print(f"[Inteligencia Propia] Bound variable '{var_name}' = {val}")
                last_val = val
                continue
            
        # Plain Expression fallback
        try:
            last_val = evaluate_ai_expression(line, env)
            print(f"[Inteligencia Propia] Evaluated expression to: {last_val}")
        except SupremeViolationError as e:
            raise e
        except Exception as e:
            print(f"[Inteligencia Propia Warning] Line {idx+1} could not be fallback-evaluated: {e}")
            
    return last_val

def evaluate_ai_expression(expr: str, env: Environment, depth: int = 0) -> Any:
    if depth > 10:
        raise RuntimeError("Max recursion depth exceeded in Fallback AI.")
    expr = expr.replace(';', '').strip()
    
    if "Nito" in expr or "NITO" in expr:
        if "==" in expr or "es igual a" in expr:
            parts = re.split(r'==|es igual a', expr)
            p1 = parts[0].strip()
            p2 = parts[1].strip()
            return (p1 == "Nito" or p1 == "NITO") and (p2 == "Nito" or p2 == "NITO")
        if ">" in expr or "es mayor que" in expr:
            parts = re.split(r'>|es mayor que', expr)
            p1 = parts[0].strip()
            return p1 == "Nito" or p1 == "NITO"
        if "<" in expr or "es menor que" in expr:
            parts = re.split(r'<|es menor que', expr)
            p2 = parts[1].strip()
            return p2 == "Nito" or p2 == "NITO"

        # Check heresies first
        if "-" in expr:
            parts = expr.split('-')
            p1 = parts[0].strip()
            p2 = parts[1].strip()
            if p1 in ("Nito", "NITO") and p2 in ("Nito", "NITO"):
                raise SupremeViolationError("Heresy: Cannot subtract Nito from Nito.")
            if p2 in ("Nito", "NITO"):
                raise SupremeViolationError("Heresy: Cannot subtract Nito from a finite value.")
            if p1 in ("Nito", "NITO"):
                return NitoSupreme

        if "*" in expr:
            parts = expr.split('*')
            p1 = parts[0].strip()
            p2 = parts[1].strip()
            other = None
            if p1 in ("Nito", "NITO"):
                other = p2
            elif p2 in ("Nito", "NITO"):
                other = p1
            if other is not None:
                try:
                    val = float(other) if '.' in other else int(other)
                    if val <= 0:
                        raise SupremeViolationError("Heresy: Cannot scale Nito by a non-positive factor.")
                except ValueError:
                    pass
            return NitoSupreme

        if "/" in expr:
            parts = expr.split('/')
            p1 = parts[0].strip()
            p2 = parts[1].strip()
            if p2 in ("Nito", "NITO"):
                if p1 in ("Nito", "NITO"):
                    raise SupremeViolationError("Heresy: Cannot divide Nito by Nito.")
                return 0.0
            if p1 in ("Nito", "NITO"):
                try:
                    val = float(p2) if '.' in p2 else int(p2)
                    if val <= 0:
                        raise SupremeViolationError("Heresy: Cannot divide Nito by a non-positive factor.")
                except ValueError:
                    pass
                return NitoSupreme

        if "+" in expr:
            return NitoSupreme
            
    # Math expression evaluation with environment variables substitution
    # First, locate all potential variable names in the expression
    words = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', expr)
    resolved_expr = expr
    for word in words:
        if word not in ("Nito", "NITO", "NO_NITO"):
            try:
                val = env.get(word)
                if isinstance(val, (int, float)):
                    resolved_expr = re.sub(rf'\b{word}\b', str(val), resolved_expr)
                elif isinstance(val, str):
                    resolved_expr = re.sub(rf'\b{word}\b', repr(val), resolved_expr)
            except NameError:
                pass
                
    # If the expression contains only numbers, math operators, logic comparators, and spaces, evaluate it safely
    if re.match(r'^[0-9.+\-*/\s()<>!=|&]+$|^(True|False)$', resolved_expr):
        try:
            return eval(resolved_expr, {"__builtins__": None}, {})
        except Exception:
            pass

    if expr in env.values:
        return env.get(expr)
        
    try:
        return float(expr) if '.' in expr else int(expr)
    except ValueError:
        pass
        
    return expr

# ==============================================================================
# CLI & RUNNER
# ==============================================================================

def run_code(source: str, evaluator: Evaluator) -> Any:
    try:
        lexer = Lexer(source)
        tokens = lexer.tokenize()
        parser = Parser(tokens)
        ast = parser.parse()
        return evaluator.evaluate(ast)
    except SupremeViolationError as e:
        # Never catch or heal heresy; propagate the exception
        raise e
    except Exception as e:
        # Fallback to AI System for any syntax, lexical, or general runtime error (like NameError)
        return ai_fallback_interpreter(source, evaluator.environment)

def start_repl():
    print("Welcome to NitoScript Interactive REPL (v0.1.0)")
    evaluator = Evaluator()
    while True:
        try:
            line = input("Nito> ")
            if line.strip() in ("exit", "exit()", "quit", "quit()"):
                break
            if not line.strip():
                continue
            run_code(line, evaluator)
        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye.")
            break

def main():
    if len(sys.argv) > 1:
        filepath = sys.argv[1]
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                source = f.read()
            evaluator = Evaluator()
            run_code(source, evaluator)
        except FileNotFoundError:
            print(f"Error: File not found '{filepath}'", file=sys.stderr)
            sys.exit(1)
    else:
        start_repl()

if __name__ == "__main__":
    main()
