import { useEffect, useRef, useState } from "react";
import Spectrogram from "../components/Spectrogram";
import AnalysisResults from "../components/AnalysisResults";
import AudioRelevanceWarning from "../components/AudioRelevanceWarning";
import { analyzeAudioFile } from "../services/audioApi";

import {
  Upload,
  AudioLines,
  FileAudio,
  X,
  Play,
  Pause,
  Leaf,
  AlertCircle,
  CheckCircle2,
  Volume2,
  RotateCcw,
} from "lucide-react";

import "../App.css";

const SUPPORTED_FORMATS = [".wav", ".mp3", ".ogg", ".flac"];

/* ==========================================
   HELPER FUNCTIONS
   ========================================== */

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

/* ==========================================
   WAVEFORM GENERATION
   ========================================== */

function createWaveform(audioBuffer, numberOfBars = 180) {
  const channelData = audioBuffer.getChannelData(0);

  const blockSize = Math.max(
    1,
    Math.floor(channelData.length / numberOfBars)
  );

  const waveform = [];

  for (let i = 0; i < numberOfBars; i++) {
    const start = i * blockSize;

    const end = Math.min(
      start + blockSize,
      channelData.length
    );

    let sum = 0;

    for (let j = start; j < end; j++) {
      sum += channelData[j] * channelData[j];
    }

    const rms =
      end > start
        ? Math.sqrt(sum / (end - start))
        : 0;

    waveform.push(
      Math.max(0.035, Math.min(1, rms * 4))
    );
  }

  return waveform;
}

/* ==========================================
   WAVEFORM COMPONENT
   ========================================== */

function Waveform({
  bars,
  currentTime,
  duration,
  onSeek,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const context = canvas.getContext("2d");

    if (!context) return;

    const dpr = window.devicePixelRatio || 1;

    const rect = canvas.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    context.clearRect(
      0,
      0,
      rect.width,
      rect.height
    );

    if (bars.length === 0) return;

    const barGap = 2;

    const barWidth = Math.max(
      1,
      (rect.width - barGap * (bars.length - 1)) /
        bars.length
    );

    const progress =
      duration > 0
        ? Math.min(1, currentTime / duration)
        : 0;

    bars.forEach((amplitude, index) => {
      const height = Math.max(
        3,
        amplitude * rect.height * 0.9
      );

      const x = index * (barWidth + barGap);

      const y = (rect.height - height) / 2;

      const barProgress =
        bars.length > 1
          ? index / (bars.length - 1)
          : 0;

      context.fillStyle =
        barProgress <= progress
          ? "#bef264"
          : "rgba(255,255,255,0.45)";

      context.beginPath();

      context.roundRect(
        x,
        y,
        barWidth,
        height,
        Math.min(barWidth / 2, 3)
      );

      context.fill();
    });
  }, [bars, currentTime, duration]);

  function handleSeek(event) {
    if (!duration || !onSeek) return;

    const rect =
      event.currentTarget.getBoundingClientRect();

    const ratio = Math.max(
      0,
      Math.min(
        1,
        (event.clientX - rect.left) / rect.width
      )
    );

    onSeek(ratio * duration);
  }

  return (
    <canvas
      ref={canvasRef}
      className="audio-waveform"
      onClick={handleSeek}
      role="slider"
      tabIndex={0}
      aria-label="Audio playback position"
      aria-valuemin={0}
      aria-valuemax={Math.floor(duration || 0)}
      aria-valuenow={Math.floor(currentTime || 0)}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();

          onSeek(
            Math.min(duration, currentTime + 5)
          );
        }

        if (event.key === "ArrowLeft") {
          event.preventDefault();

          onSeek(
            Math.max(0, currentTime - 5)
          );
        }
      }}
    />
  );
}

/* ==========================================
   MAIN AUDIO ANALYSIS PAGE
   ========================================== */

export default function AudioAnalysis() {
  const fileInputRef = useRef(null);

  const audioRef = useRef(null);

  const audioContextRef = useRef(null);

  const objectUrlsRef = useRef(new Set());

  const selectedFileIdRef = useRef(null);

  // Playback boundaries for the selected timeline window.
  const intervalStartRef = useRef(null);
  const intervalEndRef = useRef(null);

  const [files, setFiles] = useState([]);

  const [selectedFileId, setSelectedFileId] =
    useState(null);

  const [isDragging, setIsDragging] = useState(false);

  const [errors, setErrors] = useState([]);

  const [notice, setNotice] = useState("");

  const [isPlaying, setIsPlaying] = useState(false);

  const [activeWindowIndex, setActiveWindowIndex] =
    useState(null);

  const [isIntervalPlaying, setIsIntervalPlaying] =
    useState(false);

  const [currentTime, setCurrentTime] = useState(0);

  const [duration, setDuration] = useState(0);

  const [volume, setVolume] = useState(0.8);

  const [waveform, setWaveform] = useState([]);

  const [isDecoding, setIsDecoding] = useState(false);

  // Backend analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [analysisResult, setAnalysisResult] = useState(null);

  // Audio relevance warning state
  const [showRelevanceWarning, setShowRelevanceWarning] =
    useState(false);

  const [relevanceWarningMessage, setRelevanceWarningMessage] =
    useState("");

  const selectedFile =
    files.find(
      (file) => file.id === selectedFileId
    ) ?? null;

  useEffect(() => {
    selectedFileIdRef.current = selectedFileId;
  }, [selectedFileId]);

  /* Update player volume */

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  /* Release browser resources */

 useEffect(() => {
  const audioElement = audioRef.current;
  const audioContext = audioContextRef.current;
  const objectUrls = objectUrlsRef.current;

  return () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.removeAttribute("src");
      audioElement.load();
    }

    if (audioContext && audioContext.state !== "closed") {
      audioContext.close().catch(() => {});
    }

    objectUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });

    objectUrls.clear();
  };
}, []);

  /* Reset page state whenever a different recording is selected. */
  function selectFile(fileId) {
    setSelectedFileId(fileId);
    setAnalysisResult(null);
    setErrors([]);
    setNotice("");
    setShowRelevanceWarning(false);
    setRelevanceWarningMessage("");

    intervalStartRef.current = null;
    intervalEndRef.current = null;

    setActiveWindowIndex(null);
    setIsIntervalPlaying(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setWaveform([]);
  }

  /* ==========================================
     FILE UPLOAD
     ========================================== */

  function addFiles(selectedFiles) {
    const incoming = Array.from(selectedFiles);

    const newErrors = [];

    const validFiles = [];

    incoming.forEach((file) => {
      const extension =
        `.${file.name.split(".").pop().toLowerCase()}`;

      if (!SUPPORTED_FORMATS.includes(extension)) {
        newErrors.push(
          `${file.name}: unsupported audio format.`
        );

        return;
      }

      if (file.size === 0) {
        newErrors.push(
          `${file.name}: the file is empty.`
        );

        return;
      }

      const alreadyAdded = files.some(
        (existing) =>
          existing.name === file.name &&
          existing.size === file.size &&
          existing.lastModified === file.lastModified
      );

      const alreadyInBatch = validFiles.some(
        (existing) =>
          existing.name === file.name &&
          existing.size === file.size &&
          existing.lastModified === file.lastModified
      );

      if (alreadyAdded || alreadyInBatch) {
        newErrors.push(
          `${file.name}: already added.`
        );

        return;
      }

      validFiles.push(file);
    });

    const preparedFiles = validFiles.map((file) => {
      const url = URL.createObjectURL(file);

      objectUrlsRef.current.add(url);

      return {
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        url,
      };
    });

    setFiles((previous) => [
      ...previous,
      ...preparedFiles,
    ]);

    setErrors(newErrors);

    setNotice("");

    if (!selectedFileId && preparedFiles.length > 0) {
      selectFile(preparedFiles[0].id);
    }
  }

  function handleFileInput(event) {
    addFiles(event.target.files);

    event.target.value = "";
  }

  function handleDrop(event) {
    event.preventDefault();

    setIsDragging(false);

    addFiles(event.dataTransfer.files);
  }

  /* ==========================================
     REMOVE RECORDING
     ========================================== */

  function removeFile(idToRemove) {
    const removedFile = files.find(
      (file) => file.id === idToRemove
    );

    if (!removedFile) return;

    if (selectedFileId === idToRemove) {
      const audio = audioRef.current;

      if (audio) {
        audio.pause();

        audio.removeAttribute("src");

        audio.load();
      }

      setIsPlaying(false);
      setIsIntervalPlaying(false);
      setActiveWindowIndex(null);

      intervalStartRef.current = null;
      intervalEndRef.current = null;

      setCurrentTime(0);

      setDuration(0);

      setWaveform([]);

      setAnalysisResult(null);

      const remaining = files.filter(
        (file) => file.id !== idToRemove
      );

      selectFile(remaining[0]?.id ?? null);
    }

    URL.revokeObjectURL(removedFile.url);

    objectUrlsRef.current.delete(removedFile.url);

    setFiles((previous) =>
      previous.filter(
        (file) => file.id !== idToRemove
      )
    );

    setNotice("");
  }

  /* ==========================================
     AUDIO WAVEFORM DECODING
     ========================================== */

  async function loadWaveform(file) {
    setIsDecoding(true);

    setWaveform([]);

    try {
      if (!audioContextRef.current) {
        const AudioContextClass =
          window.AudioContext ||
          window.webkitAudioContext;

        if (!AudioContextClass) {
          throw new Error(
            "Web Audio API is not supported."
          );
        }

        audioContextRef.current =
          new AudioContextClass();
      }

      const context = audioContextRef.current;

      if (context.state === "suspended") {
        await context.resume();
      }

      const arrayBuffer =
        await file.file.arrayBuffer();

      const decodedBuffer =
        await context.decodeAudioData(arrayBuffer);

      if (
        selectedFileIdRef.current !== file.id
      ) {
        return;
      }

      setWaveform(
        createWaveform(decodedBuffer)
      );
    } catch (error) {
      console.error(
        "Waveform generation failed:",
        error
      );

      if (
        selectedFileIdRef.current === file.id
      ) {
        setErrors([
          `Could not decode ${file.name} for waveform visualization. The browser may not support this audio encoding.`,
        ]);
      }
    } finally {
      if (
        selectedFileIdRef.current === file.id
      ) {
        setIsDecoding(false);
      }
    }
  }

  /* Load the selected audio file */

  useEffect(() => {
    if (!selectedFile) return;

    const audio = audioRef.current;

    if (!audio) return;

    audio.pause();

    intervalStartRef.current = null;
    intervalEndRef.current = null;

    audio.src = selectedFile.url;

    audio.load();

    loadWaveform(selectedFile);

    return () => {
      audio.pause();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFileId]);

  /* ==========================================
     AUDIO PLAYER CONTROLS
     ========================================== */

  function togglePlayback() {
    const audio = audioRef.current;

    if (!audio || !selectedFile) return;

    if (audio.paused) {
      audio.play().catch((error) => {
        console.error(
          "Audio playback failed:",
          error
        );

        setErrors([
          "This recording could not be played by your browser.",
        ]);
      });
    } else {
      audio.pause();
    }
  }

  function seekAudio(time) {
    const audio = audioRef.current;

    if (!audio || !Number.isFinite(time)) return;

    // Manual seeking exits timeline-interval playback.
    intervalStartRef.current = null;
    intervalEndRef.current = null;

    setActiveWindowIndex(null);
    setIsIntervalPlaying(false);

    audio.currentTime = Math.max(
      0,
      Math.min(
        time,
        audio.duration || duration || 0
      )
    );

    setCurrentTime(audio.currentTime);
  }

  function restartAudio() {
    seekAudio(0);
  }

  /* ==========================================
     TIMELINE INTERVAL PLAYBACK
     ========================================== */

  // Play only the selected timeline interval.
  function handleWindowSeek(startTime, endTime, windowIndex) {
    const audio = audioRef.current;

    if (
      !audio ||
      !Number.isFinite(startTime) ||
      !Number.isFinite(endTime)
    ) {
      return;
    }

    // Stop the previously selected interval.
    audio.pause();

    const safeStart = Math.max(0, startTime);

    const safeEnd = Math.min(
      endTime,
      audio.duration || duration || endTime
    );

    if (safeEnd <= safeStart) return;

    intervalStartRef.current = safeStart;
    intervalEndRef.current = safeEnd;

    setActiveWindowIndex(windowIndex);
    setIsIntervalPlaying(false);

    audio.currentTime = safeStart;

    setCurrentTime(safeStart);

    audio.play().catch((error) => {
      console.error(
        "Interval playback failed:",
        error
      );

      setIsIntervalPlaying(false);

      setErrors([
        "This recording could not be played by your browser.",
      ]);
    });
  }

  // Pause the currently selected interval.
  function handleWindowPause() {
    const audio = audioRef.current;

    if (!audio) return;

    audio.pause();

    setIsIntervalPlaying(false);
  }

  // Resume the currently selected interval.
  function handleWindowResume() {
    const audio = audioRef.current;

    const startTime = intervalStartRef.current;

    const endTime = intervalEndRef.current;

    if (
      !audio ||
      startTime === null ||
      endTime === null
    ) {
      return;
    }

    // If the interval has finished, replay it from its beginning.
    if (audio.currentTime >= endTime) {
      audio.currentTime = startTime;

      setCurrentTime(startTime);
    }

    audio.play().catch((error) => {
      console.error(
        "Interval resume failed:",
        error
      );

      setIsIntervalPlaying(false);
    });
  }

  /* ==========================================
     BACKEND AUDIO ANALYSIS
     ========================================== */

  async function handleAnalyze() {
    if (!selectedFile) {
      setErrors([
        "Please select an audio recording before analysis.",
      ]);

      return;
    }

    if (isAnalyzing) return;

    setErrors([]);

    setNotice("");

    setAnalysisResult(null);

    setShowRelevanceWarning(false);

    setRelevanceWarningMessage("");

    setIsAnalyzing(true);

    try {
      // Send the selected audio file to Django.
      const data = await analyzeAudioFile(
        selectedFile.file
      );

      console.log(
        "BirdCLEF Backend Response:",
        data
      );

      // Handle audio relevance screening warnings.
      if (data.status === "warning") {
        setRelevanceWarningMessage(
          data.message ||
            "This recording may not contain wildlife sounds. CNN14 analysis was not completed."
        );

        setShowRelevanceWarning(true);

        return;
      }

      // Handle successful CNN14 inference.
if (data.status === "analysis_completed") {
  setAnalysisResult(data);

  // Notify the Biodiversity Dashboard to refresh its analytics.
  window.dispatchEvent(
    new Event("biodiversity:refresh")
  );

  const windowsAnalyzed =
    data.species_analysis?.windows_analyzed ?? 0;

  setNotice(
    `Analysis completed successfully for ${selectedFile.name}. ${windowsAnalyzed} audio windows analyzed.`
  );

  return;
}
      throw new Error(
        data.message ||
          "The backend returned an unexpected response."
      );
    } catch (error) {
      console.error(
        "Audio analysis failed:",
        error
      );

      setErrors([
        error.message ||
          "Unable to analyze the recording. Please try again.",
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleChooseAnother() {
    setShowRelevanceWarning(false);

    setRelevanceWarningMessage("");

    fileInputRef.current?.click();
  }

  function handleAnalyzeAnyway() {
    setShowRelevanceWarning(false);

    setRelevanceWarningMessage("");

    setNotice(
      "The backend screening flagged this recording. CNN14 analysis was not performed. Please select another wildlife recording."
    );
  }

  /* ==========================================
     RENDER
     ========================================== */

  return (
    <main className="audio-analysis-page">

      {/* PAGE HEADING */}

      <section className="audio-page-heading">
        <div className="audio-eyebrow">
          <Leaf size={17} />

          BIRDCLEF+ 2026 · BIOACOUSTIC ANALYSIS
        </div>

        <h1>Discover the Sounds of the Wild</h1>

        <p>
          Upload wildlife recordings, listen to the
          soundscape, and prepare recordings for
          AI-powered species detection.
        </p>
      </section>

      {/* UPLOAD PANEL */}

      <section className="upload-panel">
        <div className="upload-panel-heading">
          <div className="upload-heading-icon">
            <AudioLines size={25} />
          </div>

          <div>
            <h2>Upload Audio Recordings</h2>

            <p>
              Select one or multiple recordings to preview.
            </p>
          </div>
        </div>

        {/* DROPZONE */}

        <div
          className={`audio-dropzone ${
            isDragging ? "dragging" : ""
          }`}
          onDragEnter={(event) => {
            event.preventDefault();

            setIsDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDragLeave={(event) => {
            if (
              !event.currentTarget.contains(
                event.relatedTarget
              )
            ) {
              setIsDragging(false);
            }
          }}
          onDrop={handleDrop}
          onClick={() =>
            fileInputRef.current?.click()
          }
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" ||
              event.key === " "
            ) {
              event.preventDefault();

              fileInputRef.current?.click();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,.mp3,.ogg,.flac,audio/*"
            multiple
            hidden
            onChange={handleFileInput}
          />

          <div className="upload-icon-circle">
            <Upload size={34} />
          </div>

          <h3>
            Drag and drop your audio files here
          </h3>

          <p>
            or click to browse your computer
          </p>

          <div className="supported-formats">
            {SUPPORTED_FORMATS.map((format) => (
              <span key={format}>
                {format.replace(".", "").toUpperCase()}
              </span>
            ))}
          </div>

          <small>Multiple files supported</small>
        </div>

        {/* ERROR MESSAGES */}

        {errors.length > 0 && (
          <div
            className="upload-messages error-message"
            role="alert"
          >
            <AlertCircle size={18} />

            <div>
              {errors.map((error, index) => (
                <p key={`${error}-${index}`}>
                  {error}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* SUCCESS / STATUS MESSAGE */}

        {notice && (
          <div
            className="upload-messages success-message"
            role="status"
          >
            <CheckCircle2 size={18} />

            <p>{notice}</p>
          </div>
        )}

        {/* AUDIO RELEVANCE WARNING */}

        {showRelevanceWarning && (
          <AudioRelevanceWarning
            message={relevanceWarningMessage}
            onChooseAnother={handleChooseAnother}
            onAnalyzeAnyway={handleAnalyzeAnyway}
          />
        )}

        {/* SELECTED FILES */}

        <div className="file-list-heading">
          <h3>Selected Recordings</h3>

          <span>{files.length} file(s)</span>
        </div>

        {files.length === 0 ? (
          <div className="empty-files">
            <FileAudio size={30} />

            <p>No recordings selected yet.</p>
          </div>
        ) : (
          <div className="selected-files">
            {files.map((file) => (
              <div
                className={`selected-file ${
                  file.id === selectedFileId
                    ? "selected-file-active"
                    : ""
                }`}
                key={file.id}
              >
                <button
                  type="button"
                  className="file-select-button"
                  onClick={() => selectFile(file.id)}
                  aria-label={`Select ${file.name}`}
                >
                  <div className="file-icon">
                    <FileAudio size={22} />
                  </div>

                  <div className="file-information">
                    <strong title={file.name}>
                      {file.name}
                    </strong>

                    <span>
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  className="remove-file-button"
                  aria-label={`Remove ${file.name}`}
                  title="Remove file"
                  onClick={() =>
                    removeFile(file.id)
                  }
                >
                  <X size={19} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* AUDIO PLAYER, SPECTROGRAM AND RESULTS */}

        {selectedFile && (
          <>
            {/* AUDIO PLAYER */}

            <section
              className="audio-player-panel"
              aria-label="Audio player"
            >
              <div className="audio-player-heading">
                <div className="player-title-icon">
                  <AudioLines size={23} />
                </div>

                <div className="player-file-title">
                  <span>NOW SELECTED</span>

                  <h3 title={selectedFile.name}>
                    {selectedFile.name}
                  </h3>
                </div>
              </div>

              <Waveform
                bars={waveform}
                currentTime={currentTime}
                duration={duration}
                onSeek={seekAudio}
              />

              {isDecoding && (
                <p className="waveform-status">
                  Preparing waveform…
                </p>
              )}

              {!isDecoding &&
                waveform.length === 0 && (
                  <p className="waveform-status">
                    Waveform unavailable for this recording.
                  </p>
                )}

              <div className="player-time-row">
                <span>
                  {formatTime(currentTime)}
                </span>

                <span>
                  {formatTime(duration)}
                </span>
              </div>

              <div className="player-controls">
                <button
                  type="button"
                  className="player-icon-button"
                  onClick={restartAudio}
                  aria-label="Restart audio"
                  title="Restart"
                >
                  <RotateCcw size={19} />
                </button>

                <button
                  type="button"
                  className="player-play-button"
                  onClick={togglePlayback}
                  aria-label={
                    isPlaying
                      ? "Pause audio"
                      : "Play audio"
                  }
                  title={
                    isPlaying ? "Pause" : "Play"
                  }
                >
                  {isPlaying ? (
                    <Pause
                      size={23}
                      fill="currentColor"
                    />
                  ) : (
                    <Play
                      size={23}
                      fill="currentColor"
                    />
                  )}
                </button>

                <div className="volume-control">
                  <Volume2 size={19} />

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(event) =>
                      setVolume(
                        Number(event.target.value)
                      )
                    }
                    aria-label="Volume"
                  />
                </div>
              </div>

              <audio
                ref={audioRef}
                preload="metadata"
                onLoadedMetadata={(event) => {
                  const audio = event.currentTarget;

                  setDuration(
                    Number.isFinite(audio.duration)
                      ? audio.duration
                      : 0
                  );
                }}
                onTimeUpdate={(event) => {
                  const audio = event.currentTarget;

                  setCurrentTime(audio.currentTime);

                  // Stop at the end of the selected timeline interval.
                  if (
                    intervalEndRef.current !== null &&
                    audio.currentTime >= intervalEndRef.current
                  ) {
                    audio.pause();

                    audio.currentTime = intervalEndRef.current;

                    setCurrentTime(intervalEndRef.current);

                    setIsIntervalPlaying(false);
                  }
                }}
                onPlay={() => {
                  setIsPlaying(true);

                  setIsIntervalPlaying(
                    intervalEndRef.current !== null
                  );
                }}
                onPause={() => {
                  setIsPlaying(false);

                  setIsIntervalPlaying(false);
                }}
                onEnded={() => {
                  setIsPlaying(false);

                  setIsIntervalPlaying(false);
                }}
                onError={() => {
                  setIsPlaying(false);

                  setIsIntervalPlaying(false);
                }}
              />
            </section>

            {/* SPECTROGRAM */}

            <Spectrogram file={selectedFile.file} />

            {/* ANALYSIS RESULTS DASHBOARD */}

            <AnalysisResults
              results={
                analysisResult?.species_analysis?.predictions ?? []
              }
              windowPredictions={
                analysisResult?.species_analysis?.window_predictions ?? []
              }
              audioDuration={
                analysisResult?.species_analysis?.audio_duration ??
                duration
              }
              windowsAnalyzed={
                analysisResult?.species_analysis?.windows_analyzed ?? 0
              }
              isDemo={!analysisResult}
              onWindowSelect={handleWindowSeek}
              onWindowPause={handleWindowPause}
              onWindowResume={handleWindowResume}
              activeWindowIndex={activeWindowIndex}
              isIntervalPlaying={isIntervalPlaying}
            />
          </>
        )}

        {/* FOOTER AND ANALYZE BUTTON */}

        <div className="upload-footer">
          <div className="privacy-note">
            <AlertCircle size={16} />

            <span>
              Playback and visualization run locally
              in your browser.
            </span>
          </div>

          <button
            type="button"
            className="analyze-audio-button"
            onClick={handleAnalyze}
            disabled={isAnalyzing || !selectedFile}
          >
            <Play size={18} fill="currentColor" />

            {isAnalyzing
              ? "Analyzing Audio..."
              : "Analyze Audio"}
          </button>
        </div>
      </section>

      <p className="audio-page-footnote">
        BirdCLEF+ 2026 · Wildlife Bioacoustic Monitoring
      </p>
    </main>
  );
}