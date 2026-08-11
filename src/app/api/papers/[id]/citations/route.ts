import { runQuery } from '@/lib/neo4j';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Multi-hop citation traversal (up to 3 hops) — the key graph query
  const result = await runQuery(
    `
    MATCH (p:Paper {id: $id})
    OPTIONAL MATCH (p)-[:CITES*1..3]->(cited:Paper)
    OPTIONAL MATCH (citing:Paper)-[:CITES]->(p)
    RETURN 
      collect(DISTINCT {
        id: cited.id,
        title: cited.title,
        year: cited.year,
        relationship: 'cites'
      }) AS cites,
      collect(DISTINCT {
        id: citing.id,
        title: citing.title,
        year: citing.year,
        relationship: 'cited_by'
      }) AS citedBy
    `,
    { id }
  );

  if ('error' in result) {
    return Response.json({ error: result.error }, { status: 503 });
  }

  const row = result.data[0] as { cites: unknown[]; citedBy: unknown[] } | undefined;
  return Response.json({
    cites: row?.cites?.filter((c: unknown) => (c as {id: string}).id) ?? [],
    citedBy: row?.citedBy?.filter((c: unknown) => (c as {id: string}).id) ?? [],
  });
}
