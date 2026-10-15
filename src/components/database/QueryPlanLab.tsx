import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import initSqlJs, { type Database } from 'sql.js';
import { Button } from '@govtechmy/myds-react/button';
import { Tag } from '@govtechmy/myds-react/tag';
import { Callout, CalloutTitle, CalloutContent } from '@govtechmy/myds-react/callout';
import { 
  Database as DbIcon, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw,
  Cpu,
  Info
} from 'lucide-react';
import { parseSqliteExplainPlan, verifyPlanOptimization } from '../../services/queryPlanParser';
import type { SemanticQueryPlanResult } from '../../types';

interface QueryPlanLabProps {
  initialIndexSql?: string;
  isDark?: boolean;
  onCodeChange?: (sql: string) => void;
  onVersionDetected?: (version: string) => void;
  onExecutionComplete?: (passed: boolean, plan: SemanticQueryPlanResult) => void;
}

export function QueryPlanLab({ 
  initialIndexSql = '',
  isDark = true,
  onCodeChange,
  onVersionDetected,
  onExecutionComplete 
}: QueryPlanLabProps) {
  const [db, setDb] = useState<Database | null>(null);
  const [sqlVersion, setSqlVersion] = useState<string>('3.45.2');
  const [sqlCode, setSqlCode] = useState<string>(initialIndexSql);
  const [currentPlan, setCurrentPlan] = useState<SemanticQueryPlanResult | null>(null);
  const [optimizationStatus, setOptimizationStatus] = useState<{ passed: boolean; message: string } | null>(null);
  const [isSeeding, setIsSeeding] = useState<boolean>(true);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  useEffect(() => {
    setSqlCode(initialIndexSql);
  }, [initialIndexSql]);

  const editorRef = useRef<any>(null);

  const BENCHMARK_QUERY = `
    SELECT id, station_code, temperature_c, recorded_at 
    FROM weather_observations 
    WHERE station_code = 'STN-MY-042' 
    ORDER BY recorded_at DESC 
    LIMIT 50;
  `;

  // Seed SQLite in WebAssembly
  const initializeAndSeed = async () => {
    setIsSeeding(true);
    try {
      const SQL = await initSqlJs({
        locateFile: () => `/sql-wasm.wasm`,
      });

      const database = new SQL.Database();
      const verRes = database.exec('SELECT sqlite_version() AS version;');
      if (verRes[0]?.values[0]) {
        const detected = String(verRes[0].values[0][0]);
        setSqlVersion(detected);
        onVersionDetected?.(detected);
      }

      // Create Table
      database.run(`
        CREATE TABLE weather_observations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          station_code TEXT NOT NULL,
          temperature_c REAL NOT NULL,
          humidity_pct REAL NOT NULL,
          recorded_at TEXT NOT NULL
        );
      `);

      // Seed 5,000 synthetic observations in a fast transaction
      database.run('BEGIN TRANSACTION;');
      const stations = ['STN-MY-001', 'STN-MY-015', 'STN-MY-042', 'STN-MY-088', 'STN-KL-100'];
      const baseDate = new Date('2026-10-01T00:00:00Z').getTime();

      for (let i = 0; i < 5000; i++) {
        const station = stations[i % stations.length];
        const temp = (24 + (i % 12) * 0.8).toFixed(1);
        const humidity = (60 + (i % 30)).toFixed(1);
        const dateIso = new Date(baseDate + i * 3600000).toISOString();
        database.run(
          `INSERT INTO weather_observations (station_code, temperature_c, humidity_pct, recorded_at) VALUES ('${station}', ${temp}, ${humidity}, '${dateIso}');`
        );
      }
      database.run('COMMIT;');

      // Get Baseline Unindexed Plan
      const explainRes = database.exec(`EXPLAIN QUERY PLAN ${BENCHMARK_QUERY}`);
      const rawRows = (explainRes[0]?.values || []) as Array<[number, number, number, string]>;
      const parsedBaseline = parseSqliteExplainPlan(rawRows, sqlVersion);

      setDb(database);
      setCurrentPlan(parsedBaseline);
      setOptimizationStatus({
        passed: false,
        message: 'Table currently unindexed. Baseline plan runs as O(N) sequential scan.',
      });
    } catch (err) {
      console.error('Failed to initialize SQLite WASM:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    initializeAndSeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Execute User Index Query
  const runOptimization = () => {
    if (!db) return;
    setIsRunning(true);

    try {
      // 1. Drop old custom index if it exists
      try {
        db.run('DROP INDEX IF EXISTS idx_station_recorded;');
      } catch {
        // Ignore if does not exist
      }

      // 2. Execute user's CREATE INDEX or SQL commands
      if (sqlCode.trim()) {
        db.run(sqlCode);
      }

      // 3. Measure warmup query timing
      const start = performance.now();
      for (let i = 0; i < 20; i++) {
        db.exec(BENCHMARK_QUERY);
      }
      const elapsedMs = (performance.now() - start) / 20;

      // 4. Capture new EXPLAIN QUERY PLAN
      const explainRes = db.exec(`EXPLAIN QUERY PLAN ${BENCHMARK_QUERY}`);
      const rawRows = (explainRes[0]?.values || []) as Array<[number, number, number, string]>;
      const parsedPlan = parseSqliteExplainPlan(rawRows, sqlVersion, elapsedMs);

      // 5. Evaluate semantic optimization
      const assertion = verifyPlanOptimization(parsedPlan, 'idx_station_recorded');
      setCurrentPlan(parsedPlan);
      setOptimizationStatus(assertion);

      if (onExecutionComplete) {
        onExecutionComplete(assertion.passed, parsedPlan);
      }
    } catch (err: any) {
      setOptimizationStatus({
        passed: false,
        message: `SQL Execution Error: ${err.message || 'Syntax error'}`,
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      
      {/* Top Engine & Disclaimer Bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '0.75rem 1.25rem', 
        borderBottom: '1px solid var(--studio-border)',
        backgroundColor: 'var(--studio-surface)',
        borderRadius: '8px',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Tag variant="success" size="small">
            <DbIcon size={12} style={{ marginRight: '4px' }} />
            Engine: SQLite {sqlVersion} (WASM)
          </Tag>
          <Tag variant="primary" size="small">
            Tier 1: Browser-Native
          </Tag>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Button 
            variant="default-outline" 
            size="small" 
            onClick={initializeAndSeed} 
            disabled={isSeeding}
            aria-label="Reset database"
          >
            <RefreshCw size={12} style={{ marginRight: '4px' }} />
            {isSeeding ? "Seeding 5k rows..." : "Reset Database"}
          </Button>

          <Button 
            variant="primary-fill" 
            size="small" 
            onClick={runOptimization} 
            disabled={isSeeding || isRunning}
            aria-label="Execute index SQL"
          >
            <Play size={12} style={{ marginRight: '4px' }} />
            {isRunning ? "Analyzing Plan..." : "Execute & Analyze Plan"}
          </Button>
        </div>
      </div>

      {/* Portability Notice */}
      <div style={{ 
        padding: '0.625rem 1rem', 
        borderRadius: '8px', 
        backgroundColor: 'var(--studio-surface-subtle)', 
        border: '1px solid var(--studio-border)',
        fontSize: '0.75rem',
        color: 'var(--studio-text)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem'
      }}>
        <Info size={16} color="var(--studio-primary)" />
        <span style={{ lineHeight: 1.45 }}>
          <strong>Database Portability Notice:</strong> SQLite execution plans teach relational mechanics (table scan vs. index seek). They do not predict PostgreSQL cost optimizer decisions.
        </span>
      </div>

      {/* Two-Column Editor & Plan Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.875rem', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        
        {/* Left Column: Monaco SQL Editor */}
        <div style={{ 
          border: '1px solid var(--studio-border)',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          backgroundColor: 'var(--studio-surface)'
        }}>
          <div style={{ 
            padding: '0.5rem 0.875rem', 
            borderBottom: '1px solid var(--studio-border)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--studio-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--studio-surface)',
            flexShrink: 0
          }}>
            <span>SQL Index Definition</span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--studio-text-muted)' }}>Esc releases focus</span>
          </div>

          <div style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative' }}>
            <Editor
              height="100%"
              defaultLanguage="sql"
              theme={isDark ? "vs-dark" : "light"}
              value={sqlCode}
              onChange={(val) => {
                const updated = val || '';
                setSqlCode(updated);
                onCodeChange?.(updated);
              }}
              onMount={(editor) => {
                editorRef.current = editor;
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
              }}
            />
          </div>

          <div style={{ padding: '0.5rem 0.875rem', borderTop: '1px solid var(--studio-border)', fontSize: '0.75rem', color: 'var(--studio-text-muted)', backgroundColor: 'var(--studio-surface-subtle)', flexShrink: 0 }}>
            <strong>Benchmark Target:</strong> <code>SELECT ... WHERE station_code = 'STN-MY-042' ORDER BY recorded_at DESC LIMIT 50;</code>
          </div>
        </div>

        {/* Right Column: Query Plan Comparison & Semantic Nodes */}
        <div style={{ 
          border: '1px solid var(--studio-border)',
          borderRadius: '8px',
          padding: '1rem',
          backgroundColor: 'var(--studio-surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.875rem',
          height: '100%',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--studio-text)' }}>Semantic Plan Analysis</span>
            {optimizationStatus && (
              <Tag variant={optimizationStatus.passed ? 'success' : 'danger'} size="small">
                {optimizationStatus.passed ? 'OPTIMIZED' : 'UNOPTIMIZED'}
              </Tag>
            )}
          </div>

          {/* Status Message */}
          {optimizationStatus && (
            <Callout variant={optimizationStatus.passed ? 'success' : 'warning'}>
              <CalloutTitle style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                {optimizationStatus.passed ? <CheckCircle2 size={14} color="var(--studio-success)" /> : <AlertTriangle size={14} color="var(--studio-warning)" />}
                {optimizationStatus.passed ? 'Index Plan Transition Successful' : 'Sequential Scan Detected'}
              </CalloutTitle>
              <CalloutContent>
                {optimizationStatus.message}
              </CalloutContent>
            </Callout>
          )}

          {/* Executive Performance Delta Highlight Card */}
          {optimizationStatus?.passed && (
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'var(--studio-success-subtle)',
              border: '1.5px solid var(--studio-success)',
              boxShadow: 'var(--studio-success-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Tag variant="success" size="small">
                    <CheckCircle2 size={12} style={{ marginRight: '4px' }} />
                    99.0% Row Scan Reduction
                  </Tag>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--studio-success)' }}>
                    B-Tree Compound Seek Active
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)' }}>
                  Target relation: <code>weather_observations</code> • Index: <code>idx_station_recorded</code>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', fontFamily: 'var(--studio-font-mono)' }}>
                <span style={{ fontSize: '0.8125rem', textDecoration: 'line-through', color: 'var(--studio-danger)' }}>
                  5,000 rows
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)' }}>→</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--studio-success)' }}>
                  50 rows
                </span>
              </div>
            </div>
          )}

          {/* Comparison Cards: Before vs After */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
            
            {/* Baseline Card */}
            <div style={{ 
              padding: '0.75rem', 
              borderRadius: '8px', 
              backgroundColor: 'var(--studio-danger-subtle)', 
              border: '1px solid var(--studio-danger-border)',
              fontSize: '0.75rem'
            }}>
              <div style={{ fontWeight: 700, color: 'var(--studio-danger)', marginBottom: '4px' }}>1. Baseline (Unindexed):</div>
              <code style={{ color: 'var(--studio-text)', display: 'block', wordBreak: 'break-all' }}>SCAN TABLE weather_observations</code>
              <div style={{ marginTop: '6px', color: 'var(--studio-text-muted)' }}>Complexity: O(N) full scan (5,000 rows)</div>
            </div>

            {/* Current Plan Card */}
            <div style={{ 
              padding: '0.75rem', 
              borderRadius: '8px', 
              backgroundColor: currentPlan?.usesFullTableScan ? 'var(--studio-danger-subtle)' : 'var(--studio-success-subtle)', 
              border: `1px solid ${currentPlan?.usesFullTableScan ? 'var(--studio-danger-border)' : 'var(--studio-success-border)'}`,
              fontSize: '0.75rem'
            }}>
              <div style={{ fontWeight: 700, color: currentPlan?.usesFullTableScan ? 'var(--studio-danger)' : 'var(--studio-success)', marginBottom: '4px' }}>
                2. Current Plan:
              </div>
              <code style={{ color: 'var(--studio-text)', display: 'block', wordBreak: 'break-all' }}>{currentPlan?.rawExplain[0] || 'Awaiting execution'}</code>
              <div style={{ marginTop: '6px', color: 'var(--studio-text-muted)' }}>
                {currentPlan?.usesFullTableScan ? 'Complexity: O(N)' : 'Complexity: O(log N) binary seek'}
              </div>
            </div>

          </div>

          {/* Parsed Nodes List */}
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--studio-text-muted)', marginBottom: '6px' }}>
              PARSED PLAN NODES:
            </div>
            {currentPlan?.nodes.map((node, i) => (
              <div key={i} style={{ 
                fontSize: '0.75rem', 
                padding: '0.5rem 0.625rem', 
                backgroundColor: 'var(--studio-surface-subtle)',
                border: '1px solid var(--studio-border)',
                borderRadius: '6px',
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'var(--studio-text)'
              }}>
                <span>
                  <strong>{node.operation.toUpperCase()}:</strong> {node.table} {node.index ? `(Index: ${node.index})` : ''}
                </span>
                <Tag variant={node.operation === 'search' ? 'success' : 'danger'} size="small">
                  {node.operation}
                </Tag>
              </div>
            ))}
          </div>

          {/* Supplementary Timing Note */}
          {currentPlan?.executionTimeMs !== undefined && (
            <div style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Cpu size={13} color="var(--studio-primary)" />
              <span>Supplementary Warm Benchmark: ~{currentPlan.executionTimeMs.toFixed(2)}ms (Informational only; host-dependent)</span>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
