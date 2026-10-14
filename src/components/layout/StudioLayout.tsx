import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import Editor from '@monaco-editor/react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Button } from '@govtechmy/myds-react/button';
import { Tag } from '@govtechmy/myds-react/tag';
import { Callout, CalloutTitle, CalloutContent } from '@govtechmy/myds-react/callout';
import { 
  Sun, 
  Moon, 
  Play, 
  RotateCcw, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  BookOpen, 
  Flag,
  FileCode,
  ChevronRight,
  ChevronLeft,
  Server,
  Lock,
  X
} from 'lucide-react';
import { WORKFLOW_STEPS, type WorkflowStep, type DrillDefinition } from '../../types';
import { WEEK_1_DRILL, evaluateLaravelDrill } from '../../drills/week1-internals';
import { WEEK_4_DRILL } from '../../drills/week4-performance';
import { 
  checkBridgeHealth, 
  runBridgeCommand, 
  type BridgeHealth, 
  type BridgeRunResult 
} from '../../services/bridgeClient';
import { 
  LARAVEL_LIFECYCLE_STEPS, 
  BTREE_INDEX_TRACER_STEPS 
} from '../tracer/tracerSteps';
import { OralRubricDialog } from '../rubric/OralRubricDialog';
import { 
  saveDrillProgress, 
  getDrillProgress, 
  getSundayHesitations, 
  exportEnvelopeJSON, 
  importEnvelopeJSON 
} from '../../services/storage';

const LifecycleTracer = lazy(() => 
  import('../tracer/LifecycleTracer').then(m => ({ default: m.LifecycleTracer }))
);
const QueryPlanLab = lazy(() => 
  import('../database/QueryPlanLab').then(m => ({ default: m.QueryPlanLab }))
);

export function StudioLayout() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('syscraft-theme');
      return saved !== null ? saved === 'dark' : true;
    } catch {
      return true;
    }
  });
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(1);
  const [highestStepReached, setHighestStepReached] = useState<number>(1);
  const [verificationSource, setVerificationSource] = useState<'simulation' | 'local-runtime' | 'self-reported'>('simulation');
  const [runtimeSqlVersion, setRuntimeSqlVersion] = useState<string>('3.45.2');

  const goToStep = (step: WorkflowStep) => {
    setCurrentStep(step);
    setHighestStepReached(prev => Math.max(prev, step));
  };
  
  // Drill State
  const activeDrill: DrillDefinition = selectedWeek === 1 ? WEEK_1_DRILL : WEEK_4_DRILL;
  const [userCode, setUserCode] = useState<string>(activeDrill.initialCode);
  const [testResults, setTestResults] = useState<any>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [drillCompleted, setDrillCompleted] = useState<boolean>(false);
  const [sundayCount, setSundayCount] = useState<number>(0);
  const [politeNotice, setPoliteNotice] = useState<string>('');
  const [importNotice, setImportNotice] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  // Tier 3 Bridge Daemon State
  const [bridgeStatus, setBridgeStatus] = useState<BridgeHealth>({ connected: false });
  const [tier3Result, setTier3Result] = useState<BridgeRunResult | null>(null);
  const [isRunningDocker, setIsRunningDocker] = useState<boolean>(false);

  // Poll Tier 3 Bridge Health on mount and periodically
  useEffect(() => {
    let isMounted = true;
    const pollBridge = async () => {
      const health = await checkBridgeHealth();
      if (isMounted) setBridgeStatus(health);
    };
    pollBridge();
    const interval = setInterval(pollBridge, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Sync theme
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('syscraft-theme', isDark ? 'dark' : 'light');
    } catch {
      // Ignore
    }
  }, [isDark]);

  const handleSelectWeek = (week: number) => {
    setSelectedWeek(week);
    const drill = week === 4 ? WEEK_4_DRILL : WEEK_1_DRILL;
    setUserCode(drill.initialCode);
    setTestResults(null);
    setTier3Result(null);
    setCurrentStep(1);
    setHighestStepReached(1);
  };

  // Load drill progress & Sunday count
  const refreshProgress = useCallback(async () => {
    const prog = await getDrillProgress(activeDrill.id);
    const isComp = prog?.completed ?? false;
    setDrillCompleted(isComp);
    if (prog?.verificationSource) {
      setVerificationSource(prog.verificationSource);
    }
    if (isComp) {
      setHighestStepReached(prev => Math.max(prev, 3));
    }
    const hes = await getSundayHesitations();
    setSundayCount(hes.length);
  }, [activeDrill.id]);

  useEffect(() => {
    let ignore = false;
    void Promise.resolve().then(async () => {
      const prog = await getDrillProgress(activeDrill.id);
      if (!ignore) {
        const isComp = prog?.completed ?? false;
        setDrillCompleted(isComp);
        if (prog?.verificationSource) {
          setVerificationSource(prog.verificationSource);
        }
        if (isComp) {
          setHighestStepReached(prev => Math.max(prev, 3));
        }
        const hes = await getSundayHesitations();
        setSundayCount(hes.length);
      }
    });
    return () => {
      ignore = true;
    };
  }, [activeDrill.id]);

  // Evaluate Drill Code (Tier 1/2 In-Browser)
  const handleRunDrill = async () => {
    setIsEvaluating(true);
    setPoliteNotice('Evaluating drill assertions via Tier 2 simulation...');

    if (activeDrill.week === 1) {
      // Week 1 Laravel Heuristic Simulation Evaluation
      const evalResult = evaluateLaravelDrill(userCode);
      setTestResults(evalResult);
      if (evalResult.passed) {
        setVerificationSource('simulation');
        setDrillCompleted(true);
        await saveDrillProgress(activeDrill.id, true, true, 'simulation');
        setPoliteNotice('All assertions passed! Query budget satisfied with zero per-row queries.');
      } else {
        setPoliteNotice('Assertion failure: N+1 query loop detected.');
      }
      goToStep(3); // Auto-advance to Step 3 (Plan & Assertion Analysis)
    }

    setIsEvaluating(false);
    refreshProgress();
  };

  // Run Tier 3 Canonical Test via Docker Bridge
  const handleRunTier3Docker = async () => {
    setIsRunningDocker(true);
    const commandId = activeDrill.week === 1 ? 'laravel-n1-test' : 'postgres-plan-test';
    const filename = activeDrill.week === 1 ? 'PostController.php' : 'weather_observations_idx.sql';
    setPoliteNotice(`Dispatching to Tier 3 Docker Runner (${commandId})...`);

    const result = await runBridgeCommand(commandId, userCode, filename);
    setTier3Result(result);
    setIsRunningDocker(false);

    if (result.passed) {
      setVerificationSource('local-runtime');
      setDrillCompleted(true);
      await saveDrillProgress(activeDrill.id, true, true, 'local-runtime');
      setPoliteNotice(`Tier 3 Docker verification passed for ${activeDrill.title}`);
      goToStep(3);
    } else {
      setPoliteNotice('Tier 3 Docker test run failed assertions.');
      goToStep(3);
    }
    refreshProgress();
  };

  // Export Envelope Backup
  const handleExportBackup = async () => {
    const jsonStr = await exportEnvelopeJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `syscraft-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setPoliteNotice('Backup exported successfully.');
  };

  // Import Envelope Backup (Non-blocking inline notification)
  const handleImportBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const text = await file.text();
        const res = await importEnvelopeJSON(text);
        setImportNotice({
          type: res.success ? 'success' : 'danger',
          text: res.message,
        });
        setPoliteNotice(res.message);
        refreshProgress();
      }
    };
    input.click();
  };

  return (
    <div className="studio-shell">
      
      {/* Screen Reader Polite Live Region */}
      <div 
        role="status" 
        aria-live="polite" 
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
      >
        {politeNotice}
      </div>

      {/* Top Masthead & Curriculum Selector Bar */}
      <header className="studio-header">
        {/* Brand & Studio ID */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ 
            width: '28px', 
            height: '28px', 
            borderRadius: '6px', 
            backgroundColor: 'var(--studio-primary)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '12px'
          }}>
            SC
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', letterSpacing: '-0.02em', color: 'var(--studio-text)' }}>
              SysCraft Studio
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--studio-text-muted)' }}>
              Interactive Systems & Backend Learning Studio
            </div>
          </div>
        </div>

        {/* Curriculum Module Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--studio-text-muted)' }}>Module:</span>
          
          <button
            type="button"
            onClick={() => handleSelectWeek(1)}
            style={{
              padding: '3px 9px',
              borderRadius: '6px',
              border: `1px solid ${selectedWeek === 1 ? 'var(--studio-primary)' : 'var(--studio-border)'}`,
              backgroundColor: selectedWeek === 1 ? 'var(--studio-primary-glow)' : 'transparent',
              color: selectedWeek === 1 ? 'var(--studio-primary)' : 'var(--studio-text)',
              fontWeight: 600,
              fontSize: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Week 1: Laravel Internals
          </button>

          <button
            type="button"
            onClick={() => handleSelectWeek(4)}
            style={{
              padding: '3px 9px',
              borderRadius: '6px',
              border: `1px solid ${selectedWeek === 4 ? 'var(--studio-primary)' : 'var(--studio-border)'}`,
              backgroundColor: selectedWeek === 4 ? 'var(--studio-primary-glow)' : 'transparent',
              color: selectedWeek === 4 ? 'var(--studio-primary)' : 'var(--studio-text)',
              fontWeight: 600,
              fontSize: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Week 4: Database & EXPLAIN Lab
          </button>
        </div>

        {/* Header Right Tools: Theme & Sunday Queue & Bridge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Tag variant={bridgeStatus.connected ? "success" : "default"} size="small">
            <Server size={12} style={{ marginRight: '4px' }} />
            {bridgeStatus.connected ? "Tier 3 Bridge Active" : "Bridge Offline"}
          </Tag>

          <Tag variant={sundayCount > 0 ? "warning" : "default"} size="small">
            <Flag size={12} style={{ marginRight: '4px' }} />
            Sunday Review ({sundayCount})
          </Tag>

          <Button 
            id="theme-toggle-btn"
            variant="default-outline" 
            size="small" 
            onClick={() => setIsDark(!isDark)}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun size={13} style={{ marginRight: '4px' }} /> : <Moon size={13} style={{ marginRight: '4px' }} />}
            {isDark ? "Light" : "Dark"}
          </Button>

          <Button variant="default-outline" size="small" onClick={handleExportBackup} aria-label="Export backup JSON">
            <Download size={13} />
          </Button>

          <Button variant="default-outline" size="small" onClick={handleImportBackup} aria-label="Import backup JSON">
            <Upload size={13} />
          </Button>
        </div>
      </header>

      {/* Dismissible Backup Import / Restore Notice */}
      {importNotice && (
        <div style={{ padding: '0.5rem 1.25rem', backgroundColor: 'var(--studio-surface-subtle)', borderBottom: '1px solid var(--studio-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1200px', margin: '0 auto' }}>
            <span style={{ fontSize: '0.8125rem', color: importNotice.type === 'success' ? 'var(--studio-success)' : 'var(--studio-danger)' }}>
              {importNotice.text}
            </span>
            <Button variant="default-outline" size="small" onClick={() => setImportNotice(null)} aria-label="Dismiss notice">
              <X size={12} />
            </Button>
          </div>
        </div>
      )}

      {/* Progressive 5-Step Stepper Navigation with Sequential Gating */}
      <nav aria-label="Progressive 5-step workflow" className="studio-stepper">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '650px' }}>
          {WORKFLOW_STEPS.map((s) => {
            const isActive = s.step === currentStep;
            const isCompleted = s.step < currentStep;
            const maxAccessibleStep = drillCompleted ? 5 : 2;
            const isLocked = s.step > maxAccessibleStep || s.step > highestStepReached + 1;

            return (
              <button
                key={s.step}
                id={`step-tab-${s.step}`}
                type="button"
                disabled={isLocked}
                onClick={() => {
                  if (!isLocked) {
                    goToStep(s.step);
                  } else {
                    setPoliteNotice('Complete earlier drill prerequisites to unlock subsequent steps.');
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  border: `1px solid ${isActive ? 'var(--studio-primary)' : 'var(--studio-border)'}`,
                  backgroundColor: isActive ? 'var(--studio-primary)' : isCompleted ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: isActive ? '#ffffff' : isCompleted ? 'var(--studio-success)' : isLocked ? 'var(--studio-text-muted)' : 'var(--studio-text)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  opacity: isLocked ? 0.6 : 1,
                  transition: 'all 0.15s ease'
                }}
                aria-current={isActive ? 'step' : undefined}
                title={isLocked ? "Complete earlier drill steps to unlock" : s.description}
              >
                <span style={{ 
                  width: '16px', 
                  height: '16px', 
                  borderRadius: '50%', 
                  backgroundColor: isActive ? '#ffffff' : isCompleted ? 'var(--studio-success)' : 'var(--studio-surface-hover)',
                  color: isActive ? 'var(--studio-primary)' : isCompleted ? '#ffffff' : 'var(--studio-text-muted)',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700
                }}>
                  {isLocked ? <Lock size={10} /> : isCompleted && !isActive ? '✓' : s.step}
                </span>
                <span>{s.title}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Studio Body Area */}
      <main className="studio-main">
        
        {/* STEP 1: Concept Brief */}
        {currentStep === 1 && (
          <div className="studio-scrollable-step">
            <div style={{ maxWidth: '860px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Callout variant="info">
                <CalloutTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BookOpen size={18} color="var(--studio-primary)" />
                  Step 1: Concept Brief • {activeDrill.title}
                </CalloutTitle>
                <CalloutContent>
                  {activeDrill.conceptBrief.thesis}
                </CalloutContent>
              </Callout>

              {/* Key Checkpoints Card */}
              <div style={{ padding: '1.125rem', borderRadius: '8px', border: '1px solid var(--studio-border)', backgroundColor: 'var(--studio-surface)' }}>
                <h3 style={{ margin: '0 0 0.625rem 0', fontSize: '0.9375rem', color: 'var(--studio-text)' }}>
                  Core Architectural Checkpoints:
                </h3>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.55, fontSize: '0.8125rem', color: 'var(--studio-text-muted)' }}>
                  {activeDrill.conceptBrief.keyPoints.map((pt, i) => (
                    <li key={i} style={{ marginBottom: '0.35rem' }}>{pt}</li>
                  ))}
                </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
                <Button variant="primary-fill" size="medium" onClick={() => goToStep(2)}>
                  Proceed to Step 2: Focused Drill
                  <ChevronRight size={16} style={{ marginLeft: '4px' }} />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Focused Code Drill (Monaco Editor & Run Controls) */}
        {currentStep === 2 && (
          <div className="studio-drill-container">
            
            {activeDrill.week === 1 ? (
              /* Week 1: Laravel PostController N+1 Drill - Resizable Split Panels */
              <Group orientation="horizontal" style={{ height: '100%', width: '100%' }}>
                
                {/* Left Panel: Drill Mission Briefing, Rules & Insights */}
                <Panel defaultSize="38%" minSize="25%" maxSize="55%" style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                  <div className="studio-drill-sidebar" style={{ height: '100%', overflowY: 'auto' }}>
                    {/* Mission Header */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                        <Tag variant="primary" size="small">Tier 2 Simulation</Tag>
                        <Tag variant="warning" size="small">Budget: ≤ 3 Queries</Tag>
                      </div>
                      <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: 'var(--studio-text)', fontWeight: 700 }}>
                        Eliminate Eloquent N+1 Loop
                      </h3>
                      <div style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)', lineHeight: 1.45 }}>
                        Refactor <code>PostController::index()</code> to collapse catastrophic database multiplication.
                      </div>
                    </div>

                    {/* Bug Diagnosis Box */}
                    <div style={{ 
                      padding: '0.625rem 0.75rem', 
                      borderRadius: '6px', 
                      backgroundColor: 'rgba(239, 68, 68, 0.08)', 
                      borderLeft: '4px solid var(--studio-danger)',
                      fontSize: '0.75rem',
                      color: 'var(--studio-text)'
                    }}>
                      <strong style={{ color: 'var(--studio-danger)', display: 'block', marginBottom: '2px' }}>
                        ⚠️ The Performance Bottleneck:
                      </strong>
                      <div style={{ lineHeight: 1.45, color: 'var(--studio-text-muted)' }}>
                        <code>Post::all()</code> fetches 25 records. Inside the <code>map()</code> loop, accessing <code>$post-&gt;author-&gt;name</code> and <code>$post-&gt;comments-&gt;count()</code> executes 2 queries per row.
                        <br />
                        <strong>Total: 1 + 25 + 25 = 51 database roundtrips!</strong>
                      </div>
                    </div>

                    {/* Task Instructions */}
                    <div style={{ fontSize: '0.75rem', color: 'var(--studio-text)' }}>
                      <strong style={{ display: 'block', marginBottom: '4px' }}>Your Objective:</strong>
                      <ol style={{ margin: 0, paddingLeft: '1.125rem', lineHeight: 1.5, color: 'var(--studio-text-muted)', fontSize: '0.75rem' }}>
                        <li style={{ marginBottom: '2px' }}>Replace <code>Post::all()</code> with eager loading: <code>Post::with([...])-&gt;get()</code>.</li>
                        <li style={{ marginBottom: '2px' }}>Pre-load both <code>author</code> and <code>comments</code> relationships in a single batch.</li>
                        <li>Click <strong>Run Test Harness</strong> to evaluate against query budget & heuristic simulation.</li>
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
                        <li>Query budget: ≤ 3 distinct queries for 25 records</li>
                        <li>Zero per-row queries during <code>map()</code> iteration</li>
                        <li><code>author</code> relationship eager loaded</li>
                        <li><code>comments</code> relationship eager loaded</li>
                      </ul>
                    </div>

                    {/* Senior Defense Tip */}
                    <div style={{ 
                      padding: '0.625rem 0.75rem', 
                      borderRadius: '6px', 
                      backgroundColor: 'var(--studio-primary-glow)', 
                      borderLeft: '3px solid var(--studio-primary)',
                      fontSize: '0.75rem',
                      lineHeight: 1.45
                    }}>
                      <strong style={{ color: 'var(--studio-primary)', display: 'block', marginBottom: '2px' }}>
                        Interview Defense Note:
                      </strong>
                      <span style={{ color: 'var(--studio-text)' }}>
                        In high-scale production, Laravel 12's <code>Model::preventLazyLoading()</code> enforces strict eager loading during development, throwing exceptions before code enters staging.
                      </span>
                    </div>

                  </div>
                </Panel>

                <Separator style={{ width: '6px', cursor: 'col-resize', backgroundColor: 'var(--studio-border)' }} />

                {/* Right Panel: Monaco Code Editor Pane */}
                <Panel defaultSize="62%" minSize="45%" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div className="studio-drill-editor-pane" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* Control Bar */}
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
                        <FileCode size={16} color="var(--studio-primary)" />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--studio-text)' }}>
                          <code>{activeDrill.targetFile}</code>
                        </span>
                        <Tag variant="primary" size="small">PHP 8.3 (Eloquent Testbed Prototype)</Tag>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Button 
                          variant="default-outline" 
                          size="small"
                          onClick={() => setUserCode(activeDrill.initialCode)}
                          aria-label="Reset code to original"
                        >
                          <RotateCcw size={12} style={{ marginRight: '4px' }} />
                          Reset Code
                        </Button>

                        {bridgeStatus.connected && (
                          <Button 
                            id="run-docker-btn"
                            variant="primary-outline" 
                            size="small"
                            onClick={handleRunTier3Docker}
                            disabled={isRunningDocker}
                            aria-label="Verify via Tier 3 Docker Runner"
                          >
                            <Server size={12} style={{ marginRight: '4px' }} />
                            {isRunningDocker ? "Running Docker..." : "Run in Docker (Tier 3)"}
                          </Button>
                        )}

                        <Button 
                          id="run-harness-btn"
                          variant="primary-fill" 
                          size="small"
                          onClick={handleRunDrill}
                          disabled={isEvaluating}
                          aria-label="Run test harness"
                        >
                          <Play size={12} style={{ marginRight: '4px' }} />
                          {isEvaluating ? "Evaluating..." : "Run Test Harness"}
                        </Button>
                      </div>
                    </div>

                    {/* Editor Container with Flexible Fit & automaticLayout */}
                    <div className="studio-drill-editor-wrapper">
                      <Editor
                        height="100%"
                        defaultLanguage="php"
                        theme={isDark ? "vs-dark" : "light"}
                        value={userCode}
                        onChange={(val) => setUserCode(val || '')}
                        options={{
                          fontSize: 13,
                          lineNumbers: 'on',
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          wordWrap: 'on',
                          tabSize: 4,
                          automaticLayout: true,
                        }}
                      />
                    </div>

                    {/* Status Bar */}
                    <div style={{ 
                      padding: '0.35rem 0.75rem', 
                      borderTop: '1px solid var(--studio-border)', 
                      fontSize: '0.75rem', 
                      color: 'var(--studio-text-muted)',
                      backgroundColor: 'var(--studio-surface-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexShrink: 0
                    }}>
                      <span>Target: <code>Post::with(['author', 'comments'])-&gt;get()</code></span>
                      <span>Click <strong>Run Test Harness</strong> or <strong>Run in Docker</strong></span>
                    </div>

                  </div>
                </Panel>

              </Group>
            ) : (
              /* Week 4: In-Browser SQLite Query Plan Lab */
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {bridgeStatus.connected && (
                  <div style={{ 
                    padding: '0.4rem 0.875rem', 
                    borderBottom: '1px solid var(--studio-border)', 
                    backgroundColor: 'var(--studio-surface)',
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
                      onCodeChange={(newSql) => setUserCode(newSql)}
                      onVersionDetected={(ver) => setRuntimeSqlVersion(ver)}
                      onExecutionComplete={(passed) => {
                        if (passed) {
                          setVerificationSource('simulation');
                          setDrillCompleted(true);
                          saveDrillProgress(activeDrill.id, true, true, 'simulation');
                          goToStep(3);
                        }
                      }}
                    />
                  </Suspense>
                </div>
              </div>
            )}

            <div className="studio-step-actions">
              <Button variant="default-outline" size="small" onClick={() => goToStep(1)}>
                <ChevronLeft size={14} style={{ marginRight: '4px' }} />
                Back to Concept
              </Button>
              <Button variant="primary-fill" size="small" onClick={() => goToStep(3)}>
                Go to Step 3: Plan Analysis
                <ChevronRight size={14} style={{ marginLeft: '4px' }} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Plan & Assertion Analysis */}
        {currentStep === 3 && (
          <div className="studio-scrollable-step">
            <div style={{ maxWidth: '860px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.0625rem', color: 'var(--studio-text)' }}>
                Step 3: Verification & Assertion Output
              </h3>

              {/* Tier 3 Canonical Docker Runtime Output Card */}
              {tier3Result && (
                <div style={{ 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  border: `1px solid ${tier3Result.exitCode === 0 ? 'var(--studio-success)' : 'var(--studio-danger)'}`, 
                  backgroundColor: 'var(--studio-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Tag variant={tier3Result.exitCode === 0 ? "success" : "danger"} size="small">
                        {tier3Result.exitCode === 0 ? "Tier 3: [PostgreSQL Runtime Passed]" : "Tier 3: [Failed]"}
                      </Tag>
                      <strong style={{ fontSize: '0.875rem', color: 'var(--studio-text)' }}>
                        syscraft-runner:1.0.0 (Isolated Docker syscraft-testnet)
                      </strong>
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--studio-text-muted)' }}>
                      Verified: {new Date(tier3Result.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <pre style={{
                    margin: 0,
                    padding: '0.875rem',
                    borderRadius: '6px',
                    backgroundColor: 'var(--studio-surface-subtle)',
                    border: '1px solid var(--studio-border)',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    lineHeight: 1.45,
                    overflowX: 'auto',
                    color: 'var(--studio-text)',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {/* eslint-disable-next-line no-control-regex */}
                    {(tier3Result.stdout || '').replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')}
                  </pre>
                </div>
              )}

              {testResults ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <Callout variant={testResults.passed ? "success" : "danger"}>
                    <CalloutTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {testResults.passed ? <CheckCircle2 size={18} color="var(--studio-success)" /> : <AlertCircle size={18} color="var(--studio-danger)" />}
                      {testResults.passed ? "All Assertions Passed • Zero N+1 Queries" : "Query Budget Violation • N+1 Queries Detected"}
                    </CalloutTitle>
                    <CalloutContent>
                      Simulated execution time: ~{testResults.simulatedLatencyMs}ms • Queries Executed: {testResults.queriesExecuted} queries.
                    </CalloutContent>
                  </Callout>

                  {/* Assertion List Card */}
                  <div style={{ padding: '1rem', borderRadius: '8px', border: '1px solid var(--studio-border)', backgroundColor: 'var(--studio-surface)' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--studio-text)' }}>
                      EVALUATED ASSERTIONS:
                    </div>
                    {testResults.assertionResults.map((a: any, i: number) => (
                      <div key={i} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '0.45rem 0.75rem',
                        borderRadius: '4px',
                        backgroundColor: 'var(--studio-surface-subtle)',
                        marginBottom: '0.375rem',
                        fontSize: '0.8125rem',
                        color: 'var(--studio-text)'
                      }}>
                        <span>{a.name} — <span style={{ color: 'var(--studio-text-muted)' }}>{a.message}</span></span>
                        <Tag variant={a.passed ? "success" : "danger"} size="small">
                          {a.passed ? "PASS" : "FAIL"}
                        </Tag>
                      </div>
                    ))}
                  </div>
                </div>
              ) : !tier3Result ? (
                <Callout variant="warning">
                  <CalloutTitle>No test run recorded yet</CalloutTitle>
                  <CalloutContent>Return to Step 2 and click "Run Test Harness" or "Run in Docker" to evaluate your code.</CalloutContent>
                </Callout>
              ) : null}

              <div className="studio-step-actions">
                <Button variant="default-outline" size="small" onClick={() => goToStep(2)}>
                  <ChevronLeft size={14} style={{ marginRight: '4px' }} />
                  Back to Code Drill
                </Button>
                <Button variant="primary-fill" size="small" onClick={() => goToStep(4)}>
                  Proceed to Step 4: Oral Recall
                  <ChevronRight size={14} style={{ marginLeft: '4px' }} />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Scored Oral Recall Rubric */}
        {currentStep === 4 && (
          <div className="studio-scrollable-step">
            <div style={{ maxWidth: '860px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <OralRubricDialog
                drillId={activeDrill.id}
                week={activeDrill.week}
                topic={activeDrill.title}
                question={activeDrill.oralRubric.question}
                checkpoints={activeDrill.oralRubric.checkpoints}
                onCompleted={() => {
                  refreshProgress();
                }}
              />

              <div className="studio-step-actions">
                <Button variant="default-outline" size="small" onClick={() => goToStep(3)}>
                  <ChevronLeft size={14} style={{ marginRight: '4px' }} />
                  Back to Assertions
                </Button>
                <Button variant="primary-fill" size="small" onClick={() => goToStep(5)}>
                  Proceed to Step 5: Tracer Replay
                  <ChevronRight size={14} style={{ marginLeft: '4px' }} />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Visual Tracer Replay */}
        {currentStep === 5 && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', overflow: 'hidden' }}>
            <div style={{ 
              padding: '0.5rem 0.875rem', 
              borderRadius: '6px', 
              backgroundColor: 'var(--studio-surface)', 
              border: '1px solid var(--studio-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}>
              <div>
                <strong style={{ fontSize: '0.8125rem', color: 'var(--studio-text)' }}>
                  {activeDrill.week === 1 
                    ? 'Step 5: Visual HTTP Request Lifecycle Tracer' 
                    : 'Step 5: Visual B-Tree Compound Index & Query Execution Tracer'}
                </strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)', display: 'block' }}>
                  {activeDrill.week === 1
                    ? 'Interactive state machine visualizing the Laravel request journey from HTTP ingress to terminating middleware.'
                    : 'Interactive state machine visualizing the SQLite storage engine B-Tree index traversal, key seek, and early LIMIT exit.'}
                </span>
              </div>
              <Tag variant={activeDrill.week === 1 ? "primary" : "success"} size="small">
                {activeDrill.week === 1 ? "Week 1: Laravel Internals" : "Week 4: Storage Engine"}
              </Tag>
            </div>

            <div style={{ flex: 1, minHeight: 0, borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--studio-border)' }}>
              <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--studio-text-muted)' }}>Loading Lifecycle Tracer...</div>}>
                <LifecycleTracer 
                  steps={activeDrill.week === 1 ? LARAVEL_LIFECYCLE_STEPS : BTREE_INDEX_TRACER_STEPS}
                  engineBadge={activeDrill.week === 1 ? "Tier 2: Deterministic Simulation" : `Tier 1: SQLite ${runtimeSqlVersion} (WASM Engine)`}
                  badgeVariant={activeDrill.week === 1 ? "primary" : "success"}
                  packetName={activeDrill.week === 1 ? "Active Ingress Packet" : "Active Cursor Pointer"}
                />
              </Suspense>
            </div>

            <div className="studio-step-actions">
              <Button variant="default-outline" size="small" onClick={() => goToStep(4)}>
                <ChevronLeft size={14} style={{ marginRight: '4px' }} />
                Back to Oral Rubric
              </Button>
            </div>
          </div>
        )}

      </main>

      {/* Bottom Status Footer with Engine Badges & Invariants */}
      <footer className="studio-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Tag variant={tier3Result && tier3Result.exitCode === 0 ? "success" : activeDrill.week === 1 ? "primary" : "success"} size="small">
            {tier3Result && tier3Result.exitCode === 0 
              ? "[Tier 3: PostgreSQL 16.4 Runtime Passed]"
              : activeDrill.week === 1 
                ? "[Tier 2: Deterministic Simulation]" 
                : `[Engine: SQLite ${runtimeSqlVersion} (WASM)]`}
          </Tag>
          <Tag variant={drillCompleted ? "success" : "default"} size="small">
            {drillCompleted 
              ? (verificationSource === 'local-runtime' ? "PostgreSQL Runtime Passed" : "Simulation Passed") 
              : "In Progress"}
          </Tag>
          <Tag variant={bridgeStatus.connected ? "success" : "default"} size="small">
            {bridgeStatus.connected ? "Bridge: 127.0.0.1:49152 (Online)" : "Bridge: Offline"}
          </Tag>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>Runner: <strong>PHP 8.3.11 / PostgreSQL 16.4 (Testbed Prototype)</strong></span>
          <span>MYDS Standards Compliant</span>
          <span>Tab/Esc Navigation Enabled</span>
        </div>
      </footer>

    </div>
  );
}
