import { useState, lazy, Suspense } from 'react';
import Editor from '@monaco-editor/react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Button } from '@govtechmy/myds-react/button';
import { Tag } from '@govtechmy/myds-react/tag';
import { 
  Play, 
  RotateCcw, 
  FileCode,
  ChevronRight,
  ChevronLeft,
  Server,
  Lightbulb,
  Unlock,
  Check,
  Copy,
  X,
  AlertCircle
} from 'lucide-react';
import { 
  type DrillDefinition,
  type StarStory,
  type WorkflowStep
} from '../../../../types';
import { getBridgeCommandForDrill } from '../../../../drills/registry';
import { type BridgeHealth } from '../../../../services/bridgeClient';
import { StarStoryBuilder } from '../../../system-design/StarStoryBuilder';

const QueryPlanLab = lazy(() => 
  import('../../../database/QueryPlanLab').then(m => ({ default: m.QueryPlanLab }))
);

export interface StepFocusedDrillProps {
  activeDrill: DrillDefinition;
  userCode: string;
  setUserCode: (code: string) => void;
  isDark: boolean;
  bridgeStatus: BridgeHealth;
  isEvaluating: boolean;
  isRunningDocker: boolean;
  handleRunDrill: () => void;
  handleRunTier3Docker: () => void;
  starStories?: StarStory[];
  setStarStories: (stories: StarStory[]) => void;
  onSaveStarStoriesSession: (stories: StarStory[]) => void;
  sprintSeconds: number;
  canProceedToStep3: boolean;
  goToStep: (step: WorkflowStep) => void;
  setPoliteNotice: (msg: string) => void;
  onRuntimeSqlVersion: (ver: string) => void;
  onQueryPlanExecutionComplete: (passed: boolean) => Promise<void>;
  hintsUsed?: number;
  solutionRevealed?: boolean;
  onRequestHint?: () => void;
  onRevealSolution?: () => void;
}

export function StepFocusedDrill({
  activeDrill,
  userCode,
  setUserCode,
  isDark,
  bridgeStatus,
  isEvaluating,
  isRunningDocker,
  handleRunDrill,
  handleRunTier3Docker,
  starStories,
  setStarStories,
  onSaveStarStoriesSession,
  sprintSeconds,
  canProceedToStep3,
  goToStep,
  setPoliteNotice,
  onRuntimeSqlVersion,
  onQueryPlanExecutionComplete,
  hintsUsed = 0,
  solutionRevealed = false,
  onRequestHint,
  onRevealSolution,
}: StepFocusedDrillProps) {
  const [showConfirmSolution, setShowConfirmSolution] = useState(false);
  const [showSolutionDrawer, setShowSolutionDrawer] = useState(false);
  const [copiedSolution, setCopiedSolution] = useState(false);

  const hints = activeDrill.hints || [];
  const maxHints = hints.length;
  const isSolutionVisible = solutionRevealed || showSolutionDrawer;

  const handleCopySolution = () => {
    navigator.clipboard.writeText(activeDrill.solutionCode);
    setCopiedSolution(true);
    setTimeout(() => setCopiedSolution(false), 2000);
  };

  const handleApplySolution = () => {
    setUserCode(activeDrill.solutionCode);
    if (!solutionRevealed && onRevealSolution) {
      onRevealSolution();
    }
    setShowSolutionDrawer(false);
  };

  const confirmRevealSolution = () => {
    setShowConfirmSolution(false);
    setShowSolutionDrawer(true);
    if (onRevealSolution) {
      onRevealSolution();
    }
  };

  return (
    <div className="studio-drill-container">
      {/* Confirmation Modal for Solution Revelation */}
      {showConfirmSolution && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-solution-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--studio-overlay)',
            backdropFilter: 'blur(4px)',
            padding: '1rem',
          }}
        >
          <div style={{
            maxWidth: '460px',
            width: '100%',
            backgroundColor: 'var(--studio-surface)',
            border: '1px solid var(--studio-border)',
            borderRadius: '10px',
            padding: '1.25rem',
            boxShadow: 'var(--studio-shadow-float)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.875rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={20} color="var(--studio-warning)" />
              <h3 id="confirm-solution-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--studio-text)' }}>
                View Reference Solution?
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.8125rem', lineHeight: 1.5, color: 'var(--studio-text-muted)' }}>
              Viewing the reference solution will be recorded in your session notes for oral review discussion.
              <br /><br />
              <strong>Note:</strong> In SysCraft pedagogy, this does NOT deduct from your oral rubric score, which evaluates verbal explanation and defense independently.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button variant="default-outline" size="small" onClick={() => setShowConfirmSolution(false)}>
                Cancel
              </Button>
              <Button variant="primary-fill" size="small" onClick={confirmRevealSolution}>
                Reveal Solution
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Week 4 Database & EXPLAIN Lab */}
      {activeDrill.week === 4 ? (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {bridgeStatus.connected && (
            <div style={{ 
              padding: '0.4rem 0.875rem', 
              backgroundColor: 'var(--studio-surface)', 
              borderBottom: '1px solid var(--studio-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)' }}>
                Connected to Tier 3 Bridge: Verify query plan against live PostgreSQL 16.4 container
              </span>
              <Button 
                id="run-docker-pg-btn"
                variant="primary-outline" 
                size="small"
                onClick={handleRunTier3Docker}
                disabled={isRunningDocker}
                aria-label="Verify via PostgreSQL Docker Container"
              >
                <Server size={12} style={{ marginRight: '4px' }} />
                {isRunningDocker ? "Running Docker..." : "Verify PostgreSQL EXPLAIN (Tier 3)"}
              </Button>
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--studio-text-muted)' }}>Loading SQLite WASM Lab...</div>}>
              <QueryPlanLab 
                initialIndexSql={userCode}
                isDark={isDark}
                onCodeChange={(newSql: string) => setUserCode(newSql)}
                onVersionDetected={(ver: string) => onRuntimeSqlVersion(ver)}
                onExecutionComplete={async (passed: boolean) => {
                  await onQueryPlanExecutionComplete(passed);
                }}
              />
            </Suspense>
          </div>
        </div>
      ) : activeDrill.week === 6 ? (
        /* Week 6 System Design Architecture & STAR Story Builder */
        <Group orientation="horizontal" style={{ flex: 1, minHeight: 0, width: '100%' }}>
          {/* Left Panel: StarStoryBuilder */}
          <Panel defaultSize="46%" minSize="30%" maxSize="60%" style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ height: '100%', overflowY: 'auto', padding: '0.75rem' }}>
              <StarStoryBuilder 
                isDark={isDark}
                stories={starStories}
                onChangeStories={(updated: StarStory[]) => {
                  setStarStories(updated);
                  onSaveStarStoriesSession(updated);
                }}
                onExportRfc={() => {
                  setPoliteNotice('Exported Architecture RFC to clipboard and downloaded Markdown file.');
                }}
                onOpenRubric={() => {
                  goToStep(4);
                }}
              />
            </div>
          </Panel>

          <Separator style={{ width: '6px', cursor: 'col-resize', backgroundColor: 'var(--studio-border)' }} />

          {/* Right Panel: Architecture Specification JSON Editor */}
          <Panel defaultSize="54%" minSize="40%" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="studio-drill-editor-pane" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              
              {/* Editor Header Bar */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '0.45rem 0.75rem',
                borderBottom: '1px solid var(--studio-border)',
                backgroundColor: 'var(--studio-surface)',
                flexWrap: 'wrap',
                gap: '0.5rem',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileCode size={14} color="var(--studio-primary)" />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--studio-text)' }}>
                    <code>{activeDrill.targetFile}</code>
                  </span>
                  <Tag variant="warning" size="small">JSON / System Architecture Topology</Tag>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {/* Progressive Hint Button */}
                  {maxHints > 0 && onRequestHint && (
                    <Button
                      variant="default-outline"
                      size="small"
                      onClick={onRequestHint}
                      disabled={hintsUsed >= maxHints}
                      aria-label="Unlock hint"
                      title={hintsUsed >= maxHints ? "All hints unlocked" : "Unlock next hint"}
                    >
                      <Lightbulb size={12} color="var(--studio-warning)" style={{ marginRight: '4px' }} />
                      {hintsUsed === 0 ? "Need a hint?" : `Hint (${hintsUsed}/${maxHints})`}
                    </Button>
                  )}

                  {/* Reference Solution Button */}
                  <Button
                    variant="default-outline"
                    size="small"
                    onClick={() => {
                      if (solutionRevealed) {
                        setShowSolutionDrawer(prev => !prev);
                      } else {
                        setShowConfirmSolution(true);
                      }
                    }}
                    aria-label="View reference solution"
                  >
                    <Unlock size={12} style={{ marginRight: '4px' }} />
                    {isSolutionVisible ? "Hide Solution" : "Solution"}
                  </Button>

                  <Button 
                    variant="default-outline" 
                    size="small" 
                    onClick={() => setUserCode(activeDrill.initialCode)}
                    aria-label="Reset Architecture Spec"
                  >
                    <RotateCcw size={12} style={{ marginRight: '4px' }} />
                    Reset Spec
                  </Button>

                  <Button 
                    id="run-simulation-btn"
                    variant="primary-fill" 
                    size="small" 
                    onClick={handleRunDrill}
                    disabled={isEvaluating}
                    aria-label="Evaluate Architecture Spec"
                  >
                    <Play size={12} style={{ marginRight: '4px' }} />
                    {isEvaluating ? "Evaluating..." : "Run Systems Evaluator"}
                  </Button>
                </div>
              </div>

              {/* Revealed Hints Drawer */}
              {hintsUsed > 0 && (
                <div style={{
                  padding: '0.5rem 0.875rem',
                  backgroundColor: 'var(--studio-surface-subtle)',
                  borderBottom: '1px solid var(--studio-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  flexShrink: 0
                }}>
                  {hints.slice(0, hintsUsed).map((h, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <Tag variant="warning" size="small" style={{ fontSize: '0.625rem', padding: '1px 4px' }}>
                        Hint {i + 1}
                      </Tag>
                      <span style={{ color: 'var(--studio-text)', lineHeight: 1.45 }}>{h}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Reference Solution Drawer */}
              {isSolutionVisible && (
                <div style={{
                  padding: '0.625rem 0.875rem',
                  backgroundColor: 'var(--studio-surface-subtle)',
                  borderBottom: '2px solid var(--studio-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  flexShrink: 0,
                  maxHeight: '180px',
                  overflowY: 'auto'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--studio-primary)' }}>
                      Reference Architecture Spec:
                    </span>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <Button variant="default-outline" size="small" onClick={handleCopySolution} style={{ padding: '2px 6px', fontSize: '0.6875rem' }}>
                        {copiedSolution ? <Check size={11} color="var(--studio-success)" /> : <Copy size={11} />}
                        {copiedSolution ? "Copied" : "Copy"}
                      </Button>
                      <Button variant="primary-outline" size="small" onClick={handleApplySolution} style={{ padding: '2px 6px', fontSize: '0.6875rem' }}>
                        Apply to Editor
                      </Button>
                      <Button variant="default-outline" size="small" onClick={() => setShowSolutionDrawer(false)} style={{ padding: '2px 4px' }} aria-label="Close solution">
                        <X size={12} />
                      </Button>
                    </div>
                  </div>
                  <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'var(--studio-font-mono)', whiteSpace: 'pre-wrap', color: 'var(--studio-text)' }}>
                    {activeDrill.solutionCode}
                  </pre>
                </div>
              )}

              {/* Monaco Editor Canvas */}
              <div className="studio-drill-editor-wrapper" aria-describedby="monaco-esc-hint-w6">
                <Editor
                  height="100%"
                  language={activeDrill.language}
                  value={userCode}
                  onChange={(value) => setUserCode(value || '')}
                  theme={isDark ? "vs-dark" : "light"}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    renderLineHighlight: 'all',
                    wordWrap: 'on',
                  }}
                />
              </div>

              {/* Editor Footer: Target & Calibrated Keyboard Navigation Indicator */}
              <div style={{ 
                padding: '0.35rem 0.75rem', 
                backgroundColor: 'var(--studio-surface-subtle)', 
                borderTop: '1px solid var(--studio-border)',
                fontSize: '0.6875rem',
                color: 'var(--studio-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}>
                <span>Target: Complete buffer backpressure strategy, partition key, and STAR story fields without &quot;TODO&quot;</span>
                <span id="monaco-esc-hint-w6" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <kbd style={{ padding: '1px 5px', fontSize: '0.625rem', borderRadius: '3px', border: '1px solid var(--studio-border)', backgroundColor: 'var(--studio-surface)', fontFamily: 'var(--studio-font-mono)' }}>Esc</kbd>
                  releases focus
                </span>
              </div>

            </div>
          </Panel>
        </Group>
      ) : (
        /* Week 1, 2, 3, 5, 7 PHP Code Drills */
        <Group orientation="horizontal" style={{ flex: 1, minHeight: 0, width: '100%' }}>
          {/* Left Panel: Problem Context & Objective */}
          <Panel defaultSize="38%" minSize="25%" maxSize="55%" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="studio-drill-sidebar-container">
              <div className="studio-drill-sidebar">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Tag variant={activeDrill.tier === 3 ? "danger" : activeDrill.tier === 1 ? "primary" : "warning"} size="small">
                    {activeDrill.week === 7 
                      ? "Tier 3 Security Sprint" 
                      : activeDrill.week === 3 
                      ? "Tier 3 Clean Architecture" 
                      : activeDrill.week === 2
                      ? "Tier 1 REST Engine"
                      : activeDrill.week === 5
                      ? "Tier 2 Async Pipeline"
                      : "Tier 2 Simulation"}
                  </Tag>
                  <Tag variant={activeDrill.week === 7 ? "danger" : "warning"} size="small">
                    {activeDrill.week === 7 
                      ? "90-Min Time Cap" 
                      : activeDrill.week === 2
                      ? "O(1) Seek • RFC 9457"
                      : activeDrill.week === 3
                      ? "SOLID D • IoC Container"
                      : activeDrill.week === 5
                      ? "Tries: 3 • Backoff: 15s"
                      : "Budget: ≤ 3 Queries"}
                  </Tag>
                </div>

                <div>
                  <h2 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem', fontWeight: 600, color: 'var(--studio-text)' }}>
                    {activeDrill.title}
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.75rem', lineHeight: 1.45, color: 'var(--studio-text-muted)' }}>
                    {activeDrill.week === 7
                      ? "Remediate critical session fixation and privilege escalation (IDOR) vulnerabilities in AuthController.php."
                      : activeDrill.week === 2
                      ? "Implement seek-based cursor pagination for high-volume APIs and emit RFC 9457 standard problem details."
                      : activeDrill.week === 3
                      ? "Refactor bloated procedural code into clean services, bind contracts in Laravel IoC, and inject dependencies."
                      : activeDrill.week === 5
                      ? "Construct idempotent queue consumers with exponential backoff and isolate poisonous messages in a dead-letter queue."
                      : "Refactor PostController::index() to collapse catastrophic database multiplication."}
                  </p>
                </div>

                {/* Bug Diagnosis Box */}
                <div style={{ 
                  padding: '0.625rem 0.75rem', 
                  borderRadius: '6px', 
                  backgroundColor: activeDrill.week === 7 ? 'var(--studio-danger-subtle)' : 'var(--studio-warning-subtle)', 
                  borderLeft: `4px solid ${activeDrill.week === 7 ? 'var(--studio-danger)' : 'var(--studio-warning)'}`,
                  fontSize: '0.75rem',
                  color: 'var(--studio-text)'
                }}>
                  <strong style={{ color: activeDrill.week === 7 ? 'var(--studio-danger)' : 'var(--studio-warning)', display: 'block', marginBottom: '2px' }}>
                    {activeDrill.week === 7 ? "🚨 Security Vulnerability Analysis:" : "⚠️ Bottleneck & Architecture Defect Analysis:"}
                  </strong>
                  <div style={{ lineHeight: 1.45, color: 'var(--studio-text-muted)' }}>
                    {activeDrill.week === 7 ? (
                      <>
                        <strong>1. Session Fixation (login):</strong> The controller authenticates credentials but omits <code>$request-&gt;session()-&gt;regenerate()</code>, allowing an attacker to hijack the authenticated session with a pre-set cookie.
                        <br />
                        <strong>2. IDOR / Missing Policy (updateRecord):</strong> The mutation endpoint accepts any <code>Record $record</code> without checking <code>$this-&gt;authorize(&apos;update&apos;, $record)</code>, exposing tenant data to unauthorized tampering.
                      </>
                    ) : activeDrill.week === 2 ? (
                      <>
                        <strong>1. OFFSET Query Degradation:</strong> <code>OFFSET 10000</code> forces the database to scan and discard 10,000 index rows, degrading pagination to O(N) latency.
                        <br />
                        <strong>2. Malformed Error Responses:</strong> Invalid cursors produce non-standard 500 error responses leaking internals instead of RFC 9457 <code>application/problem+json</code> (HTTP 422).
                      </>
                    ) : activeDrill.week === 3 ? (
                      <>
                        <strong>1. Direct Instantiation Coupling:</strong> <code>OrderService</code> instantiates concrete <code>StripePaymentGateway</code> and <code>SmtpMailer</code> using the <code>new</code> keyword, violating the Dependency Inversion Principle.
                        <br />
                        <strong>2. Untestable God Class:</strong> Unit tests cannot mock billing or mail services without triggering external APIs or modifying production code.
                      </>
                    ) : activeDrill.week === 5 ? (
                      <>
                        <strong>1. Worker Poisoning & Infinite Loops:</strong> <code>ProcessWebhookJob</code> lacks max attempt limits and backoff delays, causing malformed payloads to spin in infinite retry storms.
                        <br />
                        <strong>2. Unisolated Failures:</strong> Unrecoverable payloads are dropped without archiving to a dead-letter queue (DLQ) for engineering triage.
                      </>
                    ) : (
                      <>
                        <code>Post::all()</code> fetches 25 records. Inside the <code>map()</code> loop, accessing <code>$post-&gt;author-&gt;name</code> and <code>$post-&gt;comments-&gt;count()</code> executes 2 queries per row.
                        <br />
                        <strong>Total: 1 + 25 + 25 = 51 database roundtrips!</strong>
                      </>
                    )}
                  </div>
                </div>

                {/* Task Instructions */}
                <div style={{ fontSize: '0.75rem', color: 'var(--studio-text)' }}>
                  <strong style={{ display: 'block', marginBottom: '4px' }}>Your Objective:</strong>
                  <ol style={{ margin: 0, paddingLeft: '1.125rem', lineHeight: 1.5, color: 'var(--studio-text-muted)', fontSize: '0.75rem' }}>
                    {activeDrill.week === 7 ? (
                      <>
                        <li style={{ marginBottom: '2px' }}>In <code>login()</code>, call <code>$request-&gt;session()-&gt;regenerate()</code> upon successful credential attempt.</li>
                        <li style={{ marginBottom: '2px' }}>In <code>updateRecord()</code>, insert <code>$this-&gt;authorize(&apos;update&apos;, $record);</code> prior to model mutation.</li>
                        <li>Click <strong>Run Test Harness</strong> or <strong>Run in Docker (Tier 3)</strong> to verify both security defenses.</li>
                      </>
                    ) : activeDrill.week === 2 ? (
                      <>
                        <li style={{ marginBottom: '2px' }}>Replace <code>OFFSET</code> with seek predicate: <code>WHERE id &gt; :cursor ORDER BY id ASC LIMIT :limit</code>.</li>
                        <li style={{ marginBottom: '2px' }}>Return RFC 9457 <code>application/problem+json</code> with <code>type</code>, <code>title</code>, and <code>status: 422</code> on invalid cursor.</li>
                        <li>Click <strong>Run Test Harness</strong> to evaluate cursor pagination and error contracts.</li>
                      </>
                    ) : activeDrill.week === 3 ? (
                      <>
                        <li style={{ marginBottom: '2px' }}>Extract interfaces and inject <code>PaymentGatewayInterface</code> and <code>NotificationServiceInterface</code> via constructor.</li>
                        <li style={{ marginBottom: '2px' }}>Bind contracts in the Laravel Service Container using <code>App::bind(...)</code> or <code>App::singleton(...)</code>.</li>
                        <li>Click <strong>Run Test Harness</strong> or <strong>Run in Docker (Tier 3)</strong> to verify container resolution.</li>
                      </>
                    ) : activeDrill.week === 5 ? (
                      <>
                        <li style={{ marginBottom: '2px' }}>Configure <code>public int $tries = 3;</code> and implement <code>backoff(): array</code> with delays <code>[15, 60, 300]</code>.</li>
                        <li style={{ marginBottom: '2px' }}>Implement <code>failed(\Throwable $e)</code> handler routing poison payloads to the dead-letter queue.</li>
                        <li>Click <strong>Run Test Harness</strong> to evaluate retry scheduling and DLQ dispatch.</li>
                      </>
                    ) : (
                      <>
                        <li style={{ marginBottom: '2px' }}>Replace <code>Post::all()</code> with eager loading: <code>Post::with([...])-&gt;get()</code>.</li>
                        <li style={{ marginBottom: '2px' }}>Pre-load both <code>author</code> and <code>comments</code> relationships in a single batch.</li>
                        <li>Click <strong>Run Test Harness</strong> to evaluate against query budget &amp; heuristic simulation.</li>
                      </>
                    )}
                  </ol>
                </div>

                {/* Required Assertions Checklist */}
                <div style={{ 
                  padding: '0.625rem 0.75rem', 
                  borderRadius: '6px', 
                  backgroundColor: 'var(--studio-surface-subtle)', 
                  border: '1px solid var(--studio-border)' 
                }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--studio-text-muted)', display: 'block', marginBottom: '4px' }}>
                    Automated Assertions Evaluated:
                  </span>
                  <ul style={{ margin: 0, paddingLeft: '1.125rem', fontSize: '0.75rem', lineHeight: 1.45, color: 'var(--studio-text)' }}>
                    {activeDrill.week === 7 ? (
                      <>
                        <li>Session fixation defense: <code>$request-&gt;session()-&gt;regenerate()</code> called</li>
                        <li>Tenant authorization gate: <code>$this-&gt;authorize(&apos;update&apos;, $record)</code> enforced</li>
                        <li>Syntactically valid PHP 8.3 controller methods</li>
                        <li>Execution under 90-minute timed sprint constraint</li>
                      </>
                    ) : activeDrill.week === 2 ? (
                      <>
                        <li>Seek predicate: <code>WHERE id &gt; :cursor</code> replaces <code>OFFSET</code></li>
                        <li>Deterministic index traversal ordering (<code>ORDER BY id ASC</code>)</li>
                        <li>RFC 9457 Problem Details schema on invalid cursor format</li>
                        <li>Opaque cursor encoding for next page cursor token</li>
                      </>
                    ) : activeDrill.week === 3 ? (
                      <>
                        <li>Dependency inversion: interfaces injected via constructor</li>
                        <li>Zero concrete <code>new StripePaymentGateway()</code> instantiations</li>
                        <li>Service container binding: contracts bound to implementations</li>
                        <li>Clean separation of concerns between payment and notification</li>
                      </>
                    ) : activeDrill.week === 5 ? (
                      <>
                        <li>Resilient retry limit: <code>public int $tries = 3;</code></li>
                        <li>Exponential backoff schedule: <code>[15, 60, 300]</code> seconds</li>
                        <li>Poison message quarantine: dead-letter queue dispatch in <code>failed()</code></li>
                        <li>Idempotent payload handling with deduplication key</li>
                      </>
                    ) : (
                      <>
                        <li>Query budget: ≤ 3 distinct queries for 25 records</li>
                        <li>Zero per-row queries during <code>map()</code> iteration</li>
                        <li><code>author</code> relationship eager loaded</li>
                        <li><code>comments</code> relationship eager loaded</li>
                      </>
                    )}
                  </ul>
                </div>

                {/* Senior Defense Tip */}
                <div style={{ 
                  padding: '0.625rem 0.75rem', 
                  borderRadius: '6px', 
                  backgroundColor: 'var(--studio-surface)', 
                  border: '1px solid var(--studio-border)',
                  fontSize: '0.75rem'
                }}>
                  <strong style={{ display: 'block', marginBottom: '2px', color: 'var(--studio-primary)' }}>
                    Interview Defense Note:
                  </strong>
                  <span style={{ color: 'var(--studio-text-muted)', lineHeight: 1.45 }}>
                    {activeDrill.week === 7
                      ? "Defense-in-depth: OWASP A01 (Broken Access Control) requires strict policy authorization before mutating state. Session regeneration ensures stale session IDs cannot be weaponized after login elevation."
                      : activeDrill.week === 2
                      ? "Cursor pagination ensures O(1) seek performance regardless of depth, immune to pagination drift when new records are inserted between page requests. RFC 9457 standardizes error negotiation across distributed services."
                      : activeDrill.week === 3
                      ? "Inverting dependencies and programming to contracts allows painless mock substitution during automated testing and decouples high-level domain rules from third-party vendor APIs."
                      : activeDrill.week === 5
                      ? "Without exponential backoff and dead-letter queues, transient upstream rate limits cascade into poison-pill retry storms that exhaust Redis/database worker pools."
                      : "In high-scale production, Laravel 12's Model::preventLazyLoading() enforces strict eager loading during development, throwing exceptions before code enters staging."}
                  </span>
                </div>
              </div>
              <div className="studio-drill-sidebar-fade" />
            </div>
          </Panel>

          <Separator style={{ width: '6px', cursor: 'col-resize', backgroundColor: 'var(--studio-border)' }} />

          {/* Right Panel: Monaco Editor & Run Controls */}
          <Panel defaultSize="62%" minSize="45%" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="studio-drill-editor-pane" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              
              {/* Editor Header Bar */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '0.45rem 0.75rem',
                borderBottom: '1px solid var(--studio-border)',
                backgroundColor: 'var(--studio-surface)',
                flexWrap: 'wrap',
                gap: '0.5rem',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileCode size={14} color="var(--studio-primary)" />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--studio-text)' }}>
                    <code>{activeDrill.targetFile}</code>
                  </span>
                  <Tag variant="primary" size="small">
                    {activeDrill.week === 7 
                      ? "PHP 8.3 (Auth Security Testbed)" 
                      : activeDrill.week === 3
                      ? "PHP 8.3 (IoC Container / Docker Testbed)"
                      : activeDrill.week === 2
                      ? "PHP 8.3 (REST API / SQLite Engine)"
                      : activeDrill.week === 5
                      ? "PHP 8.3 (Queue Worker / Horizon Simulation)"
                      : "PHP 8.3 (Eloquent Testbed Prototype)"}
                  </Tag>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {/* Progressive Hint Button */}
                  {maxHints > 0 && onRequestHint && (
                    <Button
                      variant="default-outline"
                      size="small"
                      onClick={onRequestHint}
                      disabled={hintsUsed >= maxHints}
                      aria-label="Unlock hint"
                      title={hintsUsed >= maxHints ? "All hints unlocked" : "Unlock next hint"}
                    >
                      <Lightbulb size={12} color="var(--studio-warning)" style={{ marginRight: '4px' }} />
                      {hintsUsed === 0 ? "Need a hint?" : `Hint (${hintsUsed}/${maxHints})`}
                    </Button>
                  )}

                  {/* Reference Solution Button */}
                  <Button
                    variant="default-outline"
                    size="small"
                    onClick={() => {
                      if (solutionRevealed) {
                        setShowSolutionDrawer(prev => !prev);
                      } else {
                        setShowConfirmSolution(true);
                      }
                    }}
                    aria-label="View reference solution"
                  >
                    <Unlock size={12} style={{ marginRight: '4px' }} />
                    {isSolutionVisible ? "Hide Solution" : "Solution"}
                  </Button>

                  <Button 
                    variant="default-outline" 
                    size="small" 
                    onClick={() => setUserCode(activeDrill.initialCode)}
                    aria-label="Reset Code to Template"
                  >
                    <RotateCcw size={12} style={{ marginRight: '4px' }} />
                    Reset Code
                  </Button>

                  {/* Tier 3 Docker Verification Trigger */}
                  {bridgeStatus.connected && getBridgeCommandForDrill(activeDrill.week) && (
                    <Button 
                      id="run-docker-tier3-btn"
                      variant="primary-outline" 
                      size="small"
                      onClick={handleRunTier3Docker}
                      disabled={isRunningDocker}
                      aria-label="Run in Docker (Tier 3)"
                    >
                      <Server size={12} style={{ marginRight: '4px' }} />
                      {isRunningDocker ? "Running Container..." : "Run in Docker (Tier 3)"}
                    </Button>
                  )}

                  {/* Tier 2 Simulation Evaluation Trigger */}
                  <Button 
                    id="run-simulation-btn"
                    variant="primary-fill" 
                    size="small" 
                    onClick={handleRunDrill}
                    disabled={isEvaluating}
                    aria-label="Run Test Harness"
                  >
                    <Play size={12} style={{ marginRight: '4px' }} />
                    {isEvaluating ? "Evaluating..." : "Run Test Harness"}
                  </Button>
                </div>
              </div>

              {/* Revealed Hints Drawer */}
              {hintsUsed > 0 && (
                <div style={{
                  padding: '0.5rem 0.875rem',
                  backgroundColor: 'var(--studio-surface-subtle)',
                  borderBottom: '1px solid var(--studio-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  flexShrink: 0
                }}>
                  {hints.slice(0, hintsUsed).map((h, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <Tag variant="warning" size="small" style={{ fontSize: '0.625rem', padding: '1px 4px' }}>
                        Hint {i + 1}
                      </Tag>
                      <span style={{ color: 'var(--studio-text)', lineHeight: 1.45 }}>{h}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Reference Solution Drawer */}
              {isSolutionVisible && (
                <div style={{
                  padding: '0.625rem 0.875rem',
                  backgroundColor: 'var(--studio-surface-subtle)',
                  borderBottom: '2px solid var(--studio-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  flexShrink: 0,
                  maxHeight: '180px',
                  overflowY: 'auto'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--studio-primary)' }}>
                      Reference Solution ({activeDrill.targetFile.split('/').pop()}):
                    </span>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <Button variant="default-outline" size="small" onClick={handleCopySolution} style={{ padding: '2px 6px', fontSize: '0.6875rem' }}>
                        {copiedSolution ? <Check size={11} color="var(--studio-success)" /> : <Copy size={11} />}
                        {copiedSolution ? "Copied" : "Copy"}
                      </Button>
                      <Button variant="primary-outline" size="small" onClick={handleApplySolution} style={{ padding: '2px 6px', fontSize: '0.6875rem' }}>
                        Apply to Editor
                      </Button>
                      <Button variant="default-outline" size="small" onClick={() => setShowSolutionDrawer(false)} style={{ padding: '2px 4px' }} aria-label="Close solution">
                        <X size={12} />
                      </Button>
                    </div>
                  </div>
                  <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'var(--studio-font-mono)', whiteSpace: 'pre-wrap', color: 'var(--studio-text)' }}>
                    {activeDrill.solutionCode}
                  </pre>
                </div>
              )}

              {/* Week 7 Timed Sprint Countdown Progress Bar */}
              {activeDrill.week === 7 && (
                <div style={{ width: '100%', height: '3px', backgroundColor: 'var(--studio-border)', overflow: 'hidden' }} aria-label="Sprint Progress">
                  <div style={{ 
                    width: `${Math.min(100, ((5400 - sprintSeconds) / 5400) * 100)}%`, 
                    height: '100%', 
                    backgroundColor: sprintSeconds <= 300 ? 'var(--studio-danger)' : sprintSeconds <= 900 ? 'var(--studio-warning)' : 'var(--studio-primary)',
                    transition: 'width 1s linear'
                  }} />
                </div>
              )}

              {/* Monaco Editor Canvas */}
              <div className="studio-drill-editor-wrapper" aria-describedby="monaco-esc-hint-php">
                <Editor
                  height="100%"
                  language={activeDrill.language}
                  value={userCode}
                  onChange={(value) => setUserCode(value || '')}
                  theme={isDark ? "vs-dark" : "light"}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 4,
                    renderLineHighlight: 'all',
                    wordWrap: 'on',
                  }}
                />
              </div>

              {/* Editor Footer Target Hint & Calibrated Keyboard Navigation */}
              <div style={{ 
                padding: '0.35rem 0.75rem', 
                backgroundColor: 'var(--studio-surface-subtle)', 
                borderTop: '1px solid var(--studio-border)',
                fontSize: '0.6875rem',
                color: 'var(--studio-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}>
                <span>
                  {activeDrill.week === 7 ? (
                    <code>Target: $request-&gt;session()-&gt;regenerate() and $this-&gt;authorize(&apos;update&apos;, $record)</code>
                  ) : activeDrill.week === 2 ? (
                    <code>Target: WHERE id &gt; :cursor ORDER BY id ASC LIMIT :limit + RFC 9457</code>
                  ) : activeDrill.week === 3 ? (
                    <code>Target: Constructor injection &amp; App::bind(PaymentGatewayInterface::class, ...)</code>
                  ) : activeDrill.week === 5 ? (
                    <code>Target: public int $tries = 3; backoff(); failed(\Throwable $e);</code>
                  ) : (
                    <code>Target: Post::with([&apos;author&apos;, &apos;comments&apos;])-&gt;get()</code>
                  )}
                </span>
                <span id="monaco-esc-hint-php" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <kbd style={{ padding: '1px 5px', fontSize: '0.625rem', borderRadius: '3px', border: '1px solid var(--studio-border)', backgroundColor: 'var(--studio-surface)', fontFamily: 'var(--studio-font-mono)' }}>Esc</kbd>
                  releases focus
                </span>
              </div>

            </div>
          </Panel>
        </Group>
      )}

      <div className="studio-step-actions">
        <Button variant="default-outline" size="small" onClick={() => goToStep(1)}>
          <ChevronLeft size={14} style={{ marginRight: '4px' }} />
          Back to Concept
        </Button>
        <Button 
          variant="primary-fill" 
          size="small" 
          disabled={!canProceedToStep3}
          onClick={() => goToStep(3)}
          title={!canProceedToStep3 ? "Pass drill assertions in Step 2 to unlock" : "Advance to Analysis & Feedback"}
        >
          Go to Step 3: Analysis &amp; Feedback
          <ChevronRight size={14} style={{ marginLeft: '4px' }} />
        </Button>
      </div>
    </div>
  );
}
