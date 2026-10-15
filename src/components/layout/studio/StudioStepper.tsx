import React from 'react';
import { Lock } from 'lucide-react';
import { WORKFLOW_STEPS, type WorkflowStep, type DrillStepCompletions } from '../../../types';

export interface StudioStepperProps {
  currentStep: WorkflowStep;
  stepCompletions: DrillStepCompletions;
  isStepUnlocked: (step: WorkflowStep) => boolean;
  onSelectStep: (step: WorkflowStep) => void;
  onLockedNotice: (notice: string) => void;
}

export const StudioStepper: React.FC<StudioStepperProps> = ({
  currentStep,
  stepCompletions,
  isStepUnlocked,
  onSelectStep,
  onLockedNotice,
}) => {
  return (
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
                    onSelectStep(s.step);
                  } else {
                    onLockedNotice(lockTooltip);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '4px 11px',
                  borderRadius: '20px',
                  border: `1.5px solid ${isActive ? 'var(--studio-primary)' : isCompleted ? 'var(--studio-success)' : 'var(--studio-border)'}`,
                  backgroundColor: isActive ? 'var(--studio-primary)' : isCompleted ? 'var(--studio-success-subtle)' : 'transparent',
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
                    boxShadow: isCompleted ? 'var(--studio-success-glow)' : 'none',
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
  );
};
