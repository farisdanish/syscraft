import { useState, useEffect } from 'react';
import { StudioHeader } from './studio/StudioHeader';
import { StudioStepper } from './studio/StudioStepper';
import { StepConceptBrief } from './studio/steps/StepConceptBrief';
import { StepFocusedDrill } from './studio/steps/StepFocusedDrill';
import { StepAssertionOutput } from './studio/steps/StepAssertionOutput';
import { StepOralRubric } from './studio/steps/StepOralRubric';
import { StepTracerReplay } from './studio/steps/StepTracerReplay';
import { StudioFooter } from './studio/StudioFooter';
import { ResetProgressModal } from './studio/ResetProgressModal';
import { PostDrillSummaryDialog } from '../summary/PostDrillSummaryDialog';
import { useStudioSession } from './studio/useStudioSession';

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
  onToggleTheme,
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

  const session = useStudioSession({ initialWeek });

  return (
    <div className="studio-shell">
      {/* Top Application Header */}
      <StudioHeader
        selectedWeek={session.selectedWeek}
        activeDrill={session.activeDrill}
        onSelectWeek={session.handleSelectWeek}
        onNavigateHome={onNavigateHome}
        onNavigateArchitecture={onNavigateArchitecture}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        bridgeStatus={session.bridgeStatus}
        sundayCount={session.sundayCount}
        sprintSeconds={session.sprintSeconds}
        sprintActive={session.sprintActive}
        onToggleSprintActive={() => session.setSprintActive(p => !p)}
        onExportBackup={session.handleExportBackup}
        onImportBackup={session.handleImportBackup}
        onOpenResetModal={() => session.setShowResetModal(true)}
        clearTriggerBtnRef={session.clearTriggerBtnRef}
        importNotice={session.importNotice}
        onDismissImportNotice={() => session.setImportNotice(null)}
      />

      {/* Progressive 5-Step Stepper Navigation */}
      <StudioStepper
        currentStep={session.currentStep}
        stepCompletions={session.stepCompletions}
        isStepUnlocked={session.isStepUnlocked}
        onSelectStep={session.goToStep}
        onLockedNotice={session.setPoliteNotice}
      />

      {/* Main Studio Body Area */}
      <main className="studio-main">
        {/* STEP 1: Concept Brief */}
        {session.currentStep === 1 && (
          <StepConceptBrief
            activeDrill={session.activeDrill}
            onProceed={session.handleProceedFromConcept}
          />
        )}

        {/* STEP 2: Focused Code Drill */}
        {session.currentStep === 2 && (
          <StepFocusedDrill
            key={session.activeDrill.id}
            activeDrill={session.activeDrill}
            userCode={session.userCode}
            setUserCode={session.setUserCode}
            isDark={isDark}
            bridgeStatus={session.bridgeStatus}
            isEvaluating={session.isEvaluating}
            isRunningDocker={session.isRunningDocker}
            handleRunDrill={session.handleRunDrill}
            handleRunTier3Docker={session.handleRunTier3Docker}
            starStories={session.starStories}
            setStarStories={session.setStarStories}
            onSaveStarStoriesSession={session.handleSaveStarStoriesSession}
            sprintSeconds={session.sprintSeconds}
            canProceedToStep3={session.stepCompletions[2]}
            goToStep={session.goToStep}
            setPoliteNotice={session.setPoliteNotice}
            onRuntimeSqlVersion={session.setRuntimeSqlVersion}
            onQueryPlanExecutionComplete={session.handleQueryPlanExecutionComplete}
            hintsUsed={session.hintsUsed}
            solutionRevealed={session.solutionRevealed}
            onRequestHint={session.handleRequestHint}
            onRevealSolution={session.handleRevealSolution}
          />
        )}

        {/* STEP 3: Plan & Assertion Analysis */}
        {session.currentStep === 3 && (
          <StepAssertionOutput
            activeDrill={session.activeDrill}
            testResults={session.testResults}
            tier3Result={session.tier3Result}
            onBackToDrill={() => session.goToStep(2)}
            onConfirmAnalysis={session.handleConfirmAnalysis}
          />
        )}

        {/* STEP 4: Scored Oral Recall Rubric */}
        {session.currentStep === 4 && (
          <StepOralRubric
            activeDrill={session.activeDrill}
            isCompleted={session.stepCompletions[4]}
            hintsUsed={session.hintsUsed}
            solutionRevealed={session.solutionRevealed}
            onOralRubricCompleted={session.handleOralRubricCompleted}
            onBackToStep3={() => session.goToStep(3)}
            onProceedToStep5={() => session.goToStep(5)}
          />
        )}

        {/* STEP 5: Visual Tracer Replay */}
        {session.currentStep === 5 && (
          <StepTracerReplay
            activeDrill={session.activeDrill}
            runtimeSqlVersion={session.runtimeSqlVersion}
            isMastered={session.stepCompletions[5]}
            onBackToRubric={() => session.goToStep(4)}
            onCompleteMastery={session.handleCompleteMastery}
            onOpenMasterySummary={session.handleOpenMasterySummary}
          />
        )}
      </main>

      {/* Bottom Status Footer */}
      <StudioFooter
        activeDrill={session.activeDrill}
        tier3Result={session.tier3Result}
        runtimeSqlVersion={session.runtimeSqlVersion}
        drillCompleted={session.drillCompleted}
        verificationSource={session.verificationSource}
        bridgeStatus={session.bridgeStatus}
        politeNotice={session.politeNotice}
      />

      {/* Modal: Post-Drill Mastery Celebration & Analysis */}
      <PostDrillSummaryDialog
        open={session.showMasteryDialog}
        onOpenChange={session.setShowMasteryDialog}
        summary={session.masterySummary}
        onAdvanceToNextWeek={session.handleAdvanceToNextWeek}
        onReturnToHome={() => {
          if (onNavigateHome) onNavigateHome();
        }}
        onExportEnvelope={session.handleExportBackup}
      />

      {/* Modal: Confirm Clear Learner Progress */}
      <ResetProgressModal
        isOpen={session.showResetModal}
        onClose={() => {
          session.setShowResetModal(false);
          session.clearTriggerBtnRef.current?.focus();
        }}
        onConfirm={session.handleConfirmResetProgress}
      />
    </div>
  );
}
