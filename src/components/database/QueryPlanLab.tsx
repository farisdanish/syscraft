import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import initSqlJs, { type Database } from 'sql.js';
import { Button } from '@govtechmy/myds-react/button';
import { Tag } from '@govtechmy/myds-react/tag';
import { Callout, CalloutTitle, CalloutContent } from '@govtechmy/myds-react/callout';
import { Tabs, TabsList, TabsTrigger, TabsContent, TabsIcon } from '@govtechmy/myds-react/tabs';
import { 
  Database as DbIcon, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw,
  Cpu,
  Info,
  Terminal,
  Layers,
  TrendingDown
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

type PlanViewTab = 'delta' | 'nodes' | 'raw';

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
  const [activeTab, setActiveTab] = useState<PlanViewTab>('delta');
  const [seedTrigger, setSeedTrigger] = useState<number>(0);
  const editorRef = useRef<any>(null);
  const dbRef = useRef<Database | null>(null);

  // Initialize SQLite WASM and Seed Synthetically (5,000 observations)
  useEffect(() => {
    let isMounted = true;
    let localDb: Database | null = null;

    const initAndSeed = async () => {
      setIsSeeding(true);
      try {
        const SQL = await initSqlJs({
          locateFile: (file) => `/${file}`,
        });

        if (!isMounted) return;
        localDb = new SQL.Database();
        dbRef.current = localDb;

        // Detect sqlite version
        const verRes = localDb.exec('SELECT sqlite_version() AS ver;');
        let detected = '3.45.2';
        if (verRes[0]?.values[0]?.[0]) {
          detected = String(verRes[0].values[0][0]);
          if (isMounted) {
            setSqlVersion(detected);
            onVersionDetected?.(detected);
          }
        }

        // Create Schema
        localDb.run(`
          CREATE TABLE weather_observations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            station_code TEXT NOT NULL,
            temperature_c REAL NOT NULL,
            humidity_pct REAL NOT NULL,
            recorded_at TEXT NOT NULL
          );
        `);

        // Seed 5,000 deterministic rows
        localDb.run('BEGIN TRANSACTION;');
        const stmt = localDb.prepare(`
          INSERT INTO weather_observations (station_code, temperature_c, humidity_pct, recorded_at)
          VALUES ($station, $temp, $humidity, $recorded);
        `);

        const stations = ['STN-MY-042', 'STN-MY-001', 'STN-MY-099', 'STN-SG-102', 'STN-ID-501'];
        const baseDate = new Date('2026-01-01T00:00:00Z').getTime();

        for (let i = 0; i < 5000; i++) {
          const stn = stations[i % stations.length];
          const temp = +(24 + Math.sin(i) * 8).toFixed(1);
          const hum = +(60 + Math.cos(i) * 25).toFixed(1);
          const dateIso = new Date(baseDate + i * 60000).toISOString();

          stmt.run({
            $station: stn,
            $temp: temp,
            $humidity: hum,
            $recorded: dateIso,
          });
        }
        stmt.free();
        localDb.run('COMMIT;');

        if (!isMounted) {
          localDb.close();
          dbRef.current = null;
          return;
        }

        setDb(localDb);

        // Baseline EXPLAIN QUERY PLAN (Unindexed)
        const baselineRes = localDb.exec(`
          EXPLAIN QUERY PLAN
          SELECT id, station_code, temperature_c, recorded_at
          FROM weather_observations
          WHERE station_code = 'STN-MY-042'
          ORDER BY recorded_at DESC
          LIMIT 50;
        `);

        const baselinePlan = parseSqliteExplainPlan(baselineRes, detected, 0);
        setCurrentPlan(baselinePlan);
        const baselineAssertion = verifyPlanOptimization(baselinePlan, 'idx_station_recorded');
        setOptimizationStatus(baselineAssertion);
      } catch (err) {
        console.error('Failed to initialize SQLite WASM:', err);
        if (isMounted) {
          setOptimizationStatus({
            passed: false,
            message: 'Failed to initialize WASM database engine.',
          });
        }
      } finally {
        if (isMounted) {
          setIsSeeding(false);
        }
      }
    };

    initAndSeed();

    return () => {
      isMounted = false;
      if (localDb) {
        try {
          localDb.close();
        } catch {
          // ignore
        }
      }
      dbRef.current = null;
    };
  }, [seedTrigger, onVersionDetected]);

  // Execute User Index Definition and Run EXPLAIN QUERY PLAN
  const runOptimization = () => {
    if (!db) return;
    setIsRunning(true);

    try {
      // 1. Drop existing user index if present
      try {
        db.run('DROP INDEX IF EXISTS idx_station_recorded;');
      } catch {
        // Ignore
      }

      // 2. Execute user DDL code
      if (sqlCode.trim().length > 0) {
        db.run(sqlCode);
      }

      // 3. Measure Execution Time
      const start = performance.now();
      const rawRows = db.exec(`
        EXPLAIN QUERY PLAN
        SELECT id, station_code, temperature_c, recorded_at
        FROM weather_observations
        WHERE station_code = 'STN-MY-042'
        ORDER BY recorded_at DESC
        LIMIT 50;
      `);
      const elapsedMs = performance.now() - start;

      // 4. Parse execution plan
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

  const handleReset = () => {
    setIsSeeding(true);
    setSeedTrigger((prev) => prev + 1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.875rem' }}>
      
      {/* Top Engine & Action Bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '0.625rem 1rem', 
        borderBottom: '1px solid var(--studio-border)',
        backgroundColor: 'var(--studio-surface)',
        borderRadius: '8px',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Tag variant="success" size="small">
            <DbIcon size={12} style={{ marginRight: '4px' }} />
            SQLite {sqlVersion} (WASM)
          </Tag>
          <Tag variant="primary" size="small">
            Tier 1: Browser-Native
          </Tag>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Button 
            variant="default-outline" 
            size="small" 
            onClick={handleReset} 
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
        padding: '0.5rem 0.875rem', 
        borderRadius: '8px', 
        backgroundColor: 'var(--studio-surface-subtle)', 
        border: '1px solid var(--studio-border)',
        fontSize: '0.75rem',
        color: 'var(--studio-text)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <Info size={15} color="var(--studio-primary)" style={{ flexShrink: 0 }} />
        <span style={{ lineHeight: 1.45 }}>
          <strong>Database Portability Notice:</strong> SQLite execution plans teach relational mechanics (table scan vs. index seek). They do not predict PostgreSQL cost optimizer choices.
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
            <Tag variant="primary" size="small">weather_observations_idx.sql</Tag>
          </div>

          <div style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative' }} aria-describedby="monaco-sql-esc-hint">
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

          <div style={{ 
            padding: '0.4rem 0.875rem', 
            borderTop: '1px solid var(--studio-border)', 
            fontSize: '0.6875rem', 
            color: 'var(--studio-text-muted)', 
            backgroundColor: 'var(--studio-surface-subtle)', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0 
          }}>
            <span><strong>Target:</strong> <code>SELECT ... WHERE station_code = &apos;STN-MY-042&apos; ORDER BY recorded_at DESC LIMIT 50;</code></span>
            <span id="monaco-sql-esc-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <kbd style={{ padding: '1px 5px', fontSize: '0.625rem', borderRadius: '3px', border: '1px solid var(--studio-border)', backgroundColor: 'var(--studio-surface)', fontFamily: 'var(--studio-font-mono)' }}>Esc</kbd>
              releases focus
            </span>
          </div>
        </div>

        {/* Right Column: Tabbed Query Plan Inspector */}
        <div style={{ 
          border: '1px solid var(--studio-border)',
          borderRadius: '8px',
          backgroundColor: 'var(--studio-surface)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden'
        }}>
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as PlanViewTab)}
            variant="pill"
            size="small"
            style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
          >
            {/* Header & ARIA Tablist */}
            <div style={{ 
              padding: '0.625rem 0.875rem', 
              borderBottom: '1px solid var(--studio-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--studio-text)' }}>
                  Plan Inspector
                </span>
                {optimizationStatus && (
                  <Tag variant={optimizationStatus.passed ? 'success' : 'danger'} size="small">
                    {optimizationStatus.passed ? (
                      <CheckCircle2 size={11} style={{ marginRight: '3px' }} />
                    ) : (
                      <AlertTriangle size={11} style={{ marginRight: '3px' }} />
                    )}
                    {optimizationStatus.passed ? 'OPTIMIZED' : 'UNOPTIMIZED'}
                  </Tag>
                )}
              </div>

              {/* Accessible Tab Navigation */}
              <TabsList width="fit">
                <TabsTrigger value="delta">
                  <TabsIcon><TrendingDown size={11} /></TabsIcon>
                  Cost Delta
                </TabsTrigger>
                <TabsTrigger value="nodes">
                  <TabsIcon><Layers size={11} /></TabsIcon>
                  Plan Nodes
                </TabsTrigger>
                <TabsTrigger value="raw">
                  <TabsIcon><Terminal size={11} /></TabsIcon>
                  Raw EXPLAIN
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Scrollable Tab Panels */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              
              {/* Status Callout (Always Visible above tabs) */}
              {optimizationStatus && (
                <Callout variant={optimizationStatus.passed ? 'success' : 'warning'}>
                  <CalloutTitle style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}>
                    {optimizationStatus.passed ? <CheckCircle2 size={14} color="var(--studio-success)" /> : <AlertTriangle size={14} color="var(--studio-warning)" />}
                    {optimizationStatus.passed ? 'Index Plan Transition Successful' : 'Sequential Scan Detected'}
                  </CalloutTitle>
                  <CalloutContent style={{ fontSize: '0.75rem' }}>
                    {optimizationStatus.message}
                  </CalloutContent>
                </Callout>
              )}

              {/* TAB PANEL 1: Cost Delta & Performance Transition */}
              <TabsContent value="delta" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: 0 }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.625rem' }}>
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

                {/* Supplementary Timing Note */}
                {currentPlan?.executionTimeMs !== undefined && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Cpu size={13} color="var(--studio-primary)" />
                    <span>Supplementary Benchmark: ~{currentPlan.executionTimeMs.toFixed(2)}ms (Informational only; host-dependent)</span>
                  </div>
                )}
              </TabsContent>

              {/* TAB PANEL 2: Parsed Plan Nodes */}
              <TabsContent value="nodes" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: 0 }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--studio-text-muted)', marginBottom: '2px' }}>
                  PARSED PLAN NODES:
                </div>
                {currentPlan?.nodes && currentPlan.nodes.length > 0 ? (
                  currentPlan.nodes.map((node, i) => (
                    <div key={i} style={{ 
                      fontSize: '0.75rem', 
                      padding: '0.5rem 0.625rem', 
                      backgroundColor: 'var(--studio-surface-subtle)',
                      border: '1px solid var(--studio-border)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      color: 'var(--studio-text)'
                    }}>
                      <span>
                        <strong>{node.operation.toUpperCase()}:</strong> {node.table} {node.index ? `(Index: ${node.index})` : ''}
                      </span>
                      <Tag variant={node.operation === 'search' ? 'success' : 'danger'} size="small">
                        {node.operation === 'search' ? (
                          <CheckCircle2 size={10} style={{ marginRight: '3px' }} />
                        ) : (
                          <AlertTriangle size={10} style={{ marginRight: '3px' }} />
                        )}
                        {node.operation}
                      </Tag>
                    </div>
                  ))
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)' }}>No nodes parsed yet. Click Execute & Analyze Plan above.</span>
                )}
              </TabsContent>

              {/* TAB PANEL 3: Raw EXPLAIN Rows */}
              <TabsContent value="raw" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: 0 }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--studio-text-muted)', marginBottom: '2px' }}>
                  RAW EXPLAIN QUERY PLAN ROWS:
                </div>
                <pre style={{ 
                  margin: 0, 
                  padding: '0.75rem', 
                  borderRadius: '6px', 
                  backgroundColor: 'var(--studio-surface-subtle)', 
                  color: 'var(--studio-text)', 
                  fontFamily: 'monospace', 
                  fontSize: '0.75rem', 
                  whiteSpace: 'pre-wrap', 
                  border: '1px solid var(--studio-border)' 
                }}>
                  {currentPlan?.rawExplain && currentPlan.rawExplain.length > 0 
                    ? currentPlan.rawExplain.join('\n')
                    : 'Awaiting execution. Click "Execute & Analyze Plan" above.'}
                </pre>
              </TabsContent>

            </div>
          </Tabs>
        </div>

      </div>

    </div>
  );
}
