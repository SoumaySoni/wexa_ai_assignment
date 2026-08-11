#!/usr/bin/env node
/**
 * ResearchGraph Seed Script
 * Fetches real AI/CS papers from arXiv API and loads them into CognoDB
 *
 * Usage:
 *   1. Copy .env.local.example to .env.local and fill in your CognoDB credentials
 *   2. Run: node scripts/seed.mjs
 */

import neo4j from 'neo4j-driver';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load env from .env.local ────────────────────────────────────────────────
function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env.local');
    const content = readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) return;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (key) process.env[key] = val;
    });
    console.log('✓ Loaded .env.local');
  } catch {
    console.log('ℹ No .env.local found, using existing environment variables');
  }
}

loadEnv();

const URI = process.env.COGNODB_URI;
const PASSWORD = process.env.COGNODB_PASSWORD;
const USER = process.env.COGNODB_USER || 'cognodb';

if (!URI || !PASSWORD) {
  console.error('✗ Missing COGNODB_URI or COGNODB_PASSWORD');
  console.error('  Copy .env.local.example to .env.local and fill in your credentials');
  process.exit(1);
}

// ── arXiv category → concept mapping ───────────────────────────────────────
const CATEGORY_CONCEPTS = {
  'cs.AI': 'Artificial Intelligence',
  'cs.LG': 'Machine Learning',
  'cs.CL': 'Natural Language Processing',
  'cs.CV': 'Computer Vision',
  'cs.NE': 'Neural Networks',
  'cs.IR': 'Information Retrieval',
  'cs.RO': 'Robotics',
  'cs.HC': 'Human-Computer Interaction',
  'stat.ML': 'Statistical Machine Learning',
  'math.OC': 'Optimization',
  'cs.GT': 'Game Theory',
  'cs.CR': 'Cryptography & Security',
  'cs.DC': 'Distributed Computing',
  'cs.SE': 'Software Engineering',
};

const CONCEPT_RELATIONS = {
  'Artificial Intelligence': ['Machine Learning', 'Neural Networks', 'Natural Language Processing', 'Computer Vision'],
  'Machine Learning': ['Neural Networks', 'Statistical Machine Learning', 'Optimization', 'Artificial Intelligence'],
  'Natural Language Processing': ['Machine Learning', 'Artificial Intelligence', 'Information Retrieval'],
  'Computer Vision': ['Machine Learning', 'Neural Networks', 'Artificial Intelligence'],
  'Neural Networks': ['Machine Learning', 'Optimization', 'Computer Vision', 'Natural Language Processing'],
  'Information Retrieval': ['Natural Language Processing', 'Machine Learning'],
  'Statistical Machine Learning': ['Machine Learning', 'Optimization'],
  'Optimization': ['Machine Learning', 'Statistical Machine Learning'],
  'Robotics': ['Artificial Intelligence', 'Machine Learning', 'Computer Vision'],
  'Human-Computer Interaction': ['Artificial Intelligence', 'Information Retrieval'],
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Load mock papers fallback ────────────────────────────────────────────────
function loadMockPapers() {
  try {
    const mockPath = join(__dirname, 'mock_papers.json');
    const content = readFileSync(mockPath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error('✗ Failed to load mock_papers.json:', e.message);
    return [];
  }
}

// ── Fetch arXiv papers with retry ──────────────────────────────────────────
async function fetchArxivBatch(start, maxResults, attempt = 1) {
  const query = encodeURIComponent(
    'cat:cs.AI OR cat:cs.LG OR cat:cs.CL OR cat:cs.CV OR cat:cs.NE'
  );
  const url = `https://export.arxiv.org/api/query?search_query=${query}&start=${start}&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

  console.log(`    Requesting: start=${start} max=${maxResults} (attempt ${attempt})`);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'ResearchGraph/1.0 (academic project; contact: student@example.com)',
    },
  });

  if (res.status === 429 || res.status === 503) {
    throw new Error(`arXiv API rate limited (${res.status})`);
  }

  if (!res.ok) throw new Error(`arXiv API error: ${res.status} ${res.statusText}`);

  const xml = await res.text();
  return parseArxivXML(xml);
}

function parseArxivXML(xml) {
  const papers = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/);
    const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
    const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
    const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/);

    if (!idMatch || !titleMatch) continue;

    const rawId = idMatch[1].trim();
    const title = titleMatch[1].trim().replace(/\s+/g, ' ');
    const summary = summaryMatch ? summaryMatch[1].trim().replace(/\s+/g, ' ') : '';
    const published = publishedMatch ? publishedMatch[1].trim() : '';

    const authorMatches = [...entry.matchAll(/<author>([\s\S]*?)<\/author>/g)];
    const authors = authorMatches
      .map(m => { const n = m[1].match(/<name>([\s\S]*?)<\/name>/); return n ? n[1].trim() : null; })
      .filter(Boolean);

    const categoryMatches = [...entry.matchAll(/term="([^"]+)"/g)];
    const categories = categoryMatches
      .map(m => m[1])
      .filter(c => Object.keys(CATEGORY_CONCEPTS).includes(c));

    if (!rawId || !title || authors.length === 0) continue;

    const arxivId = rawId
      .replace('http://arxiv.org/abs/', '')
      .replace('https://arxiv.org/abs/', '');
    const year = published ? parseInt(published.slice(0, 4), 10) : 2024;

    papers.push({
      id: arxivId,
      title,
      abstract: summary.slice(0, 1000),
      year,
      url: `https://arxiv.org/abs/${arxivId}`,
      venue: 'arXiv',
      authors: authors.slice(0, 6),
      categories: categories.slice(0, 3),
    });
  }

  return papers;
}

// ── Build citation proxy graph ──────────────────────────────────────────────
function buildCitations(papers) {
  const citations = [];
  const papersByAuthor = {};

  for (const paper of papers) {
    for (const author of paper.authors.slice(0, 2)) {
      if (!papersByAuthor[author]) papersByAuthor[author] = [];
      papersByAuthor[author].push(paper.id);
    }
  }

  const citationSet = new Set();
  for (const paper of papers) {
    for (const author of paper.authors.slice(0, 2)) {
      const siblings = (papersByAuthor[author] || []).filter(id => id !== paper.id);
      for (const sibling of siblings.slice(0, 3)) {
        const key = `${paper.id}→${sibling}`;
        const rev  = `${sibling}→${paper.id}`;
        if (!citationSet.has(key) && !citationSet.has(rev) && citations.length < 3000) {
          citations.push({ from: paper.id, to: sibling });
          citationSet.add(key);
        }
      }
    }
  }

  return citations;
}

// ── DB helpers ──────────────────────────────────────────────────────────────
async function createIndexes(session) {
  console.log('\n📑 Creating indexes…');
  const queries = [
    'CREATE INDEX paper_id     IF NOT EXISTS FOR (p:Paper)   ON (p.id)',
    'CREATE INDEX author_id    IF NOT EXISTS FOR (a:Author)  ON (a.id)',
    'CREATE INDEX concept_id   IF NOT EXISTS FOR (c:Concept) ON (c.id)',
    'CREATE INDEX paper_year   IF NOT EXISTS FOR (p:Paper)   ON (p.year)',
    'CREATE INDEX paper_title  IF NOT EXISTS FOR (p:Paper)   ON (p.title)',
    'CREATE INDEX author_name  IF NOT EXISTS FOR (a:Author)  ON (a.name)',
    'CREATE INDEX concept_name IF NOT EXISTS FOR (c:Concept) ON (c.name)',
  ];
  for (const q of queries) {
    try { await session.run(q); }
    catch (e) { if (!e.message.includes('already exists')) console.warn('  index warn:', e.message); }
  }
  console.log('✓ Indexes ready');
}

async function loadConcepts(session) {
  console.log('\n🏷  Loading concepts…');
  const concepts = Object.entries(CATEGORY_CONCEPTS).map(([, name]) => ({
    name,
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: 'An AI/CS research topic from the arXiv taxonomy',
  }));

  await session.run(
    `UNWIND $concepts AS c
     MERGE (concept:Concept {id: c.id})
     SET concept.name = c.name, concept.description = c.description, concept.paperCount = 0`,
    { concepts }
  );

  for (const [conceptName, relatedNames] of Object.entries(CONCEPT_RELATIONS)) {
    const fromId = conceptName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    for (const relName of relatedNames) {
      const toId = relName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await session.run(
        `MATCH (a:Concept {id: $fromId}), (b:Concept {id: $toId}) MERGE (a)-[:RELATED_TO]->(b)`,
        { fromId, toId }
      );
    }
  }

  console.log(`✓ Loaded ${concepts.length} concepts with RELATED_TO edges`);
}

async function loadPapers(session, papers) {
  if (papers.length === 0) { console.log('\n📄 No papers to load.'); return; }
  console.log(`\n📄 Loading ${papers.length} papers…`);
  const BATCH = 50;

  for (let i = 0; i < papers.length; i += BATCH) {
    const batch = papers.slice(i, i + BATCH).map(p => ({
      id: p.id, title: p.title, abstract: p.abstract,
      year: neo4j.int(p.year), url: p.url, venue: p.venue,
    }));
    await session.run(
      `UNWIND $batch AS p
       MERGE (paper:Paper {id: p.id})
       SET paper.title = p.title, paper.abstract = p.abstract,
           paper.year = p.year, paper.url = p.url, paper.venue = p.venue`,
      { batch }
    );
    process.stdout.write(`\r  ${Math.min(i + BATCH, papers.length)} / ${papers.length}`);
  }
  console.log('\n✓ Papers loaded');
}

async function loadAuthors(session, papers) {
  if (papers.length === 0) { console.log('\n👤 No authors to load.'); return; }
  console.log('\n👤 Loading authors…');
  const authorMap = {};
  for (const paper of papers) {
    for (const name of paper.authors) {
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (!authorMap[id]) authorMap[id] = { id, name };
    }
  }

  const authors = Object.values(authorMap);
  const BATCH = 100;
  for (let i = 0; i < authors.length; i += BATCH) {
    await session.run(
      `UNWIND $batch AS a MERGE (author:Author {id: a.id}) SET author.name = a.name`,
      { batch: authors.slice(i, i + BATCH) }
    );
  }
  console.log(`✓ Loaded ${authors.length} authors`);
}

async function createRelationships(session, papers) {
  if (papers.length === 0) { console.log('\n🔗 No relationships to create.'); return; }
  console.log('\n🔗 Creating AUTHORED and TAGGED_WITH relationships…');
  let authored = 0, tagged = 0;

  for (const paper of papers) {
    const authorRels = paper.authors.map(name => ({
      authorId: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      paperId: paper.id,
    }));
    if (authorRels.length > 0) {
      await session.run(
        `UNWIND $rels AS r
         MATCH (a:Author {id: r.authorId}), (p:Paper {id: r.paperId})
         MERGE (a)-[:AUTHORED]->(p)`,
        { rels: authorRels }
      );
      authored += authorRels.length;
    }

    const conceptRels = paper.categories
      .map(cat => CATEGORY_CONCEPTS[cat])
      .filter(Boolean)
      .map(name => ({ conceptId: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), paperId: paper.id }));
    if (conceptRels.length > 0) {
      await session.run(
        `UNWIND $rels AS r
         MATCH (p:Paper {id: r.paperId}), (c:Concept {id: r.conceptId})
         MERGE (p)-[:TAGGED_WITH]->(c)`,
        { rels: conceptRels }
      );
      tagged += conceptRels.length;
    }
  }
  console.log(`✓ ${authored} AUTHORED, ${tagged} TAGGED_WITH relationships`);
}

async function createCitations(session, citations) {
  if (citations.length === 0) { console.log('\n🔗 No citations to create.'); return; }
  console.log(`\n🔗 Creating ${citations.length} CITES relationships…`);
  const BATCH = 100;
  for (let i = 0; i < citations.length; i += BATCH) {
    await session.run(
      `UNWIND $batch AS c
       MATCH (from:Paper {id: c.from}), (to:Paper {id: c.to})
       MERGE (from)-[:CITES]->(to)`,
      { batch: citations.slice(i, i + BATCH) }
    );
  }
  console.log('✓ Citations loaded');
}

async function updateConceptCounts(session) {
  console.log('\n📊 Updating concept paper counts…');
  await session.run(
    `MATCH (c:Concept)
     OPTIONAL MATCH (c)<-[:TAGGED_WITH]-(p:Paper)
     WITH c, count(p) AS cnt
     SET c.paperCount = cnt`
  );
  console.log('✓ Counts updated');
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 ResearchGraph Seed Script');
  console.log('='.repeat(50));
  console.log(`  DB URI:  ${URI}`);
  console.log(`  DB User: ${USER}`);
  console.log('='.repeat(50));

  const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD), {
    connectionTimeout: 15000,
  });

  try {
    await driver.verifyConnectivity();
    console.log('✓ Connected to CognoDB');
  } catch (e) {
    console.error('✗ Cannot connect to CognoDB:', e.message);
    console.error('  Check your COGNODB_URI and COGNODB_PASSWORD in .env.local');
    await driver.close();
    process.exit(1);
  }

  const session = driver.session();

  try {
    // 1. Indexes
    await createIndexes(session);

    // 2. Fetch arXiv papers — 3 batches of 100, with polite delays
    console.log('\n🌐 Fetching papers from arXiv API…');
    console.log('  (arXiv rate limits: waiting 10s between batches)');
    let allPapers = [];
    const BATCH_SIZE = 100;
    const BATCHES = 3;
    let rateLimited = false;

    for (let i = 0; i < BATCHES; i++) {
      const start = i * BATCH_SIZE;
      console.log(`\n  Batch ${i + 1}/${BATCHES} (start=${start})…`);
      try {
        const batch = await fetchArxivBatch(start, BATCH_SIZE);
        allPapers = allPapers.concat(batch);
        console.log(`  ✓ Got ${batch.length} papers (total: ${allPapers.length})`);
      } catch (e) {
        console.warn(`  ⚠ Batch ${i + 1} failed: ${e.message}`);
        if (e.message.includes('rate limited') || e.message.includes('429') || e.message.includes('503')) {
          rateLimited = true;
          break;
        }
      }
      // Polite delay between batches (skip after last)
      if (i < BATCHES - 1) {
        console.log('  Waiting 10s before next batch…');
        await sleep(10000);
      }
    }

    // Deduplicate
    const paperMap = {};
    for (const p of allPapers) paperMap[p.id] = p;
    let papers = Object.values(paperMap);
    console.log(`\n✓ Total unique papers: ${papers.length}`);

    if (papers.length === 0) {
      if (rateLimited) {
        console.log('\n⚠️ arXiv API rate limit reached. Falling back to local offline paper dataset...');
      } else {
        console.warn('\n⚠ No papers fetched from arXiv. Falling back to local offline paper dataset...');
      }
      papers = loadMockPapers();
      console.log(`✓ Loaded ${papers.length} high-quality mock papers`);
    }

    // 3–8. Load everything
    await loadConcepts(session);
    await loadPapers(session, papers);
    await loadAuthors(session, papers);
    await createRelationships(session, papers);
    const citations = buildCitations(papers);
    await createCitations(session, citations);
    await updateConceptCounts(session);

    // 9. Summary stats
    console.log('\n' + '='.repeat(50));
    console.log('✅ Seed complete!');

    const statsResult = await session.run(`
      MATCH (p:Paper) WITH count(p) AS papers
      MATCH (a:Author) WITH papers, count(a) AS authors
      MATCH (c:Concept) WITH papers, authors, count(c) AS concepts
      RETURN papers, authors, concepts
    `);

    if (statsResult.records.length > 0) {
      const s = statsResult.records[0];
      console.log(`  Papers:   ${s.get('papers')}`);
      console.log(`  Authors:  ${s.get('authors')}`);
      console.log(`  Concepts: ${s.get('concepts')}`);

      // Citation count separately (may be 0)
      const citResult = await session.run(`MATCH ()-[r:CITES]->() RETURN count(r) AS citations`);
      if (citResult.records.length > 0) {
        console.log(`  Citations: ${citResult.records[0].get('citations')}`);
      }
    }

    console.log('='.repeat(50));
    console.log('\nRun `npm run dev` to start the app!');

  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch(e => {
  console.error('\n✗ Seed failed:', e.message);
  process.exit(1);
});
