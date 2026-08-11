import { runQuery } from '@/lib/neo4j';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const result = await runQuery(
    `
    MATCH (a:Author {id: $id})
    OPTIONAL MATCH (a)-[:AUTHORED]->(p:Paper)
    OPTIONAL MATCH (p)-[:TAGGED_WITH]->(c:Concept)
    RETURN a.id AS id,
           a.name AS name,
           a.affiliation AS affiliation,
           collect(DISTINCT {
             id: p.id,
             title: p.title,
             year: p.year,
             venue: p.venue
           }) AS papers,
           collect(DISTINCT c.name) AS topConcepts
    `,
    { id }
  );

  if ('error' in result) {
    return Response.json({ error: result.error }, { status: 503 });
  }

  if (result.data.length === 0) {
    return Response.json({ error: 'Author not found' }, { status: 404 });
  }

  const author = result.data[0] as Record<string, unknown>;
  // Filter null papers
  const papers = (author.papers as Array<{id: string}>)?.filter(p => p?.id) ?? [];
  return Response.json({ ...author, papers });
}
