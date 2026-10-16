// ====================================================================
// NexusHub Portal Backend: ClickHouse Client Adapter
// ====================================================================

const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123';

export async function queryClickHouse<T = any>(sql: string): Promise<T[]> {
  try {
    const formattedSql = `${sql.trim()} FORMAT JSON`;
    const response = await fetch(`${CLICKHOUSE_URL}/?query=${encodeURIComponent(formattedSql)}`);
    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[ClickHouse Adapter] Query error: ${errText}`);
      return [];
    }
    const json = await response.json() as any;
    return json.data || [];
  } catch (err: any) {
    console.warn(`[ClickHouse Adapter] Failed to connect: ${err.message}`);
    return [];
  }
}

