# ResearchGraph

**An AI Research Knowledge Graph Navigator** — explore papers, authors, and concepts through their connections, powered by [CognoDB](https://console.cognodb.com) (a managed graph database speaking openCypher over Bolt).

🔗 **Live Demo**: *(add your Vercel URL here after deployment)*

---

## Why a Graph Database?

Traditional relational databases store research data as rows in tables. To answer questions like *"find all papers connected to 'Attention is All You Need' within 3 citation hops"*, you'd need recursive CTEs or multiple self-JOINs across millions of rows.

A graph database makes these queries **natural and fast**:

| Question | SQL | Cypher |
|---|---|---|
| Papers citing paper X | 2 JOINs + subquery | `MATCH (p)-[:CITES]->(x)` |
| Papers within 3 citation hops | Recursive CTE + 3× self-JOIN | `MATCH (p)-[:CITES*1..3]->(x)` |
| Co-authors of co-authors | 4-way self-JOIN on junction table | `MATCH (a)-[:AUTHORED]->()<-[:AUTHORED]-(coauthor)-[:AUTHORED]->()<-[:AUTHORED]-(collab)` |
| Concepts related to a topic | Multiple JOIN tables + UNION | `MATCH (c)-[:RELATED_TO*1..2]-(related)` |

The data model is fundamentally about **connections** — citations between papers, authorship, topic relationships. Graph databases are the right tool when the relationships are the data.

---

## Data Model

```
(:Paper {id, title, abstract, year, url, venue})
(:Author {id, name, affiliation})
(:Concept {id, name, description, paperCount})

(:Author)   -[:AUTHORED]->    (:Paper)
(:Paper)    -[:CITES]->       (:Paper)
(:Paper)    -[:TAGGED_WITH]-> (:Concept)
(:Concept)  -[:RELATED_TO]->  (:Concept)
```

### Diagram

```
[Author] ──AUTHORED──▶ [Paper] ──CITES──▶ [Paper]
                          │
                     TAGGED_WITH
                          ▼
                       [Concept] ──RELATED_TO──▶ [Concept]
```

Node counts after seeding: ~600 Papers · ~1,500 Authors · 14 Concepts (or 25 Papers · 166 Authors · 14 Concepts when using the offline fallback dataset due to arXiv rate-limiting).

---

## Key Queries

### 1. Multi-hop citation traversal (≥2 hops)
```cypher
MATCH (p:Paper {id: $paperId})-[:CITES*1..3]->(cited:Paper)
RETURN DISTINCT cited.title, cited.year
ORDER BY cited.year DESC
LIMIT 25
```
*Returns all papers reachable within 3 citation hops — impossible without recursion in SQL.*

### 2. 2-hop collaborator network
```cypher
MATCH (a:Author {id: $id})-[:AUTHORED]->(p:Paper)<-[:AUTHORED]-(coauthor)
MATCH (coauthor)-[:AUTHORED]->(p2:Paper)<-[:AUTHORED]-(collab)
WHERE collab <> a
RETURN DISTINCT collab.name, count(*) AS connections
ORDER BY connections DESC
```
*Would require 4 self-JOINs on an author-paper junction table in SQL.*

### 3. Concept neighbourhood (2-hop RELATED_TO)
```cypher
MATCH (c:Concept {id: $id})-[:RELATED_TO*1..2]-(related:Concept)
WHERE related.id <> $id
RETURN DISTINCT related.name
```

### 4. Trending topics (concepts with recent papers)
```cypher
MATCH (c:Concept)<-[:TAGGED_WITH]-(p:Paper)
WHERE p.year >= 2021
RETURN c.name, count(p) AS recentPapers
ORDER BY recentPapers DESC LIMIT 12
```

All queries use **parameterised Cypher** via the official `neo4j-driver`. No string concatenation.

---

## Setup & Run

### Prerequisites
- Node.js 18+
- A CognoDB instance (free, no credit card)

### 1. Create a CognoDB instance

1. Go to [console.cognodb.com/signup](https://console.cognodb.com/signup) and create an account
2. Create a free **c0** instance — choose any region
3. Copy the **Bolt URI** (`bolt+s://<id>.databases.cognodb.cloud`) and the generated password (shown once — save it!)

### 2. Clone and install

```bash
git clone <your-repo-url>
cd wexa_ai
npm install
```

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
COGNODB_URI=bolt+s://<your-instance-id>.databases.cognodb.cloud
COGNODB_PASSWORD=<your-password>
COGNODB_USER=cognodb
```

### 4. Seed the database

```bash
npm run seed
```

This fetches ~600 real AI/CS papers from the arXiv API and loads them into CognoDB. Takes ~2–3 minutes. If the arXiv API rate-limits your IP address, the script will automatically fallback to loading a high-quality offline dataset of 25 seminal AI/CS papers.

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
wexa_ai/
├── scripts/
│   └── seed.mjs              # arXiv fetch + CognoDB loader
├── src/
│   ├── lib/
│   │   └── neo4j.ts          # Driver singleton, runQuery helper
│   ├── app/
│   │   ├── api/
│   │   │   ├── search/       # GET /api/search?q=
│   │   │   ├── papers/[id]/  # GET /api/papers/:id
│   │   │   │   └── citations/# GET /api/papers/:id/citations
│   │   │   ├── authors/[id]/ # GET /api/authors/:id
│   │   │   │   └── network/  # GET /api/authors/:id/network
│   │   │   ├── concepts/[id]/# GET /api/concepts/:id
│   │   │   └── trending/     # GET /api/trending
│   │   ├── papers/[id]/      # Paper detail page
│   │   ├── authors/[id]/     # Author profile page
│   │   └── concepts/[id]/    # Concept explorer page
│   └── app/globals.css       # Full CSS design system
├── .env.local.example        # Env template
└── README.md
```

---

## Deploy to Vercel

1. Push your repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import Project → select your repo
3. In **Environment Variables**, add:
   - `COGNODB_URI`
   - `COGNODB_PASSWORD`
   - `COGNODB_USER` = `cognodb`
4. Deploy

> **Important**: Keep your CognoDB instance running until the reviewer evaluates your submission.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19 |
| Styling | Vanilla CSS |
| Graph DB | CognoDB (openCypher / Bolt 5.x) |
| Driver | `neo4j-driver` (official) |
| Data | arXiv API (~600 real papers) |
| Hosting | Vercel |

---

## Screenshots

<img width="1919" height="833" alt="image" src="https://github.com/user-attachments/assets/11ced39b-be3f-4802-b52b-06a817a8fa38" />
<img width="1891" height="846" alt="image" src="https://github.com/user-attachments/assets/593c1743-145d-4e20-afb1-1afaa185cf13" />
<img width="1871" height="851" alt="image" src="https://github.com/user-attachments/assets/1ac0b201-5002-4794-9e2c-0e64efcd6c49" />

#
