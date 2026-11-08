import { useEffect, useState } from "react";

import {
  Leaf,
  ChartNoAxesCombined,
  AudioLines,
  Dna,
  Activity,
  Trees,
  Bird,
  PawPrint,
  Bug,
  Waves,
  RefreshCw,
  AlertCircle,
  Clock,
  ChevronRight,
} from "lucide-react";

import { fetchBiodiversityData } from "../services/audioApi";


const TAXONOMIC_ICONS = {
  Birds: Bird,
  Mammals: PawPrint,
  Amphibians: Waves,
  Reptiles: Bug,
  Insects: Bug,
};


function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) {
    return "N/A";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}m ${remainingSeconds}s`;
}


function formatDate(dateString) {
  if (!dateString) {
    return "Date unavailable";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString();
}


function SummaryCard({ title, value, description, icon: Icon }) {
  return (
    <div className="biodiversity-summary-card">
      <div className="biodiversity-summary-icon">
        <Icon size={23} />
      </div>

      <div className="biodiversity-summary-content">
        <p>{title}</p>

        <h2>{value ?? 0}</h2>

        <span>{description}</span>
      </div>
    </div>
  );
}


function EmptyState({ message }) {
  return (
    <div className="biodiversity-empty-state">
      <Leaf size={30} />

      <p>{message}</p>
    </div>
  );
}


function TaxonomicDistribution({ data = [] }) {
  const totalSpecies = data.reduce(
    (total, item) => total + item.species_count,
    0
  );

  const maximum = Math.max(
    ...data.map((item) => item.species_count),
    1
  );

  const preferredOrder = [
    "Birds",
    "Mammals",
    "Amphibians",
    "Reptiles",
    "Insects",
  ];

  const sortedData = [...data].sort(
    (a, b) =>
      preferredOrder.indexOf(a.group_name) -
      preferredOrder.indexOf(b.group_name)
  );

  return (
    <div className="biodiversity-card">
      <div className="biodiversity-section-heading">
        <div>
          <h2>Taxonomic Distribution</h2>

          <p>Predicted species across taxonomic groups</p>
        </div>

        <ChartNoAxesCombined size={23} />
      </div>

      {data.length === 0 ? (
        <EmptyState message="No taxonomic data available yet." />
      ) : (
        <>
          <div className="taxonomic-total">
            <span>Species represented</span>

            <strong>{totalSpecies}</strong>
          </div>

          <div className="taxonomic-list">
            {sortedData.map((item) => {
              const Icon =
                TAXONOMIC_ICONS[item.group_name] || Leaf;

              const percentage =
                totalSpecies > 0
                  ? (
                      (item.species_count / totalSpecies) *
                      100
                    ).toFixed(1)
                  : 0;

              return (
                <div
                  className="taxonomic-item"
                  key={item.taxonomic_class}
                >
                  <div className="taxonomic-item-header">
                    <div className="taxonomic-name">
                      <Icon size={19} />

                      <div>
                        <strong>{item.group_name}</strong>

                        <small>{item.taxonomic_class}</small>
                      </div>
                    </div>

                    <div className="taxonomic-count">
                      <strong>{item.species_count}</strong>

                      <span>{percentage}%</span>
                    </div>
                  </div>

                  <div className="taxonomic-progress-track">
                    <div
                      className="taxonomic-progress-fill"
                      style={{
                        width: `${
                          (item.species_count / maximum) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}


function TopSpecies({ data = [] }) {
  return (
    <div className="biodiversity-card">
      <div className="biodiversity-section-heading">
        <div>
          <h2>Top Predicted Species</h2>

          <p>Species appearing across analyzed recordings</p>
        </div>

        <Dna size={23} />
      </div>

      {data.length === 0 ? (
        <EmptyState message="No species predictions available yet." />
      ) : (
        <div className="top-species-list">
          {data.map((species,index) => (
            <div
              className="top-species-item"
              key={`${species.species_id}-${index}`}
            >
              <div className="species-rank">
                {index + 1}
              </div>

              <div className="species-details">
                <strong>
                  {species.common_name || "Unknown species"}
                </strong>

                <em>{species.scientific_name}</em>

                <span>
                  {species.group_name ||
                    species.taxonomic_class}
                </span>
              </div>

              <div className="species-recording-count">
                <strong>{species.recording_count}</strong>

                <small>
                  {species.recording_count === 1
                    ? "recording"
                    : "recordings"}
                </small>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function SpeciesRichness({ data = [] }) {
  const maximum = Math.max(
    ...data.map((item) => item.species_richness),
    1
  );

  return (
    <div className="biodiversity-card">
      <div className="biodiversity-section-heading">
        <div>
          <h2>Species Richness</h2>

          <p>Unique predicted species per recording</p>
        </div>

        <Activity size={23} />
      </div>

      {data.length === 0 ? (
        <EmptyState message="No species richness data available yet." />
      ) : (
        <div className="richness-chart">
          {data.map((item) => {
            const height =
              (item.species_richness / maximum) * 100;

            return (
              <div
                className="richness-column"
                key={item.recording_id}
                title={`Recording ${item.recording_id}: ${item.species_richness} species`}
              >
                <strong>{item.species_richness}</strong>

                <div className="richness-bar-container">
                  <div
                    className="richness-bar"
                    style={{
                      height: `${Math.max(height, 4)}%`,
                    }}
                  />
                </div>

                <span>R{item.recording_id}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="richness-footer">
        Showing species richness for analyzed recordings.
      </div>
    </div>
  );
}


function RecordingHistory({ data = [] }) {
  return (
    <div className="biodiversity-card">
      <div className="biodiversity-section-heading">
        <div>
          <h2>Recent Recording History</h2>

          <p>Recently analyzed wildlife recordings</p>
        </div>

        <Clock size={23} />
      </div>

      {data.length === 0 ? (
        <EmptyState message="No recordings have been analyzed yet." />
      ) : (
        <div className="recording-history-list">
          {data.map((recording) => (
            <div
              className="recording-history-item"
              key={recording.recording_id}
            >
              <div className="recording-history-icon">
                <AudioLines size={21} />
              </div>

              <div className="recording-history-details">
                <strong>{recording.filename}</strong>

                <span>
                  {formatDate(recording.analyzed_at)}
                </span>

                <div className="recording-history-meta">
                  <span>
                    Duration:{" "}
                    {formatDuration(recording.audio_duration)}
                  </span>

                  <span>
                    Windows: {recording.windows_analyzed}
                  </span>

                  <span>
                    Species: {recording.species_richness}
                  </span>
                </div>
              </div>

              <ChevronRight
                size={19}
                className="recording-history-arrow"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


export default function Biodiversity() {
  const [dashboardData, setDashboardData] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  async function loadDashboard(showLoader = true) {
  try {
    if (showLoader) {
      setLoading(true);
    }

    setError("");

    const data = await fetchBiodiversityData();

    setDashboardData(data);

  } catch (err) {
    console.error("Dashboard loading failed:", err);

    setError(
      err.message ||
      "Unable to load biodiversity analytics."
    );

  } finally {
    setLoading(false);
  }
}


  useEffect(() => {
  // Load dashboard data when the page opens.
  const initialLoad = async () => {
    try {
      setError("");

      const data = await fetchBiodiversityData();

      setDashboardData(data);

    } catch (err) {
      console.error("Dashboard loading failed:", err);

      setError(
        err.message ||
        "Unable to load biodiversity analytics."
      );

    } finally {
      setLoading(false);
    }
  };

  initialLoad();

  // Listen for successful audio analysis events.
  const handleDashboardRefresh = () => {
    loadDashboard();
  };

  window.addEventListener(
    "biodiversity:refresh",
    handleDashboardRefresh
  );

  return () => {
    window.removeEventListener(
      "biodiversity:refresh",
      handleDashboardRefresh
    );
  };
}, []);


  if (loading && !dashboardData) {
    return (
      <section className="page-container">
        <div className="content-panel biodiversity-loading">
          <RefreshCw size={35} className="loading-spinner" />

          <h2>Loading Biodiversity Dashboard</h2>

          <p>
            Retrieving wildlife analysis and biodiversity statistics...
          </p>
        </div>
      </section>
    );
  }


  if (error && !dashboardData) {
    return (
      <section className="page-container">
        <div className="content-panel biodiversity-error">
          <AlertCircle size={38} />

          <h2>Unable to Load Dashboard</h2>

          <p>{error}</p>

          <button
            className="biodiversity-refresh-button"
            onClick={loadDashboard}
          >
            <RefreshCw size={17} />

            Retry
          </button>
        </div>
      </section>
    );
  }


  const summary = dashboardData?.summary || {};


  return (
    <section className="page-container">
      <div className="content-panel biodiversity-dashboard">

        {/* Dashboard Header */}
        <div className="biodiversity-header">
          <div className="biodiversity-title">
            <div className="biodiversity-title-icon">
              <Leaf size={34} />
            </div>

            <div>
              <h1>Biodiversity Dashboard</h1>

              <p>
                Explore acoustic biodiversity patterns and
                species activity across wildlife recordings.
              </p>
            </div>
          </div>

          <button
            className="biodiversity-refresh-button"
            onClick={loadDashboard}
            disabled={loading}
          >
            <RefreshCw
              size={17}
              className={loading ? "loading-spinner" : ""}
            />

            {loading ? "Refreshing..." : "Refresh Data"}
          </button>
        </div>


        {/* API Error */}
        {error && (
          <div className="biodiversity-inline-error">
            <AlertCircle size={18} />

            <span>{error}</span>
          </div>
        )}


        {/* Summary Cards */}
        <div className="biodiversity-summary-grid">

          <SummaryCard
            title="Total Recordings"
            value={summary.total_recordings}
            description="Successfully analyzed recordings"
            icon={AudioLines}
          />

          <SummaryCard
            title="Unique Species"
            value={summary.unique_species}
            description="Distinct model-predicted species"
            icon={Dna}
          />

          <SummaryCard
            title="Total Predictions"
            value={summary.total_predictions}
            description="Overall recording-level predictions"
            icon={ChartNoAxesCombined}
          />

          <SummaryCard
            title="Average Species Richness"
            value={summary.average_species_richness}
            description="Predicted species per recording"
            icon={Trees}
          />

        </div>


        {/* Taxonomy and Top Species */}
        <div className="biodiversity-two-column">

          <TaxonomicDistribution
            data={dashboardData?.taxonomic_distribution || []}
          />

          <TopSpecies
            data={dashboardData?.top_species || []}
          />

        </div>


        {/* Species Richness */}
        <SpeciesRichness
          data={dashboardData?.species_richness || []}
        />


        {/* Recording History */}
        <RecordingHistory
          data={dashboardData?.recording_history || []}
        />


        {/* Scientific Disclaimer */}
        <div className="biodiversity-disclaimer">
          <AlertCircle size={19} />

          <p>
            <strong>Research note:</strong>{" "}
            {dashboardData?.note ||
              "These statistics represent model-predicted species detections, not scientifically confirmed ecological observations."}
          </p>
        </div>

      </div>

      <style>{`

        .biodiversity-dashboard {
          display: flex;
          flex-direction: column;
          gap: 25px;
        }

        .biodiversity-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }

        .biodiversity-title {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .biodiversity-title-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 60px;
          height: 60px;
          border-radius: 16px;
          background: rgba(45, 160, 100, 0.12);
          color: #23945b;
        }

        .biodiversity-title h1 {
          margin: 0 0 7px;
        }

        .biodiversity-title p {
          margin: 0;
          opacity: 0.7;
          line-height: 1.5;
        }

        .biodiversity-refresh-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 11px 17px;
          border: none;
          border-radius: 9px;
          background: #238b59;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .biodiversity-refresh-button:hover {
          background: #176d43;
        }

        .biodiversity-refresh-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .biodiversity-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 17px;
        }

        .biodiversity-summary-card {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 20px;
          border-radius: 14px;
          border: 1px solid rgba(128, 128, 128, 0.18);
          background: var(--card-bg, rgba(128, 128, 128, 0.04));
          min-width: 0;
        }

        .biodiversity-summary-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 43px;
          height: 43px;
          border-radius: 12px;
          background: rgba(35, 139, 89, 0.12);
          color: #23945b;
        }

        .biodiversity-summary-content {
          min-width: 0;
        }

        .biodiversity-summary-content p {
          margin: 0 0 8px;
          font-size: 13px;
          opacity: 0.7;
        }

        .biodiversity-summary-content h2 {
          margin: 0 0 6px;
          font-size: 27px;
        }

        .biodiversity-summary-content span {
          font-size: 11px;
          opacity: 0.65;
          line-height: 1.4;
        }

        .biodiversity-two-column {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
          align-items: stretch;
        }

        .biodiversity-card {
          padding: 22px;
          border: 1px solid rgba(128, 128, 128, 0.18);
          border-radius: 15px;
          background: var(--card-bg, rgba(128, 128, 128, 0.04));
          min-width: 0;
        }

        .biodiversity-section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 24px;
        }

        .biodiversity-section-heading h2 {
          margin: 0 0 6px;
          font-size: 19px;
        }

        .biodiversity-section-heading p {
          margin: 0;
          font-size: 12px;
          opacity: 0.65;
        }

        .biodiversity-section-heading > svg {
          color: #23945b;
          flex-shrink: 0;
        }

        .taxonomic-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          margin-bottom: 20px;
          border-radius: 9px;
          background: rgba(35, 139, 89, 0.09);
        }

        .taxonomic-total span {
          font-size: 13px;
        }

        .taxonomic-total strong {
          font-size: 20px;
        }

        .taxonomic-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .taxonomic-item-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 9px;
        }

        .taxonomic-name {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .taxonomic-name > svg {
          color: #23945b;
        }

        .taxonomic-name div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .taxonomic-name strong {
          font-size: 13px;
        }

        .taxonomic-name small {
          font-size: 11px;
          opacity: 0.6;
        }

        .taxonomic-count {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .taxonomic-count strong {
          font-size: 14px;
        }

        .taxonomic-count span {
          font-size: 11px;
          opacity: 0.65;
        }

        .taxonomic-progress-track {
          height: 8px;
          width: 100%;
          overflow: hidden;
          border-radius: 10px;
          background: rgba(128, 128, 128, 0.15);
        }

        .taxonomic-progress-fill {
          height: 100%;
          border-radius: 10px;
          background: #23945b;
          transition: width 0.4s ease;
        }

        .top-species-list {
          display: flex;
          flex-direction: column;
        }

        .top-species-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 0;
          border-bottom: 1px solid rgba(128, 128, 128, 0.15);
        }

        .top-species-item:last-child {
          border-bottom: none;
        }

        .species-rank {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 29px;
          height: 29px;
          border-radius: 8px;
          background: rgba(35, 139, 89, 0.1);
          color: #23945b;
          font-weight: 700;
          font-size: 12px;
        }

        .species-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          min-width: 0;
        }

        .species-details strong {
          font-size: 13px;
        }

        .species-details em {
          font-size: 11px;
          opacity: 0.7;
          overflow-wrap: anywhere;
        }

        .species-details span {
          font-size: 10px;
          opacity: 0.6;
        }

        .species-recording-count {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 3px;
          flex-shrink: 0;
        }

        .species-recording-count strong {
          font-size: 17px;
        }

        .species-recording-count small {
          font-size: 10px;
          opacity: 0.6;
        }

        .richness-chart {
          display: flex;
          align-items: flex-end;
          gap: 14px;
          height: 210px;
          padding: 20px 8px 0;
          overflow-x: auto;
        }

        .richness-column {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex: 1;
          min-width: 42px;
          height: 100%;
        }

        .richness-column > strong {
          font-size: 12px;
        }

        .richness-bar-container {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          width: 25px;
          height: 135px;
          border-radius: 8px;
          background: rgba(128, 128, 128, 0.09);
          overflow: hidden;
        }

        .richness-bar {
          width: 100%;
          min-height: 4px;
          border-radius: 7px 7px 0 0;
          background: #23945b;
          transition: height 0.4s ease;
        }

        .richness-column > span {
          font-size: 10px;
          opacity: 0.65;
        }

        .richness-footer {
          margin-top: 15px;
          font-size: 11px;
          opacity: 0.6;
        }

        .recording-history-list {
          display: flex;
          flex-direction: column;
        }

        .recording-history-item {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 16px 0;
          border-bottom: 1px solid rgba(128, 128, 128, 0.15);
        }

        .recording-history-item:last-child {
          border-bottom: none;
        }

        .recording-history-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 43px;
          height: 43px;
          border-radius: 12px;
          background: rgba(35, 139, 89, 0.1);
          color: #23945b;
        }

        .recording-history-details {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
          min-width: 0;
        }

        .recording-history-details > strong {
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .recording-history-details > span {
          font-size: 11px;
          opacity: 0.6;
        }

        .recording-history-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 13px;
          margin-top: 3px;
        }

        .recording-history-meta span {
          font-size: 11px;
          opacity: 0.7;
        }

        .recording-history-arrow {
          flex-shrink: 0;
          opacity: 0.45;
        }

        .biodiversity-disclaimer {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 15px;
          border-radius: 10px;
          background: rgba(35, 139, 89, 0.08);
          color: inherit;
        }

        .biodiversity-disclaimer svg {
          flex-shrink: 0;
          color: #23945b;
        }

        .biodiversity-disclaimer p {
          margin: 0;
          font-size: 12px;
          line-height: 1.7;
          opacity: 0.8;
        }

        .biodiversity-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          min-height: 140px;
          text-align: center;
          opacity: 0.65;
        }

        .biodiversity-empty-state svg {
          color: #23945b;
        }

        .biodiversity-empty-state p {
          font-size: 13px;
        }

        .biodiversity-loading,
        .biodiversity-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 350px;
          text-align: center;
          gap: 12px;
        }

        .biodiversity-loading p,
        .biodiversity-error p {
          opacity: 0.7;
        }

        .biodiversity-error > svg {
          color: #d65a5a;
        }

        .biodiversity-inline-error {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          border-radius: 9px;
          background: rgba(214, 90, 90, 0.1);
          color: #c84b4b;
          font-size: 13px;
        }

        .loading-spinner {
          animation: biodiversity-spin 1s linear infinite;
        }

        @keyframes biodiversity-spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1000px) {
          .biodiversity-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .biodiversity-two-column {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .biodiversity-summary-grid {
            grid-template-columns: 1fr;
          }

          .biodiversity-header {
            align-items: flex-start;
          }

          .biodiversity-title {
            align-items: flex-start;
          }

          .biodiversity-title-icon {
            width: 46px;
            height: 46px;
          }

          .biodiversity-title h1 {
            font-size: 23px;
          }

          .biodiversity-card {
            padding: 16px;
          }

          .recording-history-meta {
            flex-direction: column;
            gap: 5px;
          }
        }

      `}</style>
    </section>
  );
}