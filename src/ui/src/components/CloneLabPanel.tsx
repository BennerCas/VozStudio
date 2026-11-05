import { useEffect, useMemo, useRef, useState } from 'react';
import { CLONING_CALIBRATION_SCRIPTS, type CalibrationScript } from '../data/fallbackCatalog';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { AnimatedIcon } from '../icons/AnimatedIcon';
import { studioApi } from '../services/api';

export interface CloneLabPanelProps {
  selectedEngineId: string;
  selectedVoiceId: string;
  referenceFile: File | null;
  referenceText: string;
  cloneBlocks: string[];
  activeCloneBlockIndex: number;
  speed: number;
  emotion: string;
  isCloning: boolean;
  onSwitchToCloningEngine: (engineId: string) => void;
  onReferenceFileChange: (file: File | null) => void;
  onReferenceTextChange: (value: string) => void;
  onChangeCloneBlock: (value: string) => void;
  onSelectCloneBlock: (index: number) => void;
  onSpeedChange: (val: number) => void;
  onEmotionChange: (val: string) => void;
  onRunClone: () => void;
  onVoiceSaved?: (engineId: string, voiceId: string) => void;
}

export function CloneLabPanel({
  selectedEngineId,
  selectedVoiceId,
  referenceFile,
  referenceText,
  cloneBlocks,
  activeCloneBlockIndex,
  speed,
  emotion,
  isCloning,
  onSwitchToCloningEngine,
  onReferenceFileChange,
  onReferenceTextChange,
  onChangeCloneBlock,
  onSelectCloneBlock,
  onSpeedChange,
  onEmotionChange,
  onRunClone,
  onVoiceSaved,
}: CloneLabPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [refSourceMode, setRefSourceMode] = useState<'upload' | 'mic'>('mic');
  const [activeScriptId, setActiveScriptId] = useState<string>('pangrama_fonetico');
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [isSavingVoice, setIsSavingVoice] = useState<boolean>(false);
  const [customVoiceName, setCustomVoiceName] = useState<string>('Voz Clonada');
  const [customVoiceRegion, setCustomVoiceRegion] = useState<string>('ES');
  const [dspFeedback, setDspFeedback] = useState<string | null>(null);
  const [cleanNoise, setCleanNoise] = useState<boolean>(true);
  const [cleanNasal, setCleanNasal] = useState<boolean>(true);
  const [cleanDeEsser, setCleanDeEsser] = useState<boolean>(true);

  const recorder = useVoiceRecorder();

  const isNativeCloningEngine =
    selectedEngineId === 'f5_spanish' ||
    selectedEngineId === 'cosyvoice' ||
    selectedEngineId === 'xtts_v2' ||
    selectedEngineId === 'qwen3_tts';

  const safeIdx = Math.min(
    Math.max(0, activeCloneBlockIndex),
    Math.max(0, cloneBlocks.length - 1),
  );
  const activeText = cloneBlocks[safeIdx] ?? '';

  const totalChars = useMemo(
    () => cloneBlocks.reduce((acc, b) => acc + b.length, 0),
    [cloneBlocks],
  );

  const selectedScript = useMemo(
    () => CLONING_CALIBRATION_SCRIPTS.find((s) => s.id === activeScriptId) ?? CLONING_CALIBRATION_SCRIPTS[0],
    [activeScriptId],
  );

  // Inicializar transcripcion de referencia con el guion activo si el campo esta vacio
  useEffect(() => {
    if (!referenceText.trim() && selectedScript) {
      onReferenceTextChange(selectedScript.text);
    }
  }, [selectedScript, referenceText, onReferenceTextChange]);

  const handleSelectScript = (script: CalibrationScript) => {
    setActiveScriptId(script.id);
    onReferenceTextChange(script.text);
  };

  // Cuando el microfono termina de grabar, asignar el archivo WAV generado como referencia
  useEffect(() => {
    if (recorder.recordedFile && refSourceMode === 'mic') {
      onReferenceFileChange(recorder.recordedFile);
    }
  }, [recorder.recordedFile, refSourceMode, onReferenceFileChange]);

  const handleApplyDspClean = async () => {
    if (!referenceFile || isCleaning) return;
    setIsCleaning(true);
    setDspFeedback('Aplicando filtros acusticos DSP (Anti-Ruido, Anti-Nasal, De-Esser)...');

    try {
      const result = await studioApi.cleanVocalAudio(referenceFile, {
        removeNoise: cleanNoise,
        antiNasal: cleanNasal,
        deEsser: cleanDeEsser,
        enhancePresence: true,
        targetPeak: 0.89,
      });

      const res = await fetch(result.audio_url);
      const blob = await res.blob();
      const cleanedFile = new File([blob], `limpio_${referenceFile.name}`, {
        type: 'audio/wav',
      });
      onReferenceFileChange(cleanedFile);
      if (refSourceMode === 'mic') {
        void recorder.setRecordedFromBlob(blob, cleanedFile.name);
      }

      setDspFeedback(
        `Filtros aplicados: ${result.metrics.filtros_aplicados.join(' | ')} (pico final: ${result.metrics.pico_final})`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error durante el procesamiento DSP';
      setDspFeedback(`Aviso DSP: ${msg}`);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleSaveVoiceAsTimbre = async () => {
    if (!referenceFile || isSavingVoice) return;
    setIsSavingVoice(true);
    setDspFeedback(`Guardando timbre "${customVoiceName.trim()}" en biblioteca y registrando en Columna 1...`);

    try {
      const saved = await studioApi.saveCustomVoice({
        engineId: selectedEngineId,
        name: customVoiceName.trim() || 'Voz Clonada',
        region: customVoiceRegion,
        gender: 'MIX',
        description: `Clon creado desde audio ${referenceFile.name}`,
        referenceText: referenceText.trim() || undefined,
        referenceAudio: referenceFile,
      });

      setDspFeedback(`Timbre "${saved.name}" registrado en Columna 1 bajo motor ${selectedEngineId.toUpperCase()} con exito.`);
      onVoiceSaved?.(selectedEngineId, saved.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar timbre personalizado';
      setDspFeedback(`Error al guardar: ${msg}`);
    } finally {
      setIsSavingVoice(false);
    }
  };

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-col justify-between gap-[0.45cqh] overflow-hidden"
      data-testid="clone-lab-panel"
    >
      {/* Cabecera de Estado Zero-Shot */}
      <div className="flex shrink-0 items-center justify-between gap-[0.45cqw] rounded-[0.5cqh] border border-amber-400/25 bg-amber-500/8 px-[0.6cqw] py-[0.25cqh]">
        <div className="flex min-w-0 items-center gap-[0.35cqw]">
          <AnimatedIcon
            name="fingerprint"
            variant="pulse"
            trigger="always"
            className="text-amber-300"
          />
          <span className="tx-xs truncate font-semibold text-amber-100">
            {isNativeCloningEngine
              ? `Motor Zero-Shot Activo: ${selectedEngineId.toUpperCase()} (${selectedVoiceId})`
              : 'Seleccione arquitectura Zero-Shot recomendada:'}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-[0.22cqw]">
          {(['f5_spanish', 'cosyvoice', 'xtts_v2', 'qwen3_tts'] as const).map((eng) => (
            <button
              key={eng}
              type="button"
              data-testid={`switch-${eng}-btn`}
              onClick={() => onSwitchToCloningEngine(eng)}
              className={`rounded-[0.35cqh] border px-[0.42cqw] py-[0.14cqh] font-mono-tech text-[clamp(7.5px,0.82cqh,11px)] font-semibold transition ${
                selectedEngineId === eng
                  ? 'border-amber-300 bg-amber-400/25 text-amber-100'
                  : 'border-sky-400/20 bg-slate-900/80 text-slate-300 hover:border-amber-400/50'
              }`}
            >
              {eng === 'f5_spanish'
                ? 'F5-TTS'
                : eng === 'cosyvoice'
                  ? 'COSYVOICE'
                  : eng === 'xtts_v2'
                    ? 'XTTS-V2'
                    : 'QWEN3'}
            </button>
          ))}
        </div>
      </div>

      {/* Selector de Guiones de Calibracion Fonetica y Tonal */}
      <div className="flex shrink-0 items-center justify-between gap-[0.35cqw] rounded-[0.45cqh] border border-sky-400/20 bg-slate-950/70 px-[0.55cqw] py-[0.22cqh]">
        <div className="flex min-w-0 items-center gap-[0.25cqw] overflow-hidden">
          <AnimatedIcon name="book-open" className="text-cyan-300 shrink-0" />
          <span className="font-mono-tech text-[clamp(7.5px,0.82cqh,10.5px)] font-semibold text-slate-300 shrink-0">
            GUIONES DE CALIBRACION:
          </span>
          <div className="flex items-center gap-[0.2cqw] overflow-hidden">
            {CLONING_CALIBRATION_SCRIPTS.map((script) => {
              const active = activeScriptId === script.id;
              return (
                <button
                  key={script.id}
                  type="button"
                  data-testid={`script-btn-${script.id}`}
                  onClick={() => handleSelectScript(script)}
                  title={`${script.tone} (${script.durationEst}) - ${script.tip}`}
                  className={`rounded-[0.3cqh] border px-[0.38cqw] py-[0.1cqh] font-mono-tech text-[clamp(7px,0.78cqh,10px)] font-medium transition whitespace-nowrap ${
                    active
                      ? 'border-cyan-400/80 bg-cyan-400/22 text-cyan-200'
                      : 'border-sky-400/15 bg-slate-900/80 text-slate-400 hover:border-sky-400/40 hover:text-slate-200'
                  }`}
                >
                  {script.label}
                </button>
              );
            })}
          </div>
        </div>

        {selectedScript && (
          <div className="flex shrink-0 items-center gap-[0.22cqw]">
            <span className="badge-chip badge-cyan">{selectedScript.durationEst}</span>
            <span className="badge-chip badge-amber">{selectedScript.tone}</span>
          </div>
        )}
      </div>

      {/* Caja de Teleprompter con el texto a leer en voz alta */}
      {selectedScript && (
        <div
          data-testid="teleprompter-box"
          className="shrink-0 rounded-[0.4cqh] border border-cyan-400/30 bg-cyan-950/25 px-[0.55cqw] py-[0.22cqh]"
        >
          <div className="flex items-center justify-between text-[clamp(7px,0.76cqh,10px)] text-cyan-300 font-mono-tech mb-[0.1cqh]">
            <span>LEER EN VOZ ALTA MIENTRAS GRABA:</span>
            <span className="text-slate-400 truncate ml-2">{selectedScript.tip}</span>
          </div>
          <p className="text-[clamp(8px,0.92cqh,11.5px)] font-medium text-slate-100 italic leading-snug">
            "{selectedScript.text}"
          </p>
        </div>
      )}

      {/* Fila: Grabacion de Microfono / Carga WAV y Transcripcion */}
      <div className="grid shrink-0 grid-cols-12 gap-[0.45cqw]">
        {/* Modulo Semilla: Grabar en Vivo o Cargar Archivo */}
        <div className="col-span-6 flex min-w-0 flex-col justify-between rounded-[0.5cqh] border border-sky-400/20 bg-slate-950/65 p-[0.35cqh_0.45cqw]">
          <div className="flex items-center justify-between">
            <span className="font-mono-tech text-[clamp(7px,0.82cqh,10.5px)] text-[var(--text-muted)]">
              SEMILLA VOCAL
            </span>
            <div className="flex items-center gap-[0.2cqw]">
              <button
                type="button"
                data-testid="ref-mode-mic-btn"
                onClick={() => setRefSourceMode('mic')}
                className={`rounded px-[0.35cqw] py-[0.08cqh] font-mono-tech text-[clamp(7px,0.78cqh,10px)] font-semibold transition ${
                  refSourceMode === 'mic'
                    ? 'border border-cyan-400/70 bg-cyan-400/20 text-cyan-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                MICROFONO
              </button>
              <button
                type="button"
                data-testid="ref-mode-upload-btn"
                onClick={() => setRefSourceMode('upload')}
                className={`rounded px-[0.35cqw] py-[0.08cqh] font-mono-tech text-[clamp(7px,0.78cqh,10px)] font-semibold transition ${
                  refSourceMode === 'upload'
                    ? 'border border-cyan-400/70 bg-cyan-400/20 text-cyan-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                SUBIR WAV
              </button>
            </div>
          </div>

          <div className="mt-[0.2cqh] flex min-w-0 items-center justify-between gap-[0.3cqw]">
            {refSourceMode === 'mic' ? (
              <div className="flex min-w-0 flex-1 items-center gap-[0.3cqw]">
                {!recorder.isRecording ? (
                  <button
                    type="button"
                    data-testid="start-mic-record-btn"
                    onClick={() => void recorder.startRecording()}
                    className="flex min-w-0 flex-1 items-center justify-center gap-[0.28cqw] rounded-[0.4cqh] border border-rose-400/50 bg-rose-500/15 px-[0.45cqw] py-[0.22cqh] tx-xs font-semibold text-rose-200 transition hover:bg-rose-500/25"
                  >
                    <AnimatedIcon name="mic" variant="pulse" trigger="hover" className="text-rose-400" />
                    <span>{referenceFile ? 'Regrabar Toma' : 'Grabar Voz en Vivo (15s)'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="stop-mic-record-btn"
                    onClick={recorder.stopRecording}
                    className="flex min-w-0 flex-1 items-center justify-center gap-[0.28cqw] rounded-[0.4cqh] border border-rose-400 bg-rose-600 px-[0.45cqw] py-[0.22cqh] tx-xs font-bold text-slate-950 transition animate-pulse"
                  >
                    <AnimatedIcon name="square" variant="none" className="text-slate-950" />
                    <span>Detener REC ({recorder.durationSec.toFixed(1)}s / 15s)</span>
                  </button>
                )}

                {recorder.isRecording && (
                  <div
                    aria-label="Medidor de nivel de voz"
                    className="h-[1.6cqh] w-[4.2cqw] shrink-0 overflow-hidden rounded-[0.3cqh] border border-sky-400/30 bg-slate-900"
                  >
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-400 transition-all duration-75"
                      style={{ width: `${Math.round(recorder.audioLevel * 100)}%` }}
                    />
                  </div>
                )}

                {referenceFile && !recorder.isRecording && (
                  <button
                    type="button"
                    data-testid="play-recorded-btn"
                    onClick={() => (recorder.isPlaying ? recorder.stopPlayback() : recorder.playRecorded())}
                    className="flex items-center gap-[0.22cqw] rounded-[0.4cqh] border border-cyan-400/40 bg-cyan-500/15 px-[0.4cqw] py-[0.22cqh] tx-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25"
                  >
                    <AnimatedIcon
                      name={recorder.isPlaying ? 'pause' : 'play'}
                      variant={recorder.isPlaying ? 'pulse' : 'none'}
                    />
                    <span>{recorder.isPlaying ? 'Pausa' : 'Oir'}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-[0.3cqw]">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".wav,audio/wav"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    onReferenceFileChange(f);
                  }}
                />
                <button
                  type="button"
                  data-testid="upload-ref-wav-btn"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-w-0 flex-1 items-center justify-center gap-[0.3cqw] rounded-[0.4cqh] border border-cyan-400/35 bg-cyan-500/12 px-[0.45cqw] py-[0.25cqh] tx-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20"
                >
                  <AnimatedIcon name="upload" variant="bounce" trigger="hover" />
                  <span className="truncate">
                    {referenceFile ? referenceFile.name : 'Cargar semilla .WAV'}
                  </span>
                </button>
                {referenceFile && (
                  <button
                    type="button"
                    onClick={() => onReferenceFileChange(null)}
                    aria-label="Quitar audio de referencia"
                    className="rounded border border-slate-700 px-[0.3cqw] py-[0.2cqh] tx-xs text-slate-400 hover:text-amber-300"
                  >
                    Quitar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modulo Transcripcion Fiel */}
        <div className="col-span-6 flex min-w-0 flex-col justify-between rounded-[0.5cqh] border border-sky-400/20 bg-slate-950/65 p-[0.35cqh_0.45cqw]">
          <div className="flex items-center justify-between">
            <label
              htmlFor="clone-ref-text"
              className="font-mono-tech text-[clamp(7px,0.82cqh,10.5px)] text-[var(--text-muted)] truncate"
            >
              TRANSCRIPCION DEL AUDIO
            </label>
            {referenceFile && (
              <span className="font-mono-tech text-[clamp(7px,0.78cqh,10px)] text-cyan-300 truncate">
                {referenceFile.name.slice(0, 20)}
              </span>
            )}
          </div>

          <input
            id="clone-ref-text"
            type="text"
            data-testid="clone-reference-text"
            maxLength={250}
            value={referenceText}
            onChange={(e) => onReferenceTextChange(e.target.value)}
            placeholder="Texto exacto pronunciado en el audio..."
            className="mt-[0.18cqh] w-full rounded-[0.4cqh] border border-sky-400/20 bg-slate-900/90 px-[0.4cqw] py-[0.2cqh] tx-xs text-slate-100"
          />
        </div>
      </div>

      {/* Barra de Herramientas DSP: Limpiar Audio (Ruido, Anti-Nasal, De-Esser) */}
      <div className="flex shrink-0 items-center justify-between gap-[0.35cqw] rounded-[0.45cqh] border border-cyan-400/25 bg-slate-950/80 px-[0.55cqw] py-[0.22cqh]">
        <div className="flex min-w-0 items-center gap-[0.3cqw]">
          <span className="font-mono-tech text-[clamp(7px,0.82cqh,10.5px)] font-semibold text-slate-300 shrink-0">
            TRATAMIENTO ACUSTICO:
          </span>

          <button
            type="button"
            data-testid="dsp-toggle-noise"
            onClick={() => setCleanNoise(!cleanNoise)}
            className={`rounded px-[0.35cqw] py-[0.1cqh] font-mono-tech text-[clamp(7px,0.78cqh,10px)] font-semibold transition ${
              cleanNoise
                ? 'border border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                : 'border border-slate-700/60 bg-slate-900 text-slate-400'
            }`}
          >
            Anti-Ruido (HPF 75Hz)
          </button>

          <button
            type="button"
            data-testid="dsp-toggle-nasal"
            onClick={() => setCleanNasal(!cleanNasal)}
            className={`rounded px-[0.35cqw] py-[0.1cqh] font-mono-tech text-[clamp(7px,0.78cqh,10px)] font-semibold transition ${
              cleanNasal
                ? 'border border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                : 'border border-slate-700/60 bg-slate-900 text-slate-400'
            }`}
          >
            Anti-Nasal (1050Hz -4.5dB)
          </button>

          <button
            type="button"
            data-testid="dsp-toggle-deesser"
            onClick={() => setCleanDeEsser(!cleanDeEsser)}
            className={`rounded px-[0.35cqw] py-[0.1cqh] font-mono-tech text-[clamp(7px,0.78cqh,10px)] font-semibold transition ${
              cleanDeEsser
                ? 'border border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                : 'border border-slate-700/60 bg-slate-900 text-slate-400'
            }`}
          >
            De-Esser (7kHz)
          </button>
        </div>

        <button
          type="button"
          disabled={!referenceFile || isCleaning}
          data-testid="apply-dsp-clean-btn"
          onClick={() => void handleApplyDspClean()}
          className="flex items-center gap-[0.25cqw] rounded-[0.4cqh] border border-cyan-300/70 bg-gradient-to-r from-cyan-400/25 to-sky-400/25 px-[0.55cqw] py-[0.22cqh] tx-xs font-semibold text-cyan-100 transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <AnimatedIcon
            name={isCleaning ? 'loader' : 'wand'}
            variant={isCleaning ? 'spin' : 'pulse'}
            trigger={isCleaning ? 'always' : 'hover'}
          />
          <span>{isCleaning ? 'Limpiando...' : 'Limpiar Audio (DSP)'}</span>
        </button>
      </div>

      {/* Registro de Timbre en Columna 1 */}
      <div className="flex shrink-0 items-center justify-between gap-[0.35cqw] rounded-[0.45cqh] border border-amber-400/25 bg-amber-950/20 px-[0.55cqw] py-[0.18cqh]">
        <div className="flex min-w-0 items-center gap-[0.3cqw] overflow-hidden">
          <AnimatedIcon name="sparkles" className="text-amber-300 shrink-0" />
          <span className="font-mono-tech text-[clamp(7px,0.82cqh,10.5px)] font-semibold text-amber-200 shrink-0">
            GUARDAR TIMBRE EN COLUMNA 1:
          </span>
          <input
            type="text"
            data-testid="custom-voice-name-input"
            value={customVoiceName}
            onChange={(e) => setCustomVoiceName(e.target.value)}
            placeholder="Nombre del timbre..."
            maxLength={40}
            className="w-[11cqw] rounded-[0.35cqh] border border-amber-400/30 bg-slate-900/90 px-[0.35cqw] py-[0.1cqh] font-mono-tech text-[clamp(7.5px,0.82cqh,11px)] text-slate-100"
          />
          <select
            value={customVoiceRegion}
            onChange={(e) => setCustomVoiceRegion(e.target.value)}
            aria-label="Region del timbre personalizado"
            className="rounded-[0.35cqh] border border-amber-400/30 bg-slate-900/90 px-[0.3cqw] py-[0.1cqh] font-mono-tech text-[clamp(7.5px,0.82cqh,11px)] text-slate-100"
          >
            <option value="ES">ES (Espana)</option>
            <option value="MX">MX (Mexico)</option>
            <option value="AR">AR (Argentina)</option>
            <option value="LATAM">LATAM</option>
          </select>
        </div>

        <button
          type="button"
          disabled={!referenceFile || isSavingVoice}
          data-testid="save-custom-voice-btn"
          onClick={() => void handleSaveVoiceAsTimbre()}
          className="flex items-center gap-[0.25cqw] rounded-[0.4cqh] border border-amber-400/80 bg-amber-500/20 px-[0.55cqw] py-[0.18cqh] tx-xs font-semibold text-amber-200 transition hover:bg-amber-500/35 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <AnimatedIcon
            name={isSavingVoice ? 'loader' : 'sparkles'}
            variant={isSavingVoice ? 'spin' : 'pulse'}
            trigger={isSavingVoice ? 'always' : 'hover'}
          />
          <span>{isSavingVoice ? 'Guardando...' : `Guardar en ${selectedEngineId.toUpperCase()}`}</span>
        </button>
      </div>

      {/* Retroalimentacion DSP discreta */}
      {dspFeedback && (
        <div
          data-testid="dsp-feedback-banner"
          className="shrink-0 truncate rounded-[0.4cqh] border border-sky-400/20 bg-slate-900/90 px-[0.5cqw] py-[0.12cqh] font-mono-tech text-[clamp(7px,0.78cqh,10px)] text-cyan-200"
        >
          {dspFeedback}
        </div>
      )}

      {/* Texto Objetivo a Clonar con Chips sin Scroll */}
      <div className="flex min-h-0 flex-1 flex-col gap-[0.25cqh] overflow-hidden">
        <div className="flex shrink-0 items-center justify-between tx-xs">
          <div className="flex items-center gap-[0.3cqw] overflow-hidden">
            <span className="font-semibold text-slate-300">Texto Objetivo:</span>
            {cloneBlocks.slice(0, 4).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectCloneBlock(idx)}
                className={`rounded border px-[0.38cqw] py-[0.1cqh] font-mono-tech text-[clamp(7.5px,0.85cqh,11px)] ${
                  idx === safeIdx
                    ? 'border-amber-400/75 bg-amber-400/20 text-amber-200'
                    : 'border-sky-400/15 bg-slate-900 text-slate-400'
                }`}
              >
                Bloque {idx + 1}/{cloneBlocks.length}
              </button>
            ))}
          </div>
          <span className="font-mono-tech text-amber-300">{totalChars} CAR.</span>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <label htmlFor="clone-target-textarea" className="sr-only">
            Texto en espanol para clonar voz
          </label>
          <textarea
            id="clone-target-textarea"
            data-testid="clone-target-textarea"
            className="studio-textarea"
            value={activeText}
            onChange={(e) => onChangeCloneBlock(e.target.value)}
            placeholder="Escriba el guion en espanol que sera pronunciado con la huella vocal clonada..."
            spellCheck={false}
          />
        </div>
      </div>

      {/* Barra Inferior de Ejecucion Zero-Shot */}
      <div className="grid shrink-0 grid-cols-12 items-center gap-[0.45cqw] rounded-[0.5cqh] border border-amber-400/20 bg-slate-950/65 px-[0.55cqw] py-[0.38cqh]">
        <div className="col-span-4 flex flex-col">
          <div className="flex justify-between font-mono-tech tx-xs">
            <span className="text-[var(--text-muted)]">CADENCIA</span>
            <span className="text-amber-300">{speed.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.6}
            max={1.6}
            step={0.05}
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            aria-label="Cadencia de clonacion"
            className="studio-slider mt-[0.2cqh]"
          />
        </div>

        <div className="col-span-3 flex flex-col">
          <span className="font-mono-tech tx-xs text-[var(--text-muted)]">INTENCION</span>
          <select
            value={emotion}
            onChange={(e) => onEmotionChange(e.target.value)}
            aria-label="Intencion vocal"
            className="mt-[0.1cqh] rounded-[0.4cqh] border border-sky-400/25 bg-slate-900 px-[0.3cqw] py-[0.18cqh] tx-xs text-slate-100 uppercase"
          >
            <option value="neutro">NEUTRO</option>
            <option value="narrativo">NARRATIVO</option>
            <option value="calido">CALIDO</option>
            <option value="expresivo">EXPRESIVO</option>
          </select>
        </div>

        <div className="col-span-5 flex justify-end">
          <button
            type="button"
            disabled={isCloning || totalChars === 0}
            onClick={onRunClone}
            data-testid="execute-clone-btn"
            className="flex w-full items-center justify-center gap-[0.35cqw] rounded-[0.5cqh] border border-amber-300/70 bg-gradient-to-r from-amber-400 to-orange-400 px-[0.7cqw] py-[0.5cqh] tx-xs font-bold text-slate-950 shadow-[0_0_18px_rgba(245,166,35,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <AnimatedIcon
              name={isCloning ? 'loader' : 'fingerprint'}
              variant={isCloning ? 'spin' : 'pulse'}
              trigger={isCloning ? 'always' : 'hover'}
              className="text-slate-950"
            />
            <span>{isCloning ? 'Clonando Timbre...' : 'Ejecutar Clonacion Zero-Shot'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
