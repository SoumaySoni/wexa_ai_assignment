import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'ResearchGraph — AI Research Knowledge Graph',
    template: '%s | ResearchGraph',
  },
  description:
    'Explore AI and CS research papers, authors, and concepts through an interactive knowledge graph powered by CognoDB.',
  keywords: ['research', 'AI', 'knowledge graph', 'papers', 'citations', 'graph database'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="page-wrapper">
          <header>
            <nav className="nav" role="navigation" aria-label="Main navigation">
              <div className="nav-inner">
                <a href="/" className="nav-logo" aria-label="ResearchGraph home">
                  <span className="nav-logo-dot" aria-hidden="true" />
                  ResearchGraph
                </a>
                <div className="nav-links">
                  <a href="/" className="nav-link">Explore</a>
                  <a
                    href="https://console.cognodb.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nav-link"
                  >
                    CognoDB ↗
                  </a>
                </div>
              </div>
            </nav>
          </header>

          <main className="main-content" role="main">
            {children}
          </main>

          <footer className="footer" role="contentinfo">
            <div className="footer-inner">
              <span className="footer-text">
                ResearchGraph · Powered by CognoDB (openCypher / Bolt)
              </span>
              <span className="footer-text">
                Data sourced from arXiv API
              </span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
