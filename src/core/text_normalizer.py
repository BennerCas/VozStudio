"""Normalizador fonetico nativo y segmentador de texto en espanol para sintesis TTS."""

from __future__ import annotations

import re
import unicodedata

MAX_SUPPORTED_INTEGER = 999_999_999_999

_UNITS_0_TO_29: tuple[str, ...] = (
    "cero",
    "uno",
    "dos",
    "tres",
    "cuatro",
    "cinco",
    "seis",
    "siete",
    "ocho",
    "nueve",
    "diez",
    "once",
    "doce",
    "trece",
    "catorce",
    "quince",
    "dieciséis",
    "diecisiete",
    "dieciocho",
    "diecinueve",
    "veinte",
    "veintiuno",
    "veintidós",
    "veintitrés",
    "veinticuatro",
    "veinticinco",
    "veintiséis",
    "veintisiete",
    "veintiocho",
    "veintinueve",
)

_TENS: dict[int, str] = {
    30: "treinta",
    40: "cuarenta",
    50: "cincuenta",
    60: "sesenta",
    70: "setenta",
    80: "ochenta",
    90: "noventa",
}

_HUNDREDS: dict[int, str] = {
    1: "ciento",
    2: "doscientos",
    3: "trescientos",
    4: "cuatrocientos",
    5: "quinientos",
    6: "seiscientos",
    7: "setecientos",
    8: "ochocientos",
    9: "novecientos",
}


def _under_one_hundred(n: int, apocopate_one: bool = False) -> str:
    """Convierte un entero en [1, 99] a palabras en espanol."""
    if n == 1:
        return "un" if apocopate_one else "uno"
    if n == 21:
        return "veintiún" if apocopate_one else "veintiuno"
    if n < 30:
        return _UNITS_0_TO_29[n]

    ten = (n // 10) * 10
    unit = n % 10
    ten_word = _TENS[ten]
    if unit == 0:
        return ten_word
    if unit == 1:
        return f"{ten_word} y un" if apocopate_one else f"{ten_word} y uno"
    return f"{ten_word} y {_UNITS_0_TO_29[unit]}"


def _under_one_thousand(n: int, apocopate_one: bool = False) -> str:
    """Convierte un entero en [1, 999] a palabras en espanol."""
    if n == 100:
        return "cien"
    if n < 100:
        return _under_one_hundred(n, apocopate_one=apocopate_one)

    hundreds = n // 100
    remainder = n % 100
    hundreds_word = _HUNDREDS[hundreds]
    if remainder == 0:
        return hundreds_word
    return f"{hundreds_word} {_under_one_hundred(remainder, apocopate_one=apocopate_one)}"


def _under_one_million(n: int, apocopate_one: bool = False) -> str:
    """Convierte un entero en [1, 999_999] a palabras en espanol."""
    thousands = n // 1000
    remainder = n % 1000
    parts: list[str] = []

    if thousands == 1:
        parts.append("mil")
    elif thousands > 1:
        parts.append(f"{_under_one_thousand(thousands, apocopate_one=True)} mil")

    if remainder > 0:
        parts.append(_under_one_thousand(remainder, apocopate_one=apocopate_one))

    return " ".join(parts)


def number_to_spanish(n: int, *, apocopate_one: bool = False) -> str:
    """Convierte un entero entre 0 y 999_999_999_999 a su forma exacta en espanol."""
    if isinstance(n, bool) or not isinstance(n, int):
        raise TypeError("El valor proporcionado debe ser un entero.")

    if n < 0:
        return f"menos {number_to_spanish(-n, apocopate_one=apocopate_one)}"

    if n > MAX_SUPPORTED_INTEGER:
        raise ValueError(f"Numero fuera de rango soportado (maximo {MAX_SUPPORTED_INTEGER}): {n}")

    if n == 0:
        return "cero"

    millions = n // 1_000_000
    remainder = n % 1_000_000
    parts: list[str] = []

    if millions == 1:
        parts.append("un millón")
    elif millions > 1:
        parts.append(f"{_under_one_million(millions, apocopate_one=True)} millones")

    if remainder > 0:
        parts.append(_under_one_million(remainder, apocopate_one=apocopate_one))

    return " ".join(parts)


def _digits_to_spanish(digits: str) -> str:
    """Pronuncia una cadena larga de digitos caracter por caracter."""
    return " ".join(_UNITS_0_TO_29[int(ch)] for ch in digits if ch.isdigit())


def _integer_str_to_spanish(digits: str, *, apocopate_one: bool = False) -> str:
    """Convierte una cadena de digitos enteros a espanol con fallback digito a digito."""
    stripped = digits.lstrip("0")
    if not stripped:
        return "cero"
    if len(stripped) > 12:
        return _digits_to_spanish(digits)
    return number_to_spanish(int(stripped), apocopate_one=apocopate_one)


def _fraction_str_to_spanish(frac: str) -> str:
    """Convierte la parte fraccionaria de un decimal conservando ceros a la izquierda."""
    if not frac:
        return "cero"
    leading_zeros = len(frac) - len(frac.lstrip("0"))
    rest = frac.lstrip("0")
    if not rest:
        return "cero"

    parts: list[str] = ["cero"] * leading_zeros
    if len(rest) <= 12:
        parts.append(number_to_spanish(int(rest)))
    else:
        parts.append(_digits_to_spanish(rest))
    return " ".join(parts)


def _parse_numeric_token(raw: str) -> tuple[str, str | None]:
    """Separa un token numerico en (parte_entera, parte_fraccionaria_opcional)."""
    if re.fullmatch(r"\d{1,3}(?:\.\d{3}){2,}", raw) or re.fullmatch(r"\d{1,3}(?:,\d{3}){2,}", raw):
        return re.sub(r"[.,]", "", raw), None

    if "." in raw and "," in raw:
        last_dot = raw.rfind(".")
        last_comma = raw.rfind(",")
        if last_dot > last_comma:
            int_part = raw[:last_dot].replace(",", "")
            frac_part = raw[last_dot + 1 :]
        else:
            int_part = raw[:last_comma].replace(".", "")
            frac_part = raw[last_comma + 1 :]
        return int_part, frac_part or None

    if "." in raw:
        int_part, frac_part = raw.split(".", 1)
        return int_part, frac_part or None

    if "," in raw:
        int_part, frac_part = raw.split(",", 1)
        return int_part, frac_part or None

    return raw, None


def _is_forbidden_or_control_char(ch: str) -> bool:
    """Filtra caracteres de control, pictogramas y rangos emoji sin usar literales prohibidos."""
    code = ord(ch)
    if ch in ("\n", "\t", "\r"):
        return False
    if 0x2600 <= code <= 0x27BF or code in (0xFE0F, 0x200D) or 0xD800 <= code <= 0xDFFF or code > 0xFFFF:
        return True
    category = unicodedata.category(ch)
    return category.startswith("C") or category == "So"


def _strip_control_and_pictographs(text: str) -> str:
    """Normaliza saltos de linea, comillas tipograficas y remueve caracteres de control o simbolos graficos."""
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\t", " ")
    text = text.replace("\u2026", "...")
    text = text.replace("\u2014", ", ").replace("\u2013", "-")
    for quote_char in ("\u201c", "\u201d", "\u00ab", "\u00bb", "\u2018", "\u2019", '"'):
        text = text.replace(quote_char, "")

    allowed_symbols = {"$": True, "\u20ac": True, "\u00a3": True, "%": True, "\u00b0": True}
    cleaned: list[str] = []
    for ch in text:
        if ch in allowed_symbols:
            cleaned.append(ch)
        elif not _is_forbidden_or_control_char(ch):
            cleaned.append(ch)
    return "".join(cleaned)


_TITLE_ABBREVIATIONS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\bp\.\s*ej\.", flags=re.IGNORECASE), "por ejemplo"),
    (re.compile(r"\bEE\.\s*UU\."), "Estados Unidos"),
    (re.compile(r"\bDres\.", flags=re.IGNORECASE), "doctores"),
    (re.compile(r"\bDra\.", flags=re.IGNORECASE), "doctora"),
    (re.compile(r"\bDr\.", flags=re.IGNORECASE), "doctor"),
    (re.compile(r"\bSres\.", flags=re.IGNORECASE), "señores"),
    (re.compile(r"\bSrta\.", flags=re.IGNORECASE), "señorita"),
    (re.compile(r"\bSra\.", flags=re.IGNORECASE), "señora"),
    (re.compile(r"\bSr\.", flags=re.IGNORECASE), "señor"),
    (re.compile(r"\bIng\.", flags=re.IGNORECASE), "ingeniero"),
    (re.compile(r"\bLic\.", flags=re.IGNORECASE), "licenciado"),
    (re.compile(r"\bArq\.", flags=re.IGNORECASE), "arquitecto"),
    (re.compile(r"\bProfa\.", flags=re.IGNORECASE), "profesora"),
    (re.compile(r"\bProf\.", flags=re.IGNORECASE), "profesor"),
    (re.compile(r"\bGral\.", flags=re.IGNORECASE), "general"),
    (re.compile(r"\bAvda\.", flags=re.IGNORECASE), "avenida"),
    (re.compile(r"\bAv\.", flags=re.IGNORECASE), "avenida"),
    (re.compile(r"\bpágs\.", flags=re.IGNORECASE), "páginas"),
    (re.compile(r"\bpags\.", flags=re.IGNORECASE), "páginas"),
    (re.compile(r"\bpág\.", flags=re.IGNORECASE), "página"),
    (re.compile(r"\bpag\.", flags=re.IGNORECASE), "página"),
    (re.compile(r"\bmáx\.", flags=re.IGNORECASE), "máximo"),
    (re.compile(r"\bmín\.", flags=re.IGNORECASE), "mínimo"),
    (re.compile(r"\bN\.º", flags=re.IGNORECASE), "número"),
    (re.compile(r"\bN\u00b0", flags=re.IGNORECASE), "número"),
    (re.compile(r"\bNro\.", flags=re.IGNORECASE), "número"),
    (re.compile(r"\bNúm\.", flags=re.IGNORECASE), "número"),
    (re.compile(r"\bNum\.", flags=re.IGNORECASE), "número"),
    (re.compile(r"\bNo\.(?=\s*\d)", flags=re.IGNORECASE), "número"),
)

_END_AWARE_ABBREVIATIONS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\baprox\.", flags=re.IGNORECASE), "aproximadamente"),
    (re.compile(r"\betc\.", flags=re.IGNORECASE), "etcétera"),
)

_COMPOUND_UNITS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\bkm\s*/\s*h\b", flags=re.IGNORECASE), "kilómetros por hora"),
    (re.compile(r"\bm\s*/\s*s\b", flags=re.IGNORECASE), "metros por segundo"),
    (re.compile(r"\u00b0\s*C\b"), " grados centígrados"),
    (re.compile(r"\u00b0\s*F\b"), " grados Fahrenheit"),
)

_NUMERIC_UNITS: dict[str, tuple[str, str]] = {
    "km": ("kilómetro", "kilómetros"),
    "cm": ("centímetro", "centímetros"),
    "mm": ("milímetro", "milímetros"),
    "kg": ("kilogramo", "kilogramos"),
    "mg": ("miligramo", "miligramos"),
    "ms": ("milisegundo", "milisegundos"),
    "khz": ("kilohercio", "kilohercios"),
    "mhz": ("megahercio", "megahercios"),
    "ghz": ("gigahercio", "gigahercios"),
    "hz": ("hercio", "hercios"),
    "gb": ("gigabyte", "gigabytes"),
    "mb": ("megabyte", "megabytes"),
    "kb": ("kilobyte", "kilobytes"),
    "tb": ("terabyte", "terabytes"),
}

_CURRENCY_META: dict[str, tuple[str, str, str, str]] = {
    "$": ("dólar", "dólares", "centavo", "centavos"),
    "USD": ("dólar estadounidense", "dólares estadounidenses", "centavo", "centavos"),
    "MXN": ("peso mexicano", "pesos mexicanos", "centavo", "centavos"),
    "\u20ac": ("euro", "euros", "céntimo", "céntimos"),
    "EUR": ("euro", "euros", "céntimo", "céntimos"),
    "\u00a3": ("libra esterlina", "libras esterlinas", "penique", "peniques"),
}


def _expand_abbreviations(text: str) -> str:
    """Expande abreviaturas frecuentes cuidando limites oracionales."""
    for pattern, replacement in _TITLE_ABBREVIATIONS:
        text = pattern.sub(replacement, text)

    for pattern, word in _END_AWARE_ABBREVIATIONS:

        def _replace_end_aware(match: re.Match[str], base_word: str = word) -> str:
            tail = match.string[match.end() :]
            if not tail.strip() or re.match(r"^\s+[A-ZÁÉÍÓÚÑ¿¡]", tail):
                return f"{base_word}."
            return base_word

        text = pattern.sub(_replace_end_aware, text)

    return text


def _expand_time_expressions(text: str) -> str:
    """Expande horas en formato 24h/12h (ej. 14:30 -> catorce horas con treinta minutos)."""
    pattern = re.compile(r"(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?(?!\d)")

    def _replace_time(match: re.Match[str]) -> str:
        hours = int(match.group(1))
        minutes = int(match.group(2))
        seconds_str = match.group(3)

        hour_text = "una hora" if hours == 1 else f"{number_to_spanish(hours)} horas"
        parts = [hour_text]

        if minutes == 1:
            parts.append("con un minuto")
        elif minutes > 1:
            parts.append(f"con {number_to_spanish(minutes)} minutos")

        if seconds_str is not None:
            seconds = int(seconds_str)
            if seconds == 1:
                parts.append("y un segundo")
            elif seconds > 1:
                parts.append(f"y {number_to_spanish(seconds)} segundos")

        return " ".join(parts)

    return pattern.sub(_replace_time, text)


def _format_currency_amount(raw_num: str, currency_key: str) -> str:
    """Formatea un importe monetario con concordancia singular/plural y centavos."""
    singular, plural, cent_singular, cent_plural = _CURRENCY_META[currency_key]
    int_str, frac_str = _parse_numeric_token(raw_num)
    int_val = int(int_str) if int_str.isdigit() and len(int_str) <= 12 else None

    if int_val == 1:
        main_phrase = f"un {singular}"
    else:
        num_words = _integer_str_to_spanish(int_str, apocopate_one=True)
        main_phrase = f"{num_words} {plural}"

    if frac_str:
        cents_digits = (frac_str + "0")[:2] if len(frac_str) == 1 else frac_str[:2]
        if cents_digits.isdigit():
            cents_val = int(cents_digits)
            if cents_val == 1:
                return f"{main_phrase} con un {cent_singular}"
            if cents_val > 1:
                return f"{main_phrase} con {number_to_spanish(cents_val, apocopate_one=True)} {cent_plural}"

    return main_phrase


def _expand_currencies(text: str) -> str:
    """Expande importes precedidos o seguidos por simbolos o codigos de divisa."""
    num_pat = r"(?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d+)?"

    prefix_pattern = re.compile(rf"(?:(USD|MXN|EUR)\s*\$?|(\$|\u20ac|\u00a3))\s*({num_pat})(?!\d)")

    def _replace_prefix(match: re.Match[str]) -> str:
        code = match.group(1) or match.group(2)
        raw_num = match.group(3)
        return _format_currency_amount(raw_num, code)

    text = prefix_pattern.sub(_replace_prefix, text)

    postfix_pattern = re.compile(rf"(?<![\w$])({num_pat})\s*(\$|\u20ac|\u00a3)(?!\w)")

    def _replace_postfix(match: re.Match[str]) -> str:
        raw_num = match.group(1)
        symbol = match.group(2)
        return _format_currency_amount(raw_num, symbol)

    return postfix_pattern.sub(_replace_postfix, text)


def _expand_percentages(text: str) -> str:
    """Expande porcentajes enteros o decimales (ej. 85% -> ochenta y cinco por ciento)."""
    num_pat = r"(?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d+)?"
    pattern = re.compile(rf"(?<!\w)({num_pat})\s*%")

    def _replace_pct(match: re.Match[str]) -> str:
        int_str, frac_str = _parse_numeric_token(match.group(1))
        if frac_str is not None:
            num_words = f"{_integer_str_to_spanish(int_str)} punto {_fraction_str_to_spanish(frac_str)}"
        else:
            num_words = _integer_str_to_spanish(int_str)
        return f"{num_words} por ciento"

    return pattern.sub(_replace_pct, text)


def _expand_units(text: str) -> str:
    """Expande unidades fisicas y digitales comunes en espanol."""
    for pattern, replacement in _COMPOUND_UNITS:
        text = pattern.sub(replacement, text)

    num_pat = r"(?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d+)?"
    unit_keys = "|".join(sorted(_NUMERIC_UNITS.keys(), key=len, reverse=True))
    pattern = re.compile(rf"(?<!\w)({num_pat})\s*({unit_keys})\b", flags=re.IGNORECASE)

    def _replace_unit(match: re.Match[str]) -> str:
        raw_num = match.group(1)
        unit_key = match.group(2).lower()
        singular, plural = _NUMERIC_UNITS[unit_key]
        int_str, frac_str = _parse_numeric_token(raw_num)
        if frac_str is None and int_str.lstrip("0") == "1":
            return f"un {singular}"
        if frac_str is not None:
            num_words = f"{_integer_str_to_spanish(int_str)} punto {_fraction_str_to_spanish(frac_str)}"
        else:
            num_words = _integer_str_to_spanish(int_str, apocopate_one=True)
        return f"{num_words} {plural}"

    return pattern.sub(_replace_unit, text)


def _expand_numbers_and_decimals(text: str) -> str:
    """Expande separadores de miles, decimales (coma o punto) y enteros restantes."""
    thousands_pat = re.compile(r"(?<!\d)(?:\d{1,3}(?:\.\d{3}){2,}|\d{1,3}(?:,\d{3}){2,})(?!\d)")
    text = thousands_pat.sub(
        lambda m: _integer_str_to_spanish(re.sub(r"[.,]", "", m.group(0))),
        text,
    )

    mixed_decimal_pat = re.compile(
        r"(?<!\d)(?:\d{1,3}(?:\.\d{3})+,\d+|\d{1,3}(?:,\d{3})+\.\d+)(?!\d)"
    )

    def _replace_mixed_decimal(match: re.Match[str]) -> str:
        int_str, frac_str = _parse_numeric_token(match.group(0))
        return f"{_integer_str_to_spanish(int_str)} punto {_fraction_str_to_spanish(frac_str or '0')}"

    text = mixed_decimal_pat.sub(_replace_mixed_decimal, text)

    decimal_pat = re.compile(r"(?<!\d)(\d+)[.,](\d+)(?!\d)")
    text = decimal_pat.sub(
        lambda m: f"{_integer_str_to_spanish(m.group(1))} punto {_fraction_str_to_spanish(m.group(2))}",
        text,
    )

    integer_pat = re.compile(r"(?<!\d)\d+(?!\d)")
    text = integer_pat.sub(lambda m: _integer_str_to_spanish(m.group(0)), text)
    return text


def _clean_punctuation_and_spaces(text: str) -> str:
    """Limpia espacios redundantes conservando signos hispanos (¿, ?, ¡, !, ,, ;, :, .)."""
    lines: list[str] = []
    for raw_line in text.split("\n"):
        line = re.sub(r"[ \t\f\v]+", " ", raw_line).strip()
        if not line:
            lines.append("")
            continue
        line = re.sub(r"\s+([,.;:?!])", r"\1", line)
        line = re.sub(r"([¿¡])\s+", r"\1", line)
        line = re.sub(r"([,;:?!])(?=[^\s,.;:?!])", r"\1 ", line)
        line = re.sub(r"[ \t\f\v]{2,}", " ", line).strip()
        lines.append(line)

    joined = "\n".join(lines)
    joined = re.sub(r"\n{3,}", "\n\n", joined)
    return joined.strip()


def normalize_spanish_text(text: str) -> str:
    """Pipeline completo de normalizacion fonetica y lexica para espanol."""
    if not text or not text.strip():
        return ""

    result = _strip_control_and_pictographs(text)
    result = _expand_abbreviations(result)
    result = _expand_time_expressions(result)
    result = _expand_currencies(result)
    result = _expand_percentages(result)
    result = _expand_units(result)
    result = _expand_numbers_and_decimals(result)
    result = _clean_punctuation_and_spaces(result)
    return result


def _split_words_never_cut(clause: str, max_chars: int) -> list[str]:
    """Subdivide una clausula por espacios sin cortar palabras jamas."""
    words = clause.split()
    if not words:
        return []

    chunks: list[str] = []
    current = ""
    for word in words:
        if len(word) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            for idx in range(0, len(word), max_chars):
                chunks.append(word[idx : idx + max_chars])
            continue

        candidate = word if not current else f"{current} {word}"
        if len(candidate) <= max_chars:
            current = candidate
        else:
            chunks.append(current)
            current = word

    if current:
        chunks.append(current)
    return chunks


def _subdivide_long_sentence(sentence: str, max_chars: int) -> list[str]:
    """Subdivide una oracion que excede max_chars priorizando comas y dos puntos."""
    sentence = sentence.strip()
    if not sentence:
        return []
    if len(sentence) <= max_chars:
        return [sentence]

    parts = re.split(r"(?<=[,:])\s+", sentence)
    chunks: list[str] = []
    current = ""

    for part in parts:
        part = part.strip()
        if not part:
            continue

        if len(part) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            chunks.extend(_split_words_never_cut(part, max_chars))
            continue

        candidate = part if not current else f"{current} {part}"
        if len(candidate) <= max_chars:
            current = candidate
        else:
            chunks.append(current)
            current = part

    if current:
        chunks.append(current)
    return chunks


def split_spanish_segments(text: str, max_chars: int = 260) -> list[str]:
    """Divide textos en espanol por oraciones y subdivide las largas sin cortar palabras."""
    if max_chars < 20:
        raise ValueError("max_chars debe ser al menos 20 caracteres.")
    if not text or not text.strip():
        return []

    paragraphs = [p.strip() for p in text.splitlines() if p.strip()]
    sentence_Split_pattern = re.compile(r"(?<=[.?!;])\s+")

    segments: list[str] = []
    for paragraph in paragraphs:
        collapsed = re.sub(r"\s+", " ", paragraph).strip()
        raw_sentences = sentence_Split_pattern.split(collapsed)
        for sentence in raw_sentences:
            clean_sentence = sentence.strip()
            if not clean_sentence:
                continue
            if len(clean_sentence) <= max_chars:
                segments.append(clean_sentence)
            else:
                segments.extend(_subdivide_long_sentence(clean_sentence, max_chars))

    return segments


def prepare_spanish_chunks(text: str, max_chars: int = 260) -> list[str]:
    """Normaliza foneticamente el texto en espanol y lo segmenta en bloques seguros."""
    normalized = normalize_spanish_text(text)
    if not normalized:
        return []
    return split_spanish_segments(normalized, max_chars=max_chars)
