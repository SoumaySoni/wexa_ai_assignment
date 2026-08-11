'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Paper {
  id: string;
  title: string;
  abstract: string;
  year: number;
  url: string;
  venue: string;
  authors: Array<{ id: string; name: string; affiliation?: string }>;
  concepts: Array<{ id: string; name: string }>;
}

interface Citation {
  id: string;
  title: string;
  year: number;
  relationship: string;
}

interface CitationData {
  cites: Citation[];
  citedBy: Citation[];
}

export default function PaperPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [paper, setPaper] = useState<Paper | null>(null);
  const [citations, setCitations] = useState<CitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [citationsLoading, setCitationsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'cites' | 'citedBy'>('cites');

  useEffect(() => {
    params.then(({ id }) => {
      const encodedId = encodeURIComponent(id);
      fetch(`/api/papers/${encodedId}`)
        .then(r => r.json())
        .then(d => {
          if (d.error) throw new Error(d.error);
          setPaper(d);
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));

      fetch(`/api/papers/${encodedId}/citations`)
        .then(r => r.json())
        .then(d => {
          if (d.error) throw new Error(d.error);
          setCitations(d);
        })
        .catch(() => setCitations({ cites: [], citedBy: [] }))
        .finally(() => setCitationsLoading(false));
    });
  }, [params]);

  if (loading) return (
    <div className="container">
      <div className="loading-container">
        <div className="spinner" aria-label="Loading paper" />
        <span className="loading-text">Loading paper…</span>
      </div>
    </div>
  );

  if (error || !paper) return (
    <div className="container">
      <div className="error-container">
        <div className="error-icon" aria-hidden="true">📄</div>
        <h1 className="error-title">Paper not found</h1>
        <p className="error-message">{error || 'This paper does not exist in the graph.'}</p>
        <button className="btn btn-ghost" onClick={() => router.push('/')}>← Back to Home</button>
      </div>
    </div>
  );

  const activeCitations = activeTab === 'cites' ? citations?.cites ?? [] : citations?.citedBy ?? [];

  return (
    <div className="container">
      {/* Breadcrumb */}
      <nav className="detail-breadcrumb" aria-label="Breadcrumb">
        <span
          className="detail-breadcrumb-link"
          onClick={() => router.push('/')}
          role="link"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && router.push('/')}
        >
          Home
        </span>
        <span className="detail-breadcrumb-sep" aria-hidden="true">/</span>
        <span>Paper</span>
      </nav>

      <article>
        <header className="detail-header">
          <div className="detail-meta-row">
            <span className="detail-year-badge" aria-label={`Published ${paper.year}`}>{paper.year}</span>
            {paper.venue && (
              <span className="paper-card-venue">{paper.venue}</span>
            )}
            {paper.url && (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="detail-external-link"
                aria-label="View paper on arXiv"
              >
                arXiv ↗
              </a>
            )}
          </div>

          <h1 className="detail-title">{paper.title}</h1>

          {/* Authors */}
          {paper.authors?.filter(a => a?.id).length > 0 && (
            <div className="detail-meta-row" style={{marginTop: 'var(--space-4)'}}>
              {paper.authors.filter(a => a?.id).map(author => (
                <span
                  key={author.id}
                  className="tag tag-author"
                  onClick={() => router.push(`/authors/${encodeURIComponent(author.id)}`)}
                  onKeyDown={e => e.key === 'Enter' && router.push(`/authors/${encodeURIComponent(author.id)}`)}
                  tabIndex={0}
                  role="link"
                  aria-label={`View author ${author.name}`}
                >
                  👤 {author.name}
                </span>
              ))}
            </div>
          )}

          {/* Abstract */}
          {paper.abstract && (
            <p className="detail-abstract">{paper.abstract}</p>
          )}

          {/* Concepts */}
          {paper.concepts?.filter(c => c?.id).length > 0 && (
            <div className="detail-meta-row" style={{marginTop: 'var(--space-5)'}}>
              {paper.concepts.filter(c => c?.id).map(concept => (
                <span
                  key={concept.id}
                  className="tag"
                  onClick={() => router.push(`/concepts/${encodeURIComponent(concept.id)}`)}
                  onKeyDown={e => e.key === 'Enter' && router.push(`/concepts/${encodeURIComponent(concept.id)}`)}
                  tabIndex={0}
                  role="link"
                  aria-label={`Explore concept: ${concept.name}`}
                >
                  🏷 {concept.name}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Citations */}
        <section aria-labelledby="citations-heading">
          <h2 id="citations-heading" className="section-title" style={{marginBottom: 'var(--space-1)'}}>
            Citation Graph
          </h2>
          <p style={{fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)'}}>
            Multi-hop traversal (up to 3 hops) via openCypher <code style={{fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8em', background: 'var(--color-surface)', padding: '1px 6px', borderRadius: '4px'}}>CITES*1..3</code>
          </p>

          <div className="tabs" role="tablist" aria-label="Citation direction">
            <button
              className={`tab ${activeTab === 'cites' ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === 'cites'}
              id="tab-cites"
              aria-controls="panel-cites"
              onClick={() => setActiveTab('cites')}
            >
              Cites ({citations?.cites.length ?? 0})
            </button>
            <button
              className={`tab ${activeTab === 'citedBy' ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === 'citedBy'}
              id="tab-cited-by"
              aria-controls="panel-cited-by"
              onClick={() => setActiveTab('citedBy')}
            >
              Cited By ({citations?.citedBy.length ?? 0})
            </button>
          </div>

          <div
            id={activeTab === 'cites' ? 'panel-cites' : 'panel-cited-by'}
            role="tabpanel"
            aria-labelledby={activeTab === 'cites' ? 'tab-cites' : 'tab-cited-by'}
          >
            {citationsLoading ? (
              <div className="loading-container" style={{padding: '2rem 0'}}>
                <div className="spinner" aria-label="Loading citations" />
              </div>
            ) : activeCitations.length === 0 ? (
              <div className="empty-state" role="status">
                No {activeTab === 'cites' ? 'outgoing citations' : 'incoming citations'} found for this paper.
              </div>
            ) : (
              <div className="citations-container" role="list">
                {activeCitations.slice(0, 30).map(c => (
                  <div
                    key={c.id}
                    className="citation-item"
                    role="listitem"
                    onClick={() => router.push(`/papers/${encodeURIComponent(c.id)}`)}
                    onKeyDown={e => e.key === 'Enter' && router.push(`/papers/${encodeURIComponent(c.id)}`)}
                    tabIndex={0}
                    aria-label={`${activeTab === 'cites' ? 'Cites' : 'Cited by'}: ${c.title}`}
                  >
                    <span className={`citation-direction ${activeTab === 'cites' ? 'citation-out' : 'citation-in'}`} aria-hidden="true">
                      {activeTab === 'cites' ? '→' : '←'}
                    </span>
                    <div>
                      <div className="citation-title">{c.title}</div>
                      <div className="citation-year">{c.year}</div>
                    </div>
                  </div>
                ))}
                {activeCitations.length > 30 && (
                  <p style={{fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-2)'}}>
                    Showing 30 of {activeCitations.length} results
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      </article>
    </div>
  );
}
