import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
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
  ChevronLeft
} from 'lucide-react';
import { WORKFLOW_STEPS, type WorkflowStep, type DrillDefinition } from '../../types';
import { WEEK_1_DRILL, evaluateLaravelDrill } from '../../drills/week1-internals';
import { WEEK_4_DRILL } from '../../drills/week4-performance';
import { LifecycleTracer } from '../tracer/LifecycleTracer';
import { QueryPlanLab } from '../database/QueryPlanLab';
import { OralRubricDialog } from '../rubric/OralRubricDialog';
import { 
  saveDrillProgress, 
  getDrillProgress, 
  getSundayHesitations, 
  exportEnvelopeJSON, 
  importEnvelopeJSON 
} from '../../services/storage';

export function StudioLayout() {
  const [isDark, setIsDark] = useState<boolean>(true);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(1);
  
  // Drill State
  const activeDrill: DrillDefinition = selectedWeek === 1 ? WEEK_1_DRILL : WEEK_4_DRILL;
  const [userCode, setUserCode] = useState<string>(activeDrill.initialCode);
  const [testResults, setTestResults] = useState<any>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [drillCompleted, setDrillCompleted] = useState<boolean>(false);
  const [sundayCount, setSundayCount] = useState<number>(0);
  const [politeNotice, setPoliteNotice] = useState<string>('');

  // Sync theme
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Load drill progress & Sunday count
  const loadState = async () => {
    const prog = await getDrillProgress(activeDrill.id);
    if (prog) {
      setDrillCompleted(prog.completed);
    } else {
      setDrillCompleted(false);
    }
    const hes = await getSundayHesitations();
    setSundayCount(hes.length);
  };

  useEffect(() => {
    setUserCode(activeDrill.initialCode);
    setTestResults(null);
    setCurrentStep(1);
    loadState();
  }, [selectedWeek]);

  // Evaluate Drill Code
  const handleRunDrill = async () => {
    setIsEvaluating(true);
    setPoliteNotice('Evaluating drill assertions...');

    if (activeDrill.week === 1) {
      // Week 1 Laravel AST Evaluation
      const evalResult = evaluateLaravelDrill(userCode);
      setTestResults(evalResult);
      if (evalResult.passed) {
        setDrillCompleted(true);
        await saveDrillProgress(activeDrill.id, true, true);
        setPoliteNotice('All assertions passed! Query budget satisfied with zero per-row queries.');
      } else {
        setPoliteNotice('Assertion failure: N+1 query loop detected.');
      }
      setCurrentStep(3); // Auto-advance to Step 3 (Plan & Assertion Analysis)
    }

    setIsEvaluating(false);
    loadState();
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

  // Import Envelope Backup
  const handleImportBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const text = await file.text();
        const res = await importEnvelopeJSON(text);
        alert(res.message);
        loadState();
      }
    };
    input.click();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-washed, #0b0f17)' }}>
      
      {/* Screen Reader Polite Live Region */}
      <div 
        role="status" 
        aria-live="polite" 
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
      >
        {politeNotice}
      </div>

      {/* Top Masthead & Curriculum Selector Bar */}
      <header style={{ 
        borderBottom: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))', 
        backgroundColor: 'var(--bg-white, #ffffff)', 
        padding: '0.625rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        {/* Brand & Studio ID */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ 
            width: '30px', 
            height: '30px', 
            borderRadius: '6px', 
            backgroundColor: '#0284c7', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '13px'
          }}>
            SC
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', letterSpacing: '-0.02em' }}>
              SysCraft Studio
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--txt-black-500, #64748b)' }}>
              Interactive Systems & Backend Learning Studio
            </div>
          </div>
        </div>

        {/* Curriculum Module Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--txt-black-500, #64748b)' }}>Module:</span>
          
          <button
            type="button"
            onClick={() => setSelectedWeek(1)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: `1px solid ${selectedWeek === 1 ? '#0284c7' : 'var(--border-washed, rgba(148, 163, 184, 0.3))'}`,
              backgroundColor: selectedWeek === 1 ? 'rgba(2, 132, 199, 0.15)' : 'transparent',
              color: selectedWeek === 1 ? '#0284c7' : 'var(--txt-black-800, #1e293b)',
              fontWeight: 600,
              fontSize: '0.8125rem',
              cursor: 'pointer'
            }}
          >
            Week 1: Laravel Internals
          </button>

          <button
            type="button"
            onClick={() => setSelectedWeek(4)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: `1px solid ${selectedWeek === 4 ? '#0284c7' : 'var(--border-washed, rgba(148, 163, 184, 0.3))'}`,
              backgroundColor: selectedWeek === 4 ? 'rgba(2, 132, 199, 0.15)' : 'transparent',
              color: selectedWeek === 4 ? '#0284c7' : 'var(--txt-black-800, #1e293b)',
              fontWeight: 600,
              fontSize: '0.8125rem',
              cursor: 'pointer'
            }}
          >
            Week 4: Database & EXPLAIN Lab
          </button>
        </div>

        {/* Header Right Tools: Theme & Sunday Queue */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Tag variant={sundayCount > 0 ? "warning" : "default"} size="small">
            <Flag size={12} style={{ marginRight: '4px' }} />
            Sunday Review ({sundayCount})
          </Tag>

          <Button 
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

      {/* Progressive 5-Step Stepper Navigation */}
      <nav aria-label="Progressive 5-step workflow" style={{ 
        borderBottom: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))', 
        backgroundColor: 'var(--bg-white, #ffffff)', 
        padding: '0.5rem 1.25rem',
        overflowX: 'auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '700px' }}>
          {WORKFLOW_STEPS.map((s) => {
            const isActive = s.step === currentStep;
            const isCompleted = s.step < currentStep || (s.step === 2 && drillCompleted);

            return (
              <button
                key={s.step}
                type="button"
                onClick={() => setCurrentStep(s.step)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '5px 10px',
                  borderRadius: '20px',
                  border: `1px solid ${isActive ? '#0284c7' : 'var(--border-washed, rgba(148, 163, 184, 0.2))'}`,
                  backgroundColor: isActive ? '#0284c7' : isCompleted ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  color: isActive ? '#ffffff' : isCompleted ? '#059669' : 'var(--txt-black-700, #334155)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                aria-current={isActive ? 'step' : undefined}
              >
                <span style={{ 
                  width: '18px', 
                  height: '18px', 
                  borderRadius: '50%', 
                  backgroundColor: isActive ? '#ffffff' : isCompleted ? '#10b981' : 'var(--bg-contrast, rgba(0,0,0,0.06))',
                  color: isActive ? '#0284c7' : isCompleted ? '#ffffff' : 'var(--txt-black-600, #475569)',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700
                }}>
                  {isCompleted && !isActive ? '✓' : s.step}
                </span>
                <span>{s.title}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Studio Body Area */}
      <main style={{ flex: 1, padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* STEP 1: Concept Brief */}
        {currentStep === 1 && (
          <div style={{ maxWidth: '900px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Callout variant="info">
              <CalloutTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={18} color="#0284c7" />
                Step 1: Concept Brief • {activeDrill.title}
              </CalloutTitle>
              <CalloutContent>
                {activeDrill.conceptBrief.thesis}
              </CalloutContent>
            </Callout>

            {/* Key Checkpoints Card */}
            <div style={{ padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))', backgroundColor: 'var(--bg-white, #ffffff)' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: 'var(--txt-black-900, #0f172a)' }}>
                Core Architectural Checkpoints:
              </h3>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.6, fontSize: '0.875rem', color: 'var(--txt-black-700, #334155)' }}>
                {activeDrill.conceptBrief.keyPoints.map((pt, i) => (
                  <li key={i} style={{ marginBottom: '0.375rem' }}>{pt}</li>
                ))}
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary-fill" size="medium" onClick={() => setCurrentStep(2)}>
                Proceed to Step 2: Focused Drill
                <ChevronRight size={16} style={{ marginLeft: '4px' }} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Focused Code Drill (Monaco Editor & Run Controls) */}
        {currentStep === 2 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            
            {activeDrill.week === 1 ? (
              /* Week 1: Laravel PostController N+1 Drill */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                
                {/* Control Bar */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-white, #ffffff)',
                  border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileCode size={16} color="#0284c7" />
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}><code>{activeDrill.targetFile}</code></span>
                    <Tag variant="primary" size="small">PHP 8.3 / Laravel 12</Tag>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Button 
                      variant="default-outline" 
                      size="small"
                      onClick={() => setUserCode(activeDrill.initialCode)}
                    >
                      <RotateCcw size={12} style={{ marginRight: '4px' }} />
                      Reset Code
                    </Button>

                    <Button 
                      variant="primary-fill" 
                      size="small"
                      onClick={handleRunDrill}
                      disabled={isEvaluating}
                    >
                      <Play size={12} style={{ marginRight: '4px' }} />
                      {isEvaluating ? "Evaluating..." : "Run Test Harness"}
                    </Button>
                  </div>
                </div>

                {/* Editor Container */}
                <div style={{ 
                  flex: 1, 
                  minHeight: '420px', 
                  border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))', 
                  borderRadius: '8px', 
                  overflow: 'hidden' 
                }}>
                  <Editor
                    height="100%"
                    defaultLanguage="php"
                    theme="vs-dark"
                    value={userCode}
                    onChange={(val) => setUserCode(val || '')}
                    options={{
                      fontSize: 13,
                      lineNumbers: 'on',
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                    }}
                  />
                </div>
              </div>
            ) : (
              /* Week 4: In-Browser SQLite Query Plan Lab */
              <div style={{ flex: 1 }}>
                <QueryPlanLab 
                  onExecutionComplete={(passed) => {
                    if (passed) {
                      setDrillCompleted(true);
                      saveDrillProgress(activeDrill.id, true, true);
                    }
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <Button variant="default-outline" size="small" onClick={() => setCurrentStep(1)}>
                <ChevronLeft size={14} style={{ marginRight: '4px' }} />
                Back to Concept
              </Button>
              <Button variant="primary-fill" size="small" onClick={() => setCurrentStep(3)}>
                Go to Step 3: Plan Analysis
                <ChevronRight size={14} style={{ marginLeft: '4px' }} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Plan & Assertion Analysis */}
        {currentStep === 3 && (
          <div style={{ maxWidth: '900px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.125rem' }}>
              Step 3: Verification & Assertion Output
            </h3>

            {testResults ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Callout variant={testResults.passed ? "success" : "danger"}>
                  <CalloutTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {testResults.passed ? <CheckCircle2 size={18} color="#10b981" /> : <AlertCircle size={18} color="#ef4444" />}
                    {testResults.passed ? "All Assertions Passed • Zero N+1 Queries" : "Query Budget Violation • N+1 Queries Detected"}
                  </CalloutTitle>
                  <CalloutContent>
                    Simulated execution time: ~{testResults.simulatedLatencyMs}ms • Queries Executed: {testResults.queriesExecuted} queries.
                  </CalloutContent>
                </Callout>

                {/* Assertion List Card */}
                <div style={{ padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))', backgroundColor: 'var(--bg-white, #ffffff)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    EVALUATED ASSERTIONS:
                  </div>
                  {testResults.assertionResults.map((a: any, i: number) => (
                    <div key={i} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-contrast, rgba(0,0,0,0.02))',
                      marginBottom: '0.375rem',
                      fontSize: '0.8125rem'
                    }}>
                      <span>{a.name} — <span style={{ color: 'var(--txt-black-600, #475569)' }}>{a.message}</span></span>
                      <Tag variant={a.passed ? "success" : "danger"} size="small">
                        {a.passed ? "PASS" : "FAIL"}
                      </Tag>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Callout variant="warning">
                <CalloutTitle>No test run recorded yet</CalloutTitle>
                <CalloutContent>Return to Step 2 and click "Run Test Harness" to evaluate your code.</CalloutContent>
              </Callout>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
              <Button variant="default-outline" size="small" onClick={() => setCurrentStep(2)}>
                <ChevronLeft size={14} style={{ marginRight: '4px' }} />
                Back to Code Drill
              </Button>
              <Button variant="primary-fill" size="small" onClick={() => setCurrentStep(4)}>
                Proceed to Step 4: Oral Recall
                <ChevronRight size={14} style={{ marginLeft: '4px' }} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Scored Oral Recall Rubric */}
        {currentStep === 4 && (
          <div style={{ maxWidth: '900px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <OralRubricDialog
              drillId={activeDrill.id}
              week={activeDrill.week}
              topic={activeDrill.title}
              question={activeDrill.oralRubric.question}
              checkpoints={activeDrill.oralRubric.checkpoints}
              onCompleted={() => {
                loadState();
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <Button variant="default-outline" size="small" onClick={() => setCurrentStep(3)}>
                <ChevronLeft size={14} style={{ marginRight: '4px' }} />
                Back to Assertions
              </Button>
              <Button variant="primary-fill" size="small" onClick={() => setCurrentStep(5)}>
                Proceed to Step 5: Tracer Replay
                <ChevronRight size={14} style={{ marginLeft: '4px' }} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5: Visual Tracer Replay */}
        {currentStep === 5 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ 
              padding: '0.625rem 1rem', 
              borderRadius: '6px', 
              backgroundColor: 'var(--bg-white, #ffffff)', 
              border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <strong style={{ fontSize: '0.875rem' }}>Step 5: Visual System Tracer Replay</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--txt-black-500, #64748b)', display: 'block' }}>
                  Interactive state machine visualizing the request journey. Click any node to inspect internal variables and assumptions.
                </span>
              </div>
              <Tag variant="success" size="small">
                Review & Consolidate
              </Tag>
            </div>

            <div style={{ flex: 1, minHeight: '520px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))' }}>
              <LifecycleTracer />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.5rem' }}>
              <Button variant="default-outline" size="small" onClick={() => setCurrentStep(4)}>
                <ChevronLeft size={14} style={{ marginRight: '4px' }} />
                Back to Oral Rubric
              </Button>
            </div>
          </div>
        )}

      </main>

      {/* Bottom Status Footer with Engine Badges & Invariants */}
      <footer style={{ 
        borderTop: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))', 
        padding: '0.625rem 1.25rem',
        backgroundColor: 'var(--bg-white, #ffffff)',
        fontSize: '0.75rem',
        color: 'var(--txt-black-600, #475569)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Tag variant={activeDrill.week === 1 ? "primary" : "success"} size="small">
            {activeDrill.week === 1 ? "[Tier 2: Deterministic Simulation]" : "[Engine: SQLite 3.45.2 (WASM)]"}
          </Tag>
          <Tag variant={drillCompleted ? "success" : "default"} size="small">
            {drillCompleted ? "Automated Pass" : "In Progress"}
          </Tag>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>Target: <strong>Laravel 12.0.1 / PHP 8.3.11</strong></span>
          <span>MYDS Standards Compliant</span>
          <span>Tab/Esc Navigation Enabled</span>
        </div>
      </footer>

    </div>
  );
}
