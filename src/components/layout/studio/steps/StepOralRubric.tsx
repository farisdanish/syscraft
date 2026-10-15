import React from 'react';
import { Button } from '@govtechmy/myds-react/button';
import { Tag } from '@govtechmy/myds-react/tag';
import { ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import { OralRubricDialog } from '../../../rubric/OralRubricDialog';
import type { DrillDefinition } from '../../../../types';

export interface StepOralRubricProps {
  activeDrill: DrillDefinition;
  isCompleted: boolean;
  hintsUsed?: number;
  solutionRevealed?: boolean;
  onOralRubricCompleted: () => void;
  onBackToStep3: () => void;
  onProceedToStep5: () => void;
}

export const StepOralRubric: React.FC<StepOralRubricProps> = ({
  activeDrill,
  isCompleted,
  hintsUsed = 0,
  solutionRevealed = false,
  onOralRubricCompleted,
  onBackToStep3,
  onProceedToStep5,
}) => {
  return (
    <div className="studio-scrollable-step">
      <div style={{ maxWidth: '860px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        
        {/* Pedagogical Scaffolding Telemetry Context (No score deduction) */}
        {(hintsUsed > 0 || solutionRevealed) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.625rem',
            padding: '0.5rem 0.875rem',
            borderRadius: '6px',
            backgroundColor: 'var(--studio-surface-subtle)',
            border: '1px solid var(--studio-border)',
            fontSize: '0.75rem'
          }}>
            <span style={{ fontWeight: 600, color: 'var(--studio-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <HelpCircle size={13} color="var(--studio-primary)" />
              Scaffolding Context:
            </span>
            {hintsUsed > 0 && (
              <Tag variant="default" size="small">
                💡 {hintsUsed} hint{hintsUsed > 1 ? 's' : ''} consulted
              </Tag>
            )}
            {solutionRevealed && (
              <Tag variant="warning" size="small">
                🔓 Reference solution consulted
              </Tag>
            )}
            <span style={{ color: 'var(--studio-text-muted)', fontSize: '0.6875rem', marginLeft: 'auto' }}>
              Rubric measures verbal defense & explanation independently
            </span>
          </div>
        )}

        <OralRubricDialog
          drillId={activeDrill.id}
          week={activeDrill.week}
          topic={activeDrill.title}
          question={activeDrill.oralRubric.question}
          checkpoints={activeDrill.oralRubric.checkpoints}
          hintsUsed={hintsUsed}
          solutionRevealed={solutionRevealed}
          onCompleted={onOralRubricCompleted}
        />

        <div className="studio-step-actions">
          <Button variant="default-outline" size="small" onClick={onBackToStep3}>
            <ChevronLeft size={14} style={{ marginRight: '4px' }} />
            Back to Analysis
          </Button>
          <Button 
            id="proceed-to-tracer-btn"
            variant="primary-fill" 
            size="small" 
            disabled={!isCompleted}
            onClick={onProceedToStep5}
            title={!isCompleted ? "Submit your oral rubric score above to unlock Tracer Replay" : "Advance to Tracer Replay"}
          >
            {isCompleted ? "Proceed to Step 5: Tracer Replay" : "Submit Rubric to Unlock Tracer Replay"}
            <ChevronRight size={14} style={{ marginLeft: '4px' }} />
          </Button>
        </div>
      </div>
    </div>
  );
};
