import { AlertTriangle, ArrowLeft, AudioLines, ShieldAlert } from "lucide-react";
import "../App.css";

export default function AudioRelevanceWarning({
  message = "This recording may not contain recognizable wildlife sounds.",
  onChooseAnother,
  onAnalyzeAnyway,
}) {
  return (
    <section
      className="audio-relevance-warning"
      role="alert"
      aria-live="polite"
    >
      <div className="relevance-warning-icon">
        <AlertTriangle size={30} />
      </div>

      <div className="relevance-warning-content">
        <span className="relevance-warning-label">
          AUDIO RELEVANCE CHECK
        </span>

        <h2>Are you sure this is a wildlife recording?</h2>

        <p>{message}</p>

        <div className="relevance-warning-info">
          <ShieldAlert size={18} />

          <span>
            BirdCLEF+ analysis may produce unreliable species predictions
            for unrelated audio, such as music or ordinary conversation.
          </span>
        </div>

        <div className="relevance-warning-actions">
          <button
            type="button"
            className="relevance-button relevance-button-secondary"
            onClick={onChooseAnother}
          >
            <ArrowLeft size={18} />
            Choose Another Recording
          </button>

          <button
            type="button"
            className="relevance-button relevance-button-primary"
            onClick={onAnalyzeAnyway}
          >
            <AudioLines size={18} />
            Analyze Anyway
          </button>
        </div>

        <p className="relevance-warning-disclaimer">
          This is a warning, not a definitive classification. Wildlife sounds
          can occur alongside speech, music, wind, and other background noise.
        </p>
      </div>
    </section>
  );
}