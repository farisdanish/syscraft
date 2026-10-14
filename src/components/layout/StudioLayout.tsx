import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
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
  X,
  Trash2,
  Award,
  LayoutDashboard
} from 'lucide-react';
import { 
  WORKFLOW_STEPS, 
  type WorkflowStep, 
  type DrillDefinition,
  type DrillStepCompletions,
  type DrillSessionState,
  type TaskStatus
} from '../../types';
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
  importEnvelopeJSON,
  getDrillSession,
  saveDrillSession,
  getTaskState,
  saveTaskState,
  clearLearnerProgress
} from '../../services/storage';

const LifecycleTracer = lazy(() => 
  import('../tracer/LifecycleTracer').then(m => ({ default: m.LifecycleTracer }))
);
const QueryPlanLab = lazy(() => 
  import('../database/QueryPlanLab').then(m => ({ default: m.QueryPlanLab }))
);

export interface StudioLayoutProps {
  initialWeek?: number;
  onNavigateHome?: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export function StudioLayout({
  initialWeek = 1,
  onNavigateHome,
  isDark: propIsDark,
  onToggleTheme
}: StudioLayoutProps = {}) {
  const [internalDark, setInternalDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('syscraft-theme');
      return saved !== null ? saved === 'dark' : true;
    } catch {
      return true;
    }
  });

  const isDark = propIsDark !== undefined ? propIsDark : internalDark;
  const toggleTheme = () => {
    if (onToggleTheme) {
      onToggleTheme();
    } else {
      setInternalDark(prev => !prev);
    }
  };

  const [selectedWeek, setSelectedWeek] = useState<number>(initialWeek);
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(1);
  const [highestStepReached, setHighestStepReached] = useState<number>(1);
  const [stepCompletions, setStepCompletions] = useState<DrillStepCompletions>({
    1: false,
    2: false,
    3: false,
    4: false,
    5: false,
  });
  const [verificationSource, setVerificationSource] = useState<'simulation' | 'local-runtime' | 'self-reported'>('simulation');
  const [runtimeSqlVersion, setRuntimeSqlVersion] = useState<string>('3.45.2');

  // Drill State
  const activeDrill: DrillDefinition = selectedWeek === 1 ? WEEK_1_DRILL : WEEK_4_DRILL;
  const [userCode, setUserCode] = useState<string>(activeDrill.initialCode);
  const [testResults, setTestResults] = useState<any>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [drillCompleted, setDrillCompleted] = useState<boolean>(false);
  const [sundayCount, setSundayCount] = useState<number>(0);
  const [politeNotice, setPoliteNotice] = useState<string>('');
  const [importNotice, setImportNotice] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const cancelResetBtnRef = useRef<HTMLButtonElement | null>(null);
  const confirmResetBtnRef = useRef<HTMLButtonElement | null>(null);
  const clearTriggerBtnRef = useRef<HTMLButtonElement | null>(null);

  // Accessible Modal Keyboard Trap & Escape-to-Close
  useEffect(() => {
    if (!showResetModal) return;

    // Auto-focus Cancel button when modal opens
    const timer = setTimeout(() => {
      cancelResetBtnRef.current?.focus();
    }, 40);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowResetModal(false);
        clearTriggerBtnRef.current?.focus();
        return;
      }
      if (e.key === 'Tab') {
        const cancelBtn = cancelResetBtnRef.current;
        const confirmBtn = confirmResetBtnRef.current;
        if (!cancelBtn || !confirmBtn) return;

        if (e.shiftKey) {
          if (document.activeElement === cancelBtn) {
            e.preventDefault();
            confirmBtn.focus();
          }
        } else {
          if (document.activeElement === confirmBtn) {
            e.preventDefault();
            cancelBtn.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showResetModal]);

  // Tier 3 Bridge Daemon State
  const [bridgeStatus, setBridgeStatus] = useState<BridgeHealth>({ connected: false });
  const [tier3Result, setTier3Result] = useState<BridgeRunResult | null>(null);
  const [isRunningDocker, setIsRunningDocker] = useState<boolean>(false);

  // Sequential Step Unlock Predicate
  const isStepUnlocked = useCallback((step: WorkflowStep): boolean => {
    if (step === 1) return true;
    for (let k = 1; k < step; k++) {
      if (!stepCompletions[k as WorkflowStep]) {
        return false;
      }
    }
    return true;
  }, [stepCompletions]);

  const goToStep = useCallback((step: WorkflowStep) => {
    if (!isStepUnlocked(step)) {
      if (step === 2) setPoliteNotice('Step 2 is locked: Click "Proceed to Focused Drill" in Step 1 first.');
      else if (step === 3) setPoliteNotice('Step 3 is locked: Pass drill assertions in Step 2 to unlock Plan Analysis.');
      else if (step === 4) setPoliteNotice('Step 4 is locked: Confirm execution analysis in Step 3 to unlock Oral Defense.');
      else if (step === 5) setPoliteNotice('Step 5 is locked: Submit 5-dimension rubric in Step 4 to unlock Tracer Replay.');
      return;
    }
    setCurrentStep(step);
    setHighestStepReached(prev => Math.max(prev, step));

    // Persist active step in drill session
    void saveDrillSession({
      drillId: activeDrill.id,
      week: activeDrill.week,
      currentStep: step,
      highestStepReached: Math.max(highestStepReached, step),
      stepCompletions,
      draftCode: userCode,
      testResults,
      tier3Result,
      verificationSource,
      completed: drillCompleted,
      oralDefenseCompleted: stepCompletions[4],
      lastActiveAt: new Date().toISOString(),
    });
  }, [isStepUnlocked, activeDrill.id, activeDrill.week, highestStepReached, stepCompletions, userCode, testResults, tier3Result, verificationSource, drillCompleted]);

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

  // Load drill progress & Sunday count
  const refreshProgress = useCallback(async () => {
    const hes = await getSundayHesitations();
    setSundayCount(hes.length);
  }, []);

  // Initial Load & Session Rehydration for active drill
  useEffect(() => {
    let isMounted = true;
    const loadSession = async () => {
      const session = await getDrillSession(activeDrill.id);
      if (!isMounted) return;
      if (session) {
        setUserCode(session.draftCode);
        setCurrentStep(session.currentStep);
        setHighestStepReached(session.highestStepReached);
        setStepCompletions(session.stepCompletions);
        setTestResults(session.testResults);
        setTier3Result(session.tier3Result as BridgeRunResult | null);
        setVerificationSource(session.verificationSource);
        setDrillCompleted(session.completed);
      } else {
        // Fallback to legacy progress record if migrating
        const legacy = await getDrillProgress(activeDrill.id);
        if (legacy?.completed) {
          setUserCode(activeDrill.initialCode);
          setCurrentStep(1);
          setHighestStepReached(3);
          setStepCompletions({ 1: true, 2: true, 3: true, 4: false, 5: false });
          setTestResults(null);
          setTier3Result(null);
          setVerificationSource(legacy.verificationSource || 'simulation');
          setDrillCompleted(true);
        } else {
          setUserCode(activeDrill.initialCode);
          setCurrentStep(1);
          setHighestStepReached(1);
          setStepCompletions({ 1: false, 2: false, 3: false, 4: false, 5: false });
          setTestResults(null);
          setTier3Result(null);
          setVerificationSource('simulation');
          setDrillCompleted(false);
        }
      }
      const hes = await getSundayHesitations();
      if (isMounted) setSundayCount(hes.length);
    };
    loadSession();
    return () => {
      isMounted = false;
    };
  }, [activeDrill.id, activeDrill.initialCode]);

  // Auto-Save User Draft Code (Debounced 500ms)
  useEffect(() => {
    const timer = setTimeout(async () => {
      const existing = await getDrillSession(activeDrill.id);
      if (existing) {
        if (existing.draftCode !== userCode) {
          await saveDrillSession({
            ...existing,
            draftCode: userCode,
            lastActiveAt: new Date().toISOString(),
          });
        }
      } else {
        await saveDrillSession({
          drillId: activeDrill.id,
          week: activeDrill.week,
          currentStep,
          highestStepReached,
          stepCompletions,
          draftCode: userCode,
          testResults,
          tier3Result,
          verificationSource,
          completed: drillCompleted,
          oralDefenseCompleted: stepCompletions[4],
          lastActiveAt: new Date().toISOString(),
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [userCode, activeDrill.id, activeDrill.week, currentStep, highestStepReached, stepCompletions, testResults, tier3Result, verificationSource, drillCompleted]);

  // Non-Destructive Multi-Module Switching
  const handleSelectWeek = async (week: number) => {
    if (week === selectedWeek) return;

    // 1. Snapshot and save CURRENT drill's session
    const currentSession: DrillSessionState = {
      drillId: activeDrill.id,
      week: activeDrill.week,
      currentStep,
      highestStepReached,
      stepCompletions,
      draftCode: userCode,
      testResults,
      tier3Result,
      verificationSource,
      completed: drillCompleted,
      oralDefenseCompleted: stepCompletions[4],
      lastActiveAt: new Date().toISOString(),
    };
    await saveDrillSession(currentSession);

    // 2. Switch active definition
    setSelectedWeek(week);
    const nextDrill = week === 4 ? WEEK_4_DRILL : WEEK_1_DRILL;

    // 3. Load target drill's stored session from IndexedDB
    const targetSession = await getDrillSession(nextDrill.id);
    if (targetSession) {
      setUserCode(targetSession.draftCode);
      setCurrentStep(targetSession.currentStep);
      setHighestStepReached(targetSession.highestStepReached);
      setStepCompletions(targetSession.stepCompletions);
      setTestResults(targetSession.testResults);
      setTier3Result(targetSession.tier3Result as BridgeRunResult | null);
      setVerificationSource(targetSession.verificationSource);
      setDrillCompleted(targetSession.completed);
      setPoliteNotice(`Resumed session for ${nextDrill.title} at Step ${targetSession.currentStep}`);
    } else {
      const legacyProg = await getDrillProgress(nextDrill.id);
      if (legacyProg?.completed) {
        setUserCode(nextDrill.initialCode);
        setCurrentStep(1);
        setHighestStepReached(3);
        setStepCompletions({ 1: true, 2: true, 3: true, 4: false, 5: false });
        setTestResults(null);
        setTier3Result(null);
        setVerificationSource(legacyProg.verificationSource || 'simulation');
        setDrillCompleted(true);
      } else {
        setUserCode(nextDrill.initialCode);
        setCurrentStep(1);
        setHighestStepReached(1);
        setStepCompletions({ 1: false, 2: false, 3: false, 4: false, 5: false });
        setTestResults(null);
        setTier3Result(null);
        setVerificationSource('simulation');
        setDrillCompleted(false);
      }
    }
  };

  // Gate 1: Proceed from Step 1 (Concept Brief) to Step 2 (Focused Drill)
  const handleProceedFromConcept = async () => {
    const updated: DrillStepCompletions = { ...stepCompletions, 1: true };
    setStepCompletions(updated);
    setCurrentStep(2);
    setHighestStepReached(prev => Math.max(prev, 2));

    await saveDrillSession({
      drillId: activeDrill.id,
      week: activeDrill.week,
      currentStep: 2,
      highestStepReached: Math.max(highestStepReached, 2),
      stepCompletions: updated,
      draftCode: userCode,
      testResults,
      tier3Result,
      verificationSource,
      completed: drillCompleted,
      oralDefenseCompleted: updated[4],
      lastActiveAt: new Date().toISOString(),
    });

    // Mark task as in_progress if not already completed/verified
    const currentTask = await getTaskState(activeDrill.id);
    if (!currentTask || (currentTask.status !== 'completed' && currentTask.status !== 'verified')) {
      await saveTaskState({
        taskId: activeDrill.id,
        status: 'in_progress',
        attempts: currentTask?.attempts || 0,
        verificationSource,
        lastOpenedAt: new Date().toISOString(),
      });
    }
  };

  // Gate 2: Evaluate Drill Code (Tier 1/2 In-Browser Simulation)
  const handleRunDrill = async () => {
    setIsEvaluating(true);
    setPoliteNotice('Evaluating drill assertions via Tier 2 simulation...');

    if (activeDrill.week === 1) {
      const evalResult = evaluateLaravelDrill(userCode);
      setTestResults(evalResult);
      if (evalResult.passed) {
        const updated: DrillStepCompletions = { ...stepCompletions, 1: true, 2: true };
        setStepCompletions(updated);
        setVerificationSource('simulation');
        setDrillCompleted(false); // Step 2 passed, but full mastery requires all 5 steps

        const existingTask = await getTaskState(activeDrill.id);
        await saveTaskState({
          taskId: activeDrill.id,
          status: 'in_progress',
          attempts: (existingTask?.attempts ?? 0) + 1,
          verificationSource: 'simulation',
          lastOpenedAt: new Date().toISOString(),
        });

        await saveDrillProgress(activeDrill.id, false, false, 'simulation');
        await saveDrillSession({
          drillId: activeDrill.id,
          week: activeDrill.week,
          currentStep: 3,
          highestStepReached: Math.max(highestStepReached, 3),
          stepCompletions: updated,
          draftCode: userCode,
          testResults: evalResult,
          tier3Result,
          verificationSource: 'simulation',
          completed: false,
          oralDefenseCompleted: updated[4],
          lastActiveAt: new Date().toISOString(),
        });
        setPoliteNotice('All assertions passed! Query budget satisfied with zero per-row queries. Advancing to Plan Analysis.');
        setCurrentStep(3);
        setHighestStepReached(prev => Math.max(prev, 3));
      } else {
        setPoliteNotice('Assertion failure: N+1 query loop detected. Inspect required budget.');
      }
    }

    setIsEvaluating(false);
    refreshProgress();
  };

  // Gate 2: Run Tier 3 Canonical Test via Docker Bridge
  const handleRunTier3Docker = async () => {
    setIsRunningDocker(true);
    const commandId = activeDrill.week === 1 ? 'laravel-n1-test' : 'postgres-plan-test';
    const filename = activeDrill.week === 1 ? 'PostController.php' : 'weather_observations_idx.sql';
    setPoliteNotice(`Dispatching to Tier 3 Docker Runner (${commandId})...`);

    const result = await runBridgeCommand(commandId, userCode, filename);
    setTier3Result(result);
    setIsRunningDocker(false);

    if (result.passed) {
      const updated: DrillStepCompletions = { ...stepCompletions, 1: true, 2: true };
      setStepCompletions(updated);
      setVerificationSource('local-runtime');
      setDrillCompleted(false); // Step 2 passed, but full mastery requires all 5 steps

      const existingTask = await getTaskState(activeDrill.id);
      await saveTaskState({
        taskId: activeDrill.id,
        status: 'in_progress',
        attempts: (existingTask?.attempts ?? 0) + 1,
        verificationSource: 'local-runtime',
        lastOpenedAt: new Date().toISOString(),
      });

      await saveDrillProgress(activeDrill.id, false, false, 'local-runtime');
      await saveDrillSession({
        drillId: activeDrill.id,
        week: activeDrill.week,
        currentStep: 3,
        highestStepReached: Math.max(highestStepReached, 3),
        stepCompletions: updated,
        draftCode: userCode,
        testResults,
        tier3Result: result,
        verificationSource: 'local-runtime',
        completed: false,
        oralDefenseCompleted: updated[4],
        lastActiveAt: new Date().toISOString(),
      });
      setPoliteNotice(`Tier 3 Docker verification passed for ${activeDrill.title}. Advancing to Plan Analysis.`);
      setCurrentStep(3);
      setHighestStepReached(prev => Math.max(prev, 3));
    } else {
      setPoliteNotice('Tier 3 Docker test run failed assertions. Code remains unverified.');
    }
    refreshProgress();
  };

  // Gate 3: Confirm Analysis and Advance to Oral Defense
  const handleConfirmAnalysis = async () => {
    const updated: DrillStepCompletions = { ...stepCompletions, 3: true };
    setStepCompletions(updated);
    setCurrentStep(4);
    setHighestStepReached(prev => Math.max(prev, 4));

    await saveDrillSession({
      drillId: activeDrill.id,
      week: activeDrill.week,
      currentStep: 4,
      highestStepReached: Math.max(highestStepReached, 4),
      stepCompletions: updated,
      draftCode: userCode,
      testResults,
      tier3Result,
      verificationSource,
      completed: drillCompleted,
      oralDefenseCompleted: updated[4],
      lastActiveAt: new Date().toISOString(),
    });
    setPoliteNotice('Analysis confirmed! Step 4: Scored Oral Defense is now unlocked.');
  };

  // Gate 4: Oral Rubric Submission Callback
  const handleOralRubricCompleted = async () => {
    const updated: DrillStepCompletions = { ...stepCompletions, 4: true };
    setStepCompletions(updated);

    await saveDrillSession({
      drillId: activeDrill.id,
      week: activeDrill.week,
      currentStep: 4,
      highestStepReached: Math.max(highestStepReached, 5),
      stepCompletions: updated,
      draftCode: userCode,
      testResults,
      tier3Result,
      verificationSource,
      completed: drillCompleted,
      oralDefenseCompleted: true,
      lastActiveAt: new Date().toISOString(),
    });
    refreshProgress();
    setPoliteNotice('Oral recall scored and defended! Step 5: Tracer Replay is now unlocked.');
  };

  // Gate 5: Complete Drill Mastery (5/5)
  const handleCompleteMastery = async () => {
    const updated: DrillStepCompletions = { ...stepCompletions, 5: true };
    setStepCompletions(updated);
    setDrillCompleted(true);

    await saveDrillSession({
      drillId: activeDrill.id,
      week: activeDrill.week,
      currentStep: 5,
      highestStepReached: 5,
      stepCompletions: updated,
      draftCode: userCode,
      testResults,
      tier3Result,
      verificationSource,
      completed: true,
      oralDefenseCompleted: true,
      lastActiveAt: new Date().toISOString(),
    });

    await saveDrillProgress(
      activeDrill.id,
      true,
      verificationSource === 'local-runtime',
      verificationSource
    );

    const existingTask = await getTaskState(activeDrill.id);
    const status: TaskStatus = verificationSource === 'local-runtime' ? 'verified' : 'completed';
    await saveTaskState({
      taskId: activeDrill.id,
      status,
      attempts: (existingTask?.attempts ?? 0) + 1,
      verificationSource,
      completedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    });
    setPoliteNotice(`Drill mastered! All 5 stages completed for ${activeDrill.title}.`);
  };

  // Export Envelope Backup
  const handleExportBackup = async () => {
    const jsonStr = await exportEnvelopeJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `syscraft_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setImportNotice({ type: 'success', text: 'Backup envelope exported successfully.' });
  };

  // Import Envelope Backup
  const handleImportBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        const res = await importEnvelopeJSON(text);
        if (res.success) {
          setImportNotice({ type: 'success', text: res.message });
          refreshProgress();
          // Reload active drill session
          const session = await getDrillSession(activeDrill.id);
          if (session) {
            setUserCode(session.draftCode);
            setCurrentStep(session.currentStep);
            setHighestStepReached(session.highestStepReached);
            setStepCompletions(session.stepCompletions);
            setTestResults(session.testResults);
            setTier3Result(session.tier3Result as BridgeRunResult | null);
            setVerificationSource(session.verificationSource);
            setDrillCompleted(session.completed);
          }
        } else {
          setImportNotice({ type: 'danger', text: res.message });
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Distinct Reset Action: Clear Learner Progress
  const handleConfirmResetProgress = async () => {
    setShowResetModal(false);
    clearTriggerBtnRef.current?.focus();
    try {
      await clearLearnerProgress();
      setUserCode(activeDrill.initialCode);
      setCurrentStep(1);
      setHighestStepReached(1);
      setStepCompletions({ 1: false, 2: false, 3: false, 4: false, 5: false });
      setTestResults(null);
      setTier3Result(null);
      setVerificationSource('simulation');
      setDrillCompleted(false);
      await refreshProgress();
      setImportNotice({ type: 'success', text: 'All learner progress and drill sessions have been reset.' });
    } catch (err) {
      console.error('[storage] Failed to clear progress:', err);
      setImportNotice({ type: 'danger', text: 'Failed to reset progress: ' + (err instanceof Error ? err.message : String(err)) });
    }
  };

  return (
    <div className="studio-shell">
      {/* Top Application Header */}
      <header className="studio-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {onNavigateHome && (
            <Button
              id="back-to-hub-btn"
              variant="default-outline"
              size="small"
              onClick={onNavigateHome}
              aria-label="Return to Curriculum Hub"
              style={{ padding: '3px 8px', fontSize: '0.75rem' }}
            >
              <LayoutDashboard size={13} style={{ marginRight: '5px' }} />
              Hub
            </Button>
          )}
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
              SysCraft Studio
            </h1>
            <span style={{ fontSize: '0.6875rem', color: 'var(--studio-text-muted)' }}>
              Interactive Systems &amp; Backend Learning Studio
            </span>
          </div>

          <div style={{ marginLeft: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--studio-text-muted)' }}>Module:</span>
            
            <button
              id="select-week-1-btn"
              type="button"
              onClick={() => handleSelectWeek(1)}
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: selectedWeek === 1 ? 600 : 400,
                border: `1px solid ${selectedWeek === 1 ? 'var(--studio-primary)' : 'var(--studio-border)'}`,
                backgroundColor: selectedWeek === 1 ? 'var(--studio-primary-glow)' : 'transparent',
                color: selectedWeek === 1 ? 'var(--studio-primary)' : 'var(--studio-text)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              Week 1: Laravel Internals
            </button>

            <button
              id="select-week-4-btn"
              type="button"
              onClick={() => handleSelectWeek(4)}
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: selectedWeek === 4 ? 600 : 400,
                border: `1px solid ${selectedWeek === 4 ? 'var(--studio-primary)' : 'var(--studio-border)'}`,
                backgroundColor: selectedWeek === 4 ? 'var(--studio-primary-glow)' : 'transparent',
                color: selectedWeek === 4 ? 'var(--studio-primary)' : 'var(--studio-text)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              Week 4: Database &amp; EXPLAIN Lab
            </button>
          </div>
        </div>

        {/* Global Toolbar & Status */}
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
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun size={13} style={{ marginRight: '4px' }} /> : <Moon size={13} style={{ marginRight: '4px' }} />}
            {isDark ? "Light" : "Dark"}
          </Button>

          <Button variant="default-outline" size="small" onClick={handleExportBackup} aria-label="Export backup JSON" title="Export backup JSON">
            <Download size={13} />
          </Button>

          <Button variant="default-outline" size="small" onClick={handleImportBackup} aria-label="Import backup JSON" title="Import backup JSON">
            <Upload size={13} />
          </Button>

          <Button 
            ref={clearTriggerBtnRef}
            id="clear-progress-btn"
            variant="default-outline" 
            size="small" 
            onClick={() => setShowResetModal(true)} 
            aria-label="Clear learner progress" 
            title="Clear learner progress"
          >
            <Trash2 size={13} />
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

      {/* Progressive 5-Step Stepper Navigation with Strict Sequential Gate Invariant */}
      <nav aria-label="Progressive 5-step workflow" className="studio-stepper">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '650px' }}>
          {WORKFLOW_STEPS.map((s) => {
            const isActive = s.step === currentStep;
            const isCompleted = stepCompletions[s.step];
            const isUnlocked = isStepUnlocked(s.step);
            const isLocked = !isUnlocked;

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
                    if (s.step === 2) setPoliteNotice('Step 2 is locked: Click "Proceed to Focused Drill" in Step 1 first.');
                    else if (s.step === 3) setPoliteNotice('Step 3 is locked: Satisfy all drill assertions in Step 2 to unlock Plan Analysis.');
                    else if (s.step === 4) setPoliteNotice('Step 4 is locked: Confirm execution analysis in Step 3 to unlock Oral Defense.');
                    else if (s.step === 5) setPoliteNotice('Step 5 is locked: Submit 5-dimension rubric in Step 4 to unlock Tracer Replay.');
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  border: `1px solid ${isActive ? 'var(--studio-primary)' : isCompleted ? 'rgba(16, 185, 129, 0.4)' : 'var(--studio-border)'}`,
                  backgroundColor: isActive ? 'var(--studio-primary)' : isCompleted ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: isActive ? '#ffffff' : isCompleted ? 'var(--studio-success)' : isLocked ? 'var(--studio-text-muted)' : 'var(--studio-text)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  opacity: isLocked ? 0.5 : 1,
                  transition: 'all 0.15s ease'
                }}
                aria-current={isActive ? 'step' : undefined}
                title={isLocked ? `Step ${s.step} is locked until prior steps are completed` : s.description}
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
                <Button 
                  id="proceed-to-drill-btn"
                  variant="primary-fill" 
                  size="medium" 
                  onClick={handleProceedFromConcept}
                >
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
              <Group orientation="horizontal" style={{ flex: 1, minHeight: 0, width: '100%' }}>
                
                {/* Left Panel: Problem Context & Objective */}
                <Panel defaultSize="38%" minSize="25%" maxSize="55%" style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                  <div className="studio-drill-sidebar" style={{ height: '100%', overflowY: 'auto' }}>
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Tag variant="primary" size="small">Tier 2 Simulation</Tag>
                      <Tag variant="warning" size="small">Budget: ≤ 3 Queries</Tag>
                    </div>

                    <div>
                      <h2 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem', fontWeight: 600, color: 'var(--studio-text)' }}>
                        Eliminate Eloquent N+1 Loop
                      </h2>
                      <p style={{ margin: 0, fontSize: '0.75rem', lineHeight: 1.45, color: 'var(--studio-text-muted)' }}>
                        Refactor <code>PostController::index()</code> to collapse catastrophic database multiplication.
                      </p>
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
                        <li>Click <strong>Run Test Harness</strong> to evaluate against query budget &amp; heuristic simulation.</li>
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
                      backgroundColor: 'var(--studio-surface)', 
                      border: '1px solid var(--studio-border)',
                      fontSize: '0.75rem'
                    }}>
                      <strong style={{ display: 'block', marginBottom: '2px', color: 'var(--studio-primary)' }}>
                        Interview Defense Note:
                      </strong>
                      <span style={{ color: 'var(--studio-text-muted)', lineHeight: 1.45 }}>
                        In high-scale production, Laravel 12's <code>Model::preventLazyLoading()</code> enforces strict eager loading during development, throwing exceptions before code enters staging.
                      </span>
                    </div>

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
                        <Tag variant="primary" size="small">PHP 8.3 (Eloquent Testbed Prototype)</Tag>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                        {bridgeStatus.connected && (
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
                          aria-label="Run Test Harness (Tier 2)"
                        >
                          <Play size={12} style={{ marginRight: '4px' }} />
                          {isEvaluating ? "Evaluating..." : "Run Test Harness"}
                        </Button>
                      </div>
                    </div>

                    {/* Monaco Editor Canvas */}
                    <div className="studio-drill-editor-wrapper">
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

                    {/* Editor Footer Target Hint */}
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
                      <span>Target: <code>Post::with(['author', 'comments'])-&gt;get()</code></span>
                      <span>Click <strong>Run Test Harness</strong> or <strong>Run in Docker</strong></span>
                    </div>

                  </div>
                </Panel>
              </Group>
            ) : (
              /* Week 4 Database & EXPLAIN Lab */
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
                      onCodeChange={(newSql) => setUserCode(newSql)}
                      onVersionDetected={(ver) => setRuntimeSqlVersion(ver)}
                      onExecutionComplete={async (passed) => {
                        if (passed) {
                          const updated: DrillStepCompletions = { ...stepCompletions, 1: true, 2: true };
                          setStepCompletions(updated);
                          setVerificationSource('simulation');
                          setDrillCompleted(false);

                          const existingTask = await getTaskState(activeDrill.id);
                          await saveTaskState({
                            taskId: activeDrill.id,
                            status: 'in_progress',
                            attempts: (existingTask?.attempts ?? 0) + 1,
                            verificationSource: 'simulation',
                            lastOpenedAt: new Date().toISOString(),
                          });

                          await saveDrillProgress(activeDrill.id, false, false, 'simulation');
                          await saveDrillSession({
                            drillId: activeDrill.id,
                            week: activeDrill.week,
                            currentStep: 3,
                            highestStepReached: Math.max(highestStepReached, 3),
                            stepCompletions: updated,
                            draftCode: userCode,
                            testResults: { passed: true, message: 'B-Tree compound index seek verified on idx_station_recorded.' },
                            tier3Result,
                            verificationSource: 'simulation',
                            completed: false,
                            oralDefenseCompleted: updated[4],
                            lastActiveAt: new Date().toISOString(),
                          });
                          setPoliteNotice('B-Tree compound index seek verified! Full table scan eliminated. Advancing to Plan Analysis.');
                          setCurrentStep(3);
                          setHighestStepReached(prev => Math.max(prev, 3));
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
              <Button 
                variant="primary-fill" 
                size="small" 
                disabled={!stepCompletions[2]}
                onClick={() => goToStep(3)}
                title={!stepCompletions[2] ? "Pass drill assertions in Step 2 to unlock" : "Advance to Plan Analysis"}
              >
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
                Step 3: Verification &amp; Assertion Output
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
                    <span style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)' }}>
                      Exit Code: {tier3Result.exitCode} • Verified: {tier3Result.executionVerified ? "Yes" : "No"}
                    </span>
                  </div>

                  {/* Sanitized Terminal Output */}
                  <pre style={{ 
                    margin: 0, 
                    padding: '0.75rem', 
                    borderRadius: '6px', 
                    backgroundColor: 'var(--studio-surface-subtle)', 
                    color: 'var(--studio-text)', 
                    fontFamily: 'monospace', 
                    fontSize: '0.75rem', 
                    whiteSpace: 'pre-wrap', 
                    wordBreak: 'break-all',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    border: '1px solid var(--studio-border)'
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
                      {testResults.passed ? "All Assertions Passed • Query Budget Satisfied" : "Query Budget Violation • Assertions Failed"}
                    </CalloutTitle>
                    <CalloutContent>
                      {testResults.simulatedLatencyMs ? `Simulated execution time: ~${testResults.simulatedLatencyMs}ms • ` : ''}
                      {testResults.queriesExecuted ? `Queries Executed: ${testResults.queriesExecuted} queries.` : testResults.message || 'Inspection complete.'}
                    </CalloutContent>
                  </Callout>

                  {/* Assertion List Card */}
                  {testResults.assertionResults && (
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
                  )}
                </div>
              ) : !tier3Result ? (
                <Callout variant="warning">
                  <CalloutTitle>No test run recorded yet</CalloutTitle>
                  <CalloutContent>Return to Step 2 and click "Run Test Harness" or "Run in Docker" to evaluate your code.</CalloutContent>
                </Callout>
              ) : null}

              {/* Gate 3 Action Button: Confirm Analysis & Advance to Step 4 */}
              <div className="studio-step-actions">
                <Button variant="default-outline" size="small" onClick={() => goToStep(2)}>
                  <ChevronLeft size={14} style={{ marginRight: '4px' }} />
                  Back to Code Drill
                </Button>
                <Button 
                  id="confirm-analysis-btn"
                  variant="primary-fill" 
                  size="small" 
                  onClick={handleConfirmAnalysis}
                >
                  Confirm Analysis &amp; Advance to Oral Defense
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
                onCompleted={handleOralRubricCompleted}
              />

              <div className="studio-step-actions">
                <Button variant="default-outline" size="small" onClick={() => goToStep(3)}>
                  <ChevronLeft size={14} style={{ marginRight: '4px' }} />
                  Back to Assertions
                </Button>
                <Button 
                  id="proceed-to-tracer-btn"
                  variant="primary-fill" 
                  size="small" 
                  disabled={!stepCompletions[4]}
                  onClick={() => goToStep(5)}
                  title={!stepCompletions[4] ? "Submit your oral rubric score above to unlock Tracer Replay" : "Advance to Tracer Replay"}
                >
                  {stepCompletions[4] ? "Proceed to Step 5: Tracer Replay" : "Submit Rubric to Unlock Tracer Replay"}
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
              <Button 
                id="complete-mastery-btn"
                variant="primary-fill" 
                size="small" 
                onClick={handleCompleteMastery}
              >
                <Award size={14} style={{ marginRight: '4px' }} />
                {stepCompletions[5] ? "Drill Mastered (5/5 Complete)" : "Mark Drill Mastery Complete"}
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
            Bridge: {bridgeStatus.connected ? "127.0.0.1:49152 (Online)" : "Offline"}
          </Tag>
          {politeNotice && (
            <span 
              role="status" 
              aria-live="polite" 
              style={{ fontSize: '0.75rem', color: 'var(--studio-primary)', fontWeight: 500, marginLeft: '0.5rem' }}
            >
              {politeNotice}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.6875rem', color: 'var(--studio-text-muted)' }}>
          <span>Runner: <strong>PHP 8.3.11 / PostgreSQL 16.4 (Testbed Prototype)</strong></span>
          <span>•</span>
          <span>MYDS Standards Compliant</span>
          <span>•</span>
          <span>Tab/Esc Navigation Enabled</span>
        </div>
      </footer>

      {/* Modal: Confirm Clear Learner Progress */}
      {showResetModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
        >
          <div style={{
            maxWidth: '460px',
            width: '100%',
            backgroundColor: 'var(--studio-surface)',
            border: '1px solid var(--studio-border)',
            borderRadius: '10px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ 
                width: '36px', 
                height: '36px', 
                borderRadius: '50%', 
                backgroundColor: 'rgba(239, 68, 68, 0.12)', 
                color: 'var(--studio-danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 id="reset-modal-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--studio-text)' }}>
                  Clear All Learner Progress?
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--studio-text-muted)', lineHeight: 1.45 }}>
                  This will reset your drill completions, sessions, oral scores, and hesitation records.
                </p>
              </div>
            </div>

            <div style={{ 
              padding: '0.625rem 0.75rem', 
              borderRadius: '6px', 
              backgroundColor: 'var(--studio-surface-subtle)', 
              fontSize: '0.75rem', 
              color: 'var(--studio-text-muted)',
              border: '1px solid var(--studio-border)'
            }}>
              Application preferences (such as light/dark theme) will be preserved.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
              <Button 
                ref={cancelResetBtnRef}
                id="cancel-reset-btn"
                variant="default-outline" 
                size="small" 
                onClick={() => {
                  setShowResetModal(false);
                  clearTriggerBtnRef.current?.focus();
                }}
              >
                Cancel
              </Button>
              <Button 
                ref={confirmResetBtnRef}
                id="confirm-reset-btn"
                variant="danger-fill" 
                size="small" 
                onClick={handleConfirmResetProgress}
              >
                Yes, Reset All Progress
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
