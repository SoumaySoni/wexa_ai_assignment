import { runQuery } from '@/lib/neo4j';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 2-hop co-author network — hard to express in SQL without multiple JOINs
  const result = await runQuery(
    `
    MATCH (a:Author {id: $id})-[:AUTHORED]->(p:Paper)<-[:AUTHORED]-(coauthor:Author)
    WHERE coauthor.id <> $id
    WITH a, coauthor, collect(p.title)[..3] AS sharedPapers, count(p) AS sharedCount
    OPTIONAL MATCH (coauthor)-[:AUTHORED]->(p2:Paper)<-[:AUTHORED]-(cocoauthor:Author)
    WHERE cocoauthor.id <> $id AND cocoauthor.id <> coauthor.id
    RETURN 
      collect(DISTINCT {
        id: coauthor.id,
        name: coauthor.name,
        affiliation: coauthor.affiliation,
        sharedPapers: sharedPapers,
        sharedCount: sharedCount,
        hop: 1
      }) AS directCollaborators,
      collect(DISTINCT {
        id: cocoauthor.id,
        name: cocoauthor.name,
        hop: 2
      }) AS extendedNetwork
    `,
    { id }
  );

  if ('error' in result) {
    return Response.json({ error: result.error }, { status: 503 });
  }

  const row = result.data[0] as { directCollaborators: unknown[]; extendedNetwork: unknown[] } | undefined;
  return Response.json({
    directCollaborators: row?.directCollaborators?.filter((c: unknown) => (c as {id: string}).id) ?? [],
    extendedNetwork: row?.extendedNetwork?.filter((c: unknown) => (c as {id: string}).id) ?? [],
  });
}
