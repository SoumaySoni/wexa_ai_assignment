'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ConceptData {
  id: string;
  name: string;
  description?: string;
  paperCount: number;
  relatedConcepts: Array<{ id: string; name: string }>;
  papers: Array<{ id: string; title: string; year: number }>;
}

export default function ConceptPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [concept, setConcept] = useState<ConceptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    params.then(({ id }) => {
      fetch(`/api/concepts/${encodeURIComponent(id)}`)
        .then(r => r.json())
        .then(d => {
          if (d.error) throw new Error(d.error);
          setConcept(d);
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    });
  }, [params]);

  if (loading) return (
    <div className="container">
      <div className="loading-container">
        <div className="spinner" aria-label="Loading concept" />
        <span className="loading-text">Loading concept…</span>
      </div>
    </div>
  );

  if (error || !concept) return (
    <div className="container">
      <div className="error-container">
        <div className="error-icon" aria-hidden="true">🏷</div>
        <h1 className="error-title">Concept not found</h1>
        <p className="error-message">{error || 'This concept does not exist in the graph.'}</p>
        <button className="btn btn-ghost" onClick={() => router.push('/')}>← Back to Home</button>
      </div>
    </div>
  );

  const sortedPapers = [...concept.papers].sort((a, b) => (b.year || 0) - (a.year || 0));

  return (
    <div className="container">
      <nav className="detail-breadcrumb" aria-label="Breadcrumb">
        <span className="detail-breadcrumb-link" onClick={() => router.push('/')} role="link" tabIndex={0} onKeyDown={e => e.key === 'Enter' && router.push('/')}>Home</span>
        <span className="detail-breadcrumb-sep" aria-hidden="true">/</span>
        <span>Concept</span>
      </nav>

      <article>
        <header className="detail-header">
          <div className="detail-meta-row">
            <span className="tag" style={{fontSize: 'var(--text-xs)', letterSpacing: '0.06em', textTransform: 'uppercase'}}>
              Research Topic
            </span>
          </div>
          <h1 className="detail-title">{concept.name}</h1>
          {concept.description && (
            <p className="detail-abstract">{concept.description}</p>
          )}

          <div className="stats-row" style={{marginTop: 'var(--space-6)', marginBottom: 0}}>
            <div className="stat-item">
              <div className="stat-value">{concept.papers.length}</div>
              <div className="stat-label">Papers</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{concept.relatedConcepts.length}</div>
              <div className="stat-label">Related Topics</div>
            </div>
          </div>
        </header>

        <div className="detail-grid">
          {/* Papers */}
          <section aria-labelledby="papers-heading">
            <h2 id="papers-heading" className="section-title" style={{marginBottom: 'var(--space-5)'}}>
              Papers tagged with this concept
            </h2>
            {sortedPapers.length === 0 ? (
              <div className="empty-state" role="status">No papers found for this concept.</div>
            ) : (
              <div className="paper-list" role="list">
                {sortedPapers.map(paper => (
                  <div
                    key={paper.id}
                    className="paper-card"
                    role="listitem"
                    onClick={() => router.push(`/papers/${encodeURIComponent(paper.id)}`)}
                    onKeyDown={e => e.key === 'Enter' && router.push(`/papers/${encodeURIComponent(paper.id)}`)}
                    tabIndex={0}
                    aria-label={`Paper: ${paper.title}, ${paper.year}`}
                  >
                    <div className="paper-card-meta">
                      <span className="paper-card-year">{paper.year}</span>
                    </div>
                    <div className="paper-card-title">{paper.title}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Sidebar: Related Concepts */}
          <aside className="detail-sidebar" aria-label="Related concepts">
            <div className="sidebar-card">
              <div className="sidebar-card-header">Related Concepts</div>
              <div className="sidebar-card-body">
                <p style={{fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)'}}>
                  Concepts within 2 hops via <code style={{fontFamily: 'JetBrains Mono, monospace'}}>RELATED_TO*1..2</code>
                </p>
                {concept.relatedConcepts.length === 0 ? (
                  <div className="empty-state" role="status" style={{padding: 'var(--space-4)'}}>No related concepts.</div>
                ) : (
                  <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-2)'}}>
                    {concept.relatedConcepts.map(related => (
                      <div
                        key={related.id}
                        className="tag"
                        style={{justifyContent: 'flex-start', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)'}}
                        onClick={() => router.push(`/concepts/${encodeURIComponent(related.id)}`)}
                        onKeyDown={e => e.key === 'Enter' && router.push(`/concepts/${encodeURIComponent(related.id)}`)}
                        tabIndex={0}
                        role="link"
                        aria-label={`Explore concept: ${related.name}`}
                      >
                        🏷 {related.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </article>
    </div>
  );
}
