import { runQuery } from '@/lib/neo4j';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const result = await runQuery(
    `
    MATCH (p:Paper {id: $id})
    OPTIONAL MATCH (a:Author)-[:AUTHORED]->(p)
    OPTIONAL MATCH (p)-[:TAGGED_WITH]->(c:Concept)
    RETURN p.id AS id,
           p.title AS title,
           p.abstract AS abstract,
           p.year AS year,
           p.url AS url,
           p.venue AS venue,
           collect(DISTINCT {id: a.id, name: a.name, affiliation: a.affiliation}) AS authors,
           collect(DISTINCT {id: c.id, name: c.name}) AS concepts
    `,
    { id }
  );

  if ('error' in result) {
    return Response.json({ error: result.error }, { status: 503 });
  }

  if (result.data.length === 0) {
    return Response.json({ error: 'Paper not found' }, { status: 404 });
  }

  return Response.json(result.data[0]);
}
