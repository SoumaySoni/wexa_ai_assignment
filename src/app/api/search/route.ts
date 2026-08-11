import { type NextRequest } from 'next/server';
import { runQuery } from '@/lib/neo4j';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return Response.json({ papers: [], authors: [], concepts: [] });
  }

  const pattern = `(?i).*${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`;

  const result = await runQuery<{ type: string; id: string; title: string; subtitle: string }>(
    `
    CALL {
      MATCH (p:Paper)
      WHERE p.title =~ $pattern
      RETURN 'paper' AS type, p.id AS id, p.title AS title,
             p.year + ' · ' + coalesce(p.venue, 'arXiv') AS subtitle
      LIMIT 5
      UNION
      MATCH (a:Author)
      WHERE a.name =~ $pattern
      RETURN 'author' AS type, a.id AS id, a.name AS title,
             coalesce(a.affiliation, 'Researcher') AS subtitle
      LIMIT 5
      UNION
      MATCH (c:Concept)
      WHERE c.name =~ $pattern
      RETURN 'concept' AS type, c.id AS id, c.name AS title,
             'Topic · ' + toString(c.paperCount) + ' papers' AS subtitle
      LIMIT 5
    }
    RETURN type, id, title, subtitle
    ORDER BY type, title
    `,
    { pattern }
  );

  if ('error' in result) {
    return Response.json({ error: result.error }, { status: 503 });
  }

  const papers = result.data.filter((r) => r.type === 'paper');
  const authors = result.data.filter((r) => r.type === 'author');
  const concepts = result.data.filter((r) => r.type === 'concept');

  return Response.json({ papers, authors, concepts });
}
