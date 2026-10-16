import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  type WorkflowStep, 
  type DrillDefinition,
  type DrillStepCompletions,
  type DrillSessionState,
  type TaskStatus,
  type StarStory,
  type DrillMasterySummary
} from '../../../types';
import { 
  getDrillByWeek, 
  getBridgeCommandForDrill, 
  evaluateDrillSimulation 
} from '../../../drills/registry';
import { 
  checkBridgeHealth, 
  runBridgeCommand, 
  type BridgeHealth, 
  type BridgeRunResult 
} from '../../../services/bridgeClient';
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
  clearLearnerProgress,
  compileMasterySummary
} from '../../../services/storage';
import { migrateLegacySession } from '../../../services/sessionMigration';

export interface UseStudioSessionOptions {
  initialWeek?: number;
}

export function useStudioSession({ initialWeek = 1 }: UseStudioSessionOptions = {}) {
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
  const [hintsUsed, setHintsUsed] = useState<number>(0);
  const [solutionRevealed, setSolutionRevealed] = useState<boolean>(false);
  const [masterySummary, setMasterySummary] = useState<DrillMasterySummary | null>(null);
  const [showMasteryDialog, setShowMasteryDialog] = useState<boolean>(false);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(false);
  const loadedDrillIdRef = useRef<string>('');

  // 90-minute Timed Sprint State (Week 7)
  const [sprintSeconds, setSprintSeconds] = useState<number>(5400);
  const [sprintActive, setSprintActive] = useState<boolean>(false);
  const [sprintAnnouncedMilestones, setSprintAnnouncedMilestones] = useState<Set<number>>(new Set());

  // Tier 3 Bridge Daemon State
  const [bridgeStatus, setBridgeStatus] = useState<BridgeHealth>({ connected: false });
  const [tier3Result, setTier3Result] = useState<BridgeRunResult | null>(null);
  const [isRunningDocker, setIsRunningDocker] = useState<boolean>(false);

  const clearTriggerBtnRef = useRef<HTMLButtonElement | null>(null);

  // Sprint Timer Countdown
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
      else if (step === 3) setPoliteNotice('Step 3 is locked: Pass drill assertions in Step 2 to unlock Analysis & Feedback.');
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
      hintsUsed,
      solutionRevealed,
    });
  }, [isStepUnlocked, activeDrill.id, activeDrill.week, highestStepReached, stepCompletions, userCode, testResults, tier3Result, verificationSource, drillCompleted, hintsUsed, solutionRevealed]);

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

  // Load drill progress & Sunday count
  const refreshProgress = useCallback(async () => {
    const hes = await getSundayHesitations();
    setSundayCount(hes.length);
  }, []);

  // Initial Load & Session Rehydration for active drill
  useEffect(() => {
    let isMounted = true;
    if (loadedDrillIdRef.current === activeDrill.id) {
      return;
    }
    loadedDrillIdRef.current = activeDrill.id;
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
        setHintsUsed(session.hintsUsed || 0);
        setSolutionRevealed(session.solutionRevealed || false);
      } else {
        setStarStories(undefined);
        setHintsUsed(0);
        setSolutionRevealed(false);
        // Fallback to legacy progress record if migrating
        const legacy = await getDrillProgress(activeDrill.id);
        const migrated = migrateLegacySession(legacy);
        if (migrated) {
          setUserCode(activeDrill.initialCode);
          setCurrentStep(migrated.currentStep);
          setHighestStepReached(migrated.highestStepReached);
          setStepCompletions(migrated.stepCompletions);
          setTestResults(null);
          setTier3Result(null);
          setVerificationSource(migrated.verificationSource);
          setDrillCompleted(migrated.drillCompleted);
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
    if (isLoadingSession) return;
    const timer = setTimeout(async () => {
      if (isLoadingSession) return;
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
          hintsUsed,
          solutionRevealed,
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [isLoadingSession, userCode, activeDrill.id, activeDrill.week, currentStep, highestStepReached, stepCompletions, testResults, tier3Result, verificationSource, drillCompleted, hintsUsed, solutionRevealed]);

  // Non-Destructive Multi-Module Switching
  const handleSelectWeek = useCallback(async (week: number) => {
    if (week === selectedWeek) return;
    setIsLoadingSession(true);

    try {
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
        hintsUsed,
        solutionRevealed,
      };
      await saveDrillSession(currentSession);

      // 2. Fetch target drill session BEFORE changing active definition
      const nextDrill = getDrillByWeek(week);
      const targetSession = await getDrillSession(nextDrill.id);

      // 3. Mark the drill as loaded in ref to avoid redundant effect re-run
      loadedDrillIdRef.current = nextDrill.id;

      // 4. Update drill definition & target session state synchronously in batch
      setSelectedWeek(week);

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
        setHintsUsed(targetSession.hintsUsed || 0);
        setSolutionRevealed(targetSession.solutionRevealed || false);
        setPoliteNotice(`Switched to Week ${nextDrill.week}: ${nextDrill.title.split('(')[0].trim()}, resumed at Step ${targetSession.currentStep}.`);
      } else {
        setStarStories(undefined);
        setHintsUsed(0);
        setSolutionRevealed(false);
        const legacyProg = await getDrillProgress(nextDrill.id);
        const migrated = migrateLegacySession(legacyProg);
        if (migrated) {
          setUserCode(nextDrill.initialCode);
          setCurrentStep(migrated.currentStep);
          setHighestStepReached(migrated.highestStepReached);
          setStepCompletions(migrated.stepCompletions);
          setTestResults(null);
          setTier3Result(null);
          setVerificationSource(migrated.verificationSource);
          setDrillCompleted(migrated.drillCompleted);
          setPoliteNotice(`Switched to Week ${nextDrill.week}: ${nextDrill.title.split('(')[0].trim()}, resumed at Step ${migrated.currentStep}.`);
        } else {
          setUserCode(nextDrill.initialCode);
          setCurrentStep(1);
          setHighestStepReached(1);
          setStepCompletions({ 1: false, 2: false, 3: false, 4: false, 5: false });
          setTestResults(null);
          setTier3Result(null);
          setVerificationSource('simulation');
          setDrillCompleted(false);
          setPoliteNotice(`Switched to Week ${nextDrill.week}: ${nextDrill.title.split('(')[0].trim()}, resumed at Step 1.`);
        }
      }
    } finally {
      setIsLoadingSession(false);
    }
  }, [selectedWeek, activeDrill.id, activeDrill.week, currentStep, highestStepReached, stepCompletions, userCode, testResults, tier3Result, verificationSource, drillCompleted, starStories, hintsUsed, solutionRevealed]);

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
      hintsUsed,
      solutionRevealed,
    });

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
          testResults: evalResult,
          tier3Result,
          verificationSource,
          completed: false,
          oralDefenseCompleted: updated[4],
          lastActiveAt: new Date().toISOString(),
          hintsUsed,
          solutionRevealed,
        });
        setPoliteNotice('All assertions passed! Advancing to Analysis & Feedback.');
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
      setDrillCompleted(false);

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
        hintsUsed,
        solutionRevealed,
      });
      setPoliteNotice(`Tier 3 Docker verification passed for ${activeDrill.title}. Advancing to Analysis & Feedback.`);
      setCurrentStep(3);
      setHighestStepReached(prev => Math.max(prev, 3));
    } else {
      setPoliteNotice('Tier 3 Docker test run failed assertions. Code remains unverified.');
    }
    refreshProgress();
  };

  // Gate 2: Week 4 QueryPlanLab Complete Callback
  const handleQueryPlanExecutionComplete = async (passed: boolean) => {
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

      const queryResults = {
        passed: true,
        message: 'B-Tree compound index seek verified on idx_station_recorded! Full table scan eliminated.',
        assertionResults: [
          { name: 'Target index idx_station_recorded utilized', passed: true, message: 'SQLite query planner used index seek instead of sequential scan.' },
          { name: 'Zero temporary B-Tree sorts', passed: true, message: 'ORDER BY matched compound index direction (recorded_at DESC).' },
          { name: 'Leftmost prefix match on station_code', passed: true, message: 'WHERE filter matched first column of compound index.' },
        ],
      };
      setTestResults(queryResults);

      await saveDrillProgress(activeDrill.id, false, false, 'simulation');
      await saveDrillSession({
        drillId: activeDrill.id,
        week: activeDrill.week,
        currentStep: 3,
        highestStepReached: Math.max(highestStepReached, 3),
        stepCompletions: updated,
        draftCode: userCode,
        testResults: queryResults,
        tier3Result,
        verificationSource: 'simulation',
        completed: false,
        oralDefenseCompleted: updated[4],
        lastActiveAt: new Date().toISOString(),
        hintsUsed,
        solutionRevealed,
      });
      setPoliteNotice('B-Tree compound index seek verified! Full table scan eliminated. Advancing to Analysis & Feedback.');
      setCurrentStep(3);
      setHighestStepReached(prev => Math.max(prev, 3));
    }
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
      hintsUsed,
      solutionRevealed,
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
      hintsUsed,
      solutionRevealed,
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
      hintsUsed,
      solutionRevealed,
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
    // Compile and launch celebratory mastery analysis dialog
    try {
      const summary = await compileMasterySummary(activeDrill.id);
      setMasterySummary(summary);
      setShowMasteryDialog(true);
    } catch (err) {
      console.warn('[useStudioSession] Error compiling mastery summary:', err);
    }

    setPoliteNotice(`Drill mastered! All 5 stages completed for ${activeDrill.title}.`);
  };

  // Open Mastery Summary (for inspecting previously mastered drills)
  const handleOpenMasterySummary = async () => {
    try {
      const summary = await compileMasterySummary(activeDrill.id);
      setMasterySummary(summary);
      setShowMasteryDialog(true);
    } catch (err) {
      console.warn('[useStudioSession] Error opening mastery summary:', err);
    }
  };

  // Advance to Next Week from Mastery Dialog
  const handleAdvanceToNextWeek = (nextWeekNum: number) => {
    setShowMasteryDialog(false);
    handleSelectWeek(nextWeekNum);
  };

  // Save Star Stories from Builder
  const handleSaveStarStoriesSession = (updatedStories: StarStory[]) => {
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
      starStories: updatedStories,
      hintsUsed,
      solutionRevealed,
    });
  };

  // Pedagogical Hint Handlers (Recording context without score penalty)
  const handleRequestHint = useCallback(() => {
    const maxHints = activeDrill.hints?.length || 0;
    if (maxHints === 0) return;
    setHintsUsed((prev) => {
      const next = Math.min(prev + 1, maxHints);
      setPoliteNotice(`Pedagogical hint ${next} of ${maxHints} unlocked. (Oral rubric score unaffected)`);
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
        starStories: activeDrill.week === 6 ? starStories : undefined,
        hintsUsed: next,
        solutionRevealed,
      });
      return next;
    });
  }, [activeDrill.hints, activeDrill.id, activeDrill.week, currentStep, highestStepReached, stepCompletions, userCode, testResults, tier3Result, verificationSource, drillCompleted, starStories, solutionRevealed]);

  const handleRevealSolution = useCallback(() => {
    setSolutionRevealed(true);
    setPoliteNotice('Reference solution revealed. (Recorded in session telemetry for oral review discussion)');
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
      starStories: activeDrill.week === 6 ? starStories : undefined,
      hintsUsed,
      solutionRevealed: true,
    });
  }, [activeDrill.id, activeDrill.week, currentStep, highestStepReached, stepCompletions, userCode, testResults, tier3Result, verificationSource, drillCompleted, starStories, hintsUsed]);

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

  // Clear Learner Progress
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
      setHintsUsed(0);
      setSolutionRevealed(false);
      await refreshProgress();
      setImportNotice({ type: 'success', text: 'All learner progress and drill sessions have been reset.' });
    } catch (err) {
      console.error('[storage] Failed to clear progress:', err);
      setImportNotice({ type: 'danger', text: 'Failed to reset progress: ' + (err instanceof Error ? err.message : String(err)) });
    }
  };

  return {
    selectedWeek,
    activeDrill,
    currentStep,
    highestStepReached,
    stepCompletions,
    isStepUnlocked,
    goToStep,
    handleSelectWeek,
    userCode,
    setUserCode,
    testResults,
    tier3Result,
    isEvaluating,
    isRunningDocker,
    drillCompleted,
    verificationSource,
    runtimeSqlVersion,
    setRuntimeSqlVersion,
    sundayCount,
    politeNotice,
    setPoliteNotice,
    importNotice,
    setImportNotice,
    starStories,
    setStarStories,
    handleSaveStarStoriesSession,
    sprintSeconds,
    sprintActive,
    setSprintActive,
    bridgeStatus,
    showResetModal,
    setShowResetModal,
    clearTriggerBtnRef,
    handleProceedFromConcept,
    handleRunDrill,
    handleRunTier3Docker,
    handleQueryPlanExecutionComplete,
    handleConfirmAnalysis,
    handleOralRubricCompleted,
    handleCompleteMastery,
    handleExportBackup,
    handleImportBackup,
    handleConfirmResetProgress,
    hintsUsed,
    solutionRevealed,
    handleRequestHint,
    handleRevealSolution,
    masterySummary,
    showMasteryDialog,
    setShowMasteryDialog,
    handleOpenMasterySummary,
    handleAdvanceToNextWeek,
  };
}
