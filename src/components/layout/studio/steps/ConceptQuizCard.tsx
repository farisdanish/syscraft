import React, { useState, useRef, useId } from 'react';
import { Tag } from '@govtechmy/myds-react/tag';
import { Callout, CalloutTitle, CalloutContent } from '@govtechmy/myds-react/callout';
import { HelpCircle, CheckCircle2, AlertCircle, Check, X } from 'lucide-react';
import type { ConceptQuiz } from '../../../../types';

export interface ConceptQuizCardProps {
  quiz: ConceptQuiz;
  onVerified?: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

export const ConceptQuizCard: React.FC<ConceptQuizCardProps> = ({
  quiz,
  onVerified,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const questionId = useId();
  const optionsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedOption = quiz.options.find(opt => opt.id === selectedId);
  const isCorrect = selectedOption?.isCorrect ?? false;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const chosen = quiz.options.find(opt => opt.id === id);
    if (chosen?.isCorrect) {
      onVerified?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = (index + 1) % quiz.options.length;
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = (index - 1 + quiz.options.length) % quiz.options.length;
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleSelect(quiz.options[index].id);
      return;
    } else {
      return;
    }

    optionsRef.current[nextIndex]?.focus();
    handleSelect(quiz.options[nextIndex].id);
  };

  return (
    <section
      role="region"
      aria-label="Active Concept Check"
      style={{
        padding: '1.25rem',
        borderRadius: '10px',
        border: '1px solid var(--studio-border)',
        backgroundColor: 'var(--studio-surface)',
        boxShadow: 'var(--studio-shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Header Zone */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <HelpCircle size={18} color="var(--studio-primary)" />
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--studio-text)', letterSpacing: '-0.01em' }}>
            Active Concept Check
          </h2>
          <Tag variant="primary" size="small">
            Diagnostic Micro-Quiz
          </Tag>
        </div>

        <div>
          {isCorrect ? (
            <Tag variant="success" size="small">
              Verified ✓
            </Tag>
          ) : selectedOption ? (
            <Tag variant="warning" size="small">
              Failure Mode
            </Tag>
          ) : (
            <Tag variant="default" size="small">
              Optional Check
            </Tag>
          )}
        </div>
      </div>

      {/* Question Formulation Inset */}
      <div
        id={questionId}
        style={{
          backgroundColor: 'var(--studio-surface-subtle)',
          padding: '0.875rem 1rem',
          borderRadius: '6px',
          borderLeft: '3px solid var(--studio-primary)',
          fontSize: '0.875rem',
          lineHeight: 1.5,
          fontWeight: 500,
          color: 'var(--studio-text)',
        }}
      >
        {quiz.question}
      </div>

      {/* Interactive Options Stack */}
      <div
        role="radiogroup"
        aria-labelledby={questionId}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}
      >
        {quiz.options.map((opt, i) => {
          const isSelected = selectedId === opt.id;
          const letter = OPTION_LETTERS[i] || String(i + 1);

          // Compute contextual border, background, and indicator based on state
          let cardBorder = '1px solid var(--studio-border)';
          let cardBg = 'var(--studio-surface)';
          let cardShadow = 'none';

          if (isSelected) {
            if (opt.isCorrect) {
              cardBorder = '1px solid var(--studio-success-border)';
              cardBg = 'var(--studio-success-subtle)';
              cardShadow = '0 0 12px -2px var(--studio-success-glow)';
            } else {
              cardBorder = '1px solid var(--studio-warning-border)';
              cardBg = 'var(--studio-warning-subtle)';
              cardShadow = '0 0 12px -2px var(--studio-warning-glow)';
            }
          }

          return (
            <button
              key={opt.id}
              ref={el => { optionsRef.current[i] = el; }}
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected || (!selectedId && i === 0) ? 0 : -1}
              onClick={() => handleSelect(opt.id)}
              onKeyDown={e => handleKeyDown(e, i)}
              className="studio-interactive"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.875rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: cardBorder,
                backgroundColor: cardBg,
                boxShadow: cardShadow,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                fontFamily: 'inherit',
                fontSize: '0.8125rem',
                lineHeight: 1.5,
                color: 'var(--studio-text)',
              }}
            >
              {/* Option Letter Indicator / Result Icon */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  flexShrink: 0,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: isSelected
                    ? opt.isCorrect
                      ? 'var(--studio-success)'
                      : 'var(--studio-warning)'
                    : 'var(--studio-surface-subtle)',
                  color: isSelected
                    ? 'var(--studio-text-on-accent)'
                    : 'var(--studio-text-muted)',
                  border: isSelected
                    ? 'none'
                    : '1px solid var(--studio-border)',
                  transition: 'background-color 0.2s ease, color 0.2s ease',
                }}
              >
                {isSelected ? (
                  opt.isCorrect ? <Check size={14} /> : <X size={14} />
                ) : (
                  letter
                )}
              </span>

              {/* Option Label */}
              <span style={{ flex: 1, paddingTop: '1px' }}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Immediate Diagnostic Feedback Banner */}
      {selectedOption && (
        <Callout variant={isCorrect ? 'success' : 'warning'}>
          <CalloutTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isCorrect ? (
              <>
                <CheckCircle2 size={16} color="var(--studio-success)" />
                <span>Mechanism Verified</span>
              </>
            ) : (
              <>
                <AlertCircle size={16} color="var(--studio-warning)" />
                <span>System Failure Mode Detected</span>
              </>
            )}
          </CalloutTitle>
          <CalloutContent style={{ fontSize: '0.8125rem', lineHeight: 1.55 }}>
            <p style={{ margin: 0 }}>
              {selectedOption.explanation}
            </p>
            {!isCorrect && (
              <p style={{ margin: '0.5rem 0 0 0', fontWeight: 500, color: 'var(--studio-text)' }}>
                Select another option to verify the intended production mechanism.
              </p>
            )}
          </CalloutContent>
        </Callout>
      )}
    </section>
  );
};
