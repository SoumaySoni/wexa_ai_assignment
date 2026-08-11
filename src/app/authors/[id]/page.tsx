'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AuthorData {
  id: string;
  name: string;
  affiliation: string;
  papers: Array<{ id: string; title: string; year: number; venue?: string }>;
  topConcepts: string[];
}

interface NetworkData {
  directCollaborators: Array<{
    id: string;
    name: string;
    affiliation?: string;
    sharedPapers: string[];
    sharedCount: number;
    hop: number;
  }>;
  extendedNetwork: Array<{ id: string; name: string; hop: number }>;
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function AuthorPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [author, setAuthor] = useState<AuthorData | null>(null);
  const [network, setNetwork] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkLoading, setNetworkLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'papers' | 'network'>('papers');

  useEffect(() => {
    params.then(({ id }) => {
      const encodedId = encodeURIComponent(id);
      fetch(`/api/authors/${encodedId}`)
        .then(r => r.json())
        .then(d => {
          if (d.error) throw new Error(d.error);
          setAuthor(d);
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));

      fetch(`/api/authors/${encodedId}/network`)
        .then(r => r.json())
        .then(d => {
          if (!d.error) setNetwork(d);
        })
        .catch(() => {})
        .finally(() => setNetworkLoading(false));
    });
  }, [params]);

  if (loading) return (
    <div className="container">
      <div className="loading-container">
        <div className="spinner" aria-label="Loading author profile" />
        <span className="loading-text">Loading author…</span>
      </div>
    </div>
  );

  if (error || !author) return (
    <div className="container">
      <div className="error-container">
        <div className="error-icon" aria-hidden="true">👤</div>
        <h1 className="error-title">Author not found</h1>
        <p className="error-message">{error || 'This author does not exist in the graph.'}</p>
        <button className="btn btn-ghost" onClick={() => router.push('/')}>← Back to Home</button>
      </div>
    </div>
  );

  const sortedPapers = [...author.papers].sort((a, b) => (b.year || 0) - (a.year || 0));

  return (
    <div className="container">
      <nav className="detail-breadcrumb" aria-label="Breadcrumb">
        <span className="detail-breadcrumb-link" onClick={() => router.push('/')} role="link" tabIndex={0} onKeyDown={e => e.key === 'Enter' && router.push('/')}>Home</span>
        <span className="detail-breadcrumb-sep" aria-hidden="true">/</span>
        <span>Author</span>
      </nav>

      <article>
        <header className="detail-header">
          <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-5)'}}>
            <div
              className="author-avatar"
              style={{width: 64, height: 64, fontSize: 'var(--text-xl)'}}
              aria-hidden="true"
            >
              {initials(author.name)}
            </div>
            <div>
              <h1 className="detail-title" style={{marginBottom: 'var(--space-1)'}}>{author.name}</h1>
              {author.affiliation && (
                <p style={{fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)'}}>
                  {author.affiliation}
                </p>
              )}
            </div>
          </div>

          <div className="stats-row" style={{marginTop: 'var(--space-6)', marginBottom: 0}}>
            <div className="stat-item">
              <div className="stat-value">{author.papers.length}</div>
              <div className="stat-label">Papers</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{network?.directCollaborators.length ?? '—'}</div>
              <div className="stat-label">Collaborators</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{author.topConcepts?.length ?? 0}</div>
              <div className="stat-label">Topics</div>
            </div>
          </div>

          {/* Research concepts */}
          {author.topConcepts?.length > 0 && (
            <div className="detail-meta-row" style={{marginTop: 'var(--space-5)'}}>
              {author.topConcepts.slice(0, 8).map(c => (
                <span key={c} className="tag" aria-label={`Research topic: ${c}`}>🏷 {c}</span>
              ))}
            </div>
          )}
        </header>

        {/* Tabs */}
        <div className="tabs" role="tablist" aria-label="Author information sections">
          <button
            className={`tab ${activeTab === 'papers' ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'papers'}
            id="tab-papers"
            aria-controls="panel-papers"
            onClick={() => setActiveTab('papers')}
          >
            Papers ({author.papers.length})
          </button>
          <button
            className={`tab ${activeTab === 'network' ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'network'}
            id="tab-network"
            aria-controls="panel-network"
            onClick={() => setActiveTab('network')}
          >
            Collaborator Network ({network?.directCollaborators.length ?? 0})
          </button>
        </div>

        {activeTab === 'papers' && (
          <div id="panel-papers" role="tabpanel" aria-labelledby="tab-papers">
            {sortedPapers.length === 0 ? (
              <div className="empty-state" role="status">No papers found for this author.</div>
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
                      {paper.venue && <span className="paper-card-venue">{paper.venue}</span>}
                    </div>
                    <div className="paper-card-title">{paper.title}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'network' && (
          <div id="panel-network" role="tabpanel" aria-labelledby="tab-network">
            {networkLoading ? (
              <div className="loading-container" style={{padding: '2rem 0'}}>
                <div className="spinner" aria-label="Loading collaborator network" />
              </div>
            ) : !network || network.directCollaborators.length === 0 ? (
              <div className="empty-state" role="status">No collaborators found in the graph.</div>
            ) : (
              <>
                <p style={{fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)'}}>
                  2-hop co-author network — direct collaborators and their connections.
                  This query would require multiple self-JOINs in SQL.
                </p>
                <div className="collaborator-list" role="list">
                  {network.directCollaborators.map(collab => (
                    <div
                      key={collab.id}
                      className="collaborator-item"
                      role="listitem"
                      onClick={() => router.push(`/authors/${encodeURIComponent(collab.id)}`)}
                      onKeyDown={e => e.key === 'Enter' && router.push(`/authors/${encodeURIComponent(collab.id)}`)}
                      tabIndex={0}
                      aria-label={`Collaborator: ${collab.name}, ${collab.sharedCount} shared papers`}
                    >
                      <div className="collaborator-avatar" aria-hidden="true">
                        {initials(collab.name)}
                      </div>
                      <div style={{flex: 1, minWidth: 0}}>
                        <div className="collaborator-name">{collab.name}</div>
                        {collab.affiliation && (
                          <div className="collaborator-count">{collab.affiliation}</div>
                        )}
                      </div>
                      <div style={{textAlign: 'right', flexShrink: 0}}>
                        <div style={{fontSize: 'var(--text-xs)', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace'}}>
                          {collab.sharedCount}
                        </div>
                        <div className="collaborator-count">shared</div>
                      </div>
                    </div>
                  ))}
                </div>
                {network.extendedNetwork.length > 0 && (
                  <p style={{
                    marginTop: 'var(--space-6)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)',
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)'
                  }}>
                    +{network.extendedNetwork.length} researchers reachable at 2 hops
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </article>
    </div>
  );
}
