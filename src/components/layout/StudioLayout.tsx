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
  LayoutDashboard,
  Layers,
  Clock
} from 'lucide-react';
import { 
  WORKFLOW_STEPS, 
  type WorkflowStep, 
  type DrillDefinition,
  type DrillStepCompletions,
  type DrillSessionState,
  type TaskStatus,
  type StarStory
} from '../../types';
import { 
  ACTIVE_WEEKS,
  getDrillByWeek, 
  getBridgeCommandForDrill, 
  evaluateDrillSimulation 
} from '../../drills/registry';
import { 
  checkBridgeHealth, 
  runBridgeCommand, 
  type BridgeHealth, 
  type BridgeRunResult 
} from '../../services/bridgeClient';
import { 
  LARAVEL_LIFECYCLE_STEPS, 
  BTREE_INDEX_TRACER_STEPS,
  AUTH_POLICY_TRACER_STEPS,
  SENSOR_PIPELINE_TRACER_STEPS,
  CURSOR_PAGINATION_TRACER_STEPS,
  CONTAINER_DI_TRACER_STEPS,
  QUEUE_DLQ_TRACER_STEPS
} from '../tracer/tracerSteps';
import { StarStoryBuilder } from '../system-design/StarStoryBuilder';
import { CURRICULUM_TASKS } from '../../data/curriculumTasks';
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
  onNavigateArchitecture?: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export function StudioLayout({
  initialWeek = 1,
  onNavigateHome,
  onNavigateArchitecture,
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
  const activeDrill: DrillDefinition = getDrillByWeek(selectedWeek);
  const [userCode, setUserCode] = useState<string>(activeDrill.initialCode);
  const [testResults, setTestResults] = useState<any>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [drillCompleted, setDrillCompleted] = useState<boolean>(false);
  const [sundayCount, setSundayCount] = useState<number>(0);
  const [politeNotice, setPoliteNotice] = useState<string>('');
  const [importNotice, setImportNotice] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [starStories, setStarStories] = useState<StarStory[] | undefined>(undefined);

  // 90-minute Timed Sprint State (Week 7)
  const [sprintSeconds, setSprintSeconds] = useState<number>(5400);
  const [sprintActive, setSprintActive] = useState<boolean>(false);
  const [sprintAnnouncedMilestones, setSprintAnnouncedMilestones] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!sprintActive || sprintSeconds <= 0) return;

    const timer = setInterval(() => {
      setSprintSeconds((prev) => {
        const next = Math.max(0, prev - 1);

        if (next === 2700 && !sprintAnnouncedMilestones.has(2700)) {
          setPoliteNotice('Sprint milestone: 45 minutes remaining in CRUD & Auth timed sprint.');
          setSprintAnnouncedMilestones((s) => new Set(s).add(2700));
        } else if (next === 900 && !sprintAnnouncedMilestones.has(900)) {
          setPoliteNotice('Sprint milestone: 15 minutes remaining.');
          setSprintAnnouncedMilestones((s) => new Set(s).add(900));
        } else if (next === 300 && !sprintAnnouncedMilestones.has(300)) {
          setPoliteNotice('Sprint warning: 5 minutes remaining. Prepare to submit oral defense.');
          setSprintAnnouncedMilestones((s) => new Set(s).add(300));
        } else if (next === 60 && !sprintAnnouncedMilestones.has(60)) {
          setPoliteNotice('Sprint warning: 1 minute remaining.');
          setSprintAnnouncedMilestones((s) => new Set(s).add(60));
        } else if (next === 0 && !sprintAnnouncedMilestones.has(0)) {
          setPoliteNotice('Sprint time expired! Conclude implementation and proceed to oral recall.');
          setSprintAnnouncedMilestones((s) => new Set(s).add(0));
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sprintActive, sprintSeconds, sprintAnnouncedMilestones]);

  const formatSprintTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };
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
        setStarStories(session.starStories);
      } else {
        setStarStories(undefined);
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
  const handleSelectWeek = useCallback(async (week: number) => {
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
      starStories: activeDrill.week === 6 ? starStories : undefined,
    };
    await saveDrillSession(currentSession);

    // 2. Switch active definition
    setSelectedWeek(week);
    const nextDrill = getDrillByWeek(week);

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
      setStarStories(targetSession.starStories);
      setPoliteNotice(`Resumed session for ${nextDrill.title} at Step ${targetSession.currentStep}`);
    } else {
      setStarStories(undefined);
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
  }, [selectedWeek, activeDrill.id, activeDrill.week, currentStep, highestStepReached, stepCompletions, userCode, testResults, tier3Result, verificationSource, drillCompleted, starStories]);

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
    setPoliteNotice(`Evaluating drill assertions for Week ${activeDrill.week}...`);

    const evalResult = evaluateDrillSimulation(activeDrill.week, userCode);
    if (evalResult) {
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
        setPoliteNotice('All assertions passed! Advancing to Plan Analysis.');
        setCurrentStep(3);
        setHighestStepReached(prev => Math.max(prev, 3));
      } else {
        setPoliteNotice('Assertion failure: Check required specifications in the editor.');
      }
    }

    setIsEvaluating(false);
    refreshProgress();
  };

  // Gate 2: Run Tier 3 Canonical Test via Docker Bridge
  const handleRunTier3Docker = async () => {
    const commandId = getBridgeCommandForDrill(activeDrill.week);
    if (!commandId) {
      setPoliteNotice('No Tier 3 bridge command configured for this drill.');
      return;
    }
    setIsRunningDocker(true);
    const filename = activeDrill.targetFile.split('/').pop() || 'submission.php';
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
      {/* Top Application Header: 3-Zone Studio Workbench */}
      <header className="studio-header">
        {/* Zone 1: Identity & Module Selector */}
        <div className="studio-header-zone-left">
          {onNavigateHome && (
            <Button
              id="back-to-hub-btn"
              variant="default-outline"
              size="small"
              onClick={onNavigateHome}
              aria-label="Return to Curriculum Hub"
              style={{ padding: '3px 8px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
            >
              <LayoutDashboard size={13} style={{ marginRight: '5px' }} />
              Curriculum
            </Button>
          )}

          {onNavigateArchitecture && (
            <Button
              id="studio-to-architecture-btn"
              variant="default-outline"
              size="small"
              onClick={onNavigateArchitecture}
              aria-label="View Technical Architecture & How It Works"
              style={{ padding: '3px 8px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
            >
              <Layers size={13} style={{ marginRight: '5px' }} />
              How It Works
            </Button>
          )}

          <div style={{ 
            width: '26px', 
            height: '26px', 
            borderRadius: '6px', 
            backgroundColor: 'var(--studio-primary)', 
            color: 'var(--studio-primary-contrast)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontWeight: 700, 
            fontSize: '0.75rem',
            flexShrink: 0
          }}>
            SC
          </div>

          <div style={{ display: 'inline-flex', padding: '2px', backgroundColor: 'var(--studio-surface-subtle)', borderRadius: '6px', border: '1px solid var(--studio-border)', flexShrink: 0 }}>
            {ACTIVE_WEEKS.map((wk) => {
              const isSelected = selectedWeek === wk;
              const task = CURRICULUM_TASKS.find(t => t.week === wk);
              return (
                <button
                  key={wk}
                  id={`select-week-${wk}-btn`}
                  type="button"
                  onClick={() => handleSelectWeek(wk)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? 700 : 500,
                    border: 'none',
                    backgroundColor: isSelected ? 'var(--studio-primary)' : 'transparent',
                    color: isSelected ? 'var(--studio-primary-contrast)' : 'var(--studio-text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontFamily: 'var(--studio-font-mono)'
                  }}
                  aria-current={isSelected ? 'true' : undefined}
                  title={`Week ${wk}: ${task ? task.module : ''}`}
                >
                  W{wk}
                </button>
              );
            })}
          </div>

          <span style={{ 
            fontSize: '0.75rem', 
            fontWeight: 600, 
            color: 'var(--studio-text)',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: 'var(--studio-surface-subtle)',
            border: '1px solid var(--studio-border)',
            maxWidth: '260px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }} title={activeDrill.title}>
            Week {activeDrill.week}: {activeDrill.title.split('(')[0].trim()}
          </span>
        </div>

        {/* Zone 2: Context, Tier & Sprint Timer */}
        <div className="studio-header-zone-center">
          <Tag variant={activeDrill.tier === 3 ? "warning" : "primary"} size="small">
            Tier {activeDrill.tier}: {activeDrill.engine === 'postgresql-docker' ? 'Docker PostgreSQL' : activeDrill.engine === 'sqlite-wasm' ? 'WASM SQLite' : 'Simulation'}
          </Tag>

          {/* Week 7 Sprint Timer Badge (if active) */}
          {activeDrill.week === 7 && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: sprintSeconds <= 300 ? 'rgba(244, 63, 94, 0.15)' : 'var(--studio-surface-subtle)',
              border: `1px solid ${sprintSeconds <= 300 ? 'var(--studio-danger)' : 'var(--studio-border)'}`,
              fontSize: '0.75rem',
              color: sprintSeconds <= 300 ? 'var(--studio-danger)' : 'var(--studio-text)',
              fontWeight: 600,
              fontFamily: 'var(--studio-font-mono)'
            }}>
              <Clock size={12} color={sprintSeconds <= 300 ? 'var(--studio-danger)' : 'var(--studio-primary)'} />
              <span>Sprint: {formatSprintTime(sprintSeconds)}</span>
              <button
                type="button"
                onClick={() => setSprintActive(p => !p)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '0 2px',
                  fontWeight: 700,
                  fontSize: '0.75rem'
                }}
                aria-label={sprintActive ? "Pause Sprint Timer" : "Start Sprint Timer"}
              >
                {sprintActive ? "⏸" : "▶"}
              </button>
            </div>
          )}
        </div>

        {/* Zone 3: Diagnostics, Telemetry & Studio Controls */}
        <div className="studio-header-zone-right">
          <Tag variant={bridgeStatus.connected ? "success" : "default"} size="small">
            <span className={bridgeStatus.connected ? "studio-pulse" : ""} style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: bridgeStatus.connected ? 'var(--studio-success)' : 'var(--studio-text-faint)',
              marginRight: '5px',
              display: 'inline-block'
            }} />
            {bridgeStatus.connected ? "Bridge Active" : "Bridge Offline"}
          </Tag>

          <Tag variant={sundayCount > 0 ? "warning" : "default"} size="small">
            <Flag size={11} style={{ marginRight: '4px' }} />
            Review ({sundayCount})
          </Tag>

          <Button 
            id="theme-toggle-btn"
            variant="default-outline" 
            size="small" 
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            style={{ padding: '3px 8px' }}
          >
            {isDark ? <Sun size={13} color="var(--studio-warning)" /> : <Moon size={13} color="var(--studio-primary)" />}
          </Button>

          {/* Grouped Actions: Export / Import / Reset */}
          <div style={{ display: 'inline-flex', borderRadius: '6px', border: '1px solid var(--studio-border)', overflow: 'hidden' }}>
            <Button variant="default-outline" size="small" onClick={handleExportBackup} aria-label="Export backup JSON" title="Export backup JSON" style={{ border: 'none', borderRadius: 0, padding: '3px 7px' }}>
              <Download size={13} />
            </Button>
            <Button variant="default-outline" size="small" onClick={handleImportBackup} aria-label="Import backup JSON" title="Import backup JSON" style={{ border: 'none', borderLeft: '1px solid var(--studio-border)', borderRadius: 0, padding: '3px 7px' }}>
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
              style={{ border: 'none', borderLeft: '1px solid var(--studio-border)', borderRadius: 0, padding: '3px 7px' }}
            >
              <Trash2 size={13} color="var(--studio-danger)" />
            </Button>
          </div>
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

      {/* Progressive 5-Step Stepper Navigation with Strict Sequential Gate Invariant & Illuminated Pipeline */}
      <nav aria-label="Progressive 5-step workflow" className="studio-stepper">
        <div className="studio-stepper-track">
          {WORKFLOW_STEPS.map((s, index) => {
            const isActive = s.step === currentStep;
            const isCompleted = stepCompletions[s.step];
            const isUnlocked = isStepUnlocked(s.step);
            const isLocked = !isUnlocked;

            const lockTooltip = s.step === 2 
              ? 'Step 2 locked: Click "Proceed to Focused Drill" in Step 1 first' 
              : s.step === 3 
              ? 'Step 3 locked: Satisfy all automated assertions in Step 2 first' 
              : s.step === 4 
              ? 'Step 4 locked: Acknowledge execution plan in Step 3 first' 
              : 'Step 5 locked: Submit 5-dimension oral rubric in Step 4 first';

            return (
              <div key={s.step} style={{ display: 'flex', alignItems: 'center', flex: index < WORKFLOW_STEPS.length - 1 ? 1 : 'none' }}>
                <button
                  id={`step-tab-${s.step}`}
                  type="button"
                  disabled={isLocked}
                  onClick={() => {
                    if (!isLocked) {
                      goToStep(s.step);
                    } else {
                      setPoliteNotice(lockTooltip);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '4px 11px',
                    borderRadius: '20px',
                    border: `1.5px solid ${isActive ? 'var(--studio-primary)' : isCompleted ? 'var(--studio-success)' : 'var(--studio-border)'}`,
                    backgroundColor: isActive ? 'var(--studio-primary)' : isCompleted ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                    color: isActive ? 'var(--studio-primary-contrast)' : isCompleted ? 'var(--studio-success)' : isLocked ? 'var(--studio-text-faint)' : 'var(--studio-text)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    opacity: isLocked ? 0.6 : 1,
                    boxShadow: isActive ? 'var(--studio-shadow-glow)' : 'none',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap'
                  }}
                  aria-current={isActive ? 'step' : undefined}
                  title={isLocked ? lockTooltip : s.description}
                >
                  <span style={{ 
                    width: '16px', 
                    height: '16px', 
                    borderRadius: '50%', 
                    backgroundColor: isActive ? 'var(--studio-primary-contrast)' : isCompleted ? 'var(--studio-success)' : 'var(--studio-surface-hover)',
                    color: isActive ? 'var(--studio-primary)' : isCompleted ? 'var(--studio-text-on-accent)' : 'var(--studio-text-muted)',
                    fontSize: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700
                  }}>
                    {isLocked ? <Lock size={9} /> : isCompleted && !isActive ? '✓' : s.step}
                  </span>
                  <span>{s.title}</span>
                </button>

                {/* Illuminated Pipeline Connector to next step */}
                {index < WORKFLOW_STEPS.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: '2px',
                      minWidth: '14px',
                      maxWidth: '48px',
                      margin: '0 6px',
                      backgroundColor: isCompleted ? 'var(--studio-success)' : isUnlocked ? 'var(--studio-border-strong)' : 'var(--studio-border)',
                      boxShadow: isCompleted ? '0 0 6px rgba(16, 185, 129, 0.35)' : 'none',
                      transition: 'all 0.25s ease'
                    }}
                    aria-hidden="true"
                  />
                )}
              </div>
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
            {activeDrill.week === 4 ? (
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
            ) : activeDrill.week === 6 ? (
              /* Week 6 System Design Architecture & STAR Story Builder */
              <Group orientation="horizontal" style={{ flex: 1, minHeight: 0, width: '100%' }}>
                {/* Left Panel: StarStoryBuilder */}
                <Panel defaultSize="46%" minSize="30%" maxSize="60%" style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                  <div style={{ height: '100%', overflowY: 'auto', padding: '0.75rem' }}>
                    <StarStoryBuilder 
                      isDark={isDark}
                      stories={starStories}
                      onChangeStories={(updated) => {
                        setStarStories(updated);
                        void saveDrillSession({
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
                          starStories: updated,
                        });
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
                        <span style={{ fontSize: '0.6875rem', color: 'var(--studio-text-muted)', marginLeft: '0.5rem' }}>Esc releases focus</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                          tabSize: 2,
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
                      <span>Target: Complete buffer backpressure strategy, partition key, and STAR story fields without &quot;TODO&quot;</span>
                      <span>Click <strong>Run Systems Evaluator</strong> to verify schema</span>
                    </div>

                  </div>
                </Panel>
              </Group>
            ) : (
              /* Week 1 & Week 7 PHP Code Drills */
              <Group orientation="horizontal" style={{ flex: 1, minHeight: 0, width: '100%' }}>
                {/* Left Panel: Problem Context & Objective */}
                <Panel defaultSize="38%" minSize="25%" maxSize="55%" style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                  <div className="studio-drill-sidebar" style={{ height: '100%', overflowY: 'auto' }}>
                    
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
                      backgroundColor: activeDrill.week === 7 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(234, 179, 8, 0.08)', 
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

                        <span style={{ fontSize: '0.6875rem', color: 'var(--studio-text-muted)', marginRight: '0.25rem' }}>Esc releases focus</span>

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
                      <span>Click <strong>Run Test Harness</strong> or <strong>Run in Docker</strong></span>
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
                        {tier3Result.exitCode === 0 
                          ? `Tier 3: [${activeDrill.week === 7 ? 'PHP 8.3 / Auth Testbed' : activeDrill.week === 3 ? 'PHP 8.3 / IoC Container' : 'PostgreSQL 16.4'} Runtime Passed]` 
                          : "Tier 3: [Failed]"}
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
                      {testResults.passed 
                        ? (activeDrill.week === 1 ? "All Assertions Passed • Query Budget Satisfied" : "All Assertions Passed • Requirements Satisfied") 
                        : (activeDrill.week === 1 ? "Query Budget Violation • Assertions Failed" : "Requirements Violation • Assertions Failed")}
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
                    : activeDrill.week === 2
                    ? 'Step 5: Visual Cursor Seek & RFC 9457 Ingestion Tracer'
                    : activeDrill.week === 3
                    ? 'Step 5: Visual Dependency Injection & IoC Container Tracer'
                    : activeDrill.week === 4
                    ? 'Step 5: Visual B-Tree Compound Index & Query Execution Tracer'
                    : activeDrill.week === 5
                    ? 'Step 5: Visual Resilient Queue & Dead-Letter Pipeline Tracer'
                    : activeDrill.week === 6
                    ? 'Step 5: Visual Sensor Ingestion Pipeline & Sharded Buffer Tracer'
                    : 'Step 5: Visual Session Regeneration & Policy Authorization Gate Tracer'}
                </strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)', display: 'block' }}>
                  {activeDrill.week === 1
                    ? 'Interactive state machine visualizing the Laravel request journey from HTTP ingress to terminating middleware.'
                    : activeDrill.week === 2
                    ? 'Interactive state machine visualizing seek-based cursor traversal, indexed pointer jumps, and RFC 9457 error negotiation.'
                    : activeDrill.week === 3
                    ? 'Interactive state machine visualizing Laravel Service Container interface resolution, constructor reflection, and singleton caching.'
                    : activeDrill.week === 4
                    ? 'Interactive state machine visualizing the SQLite storage engine B-Tree index traversal, key seek, and early LIMIT exit.'
                    : activeDrill.week === 5
                    ? 'Interactive state machine visualizing Redis queue worker popping, exponential retry backoff scheduling, and DLQ quarantine isolation.'
                    : activeDrill.week === 6
                    ? 'Interactive state machine visualizing high-throughput weather observation telemetry streaming through Redis buffer shards into partitioned PostgreSQL storage.'
                    : 'Interactive state machine visualizing secure session ID rotation on login and zero-trust policy authorization gate checks on record mutation.'}
                </span>
              </div>
              <Tag 
                variant={
                  activeDrill.week === 1 || activeDrill.week === 2 ? "primary" 
                  : activeDrill.week === 3 || activeDrill.week === 4 ? "success" 
                  : activeDrill.week === 5 || activeDrill.week === 6 ? "warning" 
                  : "danger"
                } 
                size="small"
              >
                {activeDrill.week === 1 
                  ? "Week 1: Laravel Internals" 
                  : activeDrill.week === 2
                  ? "Week 2: API Architecture"
                  : activeDrill.week === 3
                  ? "Week 3: Clean Architecture"
                  : activeDrill.week === 4 
                  ? "Week 4: Storage Engine" 
                  : activeDrill.week === 5
                  ? "Week 5: Async Processing"
                  : activeDrill.week === 6 
                  ? "Week 6: Systems Design" 
                  : "Week 7: Auth & Security"}
              </Tag>
            </div>

            <div style={{ flex: 1, minHeight: 0, borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--studio-border)' }}>
              <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--studio-text-muted)' }}>Loading Lifecycle Tracer...</div>}>
                <LifecycleTracer 
                  steps={
                    activeDrill.week === 1 
                      ? LARAVEL_LIFECYCLE_STEPS 
                      : activeDrill.week === 2
                      ? CURSOR_PAGINATION_TRACER_STEPS
                      : activeDrill.week === 3
                      ? CONTAINER_DI_TRACER_STEPS
                      : activeDrill.week === 4 
                      ? BTREE_INDEX_TRACER_STEPS 
                      : activeDrill.week === 5
                      ? QUEUE_DLQ_TRACER_STEPS
                      : activeDrill.week === 6 
                      ? SENSOR_PIPELINE_TRACER_STEPS 
                      : AUTH_POLICY_TRACER_STEPS
                  }
                  engineBadge={
                    activeDrill.week === 1 
                      ? "Tier 2: Deterministic Simulation" 
                      : activeDrill.week === 2
                      ? "Tier 1: SQLite WASM / REST Engine"
                      : activeDrill.week === 3
                      ? "Tier 3: Laravel 12 IoC Container"
                      : activeDrill.week === 4 
                      ? `Tier 1: SQLite ${runtimeSqlVersion} (WASM Engine)` 
                      : activeDrill.week === 5
                      ? "Tier 2: Redis / Horizon Worker Sim"
                      : activeDrill.week === 6 
                      ? "Tier 1: Distributed Pipeline Flow" 
                      : "Tier 3: PostgreSQL / Session Store"
                  }
                  badgeVariant={
                    activeDrill.week === 1 || activeDrill.week === 2
                      ? "primary" 
                      : activeDrill.week === 3 || activeDrill.week === 4 
                      ? "success" 
                      : activeDrill.week === 5 || activeDrill.week === 6 
                      ? "warning" 
                      : "danger"
                  }
                  packetName={
                    activeDrill.week === 1 
                      ? "Active Ingress Packet" 
                      : activeDrill.week === 2
                      ? "Seek Cursor Request"
                      : activeDrill.week === 3
                      ? "Service Resolution Request"
                      : activeDrill.week === 4 
                      ? "Active Cursor Pointer" 
                      : activeDrill.week === 5
                      ? "Queue Job Payload"
                      : activeDrill.week === 6 
                      ? "Sensor Reading Packet" 
                      : "Auth Session Token"
                  }
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
          <Tag 
            variant={
              tier3Result && tier3Result.exitCode === 0 
                ? "success" 
                : activeDrill.week === 1 || activeDrill.week === 2 
                ? "primary" 
                : activeDrill.week === 3 || activeDrill.week === 4 
                ? "success" 
                : activeDrill.week === 5 || activeDrill.week === 6 
                ? "warning" 
                : "danger"
            } 
            size="small"
          >
            {tier3Result && tier3Result.exitCode === 0 
              ? `[Tier 3: ${activeDrill.week === 7 ? 'PHP 8.3 / Auth Testbed' : activeDrill.week === 3 ? 'PHP 8.3 / IoC Container' : 'PostgreSQL 16.4'} Runtime Passed]`
              : activeDrill.week === 1 
                ? "[Tier 2: Deterministic Simulation]" 
                : activeDrill.week === 2
                ? `[Tier 1: SQLite ${runtimeSqlVersion} (WASM)]`
                : activeDrill.week === 3
                ? "[Tier 3: IoC Service Container]"
                : activeDrill.week === 4 
                ? `[Engine: SQLite ${runtimeSqlVersion} (WASM)]` 
                : activeDrill.week === 5
                ? "[Tier 2: Async Queue Worker Simulation]"
                : activeDrill.week === 6 
                ? "[Tier 1: Systems Design / STAR Validator]" 
                : "[Tier 2: Security Policy Evaluator]"}
          </Tag>
          <Tag variant={drillCompleted ? "success" : "default"} size="small">
            {drillCompleted 
              ? (verificationSource === 'local-runtime' ? "Runtime Passed" : "Simulation Passed") 
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
