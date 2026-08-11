'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Metadata } from 'next';

interface SearchItem {
  type: 'paper' | 'author' | 'concept';
  id: string;
  title: string;
  subtitle: string;
}

interface SearchResults {
  papers: SearchItem[];
  authors: SearchItem[];
  concepts: SearchItem[];
}

interface TrendingTopic {
  id: string;
  name: string;
  totalPapers: number;
  recentPapers: number;
}

function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(data);
      setOpen(true);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const navigate = (item: SearchItem) => {
    setOpen(false);
    setQuery('');
    if (item.type === 'paper') router.push(`/papers/${encodeURIComponent(item.id)}`);
    else if (item.type === 'author') router.push(`/authors/${encodeURIComponent(item.id)}`);
    else router.push(`/concepts/${encodeURIComponent(item.id)}`);
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const iconFor = (type: string) => {
    if (type === 'paper') return '📄';
    if (type === 'author') return '👤';
    return '🏷';
  };

  const hasResults = results && (
    results.papers.length + results.authors.length + results.concepts.length > 0
  );

  return (
    <div className="search-wrapper" ref={wrapperRef} role="search">
      <span className="search-icon" aria-hidden="true">
        {loading ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" style={{animation:'spin 1s linear infinite'}} />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        )}
      </span>
      <input
        id="main-search"
        type="search"
        className="search-input"
        placeholder="Search papers, authors, topics…"
        value={query}
        onChange={handleChange}
        onFocus={() => { if (results && hasResults) setOpen(true); }}
        autoComplete="off"
        aria-label="Search research papers, authors and topics"
        aria-expanded={open}
        aria-haspopup="listbox"
        role="combobox"
      />

      {open && (
        <div className="search-dropdown" role="listbox" aria-label="Search results">
          {!hasResults ? (
            <div className="search-empty">No results for &ldquo;{query}&rdquo;</div>
          ) : (
            <>
              {results!.papers.length > 0 && (
                <>
                  <div className="search-group-label">Papers</div>
                  {results!.papers.map(item => (
                    <div
                      key={item.id}
                      className="search-item"
                      role="option"
                      aria-selected="false"
                      onClick={() => navigate(item)}
                      onKeyDown={e => e.key === 'Enter' && navigate(item)}
                      tabIndex={0}
                    >
                      <div className="search-item-icon" aria-hidden="true">{iconFor(item.type)}</div>
                      <div className="search-item-main">
                        <div className="search-item-title">{item.title}</div>
                        <div className="search-item-sub">{item.subtitle}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {results!.authors.length > 0 && (
                <>
                  {results!.papers.length > 0 && <div className="search-divider" />}
                  <div className="search-group-label">Authors</div>
                  {results!.authors.map(item => (
                    <div
                      key={item.id}
                      className="search-item"
                      role="option"
                      aria-selected="false"
                      onClick={() => navigate(item)}
                      onKeyDown={e => e.key === 'Enter' && navigate(item)}
                      tabIndex={0}
                    >
                      <div className="search-item-icon" aria-hidden="true">{iconFor(item.type)}</div>
                      <div className="search-item-main">
                        <div className="search-item-title">{item.title}</div>
                        <div className="search-item-sub">{item.subtitle}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {results!.concepts.length > 0 && (
                <>
                  {(results!.papers.length + results!.authors.length > 0) && <div className="search-divider" />}
                  <div className="search-group-label">Topics</div>
                  {results!.concepts.map(item => (
                    <div
                      key={item.id}
                      className="search-item"
                      role="option"
                      aria-selected="false"
                      onClick={() => navigate(item)}
                      onKeyDown={e => e.key === 'Enter' && navigate(item)}
                      tabIndex={0}
                    >
                      <div className="search-item-icon" aria-hidden="true">{iconFor(item.type)}</div>
                      <div className="search-item-main">
                        <div className="search-item-title">{item.title}</div>
                        <div className="search-item-sub">{item.subtitle}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TrendingSection() {
  const router = useRouter();
  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/trending')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setTopics(d.topics || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="section">
      <div className="section-header">
        <h2 className="section-title">Trending Topics</h2>
      </div>
      <div className="loading-container" style={{padding: '3rem 0'}}>
        <div className="spinner" aria-label="Loading trending topics" />
      </div>
    </div>
  );

  if (error) return (
    <div className="section">
      <div className="section-header"><h2 className="section-title">Trending Topics</h2></div>
      <div className="error-container" style={{padding: '2rem 0'}}>
        <div className="error-icon" aria-hidden="true">⚠</div>
        <p className="error-message">Could not load trending topics.</p>
        <code className="error-hint">{error}</code>
      </div>
    </div>
  );

  if (topics.length === 0) return (
    <div className="section">
      <div className="section-header"><h2 className="section-title">Trending Topics</h2></div>
      <div className="empty-state" role="status">No topics found. Run the seed script to populate the database.</div>
    </div>
  );

  return (
    <div className="section">
      <div className="section-header">
        <h2 className="section-title">Trending Topics</h2>
        <span className="section-count">{topics.length} topics · 2021–present</span>
      </div>
      <div className="topic-grid" role="list">
        {topics.map(topic => (
          <div
            key={topic.id}
            className="topic-card"
            role="listitem"
            onClick={() => router.push(`/concepts/${encodeURIComponent(topic.id)}`)}
            onKeyDown={e => e.key === 'Enter' && router.push(`/concepts/${encodeURIComponent(topic.id)}`)}
            tabIndex={0}
            aria-label={`${topic.name}, ${topic.recentPapers} recent papers`}
          >
            <span className="topic-card-name">{topic.name}</span>
            <span className="topic-card-count">{topic.recentPapers} recent · {topic.totalPapers} total</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="container">
      <section className="hero" aria-labelledby="hero-title">
        <span className="hero-eyebrow" aria-label="Powered by CognoDB graph database">Graph Database · CognoDB · openCypher</span>
        <h1 id="hero-title" className="hero-title">
          Explore AI Research<br />Through the Graph
        </h1>
        <p className="hero-subtitle">
          Navigate papers, authors, and concepts through their connections.
          Discover multi-hop relationships that relational databases can&apos;t easily traverse.
        </p>
        <SearchBar />
      </section>

      <TrendingSection />
    </div>
  );
}
