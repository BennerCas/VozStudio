"""Auditoria automatizada de la politica estricta CERO EMOJIS en todo el proyecto."""

from __future__ import annotations

from pathlib import Path

from src.core.config import PROJECT_ROOT

SCAN_EXTENSIONS = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".css",
    ".html",
    ".md",
    ".ps1",
    ".json",
    ".yml",
    ".yaml",
}

EXCLUDED_DIRS = {
    "node_modules",
    "dist",
    ".vite",
    "__pycache__",
    ".pytest_cache",
    "playwright-report",
    "test-results",
}

# Rangos de codepoints Unicode correspondientes a emojis, dingbats, pictogramas y selectores emoji.
# El simbolo registrado U+00AE (®) esta explicitamente permitido por DISENO.md.
PROHIBITED_CODEPOINT_RANGES: tuple[tuple[int, int], ...] = (
    (0x200D, 0x200D),    # Zero Width Joiner (secuencias ZWJ emoji)
    (0x231A, 0x231B),    # Watch / Hourglass
    (0x23E9, 0x23FA),    # Simbolos multimedia estilo emoji
    (0x25FD, 0x25FE),    # Cuadrados medianos emoji
    (0x2600, 0x27BF),    # Miscellaneous Symbols + Dingbats
    (0x2B50, 0x2B50),    # Estrella emoji
    (0x2B55, 0x2B55),    # Circulo pesado emoji
    (0xFE0F, 0xFE0F),    # Variation Selector-16 (presentacion emoji)
    (0x1F000, 0x1FAFF),  # Suplemento completo de emoticonos, pictogramas, transporte y banderas
)


def is_prohibited_emoji_char(ch: str) -> bool:
    """Determina si un caracter individual pertenece a los rangos de emojis prohibidos."""
    cp = ord(ch)
    if cp == 0x00AE:
        return False
    for low, high in PROHIBITED_CODEPOINT_RANGES:
        if low <= cp <= high:
            return True
    return False


def find_emoji_violations_in_text(text: str) -> list[tuple[int, int, int]]:
    """Retorna lista de (linea_1based, columna_1based, codepoint) con emojis detectados."""
    violations: list[tuple[int, int, int]] = []
    for line_idx, line in enumerate(text.splitlines(), start=1):
        for col_idx, ch in enumerate(line, start=1):
            if is_prohibited_emoji_char(ch):
                violations.append((line_idx, col_idx, ord(ch)))
    return violations


def _iter_project_files(root: Path) -> list[Path]:
    targets = [
        root / "src",
        root / "tests",
        root / "scripts",
        root / "docs",
        root / "README.md",
    ]
    collected: list[Path] = []
    for target in targets:
        if not target.exists():
            continue
        if target.is_file():
            collected.append(target)
            continue
        for candidate in target.rglob("*"):
            if not candidate.is_file():
                continue
            if candidate.name == "package-lock.json":
                continue
            if candidate.suffix.lower() not in SCAN_EXTENSIONS:
                continue
            if any(part in EXCLUDED_DIRS for part in candidate.parts):
                continue
            collected.append(candidate)
    return sorted(set(collected))


def test_emoji_detector_precision() -> None:
    """Verifica que el detector permita ® y espanol pero bloquee emojis reales."""
    allowed_sample = "HUMAN AI SYNERGY BY BENNER CASTILLO - 2026\u00ae | Sintesis en espanol: áéíóúñ¿¡"
    assert find_emoji_violations_in_text(allowed_sample) == []

    for cp in (0x1F600, 0x1F525, 0x2705, 0x26A0, 0xFE0F, 0x200D):
        sample = f"Linea con caracter prohibido {chr(cp)} en texto"
        detected = find_emoji_violations_in_text(sample)
        assert len(detected) == 1
        assert detected[0][2] == cp


def test_zero_emojis_across_repository() -> None:
    """Escanea src/, tests/, scripts/, docs/ y README.md garantizando 0 caracteres emoji."""
    files = _iter_project_files(PROJECT_ROOT)
    assert len(files) > 0, "No se encontraron archivos para auditar en el proyecto."

    failures: list[str] = []
    for file_path in files:
        content = file_path.read_text(encoding="utf-8", errors="replace")
        for line_no, col_no, cp in find_emoji_violations_in_text(content):
            rel = file_path.relative_to(PROJECT_ROOT)
            failures.append(f"{rel}:{line_no}:{col_no} contiene U+{cp:04X}")

    assert not failures, "Violaciones a la regla CERO EMOJIS detectadas:\n" + "\n".join(failures)
