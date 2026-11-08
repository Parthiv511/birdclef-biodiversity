import {
  AudioLines,
  Bird,
  ChartNoAxesColumn,
  CircleCheck,
  Clock3,
  Info,
  Leaf,
  Sparkles,
  TrendingUp,
  Play,
  Pause,
} from "lucide-react";

import "../App.css";

const DEMO_DETECTIONS = [
  {
    id: 1,
    species: "Demo Species A",
    scientificName: "Scientific name pending",
    confidence: 94.8,
    category: "Bird",
    time: "00:05–00:10",
  },
  {
    id: 2,
    species: "Demo Species B",
    scientificName: "Scientific name pending",
    confidence: 87.3,
    category: "Amphibian",
    time: "00:15–00:20",
  },
  {
    id: 3,
    species: "Demo Species C",
    scientificName: "Scientific name pending",
    confidence: 72.6,
    category: "Insect",
    time: "00:25–00:30",
  },
];

// --------------------------------------------------
// COMMON PREDICTION NORMALIZATION
// --------------------------------------------------

function normalizeDetection(detection, index) {
  const score = Number(detection.confidence) || 0;

  const isBackendScore = score >= 0 && score <= 1;

  return {
    id: detection.species_id ?? detection.id ?? index,

    species:
      detection.common_name ??
      detection.species ??
      detection.scientific_name ??
      "Unknown species",

    scientificName:
      detection.scientific_name ??
      detection.scientificName ??
      "Scientific name unavailable",

    category:
      detection.taxonomic_class ??
      detection.category ??
      "Unclassified",

    time: detection.time ?? "Whole recording",

    rawScore: score,

    displayScore: isBackendScore
      ? score.toFixed(4)
      : `${score.toFixed(1)}%`,

    barPercentage: isBackendScore
      ? score * 100
      : score,
  };
}

// --------------------------------------------------
// TIME FORMATTING
// --------------------------------------------------

function formatTimelineTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);

  const minutes = Math.floor(safeSeconds / 60);

  const remainingSeconds = Math.floor(
    safeSeconds % 60
  );

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

// --------------------------------------------------
// CONFIDENCE BAR
// --------------------------------------------------

function ConfidenceBar({ confidence }) {
  const percentage = Math.max(
    0,
    Math.min(100, confidence)
  );

  return (
    <div
      className="confidence-track"
      role="progressbar"
      aria-label="Model score"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
    >
      <div
        className="confidence-fill"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

// --------------------------------------------------
// WINDOW PREDICTION NORMALIZATION
// --------------------------------------------------

function normalizeWindowPrediction(window) {
  return {
    windowIndex: window.window_index,

    startTime: Number(window.start_time) || 0,

    endTime: Number(window.end_time) || 0,

    predictions: Array.isArray(window.predictions)
      ? window.predictions.map(normalizeDetection)
      : [],
  };
}

// --------------------------------------------------
// SPECIES ACTIVITY TIMELINE
// --------------------------------------------------

function SpeciesActivityTimeline({
  windowPredictions,
  audioDuration,
  onWindowSelect,
  onWindowPause,
  onWindowResume,
  activeWindowIndex,
  isIntervalPlaying,
}) {
  const windows = Array.isArray(windowPredictions)
    ? windowPredictions.map(normalizeWindowPrediction)
    : [];

  function handleWindowClick(window) {
    const isActive =
      activeWindowIndex === window.windowIndex;

    // Pause the currently playing interval.
    if (isActive && isIntervalPlaying) {
      onWindowPause?.();
      return;
    }

    // Resume the currently paused interval.
    if (isActive && !isIntervalPlaying) {
      onWindowResume?.();
      return;
    }

    // Play a newly selected interval.
    onWindowSelect?.(
      window.startTime,
      window.endTime,
      window.windowIndex
    );
  }

  return (
    <section className="species-timeline-panel">
      <div className="species-timeline-heading">
        <div className="detections-heading-icon">
          <Clock3 size={23} />
        </div>

        <div>
          <h3>Species Activity Timeline</h3>

          <p>
            Explore candidate species predictions across
            five-second audio windows.
          </p>
        </div>
      </div>

      {windows.length === 0 ? (
        <div className="results-empty-state">
          <ChartNoAxesColumn size={35} />

          <h4>No activity timeline available</h4>

          <p>
            Window-level species predictions will appear
            after successful CNN14 analysis.
          </p>
        </div>
      ) : (
        <>
          <div className="timeline-overview">
            <div>
              <strong>{windows.length}</strong>
              <span>Analysis windows</span>
            </div>

            <div>
              <strong>
                {Number(audioDuration || 0).toFixed(2)} s
              </strong>
              <span>Recording duration</span>
            </div>

            <div>
              <strong>5 seconds</strong>
              <span>Window interval</span>
            </div>
          </div>

          <div className="activity-timeline">
            {windows.map((window) => {
              const isSelected =
                activeWindowIndex === window.windowIndex;

              const isPlaying =
                isSelected && isIntervalPlaying;

              const topPredictions =
                window.predictions.slice(0, 3);

              return (
                <article
                  key={window.windowIndex}
                  className={`activity-window-card ${
                    isSelected
                      ? "activity-window-selected"
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    className="activity-window-button"
                    onClick={() =>
                      handleWindowClick(window)
                    }
                    aria-pressed={isSelected}
                  >
                    <div className="activity-window-header">
                      <div className="activity-window-number">
                        <span>
                          WINDOW{" "}
                          {String(
                            window.windowIndex
                          ).padStart(2, "0")}
                        </span>

                        <strong>
                          {formatTimelineTime(
                            window.startTime
                          )}{" "}
                          –{" "}
                          {formatTimelineTime(
                            window.endTime
                          )}
                        </strong>
                      </div>

                      <span className="activity-window-action">
                        {isPlaying ? (
                          <>
                            <Pause
                              size={15}
                              fill="currentColor"
                            />
                            Pause interval
                          </>
                        ) : (
                          <>
                            <Play
                              size={15}
                              fill="currentColor"
                            />

                            {isSelected
                              ? "Resume interval"
                              : "Play interval"}
                          </>
                        )}
                      </span>
                    </div>
                  </button>

                  {topPredictions.length === 0 ? (
                    <p className="activity-no-predictions">
                      No predictions available for this window.
                    </p>
                  ) : (
                    <div className="activity-species-list">
                      {topPredictions.map(
                        (prediction, index) => (
                          <div
                            className="activity-species-item"
                            key={`${prediction.id}-${index}`}
                          >
                            <div className="activity-species-info">
                              <span className="activity-species-rank">
                                {index + 1}
                              </span>

                              <div>
                                <strong>
                                  {prediction.species}
                                </strong>

                                <span>
                                  {prediction.scientificName}
                                </span>
                              </div>
                            </div>

                            <div className="activity-species-score">
                              <strong>
                                {prediction.displayScore}
                              </strong>

                              <ConfidenceBar
                                confidence={
                                  prediction.barPercentage
                                }
                              />
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="timeline-footer-note">
            <Info size={16} />

            <p>
              Each window represents a five-second audio
              interval. Species are ranked using CNN14
              clipwise model scores. These scores are not
              calibrated probabilities and do not establish
              precise vocalization timestamps.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

// --------------------------------------------------
// MAIN ANALYSIS RESULTS COMPONENT
// --------------------------------------------------

export default function AnalysisResults({
  results = DEMO_DETECTIONS,
  windowPredictions = [],
  audioDuration = 0,
  windowsAnalyzed = 0,
  isDemo = true,
  onWindowSelect,
  onWindowPause,
  onWindowResume,
  activeWindowIndex,
  isIntervalPlaying,
}) {
  const detections = Array.isArray(results)
    ? results.map(normalizeDetection)
    : [];

  const uniqueSpecies = new Set(
    detections.map((item) => item.id)
  ).size;

  const averageConfidence =
    detections.length > 0
      ? detections.reduce(
          (total, item) => total + item.rawScore,
          0
        ) / detections.length
      : 0;

  const averageDisplayScore = isDemo
    ? `${averageConfidence.toFixed(1)}%`
    : averageConfidence.toFixed(4);

  return (
    <section className="results-dashboard">
      {/* RESULTS HEADING */}

      <div className="results-heading">
        <div>
          <div className="results-eyebrow">
            <Sparkles size={16} />

            BIOACOUSTIC INTELLIGENCE
          </div>

          <h2>Analysis Results</h2>

          <p>
            Review detected species, model scores, and
            candidate acoustic activity.
          </p>
        </div>

        <div className="results-status-badge">
          <span className="results-status-dot" />

          {isDemo ? "DEMO PREVIEW" : "MODEL RESULTS"}
        </div>
      </div>

      {/* DEMO NOTICE */}

      {isDemo && (
        <div className="results-demo-notice">
          <Info size={18} />

          <p>
            <strong>Demonstration data:</strong> These
            entries are illustrative examples, not real
            detections. Actual CNN14 predictions will
            appear after successful backend analysis.
          </p>
        </div>
      )}

      {/* SUMMARY CARDS */}

      <div className="results-summary-grid">
        <article className="results-summary-card">
          <div className="summary-card-icon">
            <Leaf size={22} />
          </div>

          <span>Unique species</span>

          <strong>{uniqueSpecies}</strong>

          <small>In the current results</small>
        </article>

        <article className="results-summary-card">
          <div className="summary-card-icon">
            <AudioLines size={22} />
          </div>

          <span>Candidate detections</span>

          <strong>{detections.length}</strong>

          <small>Listed prediction entries</small>
        </article>

        <article className="results-summary-card">
          <div className="summary-card-icon">
            <TrendingUp size={22} />
          </div>

          <span>Average score</span>

          <strong>{averageDisplayScore}</strong>

          <small>
            Average of displayed scores; not calibrated
            certainty
          </small>
        </article>

        <article className="results-summary-card">
          <div className="summary-card-icon">
            <Clock3 size={22} />
          </div>

          <span>Analysis status</span>

          <strong className="summary-status-text">
            {isDemo ? "Preview" : "Results"}
          </strong>

          <small>
            {isDemo
              ? "Backend not connected"
              : `${windowsAnalyzed} windows analyzed`}
          </small>
        </article>
      </div>

      {/* STEP 5: SPECIES ACTIVITY TIMELINE */}

      {!isDemo && (
        <SpeciesActivityTimeline
          windowPredictions={windowPredictions}
          audioDuration={audioDuration}
          onWindowSelect={onWindowSelect}
          onWindowPause={onWindowPause}
          onWindowResume={onWindowResume}
          activeWindowIndex={activeWindowIndex}
          isIntervalPlaying={isIntervalPlaying}
        />
      )}

      {/* SPECIES DETECTION SUMMARY */}

      <div className="detections-panel">
        <div className="detections-panel-heading">
          <div className="detections-heading-icon">
            <Bird size={23} />
          </div>

          <div>
            <h3>Species Detection Summary</h3>

            <p>
              Overall candidate predictions for the
              selected recording.
            </p>
          </div>
        </div>

        {detections.length === 0 ? (
          <div className="results-empty-state">
            <ChartNoAxesColumn size={35} />

            <h4>No results available</h4>

            <p>
              Predictions will appear here after the audio
              has been processed by the analysis backend.
            </p>
          </div>
        ) : (
          <div className="detections-table-wrapper">
            <table className="detections-table">
              <thead>
                <tr>
                  <th>Species</th>
                  <th>Taxonomic group</th>
                  <th>Candidate interval</th>
                  <th>Score</th>
                </tr>
              </thead>

              <tbody>
                {detections.map((detection, index) => (
                  <tr key={`${detection.id}-${index}`}>
                    <td>
                      <div className="detected-species">
                        <span className="species-rank">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        <div>
                          <strong>
                            {detection.species}
                          </strong>

                          <span className="species-scientific-name">
                            {detection.scientificName}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="taxonomy-badge">
                        {detection.category}
                      </span>
                    </td>

                    <td className="candidate-interval">
                      {detection.time}
                    </td>

                    <td>
                      <div className="confidence-cell">
                        <div className="confidence-value">
                          <strong>
                            {detection.displayScore}
                          </strong>

                          <span>
                            <CircleCheck size={14} />
                          </span>
                        </div>

                        <ConfidenceBar
                          confidence={
                            detection.barPercentage
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="results-panel-footer">
          <Info size={16} />

          <p>
            CNN14 model scores are not automatically
            calibrated probabilities. Overall predictions
            are aggregated across the recording. The
            activity timeline displays separate
            window-level predictions.
          </p>
        </div>
      </div>
    </section>
  );
}