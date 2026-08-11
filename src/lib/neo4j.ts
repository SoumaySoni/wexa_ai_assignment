import neo4j, { Driver, Session } from 'neo4j-driver';

let driver: Driver | null = null;

function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.COGNODB_URI;
    const password = process.env.COGNODB_PASSWORD;
    const user = process.env.COGNODB_USER || 'cognodb';

    if (!uri || !password) {
      throw new Error(
        'Missing CognoDB connection details. Set COGNODB_URI and COGNODB_PASSWORD in .env.local'
      );
    }

    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      connectionTimeout: 10000,
      maxConnectionPoolSize: 10,
    });
  }
  return driver;
}

export interface QueryResult<T = Record<string, unknown>> {
  data: T[];
  error?: never;
}

export interface QueryError {
  data?: never;
  error: string;
}

function convertNeo4jIntegers(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (neo4j.isInt(obj)) {
    return obj.toNumber();
  }
  if (Array.isArray(obj)) {
    return obj.map(item => convertNeo4jIntegers(item));
  }
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      res[key] = convertNeo4jIntegers(obj[key]);
    }
    return res;
  }
  return obj;
}

export async function runQuery<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<QueryResult<T> | QueryError> {
  let session: Session | null = null;
  try {
    const d = getDriver();
    session = d.session();
    const result = await session.run(cypher, params);
    const rawData = result.records.map((record) => record.toObject() as T);
    const data = convertNeo4jIntegers(rawData) as T[];
    return { data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown database error';
    console.error('[CognoDB Error]', message);
    return { error: message };
  } finally {
    if (session) await session.close();
  }
}

export async function verifyConnectivity(): Promise<boolean> {
  try {
    const d = getDriver();
    await d.verifyConnectivity();
    return true;
  } catch {
    return false;
  }
}
