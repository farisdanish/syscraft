import { useState, useEffect, useCallback } from 'react';
import { Button } from '@govtechmy/myds-react/button';
import { Tag } from '@govtechmy/myds-react/tag';
import {
  Server,
  Database,
  Cpu,
  Layers,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  Lock,
  Code2,
  Terminal,
  Network,
  Sun,
  Moon,
  Play
} from 'lucide-react';
import { checkBridgeHealth, type BridgeHealth } from '../../services/bridgeClient';

interface AboutArchitectureProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onNavigateHome: () => void;
  onLaunchWorkbench: (week: number) => void;
}

export function AboutArchitecture({
  isDark,
  onToggleTheme,
  onNavigateHome,
  onLaunchWorkbench
}: AboutArchitectureProps) {
  const [bridgeStatus, setBridgeStatus] = useState<BridgeHealth>({ connected: false });
  const [isCheckingBridge, setIsCheckingBridge] = useState<boolean>(false);

  const refreshBridge = useCallback(async () => {
    setIsCheckingBridge(true);
    try {
      const health = await checkBridgeHealth();
      setBridgeStatus(health);
    } catch {
      setBridgeStatus({ connected: false });
    } finally {
      setIsCheckingBridge(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadHealth = async () => {
      try {
        const health = await checkBridgeHealth();
        if (active) setBridgeStatus(health);
      } catch {
        if (active) setBridgeStatus({ connected: false });
      }
    };
    void loadHealth();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="home-container">
      {/* Top Header */}
      <header className="home-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <Button
            id="about-back-btn"
            variant="default-outline"
            size="small"
            onClick={onNavigateHome}
            aria-label="Back to Curriculum Hub"
          >
            <ArrowLeft size={13} style={{ marginRight: '5px' }} />
            Back to Curriculum
          </Button>

          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: 'var(--studio-primary)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.8125rem'
          }}>
            SC
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--studio-text)', lineHeight: 1.2 }}>
              SysCraft Architecture &amp; Runtimes
            </h1>
            <span style={{ fontSize: '0.6875rem', color: 'var(--studio-text-muted)' }}>
              Technical Realism, Threat Model &amp; System Health
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Button
            id="about-launch-workbench-btn"
            variant="primary-fill"
            size="small"
            onClick={() => onLaunchWorkbench(1)}
            aria-label="Open Studio Workbench"
          >
            <Play size={13} style={{ marginRight: '5px' }} />
            Open Workbench
          </Button>

          <Button
            id="about-theme-toggle-btn"
            variant="default-outline"
            size="small"
            onClick={onToggleTheme}
            aria-label={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
          >
            {isDark ? <Sun size={14} color="#f59e0b" /> : <Moon size={14} color="#0284c7" />}
          </Button>
        </div>
      </header>

      {/* Main Architecture Content */}
      <main className="home-main" style={{ gap: '1.75rem' }}>
        {/* Masthead Banner */}
        <section className="home-hero" aria-label="Architecture Overview">
          <div style={{ maxWidth: '850px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <Tag variant="primary" size="small">Under the Hood</Tag>
              <Tag variant="success" size="small">Technical Honesty Guarantee</Tag>
            </div>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.35rem', fontWeight: 700, color: 'var(--studio-text)', lineHeight: 1.25 }}>
              The 3-Tier Execution Architecture
            </h2>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--studio-text-muted)', lineHeight: 1.55 }}>
              A browser-only sandbox cannot replicate Zend engine memory internals, PDO driver buffering, or PostgreSQL concurrency locks. Rather than claiming impossible live executions in pure JavaScript, SysCraft enforces technical realism by strictly partitioning every exercise into three verifiable tiers.
            </p>
          </div>
        </section>

        {/* Live System Health & Diagnostics Panel */}
        <section aria-label="System Health & Diagnostics">
          <div className="home-section-header">
            <h3 className="home-section-title">
              <Layers size={17} color="var(--studio-primary)" />
              Live Execution Tiers &amp; Diagnostic Status
            </h3>
            <Button
              id="about-refresh-diagnostics-btn"
              variant="default-outline"
              size="small"
              onClick={refreshBridge}
              disabled={isCheckingBridge}
              aria-label="Run Diagnostic Check"
            >
              <RefreshCw size={12} className={isCheckingBridge ? "spin" : ""} style={{ marginRight: '5px' }} />
              {isCheckingBridge ? "Checking Bridge..." : "Run Diagnostic Check"}
            </Button>
          </div>

          <div className="home-tier-grid">
            {/* Tier 1 */}
            <div className="home-tier-card healthy">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Database size={16} color="var(--studio-primary)" />
                  <strong style={{ fontSize: '0.875rem', color: 'var(--studio-text)' }}>Tier 1: Browser WASM Runtime</strong>
                </div>
                <Tag variant="success" size="small">Online (SQLite 3.45.2)</Tag>
              </div>
              <p style={{ margin: 0, fontSize: '0.78125rem', color: 'var(--studio-text-muted)', lineHeight: 1.5 }}>
                Runs client-side via WebAssembly (<code>sql.js@1.12.0</code>). Dynamically queries <code>sqlite3_libversion()</code>, evaluates query plans semantically, validates RFC 9457 contracts, and stores progress in IndexedDB v2.
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--studio-text-faint)', borderTop: '1px solid var(--studio-border)', paddingTop: '0.4rem' }}>
                <span>Engine: WebAssembly SQLite</span>
                <span>Latency: &lt;1ms</span>
                <span>Synthetic Rows: 5,000</span>
              </div>
            </div>

            {/* Tier 2 */}
            <div className="home-tier-card healthy">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Cpu size={16} color="var(--studio-primary)" />
                  <strong style={{ fontSize: '0.875rem', color: 'var(--studio-text)' }}>Tier 2: Deterministic Simulation</strong>
                </div>
                <Tag variant="success" size="small">Online (9-Step FSM)</Tag>
              </div>
              <p style={{ margin: 0, fontSize: '0.78125rem', color: 'var(--studio-text-muted)', lineHeight: 1.5 }}>
                Explicitly labeled as <strong>"Deterministic Simulation"</strong>. Visualizes abstract flows (request lifecycle, queue retry backoff, container bindings) using inspectable rules and documented assumptions rather than claiming live execution.
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--studio-text-faint)', borderTop: '1px solid var(--studio-border)', paddingTop: '0.4rem' }}>
                <span>Engine: State Machine FSM</span>
                <span>Assumptions: Documented</span>
                <span>Query Budgets: Dynamic</span>
              </div>
            </div>

            {/* Tier 3 */}
            <div className={`home-tier-card ${bridgeStatus.connected ? 'healthy' : 'offline'}`}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Server size={16} color={bridgeStatus.connected ? "var(--studio-primary)" : "var(--studio-warning)"} />
                  <strong style={{ fontSize: '0.875rem', color: 'var(--studio-text)' }}>Tier 3: Secured Local Bridge</strong>
                </div>
                <Tag variant={bridgeStatus.connected ? "success" : "warning"} size="small">
                  {bridgeStatus.connected ? "Connected (127.0.0.1:49152)" : "Bridge Offline"}
                </Tag>
              </div>
              <p style={{ margin: 0, fontSize: '0.78125rem', color: 'var(--studio-text-muted)', lineHeight: 1.5 }}>
                Local loopback capability bridge bound strictly to <code>127.0.0.1:49152</code>. Executes learner code against pinned <strong>PHP 8.3 / PostgreSQL 16.4</strong> inside an isolated Docker network (<code>syscraft-testnet</code>) with real PDO query logging.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.6875rem', color: 'var(--studio-text-faint)', borderTop: '1px solid var(--studio-border)', paddingTop: '0.4rem' }}>
                <span>Docker Daemon: {bridgeStatus.dockerAvailable ? '✓ Ready' : '✗ Offline'}</span>
                <span>PostgreSQL 16.4: {bridgeStatus.postgresReady ? '✓ Healthy' : '✗ Unreachable'}</span>
                <span>Runner Image: {bridgeStatus.runnerImageReady ? '✓ Verified' : '✗ Missing'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Security & Network Isolation Threat Model */}
        <section aria-label="Security & Isolation Architecture">
          <div className="home-section-header">
            <h3 className="home-section-title">
              <ShieldCheck size={17} color="var(--studio-primary)" />
              Tier 3 Security Model &amp; Network Isolation
            </h3>
          </div>

          <div style={{
            backgroundColor: 'var(--studio-surface)',
            border: '1px solid var(--studio-border)',
            borderRadius: '8px',
            padding: '1.25rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem',
            boxShadow: 'var(--studio-shadow-sm)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Network size={16} color="var(--studio-primary)" />
                <strong style={{ fontSize: '0.875rem', color: 'var(--studio-text)' }}>Zero Egress Network Isolation</strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--studio-text-muted)', lineHeight: 1.5 }}>
                The Docker network <code>syscraft-testnet</code> is created with <code>internal: true</code>. Neither the PostgreSQL container nor the test runner can initiate or receive outbound connections to the host or internet.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={16} color="var(--studio-primary)" />
                <strong style={{ fontSize: '0.875rem', color: 'var(--studio-text)' }}>Unprivileged Execution</strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--studio-text-muted)', lineHeight: 1.5 }}>
                Containers run under a dedicated unprivileged user <code>syscraft:syscraft</code> (UID 1000:1000) with <code>read_only: true</code> root filesystems, <code>security_opt: ["no-new-privileges:true"]</code>, and strict PID limits.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Terminal size={16} color="var(--studio-primary)" />
                <strong style={{ fontSize: '0.875rem', color: 'var(--studio-text)' }}>Process-Group Cleanup</strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--studio-text-muted)', lineHeight: 1.5 }}>
                The Node.js bridge daemon spawns runner containers in distinct POSIX process groups. Cancellation commands execute <code>kill -2 -pgid</code> escalating to <code>SIGKILL</code>, preventing zombie processes or hung Docker sessions.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Code2 size={16} color="var(--studio-primary)" />
                <strong style={{ fontSize: '0.875rem', color: 'var(--studio-text)' }}>Read-Only Ephemeral Mounts</strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--studio-text-muted)', lineHeight: 1.5 }}>
                Learner code submissions are written to an ephemeral scratch directory and mounted into the testbed container as read-only at <code>/workspace/submission:ro</code>, guaranteeing zero host file tampering.
              </p>
            </div>
          </div>
        </section>

        {/* Data Contracts & Standards Reference */}
        <section aria-label="Standards Compliance">
          <div className="home-section-header">
            <h3 className="home-section-title">
              <Code2 size={17} color="var(--studio-primary)" />
              Data Contracts &amp; Specification Compliance
            </h3>
          </div>

          <div style={{
            backgroundColor: 'var(--studio-surface)',
            border: '1px solid var(--studio-border)',
            borderRadius: '8px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: 'var(--studio-shadow-sm)'
          }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <CheckCircle2 size={18} color="var(--studio-success)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '0.875rem', color: 'var(--studio-text)' }}>RFC 9457 Standard Problem Details</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8125rem', color: 'var(--studio-text-muted)', lineHeight: 1.5 }}>
                  All API contracts enforce RFC 9457 (the standard obsoleting RFC 7807), mandating structured JSON problem error formats: <code>type</code>, <code>title</code>, <code>status</code>, <code>detail</code>, and <code>instance</code>.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <CheckCircle2 size={18} color="var(--studio-success)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '0.875rem', color: 'var(--studio-text)' }}>Real PDO Query Budget Enforcement</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8125rem', color: 'var(--studio-text-muted)', lineHeight: 1.5 }}>
                  Tier 3 drills log every SQL query sent to PostgreSQL 16.4. Unoptimized iterations trigger 51 roundtrips failing the $\le 3$ budget assertion, while eager loading passes with 3 batch queries in &lt;0.10s.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <CheckCircle2 size={18} color="var(--studio-success)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '0.875rem', color: 'var(--studio-text)' }}>Zero-Secrets Envelopes with Depth Guards</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8125rem', color: 'var(--studio-text-muted)', lineHeight: 1.5 }}>
                  Import/export data uses strict Zod-validated <code>ExportEnvelopeV1</code> schema with a recursive depth ceiling ($\le 6$) to reject poisoned or maliciously nested payloads.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="home-footer">
        <div>
          <span>SysCraft Studio Architecture Specification</span>
          <span style={{ margin: '0 8px' }}>•</span>
          <span>Docker Engine &amp; PostgreSQL 16.4 Verified</span>
        </div>
        <div>
          <button
            type="button"
            onClick={onNavigateHome}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: '0.75rem',
              color: 'var(--studio-primary)',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
          >
            ← Return to Curriculum Hub
          </button>
        </div>
      </footer>
    </div>
  );
}
