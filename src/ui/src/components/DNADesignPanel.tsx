import { useMemo, useRef, useState } from 'react';
import { AnimatedIcon } from '../icons/AnimatedIcon';
import { studioApi } from '../services/api';
import type { LibraryItem, VoiceInfo } from '../types/tts';

export interface DNADesignPanelProps {
  selectedEngineId: string;
  selectedVoiceId: string;
  voices: VoiceInfo[];
  isSynthesizing: boolean;
  onVoiceSaved?: (engineId: string, voiceId: string) => void;
  onAudioGenerated?: (item: LibraryItem) => void;
}

const VOICE_DESIGN_PRESETS = [
  {
    label: 'Locutora Radio 32a',
    prompt:
      'Voz femenina de unos 32 anos, timbre calido y envolvente, cadencia pausada, acento castellano neutro, resonancia de estudio de radio y diccion impecable.',
  },
  {
    label: 'Documental Epico 50a',
    prompt:
      'Voz masculina madura de unos 50 anos, timbre grave, profundo y solemne, proyeccion teatral, ritmo pausado con gran peso dramatico y presencia de graves.',
  },
  {
    label: 'Podcast Tech 28a',
    prompt:
      'Voz androgina joven de 28 anos, articulacion dinamica, agil y brillante, tono entusiasta y natural de microfono de condensador, acento neutro contemporaneo.',
  },
  {
    label: 'Audiolibro Fantasia',
    prompt:
      'Voz femenina misteriosa, textura suave y aireada, cadencia cadenciosa con entonacion narrativa envolvente, sibilancias controladas y pausas expresivas.',
  },
];

const PARALINGUISTIC_TAGS = [
  { label: 'Risa', tag: '<|laughter|>' },
  { label: 'Respiracion', tag: '<|breath|>' },
  { label: 'Susurro', tag: '<|whisper|>' },
  { label: 'Suspiro', tag: '<|sigh|>' },
];

export function DNADesignPanel({
  selectedEngineId: _unusedEngineId,
  selectedVoiceId,
  voices,
  isSynthesizing,
  onVoiceSaved,
  onAudioGenerated,
}: DNADesignPanelProps) {
  const [dnaSubMode, setDnaSubMode] = useState<'qwen' | 'cosy'>('qwen');

  // Estado Qwen3 VoiceDesign
  const [qwenPrompt, setQwenPrompt] = useState<string>(
    'Voz femenina de unos 32 anos, timbre calido y envolvente, cadencia pausada, acento castellano neutro, resonancia de estudio de radio y diccion impecable.',
  );
  const [qwenText, setQwenText] = useState<string>(
    'Bienvenidos a VozStudio Omni. Este mensaje ha sido sintetizado mediante decodificacion autorregresiva guiada exclusivamente por parametros fenotipicos en lenguaje natural.',
  );
  const [qwenSpeed, setQwenSpeed] = useState<number>(1.0);
  const [qwenTemperature, setQwenTemperature] = useState<number>(0.7);
  const [saveAsVoice, setSaveAsVoice] = useState<boolean>(true);
  const [newVoiceName, setNewVoiceName] = useState<string>('Mi Timbre DNA');
  const [newVoiceRegion, setNewVoiceRegion] = useState<string>('ES');

  // Estado CosyVoice Instruct-TTS
  const [cosyInstruction, setCosyInstruction] = useState<string>(
    'Habla con tono emocionado y alegre, modulando las frases con energia positiva.',
  );
  const [cosyText, setCosyText] = useState<string>(
    'No puedo creer que hayamos alcanzado esta fidelidad neural <|laughter|> el resultado es extraordinario.',
  );
  const [cosySpeed, setCosySpeed] = useState<number>(1.0);
  const [selectedBaseVoiceId, setSelectedBaseVoiceId] = useState<string>(selectedVoiceId || 'cosy_nova_es');

  // Estados de IA y Retroalimentacion
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const targetTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Filtrar voces disponibles de CosyVoice
  const cosyAvailableVoices = useMemo(
    () => voices.filter((v) => v.engine === 'cosyvoice' || v.supports_cloning),
    [voices],
  );

  // Insertar etiqueta paralinguistica en la posicion del cursor
  const handleInsertTag = (tag: string) => {
    const textarea = targetTextareaRef.current;
    if (!textarea) {
      setCosyText((prev) => prev + ` ${tag} `);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextText = cosyText.slice(0, start) + ` ${tag} ` + cosyText.slice(end);
    setCosyText(nextText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length + 2, start + tag.length + 2);
    }, 10);
  };

  // Mejorar con AI usando Phi-3.5 DirectML
  const handleEnhanceWithAI = async () => {
    const currentInput = dnaSubMode === 'qwen' ? qwenPrompt : cosyInstruction;
    if (!currentInput.trim() || isEnhancing) return;

    setIsEnhancing(true);
    setStatusMessage('Optimizando descripcion acustica mediante Phi-3.5 DirectML en GPU local...');

    try {
      const mode = dnaSubMode === 'qwen' ? 'voice_design' : 'instruct_tts';
      const result = await studioApi.enhancePrompt(currentInput.trim(), mode);
      if (dnaSubMode === 'qwen') {
        setQwenPrompt(result.enhanced_prompt);
      } else {
        setCosyInstruction(result.enhanced_prompt);
      }
      setStatusMessage(`Prompt optimizado con ${result.engine_used.toUpperCase()}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al conectar con Phi DirectML';
      setStatusMessage(`Aviso AI: ${msg}`);
    } finally {
      setIsEnhancing(false);
    }
  };

  // Sintesis DNA
  const handleExecuteDna = async () => {
    if (isGenerating || isSynthesizing) return;
    setIsGenerating(true);
    setStatusMessage(
      dnaSubMode === 'qwen'
        ? 'Generando huella timbrica con Qwen3-TTS 12Hz VoiceDesign...'
        : 'Modulando expresion con CosyVoice Instruct-TTS...',
    );

    try {
      const engineId = dnaSubMode === 'qwen' ? 'qwen3_tts' : 'cosyvoice';
      const textToUse = dnaSubMode === 'qwen' ? qwenText : cosyText;

      const result = await studioApi.synthesizeDna({
        text: textToUse,
        engine_id: engineId,
        mode: dnaSubMode === 'qwen' ? 'voice_design' : 'instruct_tts',
        voice_design_prompt: dnaSubMode === 'qwen' ? qwenPrompt : undefined,
        instruct_prompt: dnaSubMode === 'cosy' ? cosyInstruction : undefined,
        voice_id: dnaSubMode === 'cosy' ? selectedBaseVoiceId : 'qwen3_voice_design',
        speed: dnaSubMode === 'qwen' ? qwenSpeed : cosySpeed,
        temperature: dnaSubMode === 'qwen' ? qwenTemperature : 0.7,
        save_as_custom: dnaSubMode === 'qwen' ? saveAsVoice : false,
        custom_voice_name: newVoiceName.trim() || 'Voz DNA Qwen',
        custom_voice_region: newVoiceRegion,
      });

      if (result.saved_voice) {
        setStatusMessage(
          `Timbre "${result.saved_voice.name}" guardado y persistido en Columna 1 bajo ${engineId.toUpperCase()}.`,
        );
        onVoiceSaved?.(engineId, result.saved_voice.id);
      } else {
        setStatusMessage('Audio DNA sintetizado y archivado correctamente en Biblioteca.');
      }

      onAudioGenerated?.(result.item);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fallo en la generacion de audio DNA';
      setStatusMessage(`Error: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-col justify-between gap-[0.45cqh] overflow-hidden"
      data-testid="dna-design-panel"
    >
      {/* Sub-selector superior de Arquitecturas DNA */}
      <div className="flex shrink-0 items-center justify-between gap-[0.45cqw] rounded-[0.5cqh] border border-cyan-400/25 bg-cyan-950/20 px-[0.6cqw] py-[0.25cqh]">
        <div className="flex min-w-0 items-center gap-[0.35cqw]">
          <AnimatedIcon name="sparkles" variant="oscillate" trigger="always" className="text-cyan-300" />
          <span className="tx-xs truncate font-semibold text-cyan-100">
            ARQUITECTURA DE DISENO TIMBRICO Y CONTROL SEMANTICO:
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-[0.22cqw]">
          <button
            type="button"
            data-testid="switch-dna-qwen-btn"
            onClick={() => setDnaSubMode('qwen')}
            className={`rounded-[0.35cqh] border px-[0.5cqw] py-[0.15cqh] font-mono-tech text-[clamp(7.5px,0.85cqh,11px)] font-semibold transition ${
              dnaSubMode === 'qwen'
                ? 'border-cyan-400 bg-cyan-400/25 text-cyan-100 shadow-[0_0_10px_rgba(12,211,245,0.2)]'
                : 'border-sky-400/20 bg-slate-900/80 text-slate-300 hover:border-cyan-400/50'
            }`}
          >
            QWEN3-TTS 12Hz VOICEDESIGN (D:\ai-models)
          </button>

          <button
            type="button"
            data-testid="switch-dna-cosy-btn"
            onClick={() => setDnaSubMode('cosy')}
            className={`rounded-[0.35cqh] border px-[0.5cqw] py-[0.15cqh] font-mono-tech text-[clamp(7.5px,0.85cqh,11px)] font-semibold transition ${
              dnaSubMode === 'cosy'
                ? 'border-cyan-400 bg-cyan-400/25 text-cyan-100 shadow-[0_0_10px_rgba(12,211,245,0.2)]'
                : 'border-sky-400/20 bg-slate-900/80 text-slate-300 hover:border-cyan-400/50'
            }`}
          >
            COSYVOICE 3/2 INSTRUCT-TTS
          </button>
        </div>
      </div>

      {/* CUERPO MODO 1: Qwen3 VoiceDesign */}
      {dnaSubMode === 'qwen' && (
        <>
          {/* Fila de Presets de Diseno Fenotipico */}
          <div className="flex shrink-0 items-center justify-between gap-[0.35cqw] rounded-[0.45cqh] border border-sky-400/20 bg-slate-950/70 px-[0.55cqw] py-[0.22cqh]">
            <div className="flex min-w-0 items-center gap-[0.25cqw] overflow-hidden">
              <AnimatedIcon name="feather" className="text-cyan-300 shrink-0" />
              <span className="font-mono-tech text-[clamp(7px,0.82cqh,10.5px)] font-semibold text-slate-300 shrink-0">
                PRESETS DE TIMBRE:
              </span>
              <div className="flex items-center gap-[0.2cqw] overflow-hidden">
                {VOICE_DESIGN_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setQwenPrompt(p.prompt)}
                    className="rounded-[0.3cqh] border border-sky-400/20 bg-slate-900/80 px-[0.38cqw] py-[0.1cqh] font-mono-tech text-[clamp(7px,0.78cqh,10px)] text-slate-300 hover:border-cyan-400/60 hover:text-cyan-200 transition whitespace-nowrap"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <span className="badge-chip badge-cyan shrink-0">12Hz 1.7B Sin Semilla WAV</span>
          </div>

          {/* Cajon de Prompt Semantico con Boton "Mejorar con AI" */}
          <div className="flex min-h-0 flex-1 flex-col gap-[0.25cqh] rounded-[0.5cqh] border border-cyan-400/20 bg-slate-950/65 p-[0.35cqh_0.5cqw]">
            <div className="flex shrink-0 items-center justify-between">
              <label
                htmlFor="qwen-prompt-input"
                className="font-mono-tech text-[clamp(7.5px,0.82cqh,10.5px)] font-semibold text-cyan-300"
              >
                DESCRIPCION FENOTIPICA Y TIMBRICA DEL LOCUTOR:
              </label>

              <button
                type="button"
                disabled={isEnhancing || !qwenPrompt.trim()}
                data-testid="enhance-qwen-prompt-btn"
                onClick={() => void handleEnhanceWithAI()}
                className="flex items-center gap-[0.25cqw] rounded-[0.35cqh] border border-cyan-400/70 bg-gradient-to-r from-cyan-500/20 to-sky-500/20 px-[0.45cqw] py-[0.12cqh] tx-xs font-semibold text-cyan-100 transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <AnimatedIcon
                  name={isEnhancing ? 'loader' : 'wand'}
                  variant={isEnhancing ? 'spin' : 'pulse'}
                  trigger={isEnhancing ? 'always' : 'hover'}
                />
                <span>{isEnhancing ? 'Mejorando con Phi...' : 'Mejorar con AI (Phi DirectML)'}</span>
              </button>
            </div>

            <textarea
              id="qwen-prompt-input"
              data-testid="qwen-voice-design-prompt"
              rows={2}
              value={qwenPrompt}
              onChange={(e) => setQwenPrompt(e.target.value)}
              placeholder="Describa genero, edad, textura, calidez, acento y ambiente de grabacion..."
              className="studio-textarea min-h-0 flex-1"
            />
          </div>

          {/* Texto a Sintetizar */}
          <div className="flex min-h-0 flex-1 flex-col gap-[0.25cqh] rounded-[0.5cqh] border border-sky-400/20 bg-slate-950/65 p-[0.35cqh_0.5cqw]">
            <div className="flex shrink-0 items-center justify-between">
              <span className="font-mono-tech text-[clamp(7.5px,0.82cqh,10.5px)] font-semibold text-slate-300">
                GUION A SINTETIZAR EN ESPANOL:
              </span>
              <span className="font-mono-tech tx-xs text-amber-300">{qwenText.length} CAR.</span>
            </div>

            <textarea
              data-testid="qwen-voice-design-text"
              rows={2}
              value={qwenText}
              onChange={(e) => setQwenText(e.target.value)}
              placeholder="Texto que pronunciara la voz disenada..."
              className="studio-textarea min-h-0 flex-1"
            />
          </div>

          {/* Opciones de Guardado Directo como Timbre en Columna 1 */}
          <div className="flex shrink-0 items-center justify-between gap-[0.35cqw] rounded-[0.45cqh] border border-amber-400/25 bg-amber-950/20 px-[0.55cqw] py-[0.18cqh]">
            <div className="flex min-w-0 items-center gap-[0.3cqw] overflow-hidden">
              <input
                id="toggle-save-voice"
                type="checkbox"
                checked={saveAsVoice}
                onChange={(e) => setSaveAsVoice(e.target.checked)}
                className="h-[1.4cqh] w-[1.4cqh] rounded border-amber-400 bg-slate-900 text-amber-400"
              />
              <label
                htmlFor="toggle-save-voice"
                className="font-mono-tech text-[clamp(7px,0.82cqh,10.5px)] font-semibold text-amber-200 shrink-0 cursor-pointer"
              >
                GUARDAR TIMBRE EN COLUMNA 1:
              </label>

              {saveAsVoice && (
                <>
                  <input
                    type="text"
                    data-testid="dna-voice-name-input"
                    value={newVoiceName}
                    onChange={(e) => setNewVoiceName(e.target.value)}
                    placeholder="Nombre del timbre..."
                    maxLength={35}
                    className="w-[10cqw] rounded-[0.35cqh] border border-amber-400/30 bg-slate-900/90 px-[0.35cqw] py-[0.1cqh] font-mono-tech text-[clamp(7.5px,0.82cqh,11px)] text-slate-100"
                  />
                  <select
                    value={newVoiceRegion}
                    onChange={(e) => setNewVoiceRegion(e.target.value)}
                    aria-label="Region dialectal"
                    className="rounded-[0.35cqh] border border-amber-400/30 bg-slate-900/90 px-[0.3cqw] py-[0.1cqh] font-mono-tech text-[clamp(7.5px,0.82cqh,11px)] text-slate-100"
                  >
                    <option value="ES">ES</option>
                    <option value="MX">MX</option>
                    <option value="AR">AR</option>
                    <option value="LATAM">LATAM</option>
                  </select>
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-[0.3cqw]">
              <span className="font-mono-tech tx-xs text-slate-400">Temp: {qwenTemperature.toFixed(2)}</span>
              <input
                type="range"
                min={0.3}
                max={1.1}
                step={0.05}
                value={qwenTemperature}
                onChange={(e) => setQwenTemperature(Number(e.target.value))}
                aria-label="Temperatura acustica"
                className="studio-slider w-[5cqw]"
              />
            </div>
          </div>
        </>
      )}

      {/* CUERPO MODO 2: CosyVoice Instruct-TTS */}
      {dnaSubMode === 'cosy' && (
        <>
          {/* Selector de Voz Base y Chips Paralinguisticos */}
          <div className="flex shrink-0 items-center justify-between gap-[0.35cqw] rounded-[0.45cqh] border border-sky-400/20 bg-slate-950/70 px-[0.55cqw] py-[0.22cqh]">
            <div className="flex min-w-0 items-center gap-[0.3cqw] overflow-hidden">
              <span className="font-mono-tech text-[clamp(7px,0.82cqh,10.5px)] font-semibold text-slate-300 shrink-0">
                VOZ BASE:
              </span>
              <select
                value={selectedBaseVoiceId}
                onChange={(e) => setSelectedBaseVoiceId(e.target.value)}
                className="rounded-[0.35cqh] border border-sky-400/30 bg-slate-900/90 px-[0.35cqw] py-[0.1cqh] font-mono-tech text-[clamp(7.5px,0.82cqh,11px)] text-slate-100"
              >
                {cosyAvailableVoices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.region}) {v.is_custom ? '[CLON]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex shrink-0 items-center gap-[0.25cqw]">
              <span className="font-mono-tech text-[clamp(7px,0.78cqh,10px)] text-slate-400">TAGS:</span>
              {PARALINGUISTIC_TAGS.map((pt) => (
                <button
                  key={pt.tag}
                  type="button"
                  data-testid={`insert-tag-${pt.label.toLowerCase()}`}
                  onClick={() => handleInsertTag(pt.tag)}
                  title={`Insertar etiqueta ${pt.tag} en el texto`}
                  className="rounded-[0.3cqh] border border-cyan-400/40 bg-cyan-500/15 px-[0.35cqw] py-[0.1cqh] font-mono-tech text-[clamp(7px,0.78cqh,10px)] font-semibold text-cyan-200 hover:bg-cyan-500/30 transition"
                >
                  +{pt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cajon de Instruccion con Boton "Mejorar con AI" */}
          <div className="flex min-h-0 flex-1 flex-col gap-[0.25cqh] rounded-[0.5cqh] border border-cyan-400/20 bg-slate-950/65 p-[0.35cqh_0.5cqw]">
            <div className="flex shrink-0 items-center justify-between">
              <label
                htmlFor="cosy-instruction-input"
                className="font-mono-tech text-[clamp(7.5px,0.82cqh,10.5px)] font-semibold text-cyan-300"
              >
                INSTRUCCION DE ESTILO, EMOCION Y MODULACION:
              </label>

              <button
                type="button"
                disabled={isEnhancing || !cosyInstruction.trim()}
                data-testid="enhance-cosy-prompt-btn"
                onClick={() => void handleEnhanceWithAI()}
                className="flex items-center gap-[0.25cqw] rounded-[0.35cqh] border border-cyan-400/70 bg-gradient-to-r from-cyan-500/20 to-sky-500/20 px-[0.45cqw] py-[0.12cqh] tx-xs font-semibold text-cyan-100 transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <AnimatedIcon
                  name={isEnhancing ? 'loader' : 'wand'}
                  variant={isEnhancing ? 'spin' : 'pulse'}
                  trigger={isEnhancing ? 'always' : 'hover'}
                />
                <span>{isEnhancing ? 'Mejorando con Phi...' : 'Mejorar con AI (Phi DirectML)'}</span>
              </button>
            </div>

            <textarea
              id="cosy-instruction-input"
              data-testid="cosy-instruct-prompt"
              rows={2}
              value={cosyInstruction}
              onChange={(e) => setCosyInstruction(e.target.value)}
              placeholder="Ejemplo: Habla con tono emocionado y alegre, o susurra con misterio..."
              className="studio-textarea min-h-0 flex-1"
            />
          </div>

          {/* Texto Objetivo con Tags */}
          <div className="flex min-h-0 flex-1 flex-col gap-[0.25cqh] rounded-[0.5cqh] border border-sky-400/20 bg-slate-950/65 p-[0.35cqh_0.5cqw]">
            <div className="flex shrink-0 items-center justify-between">
              <span className="font-mono-tech text-[clamp(7.5px,0.82cqh,10.5px)] font-semibold text-slate-300">
                TEXTO CON ETIQUETAS PARALINGUISTICAS:
              </span>
              <span className="font-mono-tech tx-xs text-cyan-300">{cosyText.length} CAR.</span>
            </div>

            <textarea
              ref={targetTextareaRef}
              data-testid="cosy-instruct-text"
              rows={2}
              value={cosyText}
              onChange={(e) => setCosyText(e.target.value)}
              placeholder="Inserte texto con etiquetas como <|laughter|> o <|breath|>..."
              className="studio-textarea min-h-0 flex-1"
            />
          </div>
        </>
      )}

      {/* Banner de Estado Discreto */}
      {statusMessage && (
        <div
          data-testid="dna-status-banner"
          className="shrink-0 truncate rounded-[0.4cqh] border border-cyan-400/30 bg-slate-900/90 px-[0.5cqw] py-[0.12cqh] font-mono-tech text-[clamp(7px,0.78cqh,10px)] text-cyan-200"
        >
          {statusMessage}
        </div>
      )}

      {/* Barra Inferior de Ejecucion */}
      <div className="grid shrink-0 grid-cols-12 items-center gap-[0.45cqw] rounded-[0.5cqh] border border-cyan-400/20 bg-slate-950/65 px-[0.55cqw] py-[0.38cqh]">
        <div className="col-span-4 flex flex-col">
          <div className="flex justify-between font-mono-tech tx-xs">
            <span className="text-[var(--text-muted)]">CADENCIA</span>
            <span className="text-cyan-300">
              {dnaSubMode === 'qwen' ? qwenSpeed.toFixed(2) : cosySpeed.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min={0.6}
            max={1.6}
            step={0.05}
            value={dnaSubMode === 'qwen' ? qwenSpeed : cosySpeed}
            onChange={(e) =>
              dnaSubMode === 'qwen'
                ? setQwenSpeed(Number(e.target.value))
                : setCosySpeed(Number(e.target.value))
            }
            aria-label="Cadencia vocal"
            className="studio-slider mt-[0.2cqh]"
          />
        </div>

        <div className="col-span-8 flex justify-end">
          <button
            type="button"
            disabled={isGenerating || isSynthesizing || (dnaSubMode === 'qwen' ? !qwenText.trim() : !cosyText.trim())}
            onClick={() => void handleExecuteDna()}
            data-testid="execute-dna-btn"
            className="flex w-full items-center justify-center gap-[0.35cqw] rounded-[0.5cqh] border border-cyan-300/80 bg-gradient-to-r from-cyan-400 to-sky-500 px-[0.7cqw] py-[0.48cqh] tx-xs font-bold text-slate-950 shadow-[0_0_18px_rgba(12,211,245,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <AnimatedIcon
              name={isGenerating ? 'loader' : 'sparkles'}
              variant={isGenerating ? 'spin' : 'pulse'}
              trigger={isGenerating ? 'always' : 'hover'}
              className="text-slate-950"
            />
            <span>
              {isGenerating
                ? 'Sintetizando Huella DNA...'
                : dnaSubMode === 'qwen'
                  ? 'Generar Voz con VoiceDesign (Qwen3 12Hz)'
                  : 'Sintetizar con Instruct-TTS (CosyVoice)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
