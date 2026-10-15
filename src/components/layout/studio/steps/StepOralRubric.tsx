import React from 'react';
import { Button } from '@govtechmy/myds-react/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { OralRubricDialog } from '../../../rubric/OralRubricDialog';
import type { DrillDefinition } from '../../../../types';

export interface StepOralRubricProps {
  activeDrill: DrillDefinition;
  isCompleted: boolean;
  onOralRubricCompleted: () => void;
  onBackToStep3: () => void;
  onProceedToStep5: () => void;
}

export const StepOralRubric: React.FC<StepOralRubricProps> = ({
  activeDrill,
  isCompleted,
  onOralRubricCompleted,
  onBackToStep3,
  onProceedToStep5,
}) => {
  return (
    <div className="studio-scrollable-step">
      <div style={{ maxWidth: '860px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <OralRubricDialog
          drillId={activeDrill.id}
          week={activeDrill.week}
          topic={activeDrill.title}
          question={activeDrill.oralRubric.question}
          checkpoints={activeDrill.oralRubric.checkpoints}
          onCompleted={onOralRubricCompleted}
        />

        <div className="studio-step-actions">
          <Button variant="default-outline" size="small" onClick={onBackToStep3}>
            <ChevronLeft size={14} style={{ marginRight: '4px' }} />
            Back to Assertions
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
