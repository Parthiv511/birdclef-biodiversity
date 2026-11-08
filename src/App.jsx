import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import "./App.css";
import {
  AudioLines,
  Home as HomeIcon,
  Leaf,
  Info,
} from "lucide-react";

import Layout from "./components/Layout";
import Home from "./pages/Home";
import AudioAnalysis from "./pages/AudioAnalysis";
import Biodiversity from "./pages/Biodiversity";
import About from "./pages/About";

function Navbar() {
  const links = [
    { to: "/", label: "Home", icon: HomeIcon, end: true },
    { to: "/analysis", label: "Audio Analysis", icon: AudioLines },
    { to: "/biodiversity", label: "Biodiversity", icon: Leaf },
    { to: "/about", label: "About", icon: Info },
  ];

  return (
    <header className="navbar">
     <NavLink to="/" className="brand">
  <Leaf className="brand-leaf" size={29} />

  <span className="brand-name">
    <span className="brand-bird">Bird</span>
    <span className="brand-clef">
      CLEF<span className="brand-plus">+</span>
    </span>
  </span>
</NavLink>

      <nav className="nav-links" aria-label="Main navigation">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `nav-link${isActive ? " active" : ""}`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Navbar />

        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/analysis" element={<AudioAnalysis />} />
            <Route path="/biodiversity" element={<Biodiversity />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </main>
      </Layout>
    </BrowserRouter>
  );
}