# VozStudio Omni-ES

Estacion de trabajo de sintesis de voz neural en espanol 100 % offline para escritorio Windows, acelerada mediante ONNX Runtime + DirectML (hasta 25 GB de VRAM dinamica) y 12 hilos de CPU.

## Caracteristicas Principales

- **Arquitectura Multimotor Modular (`Engine Adapter` + `Lazy Offloading`)**:
  - **Kokoro-82M ONNX (Motor Principal por Defecto)**: Voces neurales en espanol (`ef_dora`, `em_alex`, `em_santa`) y mezclas personalizadas a 24 kHz.
  - **Piper VITS ONNX (Multiacento Regional)**: Voces nativas de Espana (`ES`), Mexico (`MX`) y Argentina (`AR`) con inferencia instantanea.
  - **Meta MMS-TTS (`mms-tts-spa`)**: Motor VITS ultraligero para sintesis inmediata en CPU.
  - **CosyVoice 3 ONNX**: Clonacion zero-shot multilingue con deteccion automatica de espanol y control de estilo sin dependencias de PyTorch.
  - **F5-TTS Spanish / StyleTTS 2 BSC**: Adaptadores preparados para clonacion multiacento hispano y narracion expresiva.
- **Interfaz 16:9 Cero Scroll**:
  - Lienzo proporcional `16:9` sin barras de desplazamiento (`overflow: hidden`) ni espacios vacios.
  - Paginacion calculada dinamicamente mediante `ResizeObserver` y segmentacion automatica de textos extensos.
  - Sistema unificado de iconos vectoriales de linea animados (`AnimatedIcon`) y politica estricta de cero emojis.
- **Biblioteca Auditada (`biblioteca/`)**:
  - Nomenclatura estandar `YYYYMMDD_HHMMSS_audio_[motor]_[voz].wav` acompanada de metadatos `.json` verificables (latencia, RTF, parametros y huella de hardware).

## Estructura del Proyecto

Conforme a `ESTRUCTURA.md`:

- `src/main/`: Punto de entrada del servidor local.
- `src/core/`: Control de hardware DirectML, gestor de memoria Zero-OOM, normalizador fonetico espanol y DSP de audio.
- `src/ai/`: Adaptadores desacoplados de motores TTS.
- `src/api/`: Endpoints FastAPI REST y telemetria.
- `src/models/`: Esquemas estrictos Pydantic.
- `src/ui/`: Aplicacion React + Vite + TailwindCSS en formato 16:9 sin scroll.
- `models_link/`: Enlaces directos a `C:\antigravityAS\Modelos -ai-brains\` (cero duplicacion de modelos).
- `biblioteca/`: Repositorio de audios sintetizados y sus metadatos JSON.
- `tests/`: Suite unitaria, integracion y E2E Playwright (`no_scroll`).
- `scripts/`: Automatizacion de enlaces, validacion cero-emoji, arranque y limpieza.
- `docs/`: Documentacion de arquitectura y auditoria industrial.

## Ejecucion Rapida

1. Vincular modelos locales:
   ```powershell
   pwsh -File .\scripts\setup_links.ps1
   ```
2. Ejecutar pruebas de verificacion:
   ```powershell
   pytest tests/unit
   pwsh -File .\scripts\check_no_emoji.ps1
   ```
3. Iniciar estacion completa (Backend + UI):
   ```powershell
   pwsh -File .\scripts\start_dev.ps1
   ```

---

HUMAN AI SYNERGY BY BENNER CASTILLO - 2026®
