import React from 'react';
import { Button } from '@govtechmy/myds-react/button';
import { Callout, CalloutTitle, CalloutContent } from '@govtechmy/myds-react/callout';
import { BookOpen, ChevronRight } from 'lucide-react';
import type { DrillDefinition } from '../../../../types';

export interface StepConceptBriefProps {
  activeDrill: DrillDefinition;
  onProceed: () => void;
}

export const StepConceptBrief: React.FC<StepConceptBriefProps> = ({
  activeDrill,
  onProceed,
}) => {
  return (
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
            onClick={onProceed}
          >
            Proceed to Step 2: Focused Drill
            <ChevronRight size={16} style={{ marginLeft: '4px' }} />
          </Button>
        </div>
      </div>
    </div>
  );
};
