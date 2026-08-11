import { runQuery } from '@/lib/neo4j';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const result = await runQuery(
    `
    MATCH (c:Concept {id: $id})
    OPTIONAL MATCH (c)-[:RELATED_TO*1..2]-(related:Concept)
    WHERE related.id <> $id
    OPTIONAL MATCH (c)<-[:TAGGED_WITH]-(p:Paper)
    WITH c, collect(DISTINCT {id: related.id, name: related.name}) AS relatedConcepts,
         collect(DISTINCT {id: p.id, title: p.title, year: p.year}) AS papers
    RETURN c.id AS id,
           c.name AS name,
           c.description AS description,
           c.paperCount AS paperCount,
           relatedConcepts,
           papers
    `,
    { id }
  );

  if ('error' in result) {
    return Response.json({ error: result.error }, { status: 503 });
  }

  if (result.data.length === 0) {
    return Response.json({ error: 'Concept not found' }, { status: 404 });
  }

  const concept = result.data[0] as Record<string, unknown>;
  const relatedConcepts = (concept.relatedConcepts as Array<{id: string}>)?.filter(c => c?.id) ?? [];
  const papers = (concept.papers as Array<{id: string}>)?.filter(p => p?.id) ?? [];
  return Response.json({ ...concept, relatedConcepts, papers });
}
