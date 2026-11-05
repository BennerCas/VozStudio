# Guia de Grabacion y Calibracion Fonetica para Clonacion Vocal Zero-Shot

Esta guia establece los principios foneticos, acusticos y prosodicos para capturar muestras de voz humana optimas que maximicen la fidelidad timbrica y el realismo en los motores neurales de **VozStudio Omni-ES** (F5-TTS, CosyVoice 3, Coqui XTTS-v2 y Qwen3-TTS).

---

## 1. Reglas Acusticas de Oro para la Captura

1. **Distancia y Angulo del Microfono**:
   - Mantenga el microfono a **15 - 20 centimetros** de la boca.
   - Posicione la capsula a **45 grados** (ligeramente ladeada) para evitar el impacto directo del flujo de aire en consonantes oclusivas ('p', 'b', 't') y sibilantes ('s').
2. **Entorno Acustico y Ruido de Fondo**:
   - Evite habitaciones con eco o superficies reflectantes desnudas (paredes de azulejo o cristal). Cortinas o estanterias ayudan a romper reflexiones.
   - Apague ventiladores, aire acondicionado y cierre ventanas durante la toma.
3. **Duracion Optima**:
   - Para modelos autoregresivos y de difusion (F5-TTS, CosyVoice, XTTS-v2), la ventana ideal se ubica entre **7 y 12 segundos**.
   - Muestras menores a 4 segundos carecen de informacion prosodica suficiente. Muestras superiores a 20 segundos introducen fatiga y mayor probabilidad de ruido.
4. **Procesamiento Post-Toma**:
   - Tras grabar, utilice siempre el boton **Limpiar Audio (DSP)** de la consola para eliminar automaticamente retumbos sub-75Hz, sibilancias agudas y resonancia nasal mediante filtros IIR parametricos.

---

## 2. Repertorio de Guiones Calibrados por Registro

A continuacion se presentan los guiones integrados en el teleprompter de la aplicacion, disenados especificamente para capturar diferentes dimensiones vocales:

### Guion 1: Pangrama Fonetico Panhispanico (Cobertura Total)
- **Objetivo**: Extraer la firma espectral de todos los fonemas castellanos, diptongos, consonantes vibrantes y oclusivas.
- **Tono**: Neutro, equilibrado, diccion clara y velocidad media.
- **Duracion Estimada**: 8 a 10 segundos.
- **Texto**:
  > *"El veloz murcielago hindu comia feliz cardillo y kiwi; la cigueña tocaba el saxofon detras del palenque de paja, exigiendo un ritmo exacto y brillante."*
- **Indicacion de Lectura**: Articule con precision cada silaba sin exagerar la entonacion. Es el guion estandar recomendado para calibracion general.

---

### Guion 2: Narrativa Calida (Audiolibros y Ensayos)
- **Objetivo**: Resaltar resonancias medias y graves, respiracion diafragmatica organica y micro-pausas reflexivas.
- **Tono**: Pausado, calido, envolvente y sobrio.
- **Duracion Estimada**: 10 a 12 segundos.
- **Texto**:
  > *"Al caer la tarde sobre el valle, el silencio revelaba antiguos secretos olvidados entre los robles; una leve brisa susurraba historias que el tiempo nunca logro borrar."*
- **Indicacion de Lectura**: Respire con calma en las comas y permita que la cadencia baje naturalmente hacia el final de cada frase.

---

### Guion 3: Conversacional Natural (Podcasts y Dialogos Cotidianos)
- **Objetivo**: Capturar la frescura del habla espontanea, inflexiones interrogativas y sonrisa vocal.
- **Tono**: Amigable, dinámico, informal y humano.
- **Duracion Estimada**: 9 a 11 segundos.
- **Texto**:
  > *"¿Te has fijado en lo rapido que pasa el dia cuando estas concentrado? A veces basta una buena conversacion y un cafe caliente para cambiarlo todo por completo."*
- **Indicacion de Lectura**: Lea con expresion relajada, elevando sutilmente el tono en la pregunta inicial y proyectando cercania.

---

### Guion 4: Comercial y Energetico (Publicidad y Spots)
- **Objetivo**: Capturar brillo espectral en altas frecuencias, fuerza diafragmatica y tempo vivo.
- **Tono**: Dinamico, optimista, seguro y convincente.
- **Duracion Estimada**: 7 a 9 segundos.
- **Texto**:
  > *"¡Descubre una forma completamente nueva de crear contenido! Mas rapido, con potencia absoluta y sin limites tecnicos en tu flujo de trabajo diario."*
- **Indicacion de Lectura**: Proyecte con decision hacia el frente, marcando el acento prosodico en los adjetivos clave.

---

### Guion 5: Corporativo y Autoridad (Noticias y Presentaciones)
- **Objetivo**: Capturar estabilidad timbrica, diccion ejecutiva y registro medio-grave asertivo.
- **Tono**: Institucional, firme, claro y profesional.
- **Duracion Estimada**: 9 a 11 segundos.
- **Texto**:
  > *"La innovacion constante y el analisis riguroso de cada dato definen el rumbo estrategico hacia resultados solidos, sostenibles y confiables para el futuro."*
- **Indicacion de Lectura**: Mantenga la altura tonal estable, con ritmo metrico constante y cierres concluyentes.

---

### Guion 6: Intimo y Serenidad (Meditacion y Calidez Cercana)
- **Objetivo**: Capturar armónicos de proximidad, calidez de garganta y textura susurrada.
- **Tono**: Cercano, delicado, calmo y tranquilizador.
- **Duracion Estimada**: 8 a 10 segundos.
- **Texto**:
  > *"Respira hondo y date este momento de calma; no hay prisa alguna, todo encaja con perfecta serenidad cuando escuchas tu propia voz interior."*
- **Indicacion de Lectura**: Acerquese a 10 centimetros del microfono y hable a bajo volumen, permitiendo que el aire caliente defina el timbre.

---

## 3. Correspondencia entre Audio y Transcripcion

Los motores de clonacion zero-shot condicionan la generacion cruzada emparejando los tokens de texto con las caracteristicas acusticas del espectrograma Mel.

> **Importante**: La transcripcion en el campo *Transcripcion del Audio* debe coincidir **exactamente** con lo pronunciado en la grabacion. Si se omite o anade una palabra en la lectura real, ajustela en el campo de texto antes de clonar para evitar alucinaciones foneticas o distorsion en los primeros segundos.
