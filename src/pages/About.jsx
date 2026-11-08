import { AudioLines, Brain, Leaf } from "lucide-react";

export default function About() {
  return (
    <section className="page-container">
      <div className="content-panel">
        <h1>About BirdCLEF+ 2026</h1>

        <p>
          Our project explores AI-powered bioacoustic monitoring to
          support wildlife detection and biodiversity analysis.
        </p>

        <div className="about-grid">
          <article className="placeholder-card">
            <AudioLines size={30} />
            <h2>Bioacoustics</h2>
            <p>Analyze audio recordings and visualize acoustic activity.</p>
          </article>

          <article className="placeholder-card">
            <Brain size={30} />
            <h2>Deep Learning</h2>
            <p>Use the trained CNN14 model for 234-class prediction.</p>
          </article>

          <article className="placeholder-card">
            <Leaf size={30} />
            <h2>Biodiversity</h2>
            <p>Explore wildlife observations and acoustic patterns.</p>
          </article>
        </div>
      </div>
    </section>
  );
}