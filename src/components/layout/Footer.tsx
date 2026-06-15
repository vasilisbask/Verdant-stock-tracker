"use client";

export default function Footer() {
  return (
    <footer className="footer-section">
      <div className="footer-container">
        <a href="/" className="footer-logo">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transition: "transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)" }} className="brand-logo-svg">
            <circle cx="8" cy="8" r="7" stroke="rgba(176, 228, 204, 0.25)" strokeWidth="1"/>
            <line x1="8" y1="1" x2="8" y2="15" stroke="rgba(176, 228, 204, 0.4)" strokeWidth="1"/>
            <line x1="1" y1="8" x2="15" y2="8" stroke="rgba(176, 228, 204, 0.4)" strokeWidth="1"/>
            <circle cx="8" cy="8" r="2.5" fill="#B0E4CC"/>
          </svg>
          <span className="footer-logo-text">Verdant</span>
        </a>
        <p className="footer-disclaimer">
          FOR INFORMATIONAL PURPOSES ONLY. NOT FINANCIAL ADVICE.
        </p>
        <div className="footer-links">
          <a href="https://www.gsis.gr/" target="_blank" rel="noopener noreferrer" className="footer-link">
            Developed for the GSIS Internship
          </a>
        </div>
      </div>
    </footer>
  );
}
