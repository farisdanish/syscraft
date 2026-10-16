import React from 'react';
import { Button } from '@govtechmy/myds-react/button';
import { Tag } from '@govtechmy/myds-react/tag';
import { Callout, CalloutTitle, CalloutContent } from '@govtechmy/myds-react/callout';
import { 
  BookOpen, 
  ChevronRight, 
  Code2, 
  MessageSquare, 
  ShieldCheck,
  Cpu
} from 'lucide-react';
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
      <div style={{ maxWidth: '960px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Step 1 Header Zone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Tag variant="primary" size="small">
              Week {activeDrill.week} Architectural Concept
            </Tag>
            <Tag variant={activeDrill.tier === 3 ? "danger" : activeDrill.tier === 1 ? "primary" : "warning"} size="small">
              Tier {activeDrill.tier} Engine
            </Tag>
            <Tag variant="default" size="small">
              {activeDrill.engine === 'postgresql-docker' ? 'PostgreSQL 16.4 Container' : activeDrill.engine === 'sqlite-wasm' ? 'WASM SQLite 3.45' : 'Simulated Laravel 12'}
            </Tag>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 700, color: 'var(--studio-text)', letterSpacing: '-0.01em' }}>
            {activeDrill.title}
          </h1>
        </div>

        {/* Core Thesis Callout */}
        <Callout variant="info">
          <CalloutTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={18} color="var(--studio-primary)" />
            Architectural Mental Model
          </CalloutTitle>
          <CalloutContent style={{ fontSize: '0.875rem', lineHeight: 1.55 }}>
            {activeDrill.conceptBrief.thesis}
          </CalloutContent>
        </Callout>

        {/* Two-Column Grid: Principles vs Technical Contracts */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', 
          gap: '1rem',
          alignItems: 'stretch'
        }}>
          {/* Left Column: Core Checkpoints */}
          <div style={{ 
            padding: '1.125rem', 
            borderRadius: '8px', 
            border: '1px solid var(--studio-border)', 
            backgroundColor: 'var(--studio-surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} color="var(--studio-primary)" />
              Core Theoretical Checkpoints
            </h2>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.55, fontSize: '0.8125rem', color: 'var(--studio-text-muted)' }}>
              {activeDrill.conceptBrief.keyPoints.map((pt, i) => (
                <li key={i} style={{ marginBottom: '0.625rem', lineHeight: 1.55 }}>
                  {(() => {
                    const colonIdx = pt.indexOf(':');
                    if (colonIdx > 0 && colonIdx < 40) {
                      const heading = pt.slice(0, colonIdx);
                      const detail = pt.slice(colonIdx + 1);
                      return (
                        <>
                          <strong style={{ color: 'var(--studio-text)', fontWeight: 600 }}>{heading}:</strong>
                          <span>{detail}</span>
                        </>
                      );
                    }
                    return pt;
                  })()}
                </li>
              ))}
            </ul>
          </div>

          {/* Right Column: Workbench Contract & Oral Preview */}
          <div style={{ 
            padding: '1.125rem', 
            borderRadius: '8px', 
            border: '1px solid var(--studio-border)', 
            backgroundColor: 'var(--studio-surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.875rem'
          }}>
            <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Code2 size={16} color="var(--studio-primary)" />
              Workbench Target Contract
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--studio-border)' }}>
                <span style={{ color: 'var(--studio-text-muted)' }}>Target File:</span>
                <code style={{ color: 'var(--studio-primary)', fontWeight: 600 }}>{activeDrill.targetFile}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--studio-border)' }}>
                <span style={{ color: 'var(--studio-text-muted)' }}>Validation Mode:</span>
                <span style={{ color: 'var(--studio-text)', fontWeight: 500 }}>{activeDrill.validationRules.type}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--studio-border)' }}>
                <span style={{ color: 'var(--studio-text-muted)' }}>Hints Available:</span>
                <span style={{ color: 'var(--studio-text)', fontWeight: 500 }}>
                  {activeDrill.hints ? `${activeDrill.hints.length} progressive levels available` : 'Available on demand'}
                </span>
              </div>
            </div>

            {/* Oral Rubric Challenge Preview */}
            <div style={{ 
              marginTop: 'auto',
              padding: '0.625rem 0.75rem', 
              borderRadius: '6px', 
              backgroundColor: 'var(--studio-surface-subtle)', 
              borderLeft: '3px solid var(--studio-primary)' 
            }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--studio-primary)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                <MessageSquare size={12} />
                Oral Defense Focus (Step 4)
              </span>
              <p style={{ margin: 0, fontSize: '0.75rem', lineHeight: 1.45, color: 'var(--studio-text-muted)' }}>
                &ldquo;{activeDrill.oralRubric.question}&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid var(--studio-border)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Cpu size={14} color="var(--studio-primary)" />
            Step 1 of 5 • Review concept and proceed when ready
          </span>

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
