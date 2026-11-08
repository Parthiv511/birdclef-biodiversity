import { useEffect, useRef, useState } from "react";
import FFT from "fft.js";
import { AudioLines, LoaderCircle, Info } from "lucide-react";
import "../App.css";

const FFT_SIZE = 2048;
const HOP_SIZE = 320;

const MAX_FREQUENCY = 14000;
const MIN_FREQUENCY = 50;

const DYNAMIC_RANGE_DB = 75;

export default function Spectrogram({ file }) {
  const canvasRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [spectrogramData, setSpectrogramData] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);

  // --------------------------------------------------
  // STEP 1: Generate FFT spectrogram from uploaded audio
  // --------------------------------------------------
  useEffect(() => {
  let cancelled = false;

  async function generateSpectrogram() {
    // Defer state updates to avoid synchronous updates inside the effect.
    await Promise.resolve();

    if (cancelled) return;

    if (!file) {
      setLoading(false);
      setError("");
      setSpectrogramData(null);
      setHoverInfo(null);
      return;
    }

    setLoading(true);
    setError("");
    setSpectrogramData(null);
    setHoverInfo(null);
  
      try {
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
          throw new Error(
            "Web Audio API is unavailable in this browser."
          );
        }

        const audioContext = new AudioContextClass();

        try {
          const arrayBuffer = await file.arrayBuffer();

          const audioBuffer =
            await audioContext.decodeAudioData(arrayBuffer);

          if (cancelled) return;

          const sampleRate = audioBuffer.sampleRate;
          const channels = audioBuffer.numberOfChannels;
          const sampleCount = audioBuffer.length;

          // Convert stereo or multichannel audio to mono.
          const mono = new Float32Array(sampleCount);

          for (let channel = 0; channel < channels; channel++) {
            const channelData =
              audioBuffer.getChannelData(channel);

            for (let i = 0; i < sampleCount; i++) {
              mono[i] += channelData[i] / channels;
            }
          }

          const fft = new FFT(FFT_SIZE);

          const input = new Array(FFT_SIZE).fill(0);
          const output = fft.createComplexArray();

          const frames = [];

          // Hann window reduces spectral leakage.
          const windowFunction = new Float32Array(FFT_SIZE);

          for (let i = 0; i < FFT_SIZE; i++) {
            windowFunction[i] =
              0.5 *
              (1 -
                Math.cos(
                  (2 * Math.PI * i) / (FFT_SIZE - 1)
                ));
          }

          const minBin = Math.max(
            1,
            Math.floor(
              (MIN_FREQUENCY * FFT_SIZE) / sampleRate
            )
          );

          const maxBin = Math.min(
            Math.floor(
              (MAX_FREQUENCY * FFT_SIZE) / sampleRate
            ),
            FFT_SIZE / 2
          );

          // Process audio using overlapping FFT windows.
          for (
            let start = 0;
            start < sampleCount;
            start += HOP_SIZE
          ) {
            if (cancelled) return;

            for (let i = 0; i < FFT_SIZE; i++) {
              const sampleIndex = start + i;

              input[i] =
                sampleIndex < sampleCount
                  ? mono[sampleIndex] * windowFunction[i]
                  : 0;
            }

            fft.realTransform(output, input);

            const magnitudes = [];

            for (
              let bin = minBin;
              bin <= maxBin;
              bin++
            ) {
              const real = output[2 * bin];
              const imaginary = output[2 * bin + 1];

              const magnitude = Math.sqrt(
                real * real +
                  imaginary * imaginary
              );

              const decibels =
                20 * Math.log10(magnitude + 1e-10);

              magnitudes.push(decibels);
            }

            frames.push(magnitudes);
          }

          if (!cancelled) {
            // Find maximum energy for display scaling.
            let maximumDb = -Infinity;

            for (const frame of frames) {
              for (const value of frame) {
                maximumDb = Math.max(
                  maximumDb,
                  value
                );
              }
            }

            setSpectrogramData({
              frames,
              sampleRate,
              duration: audioBuffer.duration,

              minFrequency:
                (minBin * sampleRate) / FFT_SIZE,

              maxFrequency:
                (maxBin * sampleRate) / FFT_SIZE,

              maximumDb,

              minimumDb:
                maximumDb - DYNAMIC_RANGE_DB,
            });
          }
        } finally {
          await audioContext.close().catch(() => {});
        }
      } catch (err) {
        if (!cancelled) {
          console.error(
            "Spectrogram generation failed:",
            err
          );

          setError(
            "Unable to generate the spectrogram. Try another audio recording."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    generateSpectrogram();

    return () => {
      cancelled = true;
    };
  }, [file]);

  // --------------------------------------------------
  // STEP 2: Convert decibel values into colour intensity
  // --------------------------------------------------

  function getSpectrogramColor(value) {
    const normalized = Math.max(
      0,
      Math.min(1, value)
    );

    const colorStops = [
      { position: 0.0, color: [5, 12, 25] },
      { position: 0.2, color: [12, 45, 58] },
      { position: 0.4, color: [18, 105, 85] },
      { position: 0.6, color: [55, 170, 85] },
      { position: 0.8, color: [170, 220, 55] },
      { position: 1.0, color: [255, 245, 120] },
    ];

    for (let i = 0; i < colorStops.length - 1; i++) {
      const current = colorStops[i];
      const next = colorStops[i + 1];

      if (
        normalized >= current.position &&
        normalized <= next.position
      ) {
        const amount =
          (normalized - current.position) /
          (next.position - current.position);

        return current.color.map(
          (color, channel) =>
            Math.round(
              color +
                amount *
                  (next.color[channel] - color)
            )
        );
      }
    }

    return [255, 245, 120];
  }

  // --------------------------------------------------
  // STEP 3: Draw spectrogram on canvas
  // --------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !spectrogramData) return;

    const { frames, maximumDb, minimumDb } =
      spectrogramData;

    if (
      frames.length === 0 ||
      frames[0].length === 0
    ) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) return;

    const width = frames.length;
    const height = frames[0].length;

    canvas.width = width;
    canvas.height = height;

    const imageData =
      context.createImageData(width, height);

    const range = maximumDb - minimumDb;

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        // Reverse vertical axis so high frequencies appear at the top.
        const dbValue = frames[x][height - 1 - y];

        const normalized =
          (dbValue - minimumDb) / range;

        const [red, green, blue] =
          getSpectrogramColor(normalized);

        const pixel = (y * width + x) * 4;

        imageData.data[pixel] = red;
        imageData.data[pixel + 1] = green;
        imageData.data[pixel + 2] = blue;
        imageData.data[pixel + 3] = 255;
      }
    }

    context.putImageData(imageData, 0, 0);
  }, [spectrogramData]);

  // --------------------------------------------------
  // STEP 4: Interactive time and frequency inspection
  // --------------------------------------------------

  function handleCanvasMouseMove(event) {
    const canvas = canvasRef.current;

    if (!canvas || !spectrogramData) return;

    const rect = canvas.getBoundingClientRect();

    const x =
      (event.clientX - rect.left) / rect.width;

    const y =
      (event.clientY - rect.top) / rect.height;

    const clampedX = Math.max(
      0,
      Math.min(1, x)
    );

    const clampedY = Math.max(
      0,
      Math.min(1, y)
    );

    const frameIndex = Math.min(
      spectrogramData.frames.length - 1,
      Math.floor(
        clampedX * spectrogramData.frames.length
      )
    );

    const frequency =
      spectrogramData.maxFrequency -
      clampedY *
        (
          spectrogramData.maxFrequency -
          spectrogramData.minFrequency
        );

    const frequencyIndex = Math.min(
      spectrogramData.frames[frameIndex].length - 1,
      Math.max(
        0,
        Math.floor(
          (1 - clampedY) *
            spectrogramData.frames[frameIndex].length
        )
      )
    );

    const energy =
      spectrogramData.frames[frameIndex][frequencyIndex];

    const time =
      clampedX * spectrogramData.duration;

    setHoverInfo({
      x: clampedX * 100,
      y: clampedY * 100,
      time,
      frequency,
      energy,
    });
  }

  function handleCanvasMouseLeave() {
    setHoverInfo(null);
  }

  // --------------------------------------------------
  // STEP 5: Render component
  // --------------------------------------------------

  return (
    <section className="spectrogram-panel">
      <div className="spectrogram-heading">
        <div className="spectrogram-title-icon">
          <AudioLines size={22} />
        </div>

        <div>
          <h3>Frequency Spectrogram</h3>

          <p>
            Explore acoustic energy across time and frequency.
          </p>
        </div>
      </div>

      {loading && (
        <div className="spectrogram-state">
          <LoaderCircle
            className="spectrogram-spinner"
            size={26}
          />

          <p>Generating frequency visualization…</p>
        </div>
      )}

      {error && !loading && (
        <div className="spectrogram-state spectrogram-error">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && spectrogramData && (
        <>
          {/* Spectrogram plot */}
          <div className="spectrogram-plot">
            <div className="spectrogram-y-axis">
              <span>
                {(spectrogramData.maxFrequency / 1000).toFixed(1)} kHz
              </span>

              <span>
                {(
                  spectrogramData.maxFrequency * 0.75 / 1000
                ).toFixed(1)} kHz
              </span>

              <span>
                {(
                  spectrogramData.maxFrequency * 0.5 / 1000
                ).toFixed(1)} kHz
              </span>

              <span>
                {(
                  spectrogramData.maxFrequency * 0.25 / 1000
                ).toFixed(1)} kHz
              </span>

              <span>
                {Math.round(spectrogramData.minFrequency)} Hz
              </span>
            </div>

            <div
              className="spectrogram-canvas-container"
              style={{
                position: "relative",
                overflow: "hidden",
              }}
            >
              <canvas
                ref={canvasRef}
                className="spectrogram-canvas"
                onMouseMove={handleCanvasMouseMove}
                onMouseLeave={handleCanvasMouseLeave}
                aria-label="Interactive audio frequency spectrogram"
                style={{
                  display: "block",
                  width: "100%",
                  height: "350px",
                  cursor: "crosshair",
                }}
              />

              {/* Interactive inspection tooltip */}
              {hoverInfo && (
                <>
                  <div
                    style={{
                      position: "absolute",
                      left: `${hoverInfo.x}%`,
                      top: 0,
                      bottom: 0,
                      width: "1px",
                      background: "rgba(255,255,255,0.65)",
                      pointerEvents: "none",
                    }}
                  />

                  <div
                    style={{
                      position: "absolute",
                      left: `${hoverInfo.x}%`,
                      top: `${hoverInfo.y}%`,
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: "#ffffff",
                      border: "1px solid #0b3025",
                      transform: "translate(-50%, -50%)",
                      pointerEvents: "none",
                    }}
                  />

                  <div
                    style={{
                      position: "absolute",
                      left: `${Math.min(hoverInfo.x + 2, 72)}%`,
                      top: `${Math.min(hoverInfo.y + 2, 65)}%`,
                      zIndex: 2,
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: "rgba(5, 20, 18, 0.95)",
                      color: "#ffffff",
                      fontSize: "12px",
                      lineHeight: 1.7,
                      pointerEvents: "none",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <strong>Acoustic inspection</strong>

                    <div>
                      Time: {hoverInfo.time.toFixed(3)} s
                    </div>

                    <div>
                      Frequency: {(
                        hoverInfo.frequency / 1000
                      ).toFixed(2)} kHz
                    </div>

                    <div>
                      Relative level: {hoverInfo.energy.toFixed(1)} dB
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Time axis */}
          <div className="spectrogram-x-axis">
            <span>0 sec</span>

            <span>
              {(spectrogramData.duration / 2).toFixed(1)} sec
            </span>

            <span>
              {spectrogramData.duration.toFixed(1)} sec
            </span>
          </div>

          {/* Colour legend */}
          <div className="spectrogram-legend">
            <span>Lower energy</span>

            <div
              className="spectrogram-color-scale"
              style={{
                background:
                  "linear-gradient(to right, #050c19, #0c2d3a, #126955, #37aa55, #aadc37, #fff578)",
              }}
            />

            <span>Higher energy</span>
          </div>

          {/* Technical information */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px 24px",
              marginTop: "16px",
              padding: "12px",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.04)",
              fontSize: "12px",
              color: "#b8c8c1",
            }}
          >
            <span>
              <strong>Sample rate:</strong>{" "}
              {(spectrogramData.sampleRate / 1000).toFixed(1)} kHz
            </span>

            <span>
              <strong>FFT size:</strong> {FFT_SIZE}
            </span>

            <span>
              <strong>Frequency range:</strong>{" "}
              {Math.round(spectrogramData.minFrequency)} Hz –{" "}
              {(spectrogramData.maxFrequency / 1000).toFixed(1)} kHz
            </span>

            <span>
              <strong>Hop size:</strong> {HOP_SIZE} samples
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              marginTop: "14px",
              fontSize: "12px",
              color: "#b8c8c1",
              lineHeight: 1.6,
            }}
          >
            <Info size={16} style={{ flexShrink: 0 }} />

            <p>
              Recording duration:{" "}
              {spectrogramData.duration.toFixed(2)} seconds.
              Colours represent relative spectral energy in
              decibels. Hover over the spectrogram to inspect
              approximate time, frequency, and energy values.
              This is a browser-generated FFT visualization,
              not a CNN14 species prediction.
            </p>
          </div>
        </>
      )}
    </section>
  );
}