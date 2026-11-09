# VozStudio Omni-ES

Estacion de trabajo de sintesis de voz neural en espanol 100 % offline para escritorio Windows, acelerada mediante ONNX Runtime + DirectML (hasta 25 GB de VRAM dinamica) y 12 hilos de CPU.

## Caracteristicas Principales

- **Arquitectura Multimotor Modular (`Engine Adapter` + `Lazy Offloading`)**:
  - **Kokoro-82M ONNX (Motor Principal por Defecto)**: Voces neurales en espanol (`ef_dora`, `em_alex`, `em_santa`) y mezclas personalizadas a 24 kHz.
  - **Piper VITS ONNX (Multiacento Regional)**: Voces nativas de Espana (`ES`), Mexico (`MX`) y Argentina (`AR`) con inferencia instantanea.
  - **Meta MMS-TTS (`mms-tts-spa`)**: Motor VITS ultraligero para sintesis inmediata en CPU.
  - **CosyVoice 3 ONNX**: Clonacion zero-shot multilingue con deteccion automatica de espanol y control de estilo sin dependencias de PyTorch.
  - **Qwen3-TTS VoiceDesign 1.7B**: Runtime oficial aislado para diseño de timbre por instrucción en español, con procedencia auditada.
  - **F5-TTS Spanish**: Runtime oficial aislado para clonación multiacento con audio de referencia; no se presenta como una voz directa.
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

## VozStudio Atlas: propuesta y prototipo navegable

`docs/PROPUESTA_VOZSTUDIO_ATLAS.md` describe la evolucion de esta consola de sintesis a una
**productora de contenido hablado** (proyecto > documento > bloque > toma, elenco, recetas,
QA automatico, licencias y entregables). Parte del codigo real de este repositorio.

El prototipo visual de esa propuesta esta en `docs/prototipo-atlas/` y funciona sin build y
sin dependencias. `index.html` es un **archivo unico autonomo**: lleva el CSS, los datos y todo
el JavaScript incrustados, sin red ni CDN, asi que se abre con doble clic, como adjunto o desde
cualquier servidor estatico. Incluye 12 pantallas, el catalogo completo de 34 voces en 8 motores,
1.110 prompts de diseno de voz y 12 presets de lectura.

Para servirlo en local (util para probarlo desde el movil o la red):

```bash
cd docs/prototipo-atlas
python3 -m http.server 8123 --bind 0.0.0.0
```

El codigo fuente sigue modular en `src/` y `assets/estilos.css`; `dev.html` es la version de
desarrollo con `type="module"` (necesita servidor HTTP). Tras editar el fuente, se regenera la
portada con:

```bash
cd docs/prototipo-atlas
node scripts/empaquetar.mjs
```

Para retomarlo en otro chat, `docs/prototipo-atlas/CONTINUAR.md` recoge el estado verificado
y las decisiones que no conviene deshacer.

## Lanzador Nativo Kiosk-WorkArea (Sin Consolas)

Para una experiencia de escritorio nativa e inmersiva sin barras de navegador, consolas visibles ni anuncios de extensiones:

1. **Doble clic en el acceso directo del Escritorio:** `VozStudio Omni-ES.lnk`
2. **O ejecucion directa del binario nativo Win64:**
   ```powershell
   .\VozStudio-Omni-ES.exe
   ```
   - Inicia silenciosamente el backend FastAPI sobre `pythonw.exe` sin abrir ventanas de terminal.
   - Despliega la interfaz de usuario en ventana independiente con modo aplicacion (`--app`), ocupando la pantalla completa respetando unicamente la barra de tareas de Windows.
   - Al cerrar la ventana, se liberan automaticamente los recursos de inferencia y se detiene el proceso backend.

## Ejecucion Rapida para Desarrollo

1. Vincular modelos locales:
   ```powershell
   pwsh -File .\scripts\setup_links.ps1
   ```
2. Ejecutar pruebas de verificacion:
   ```powershell
   pytest tests/unit
   pwsh -File .\scripts\check_no_emoji.ps1
   ```
3. Iniciar estacion completa en modo desarrollo:
   ```powershell
   pwsh -File .\scripts\start_dev.ps1
   ```

## Runtimes nativos opcionales

Los runtimes de Qwen3, F5 y PyTorch DirectML se mantienen en `.runtimes/`, fuera
del control de versiones, para no cambiar el Python del backend. En un equipo
nuevo se instalan con:

```powershell
pwsh -File .\scripts\install_native_runtimes.ps1
```

Después de instalar, cierre y vuelva a abrir el lanzador de VozStudio. Qwen3
VoiceDesign y F5 se exponen como motores nativos solo cuando sus pesos locales
y sus runtimes están presentes; F5 requiere siempre un audio de referencia.

---

HUMAN AI SYNERGY BY BENNER CASTILLO - 2026®
