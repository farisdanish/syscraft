import type { QueryPlanNode, SemanticQueryPlanResult } from '../types';

/**
 * Fixture-Tested Semantic Query Plan Parser for SQLite 3.45+
 * Converts SQLite EXPLAIN QUERY PLAN tree details into normalized semantic nodes.
 */
export function parseSqliteExplainPlan(
  rows: Array<[number, number, number, string]>,
  sqliteVersion: string = '3.45.2',
  executionTimeMs?: number
): SemanticQueryPlanResult {
  const nodes: QueryPlanNode[] = [];
  const rawExplain: string[] = [];
  const indexesUsed: string[] = [];
  let usesFullTableScan = false;

  for (const row of rows) {
    const detail = row[3];
    rawExplain.push(detail);

    // 1. Index Search / Seek Detection: SEARCH [TABLE] <tableName> USING [COVERING] INDEX <indexName>
    const searchMatch = detail.match(/SEARCH\s+(?:TABLE\s+)?([a-zA-Z0-9_]+)\s+USING\s+(?:(COVERING)\s+)?INDEX\s+([a-zA-Z0-9_]+)/i);
    if (searchMatch) {
      const tableName = searchMatch[1];
      const isCovering = Boolean(searchMatch[2]);
      const indexName = searchMatch[3];

      if (!indexesUsed.includes(indexName)) {
        indexesUsed.push(indexName);
      }

      nodes.push({
        operation: 'search',
        table: tableName,
        index: indexName,
        coveringIndex: isCovering,
        detail,
      });
      continue;
    }

    // 2. Primary Key Direct Lookup: SEARCH [TABLE] <tableName> USING INTEGER PRIMARY KEY
    const pkMatch = detail.match(/SEARCH\s+(?:TABLE\s+)?([a-zA-Z0-9_]+)\s+USING\s+(?:INTEGER\s+)?PRIMARY\s+KEY/i);
    if (pkMatch) {
      const tableName = pkMatch[1];
      nodes.push({
        operation: 'search',
        table: tableName,
        index: 'PRIMARY_KEY',
        coveringIndex: true,
        detail,
      });
      continue;
    }

    // 3. Index Scan Detection (Iterating over index B-Tree without binary seek)
    const indexScanMatch = detail.match(/SCAN\s+(?:TABLE\s+)?([a-zA-Z0-9_]+)\s+USING\s+(?:(COVERING)\s+)?INDEX\s+([a-zA-Z0-9_]+)/i);
    if (indexScanMatch) {
      const tableName = indexScanMatch[1];
      const isCovering = Boolean(indexScanMatch[2]);
      const indexName = indexScanMatch[3];

      if (!indexesUsed.includes(indexName)) {
        indexesUsed.push(indexName);
      }

      nodes.push({
        operation: 'scan',
        table: tableName,
        index: indexName,
        coveringIndex: isCovering,
        detail,
      });
      continue;
    }

    // 4. Full Table Scan Detection: SCAN [TABLE] <tableName> (heap sequential scan)
    const scanMatch = detail.match(/SCAN\s+(?:TABLE\s+)?([a-zA-Z0-9_]+)/i);
    if (scanMatch) {
      usesFullTableScan = true;
      nodes.push({
        operation: 'scan',
        table: scanMatch[1],
        detail,
      });
      continue;
    }

    // 4. Temporary B-Tree Sort: USE TEMP B-TREE FOR ORDER BY / GROUP BY
    const sortMatch = detail.match(/USE\s+TEMP\s+B-TREE\s+FOR\s+(ORDER\s+BY|GROUP\s+BY|DISTINCT)/i);
    if (sortMatch) {
      nodes.push({
        operation: 'sort',
        table: '',
        detail,
      });
      continue;
    }

    // Fallback: General Node
    nodes.push({
      operation: 'subquery',
      table: '',
      detail,
    });
  }

  return {
    engine: 'sqlite',
    engineVersion: sqliteVersion,
    nodes,
    usesFullTableScan,
    indexesUsed,
    executionTimeMs,
    rawExplain,
  };
}

/**
 * Asserts whether a query plan satisfies the optimization goal:
 * Transitioned from table scan to indexed search targeting the required index.
 */
export function verifyPlanOptimization(
  plan: SemanticQueryPlanResult,
  requiredIndexName?: string
): {
  passed: boolean;
  message: string;
} {
  if (plan.usesFullTableScan) {
    return {
      passed: false,
      message: 'Plan utilizes SCAN TABLE (O(N) sequential table scan). Create an index to enable SEARCH TABLE.',
    };
  }

  if (requiredIndexName && !plan.indexesUsed.includes(requiredIndexName)) {
    return {
      passed: false,
      message: `Plan uses index [${plan.indexesUsed.join(', ')}], but does not utilize required target index [${requiredIndexName}].`,
    };
  }

  const searchNode = plan.nodes.find(n => n.operation === 'search');
  if (searchNode) {
    return {
      passed: true,
      message: `Plan optimized: SEARCH TABLE ${searchNode.table} USING INDEX ${searchNode.index || 'PRIMARY_KEY'}. Zero full-table scans.`,
    };
  }

  return {
    passed: false,
    message: 'No indexed seek detected in execution plan.',
  };
}
