# Arquitectura Industrial: VozStudio Omni-ES

## 1. Principios Rectores

- **100 % Offline y Privacidad Local**: Ninguna llamada de red para sintesis, fonetizacion ni interfaz grafica.
- **Estrategia Nativa ONNX + DirectML**: Prioridad `DmlExecutionProvider` con limite dinamico de 25 GB de VRAM y fallback determinista a `CPUExecutionProvider` con 12 hilos (`intra_op_num_threads=12`).
- **Serializacion GPU DirectML (`asyncio.Lock` / `threading.RLock`)**: Evita `DXGI_ERROR_DEVICE_RESET` en iGPUs AMD RDNA3 durante solicitudes concurrentes.
- **Lazy Loading & Zero-OOM Offloading**: Un unico motor pesado permanece residente en VRAM/RAM a la vez; al conmutar de motor se libera la sesion anterior y se ejecuta `gc.collect()`.
- **Interfaz 16:9 Sin Scroll y Cero Emojis**: Lienzo fijo `16:9` con unidades relativas de contenedor (`cqw`/`cqh`), paginacion calculada por `ResizeObserver`, cero barras de scroll y sistema unico de iconos vectoriales de trazo animados (`AnimatedIcon`).

## 2. Capas del Sistema

1. **`src/core/`**:
   - `hardware.py`: Configuracion de `onnxruntime.SessionOptions`, deteccion de DirectML, metricas de RAM/CPU y variables de entorno de `GEMINI.md`.
   - `memory_manager.py`: Gestor de ciclo de vida de motores con bloqueo reentrante y desalojo limpio de sesiones.
   - `text_normalizer.py`: Expansion en espanol de cifras, divisas, porcentajes, abreviaturas, horas y segmentacion de bloques largos respetando signos de apertura (`¿`, `¡`).
   - `audio_dsp.py`: Normalizacion de pico, concatenacion con cross-fade suave entre oraciones, remuestreo y escritura WAV PCM 16-bit junto con registro obligatorio `.json` en `biblioteca/`.
2. **`src/ai/`**:
   - `base_engine.py`: Contrato abstracto `BaseTTSEngine`.
   - `kokoro_engine.py`: Motor principal por defecto (`Kokoro-82M v1.0 ONNX`) con `ef_dora`, `em_alex`, `em_santa` y mezclas personalizadas de estilo.
   - `piper_engine.py`: Motor regional multiacento (`Sherpa-ONNX` / `Piper VITS`) para Espana (`ES`), Mexico (`MX`) y Argentina (`AR`), incluyendo soporte multi-hablante (`sharvard` M/F).
   - `mms_engine.py`: Motor VITS ultraligero (`facebook/mms-tts-spa`) para sintesis rapida en CPU.
   - `cosyvoice_engine.py`: Clonacion zero-shot multilingue pura en ONNX (`CosyVoice3-ONNX`) con deteccion automatica de espanol.
   - `f5_engine.py` y `styletts2_engine.py`: Adaptadores modulares para clonacion hispana multiacento (`F5-Spanish`) y narracion expresiva (`StyleTTS 2 BSC-LT`).
3. **`src/api/` & `src/models/`**:
   - API FastAPI tipada con Pydantic v2 para sintesis, clonacion zero-shot, gestion de memoria de motores, consulta paginada de `biblioteca/` y telemetria de hardware.
4. **`src/ui/`**:
   - SPA en Vite + React + TypeScript + TailwindCSS disenada sobre un `Stage` 16:9 libre de scroll.
