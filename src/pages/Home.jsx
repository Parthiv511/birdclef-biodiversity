
import { Link } from "react-router-dom";
import { AudioLines, Leaf, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <section className="page-container">
      <div className="hero-content">
        <p className="hero-label">
          BIRDCLEF+ 2026 · BIODIVERSITY AI
        </p>

        <h1 className="typing-heading">
          <span className="typing-text">Listen to the Wild.</span>
        </h1>

        <div className="hero-actions">
          <Link to="/analysis" className="primary-button">
            <AudioLines size={20} />
            Analyze Audio
            <ArrowRight size={18} />
          </Link>

          <Link to="/biodiversity" className="secondary-button">
            <Leaf size={20} />
            Explore Biodiversity
          </Link>
        </div>
      </div>
    </section>
  );
}

