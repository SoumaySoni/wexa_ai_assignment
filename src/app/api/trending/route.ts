import { runQuery } from '@/lib/neo4j';

export async function GET() {
  const result = await runQuery(
    `
    MATCH (c:Concept)<-[:TAGGED_WITH]-(p:Paper)
    WHERE p.year >= 2021
    WITH c, count(p) AS recentPapers
    ORDER BY recentPapers DESC
    LIMIT 12
    RETURN c.id AS id, c.name AS name, c.paperCount AS totalPapers, recentPapers
    `
  );

  if ('error' in result) {
    return Response.json({ error: result.error }, { status: 503 });
  }

  return Response.json({ topics: result.data });
}
