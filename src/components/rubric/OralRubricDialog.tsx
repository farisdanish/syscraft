import { useState, useEffect } from 'react';
import { Button } from '@govtechmy/myds-react/button';
import { Tag } from '@govtechmy/myds-react/tag';
import { Callout, CalloutTitle, CalloutContent } from '@govtechmy/myds-react/callout';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Flag, 
  Award,
  HelpCircle,
  AlertTriangle
} from 'lucide-react';
import type { RubricDimension, OralRubricScore } from '../../types';
import { saveOralScore, logHesitation } from '../../services/storage';
import { isOralAssessmentComplete, computeOralScore } from '../../services/progressionGates';

interface OralRubricDialogProps {
  drillId: string;
  week: number;
  topic: string;
  question: string;
  checkpoints: Array<{
    dimension: RubricDimension;
    prompt: string;
  }>;
  hintsUsed?: number;
  solutionRevealed?: boolean;
  onCompleted?: (passed: boolean) => void;
}

const RUBRIC_DESCRIPTORS: Record<RubricDimension, Record<number, string>> = {
  correctness: {
    1: 'Inaccurate runtime concepts; misses core execution flow.',
    2: 'Syntax-level recall; omits key underlying runtime mechanics.',
    3: 'Accurate technical explanation; clearly articulates runtime execution order.',
    4: 'Flawless technical explanation; details low-level engine and memory interactions.',
  },
  tradeoff: {
    1: 'One-sided view; unaware of architectural costs or limits.',
    2: 'Mentions pros/cons briefly without systemic trade-off analysis.',
    3: 'Evaluates throughput vs latency, memory, or complexity trade-offs.',
    4: 'Quantifies multi-dimensional production trade-offs with SLA implications.',
  },
  failure: {
    1: 'Assumes happy path; no mention of failure states or crashes.',
    2: 'Identifies basic failure, lacks structured recovery strategy.',
    3: 'Outlines circuit breakers, timeouts, retries, and dead-letter handling.',
    4: 'Comprehensive fault-tolerance strategy including idempotency and cascading failure defense.',
  },
  clarity: {
    1: 'Disorganized delivery; extensive stumbling and filler pauses.',
    2: 'Understandable but rambling; relies on informal analogies.',
    3: 'Structured, professional engineering delivery with precise technical vocabulary.',
    4: 'Executive-ready, crisp, high-signal architectural presentation.',
  },
  challenge: {
    1: 'Unable to defend design choices under critical questioning.',
    2: 'Defends initial choice rigidly without adapting to edge cases.',
    3: 'Receptive to constraints, justifies choices with reasoned technical arguments.',
    4: 'Effortlessly counters challenges with empirical metrics, benchmarks, and fallback options.',
  },
};

function getScoreDescriptor(dimension: RubricDimension, score: number): string {
  return RUBRIC_DESCRIPTORS[dimension]?.[score] || 'Standard assessment criterion.';
}

export function OralRubricDialog({
  drillId,
  week,
  topic,
  question,
  checkpoints,
  hintsUsed = 0,
  solutionRevealed = false,
  onCompleted,
}: OralRubricDialogProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(180); // 3 minutes
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [scores, setScores] = useState<Partial<Record<RubricDimension, number>>>({});
  const [oralNotes, setOralNotes] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [hesitationFlagged, setHesitationFlagged] = useState<boolean>(false);
  const [politeAnnouncement, setPoliteAnnouncement] = useState<string>('');
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [attemptResult, setAttemptResult] = useState<{ passed: boolean; totalScore: number } | null>(null);

  // Timer Countdown with Milestone Announcements
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isTimerRunning && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          const next = prev - 1;
          // Milestone announcements only
          if (next === 120) {
            setPoliteAnnouncement('Oral practice: 2 minutes remaining.');
          } else if (next === 60) {
            setPoliteAnnouncement('Oral practice: 1 minute remaining. Formulate closing trade-off summary.');
          } else if (next === 30) {
            setPoliteAnnouncement('Oral practice: 30 seconds remaining.');
          } else if (next === 0) {
            setIsTimerRunning(false);
            setPoliteAnnouncement('Oral practice timer expired. Complete your rubric self-assessment.');
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, secondsRemaining]);

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleScoreChange = (dim: RubricDimension, val: number) => {
    setScores(prev => ({ ...prev, [dim]: val }));
    setAssessmentError(null);
    setPoliteAnnouncement(`${dim}, ${val} of 4 selected.`);
  };

  const onKeyDownRadioGroup = (e: React.KeyboardEvent, dim: RubricDimension) => {
    const current = scores[dim] ?? 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextVal = Math.min(4, current + 1);
      handleScoreChange(dim, nextVal);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevVal = Math.max(1, current - 1);
      handleScoreChange(dim, prevVal);
    }
  };

  const handleSaveAssessment = async () => {
    if (!isOralAssessmentComplete(scores)) {
      setAssessmentError('Please select a score for all 5 rubric dimensions before submitting.');
      setPoliteAnnouncement('Incomplete rubric: select a rating for all 5 dimensions.');
      return;
    }

    const { total, passed } = computeOralScore(scores);
    setAttemptResult({ passed, totalScore: total });

    const scoreRecord: OralRubricScore = {
      drillId,
      timestamp: new Date().toISOString(),
      dimensionScores: scores as Record<RubricDimension, number>,
      durationSeconds: 180 - secondsRemaining,
      unscriptedPass: passed,
      notes: oralNotes,
    };

    await saveOralScore(scoreRecord);
    setSavedSuccess(true);

    if (!passed) {
      await logHesitation({
        drillId,
        week,
        topic,
        timeToFirstActionSeconds: 0,
        retryCount: 1,
        hintsRequested: 0,
        failedAssertionCount: 0,
        rubricMisses: Object.entries(scores).filter(([, s]) => (s ?? 0) <= 2).map(([d]) => d),
        learnerFlagged: true,
      });
      setHesitationFlagged(true);
      setPoliteAnnouncement(`Oral assessment score ${total} of 20 did not meet the 14-point passing threshold.`);
    } else {
      setPoliteAnnouncement(`Oral defense passed with ${total} of 20 points! Tracer Replay is unlocked.`);
      if (onCompleted) {
        onCompleted(true);
      }
    }
  };

  const handleFlagHesitationManual = async () => {
    await logHesitation({
      drillId,
      week,
      topic,
      timeToFirstActionSeconds: 0,
      retryCount: 0,
      hintsRequested: 0,
      failedAssertionCount: 0,
      rubricMisses: ['Manual learner flag during oral defense'],
      learnerFlagged: true,
    });
    setHesitationFlagged(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', backgroundColor: 'var(--studio-surface)', borderRadius: '8px', border: '1px solid var(--studio-border)', color: 'var(--studio-text)' }}>
      
      {/* Accessible polite announcement region */}
      <div 
        role="status" 
        aria-live="polite" 
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
      >
        {politeAnnouncement}
      </div>

      {/* Header & 3-Min Stopwatch */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--studio-border)', paddingBottom: '0.75rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--studio-text)' }}>
            <Award size={20} color="var(--studio-primary)" />
            Unscripted Oral Recall Defense
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--studio-text-muted)' }}>
            Speak your architectural explanation out loud without reading from notes.
          </p>
        </div>

        {/* Stopwatch Controller with Circular Progress Ring HUD */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div 
            className={secondsRemaining <= 30 && isTimerRunning ? 'studio-timer-urgent' : ''}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              padding: '3px 10px 3px 6px',
              borderRadius: '8px',
              backgroundColor: 'var(--studio-surface-subtle)',
              border: `1.5px solid ${secondsRemaining <= 30 ? 'var(--studio-danger)' : (secondsRemaining <= 60 ? 'var(--studio-warning)' : 'var(--studio-border)')}`,
              transition: 'border-color 0.3s ease'
            }}
          >
            {/* SVG Countdown Ring */}
            <svg width="32" height="32" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke="var(--studio-border)"
                strokeWidth="3.5"
              />
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke={secondsRemaining <= 30 ? 'var(--studio-danger)' : (secondsRemaining <= 60 ? 'var(--studio-warning)' : 'var(--studio-primary)')}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="113.1"
                strokeDashoffset={113.1 * (1 - secondsRemaining / 180)}
                style={{ transition: 'stroke-dashoffset 0.8s linear, stroke 0.3s ease' }}
              />
            </svg>

            <span style={{ 
              fontSize: '1.25rem', 
              fontWeight: 800, 
              color: secondsRemaining <= 30 ? 'var(--studio-danger)' : (secondsRemaining <= 60 ? 'var(--studio-warning)' : 'var(--studio-text)'),
              letterSpacing: '-0.02em',
              lineHeight: 1
            }} className="studio-mono">
              {formatTime(secondsRemaining)}
            </span>
          </div>

          <Button 
            variant={isTimerRunning ? "danger-outline" : "primary-fill"} 
            size="small"
            onClick={() => setIsTimerRunning(!isTimerRunning)}
          >
            {isTimerRunning ? <Pause size={14} style={{ marginRight: '4px' }} /> : <Play size={14} style={{ marginRight: '4px' }} />}
            {isTimerRunning ? "Pause" : "Start 3m Timer"}
          </Button>

          <Button 
            variant="default-outline" 
            size="small"
            onClick={() => {
              setIsTimerRunning(false);
              setSecondsRemaining(180);
            }}
            aria-label="Reset timer to 3 minutes"
          >
            <RotateCcw size={14} />
          </Button>
        </div>
      </div>

      {/* Scaffolding Telemetry Context in Dialog Header (Task 3.1c / Task 5.1) */}
      {(hintsUsed > 0 || solutionRevealed) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          borderRadius: '6px',
          backgroundColor: 'var(--studio-surface-subtle)',
          border: '1px solid var(--studio-border)',
          fontSize: '0.75rem',
          color: 'var(--studio-text-muted)'
        }}>
          <span style={{ fontWeight: 600, color: 'var(--studio-text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <HelpCircle size={13} color="var(--studio-primary)" />
            Learner Session Context:
          </span>
          {hintsUsed > 0 && <Tag variant="default" size="small">💡 {hintsUsed} hint{hintsUsed > 1 ? 's' : ''} consulted</Tag>}
          {solutionRevealed && <Tag variant="warning" size="small">🔓 Solution consulted</Tag>}
          <span style={{ fontSize: '0.6875rem', marginLeft: 'auto', fontStyle: 'italic' }}>
            Contextual only; verbal defense rubric is assessed independently
          </span>
        </div>
      )}

      {/* Oral Prompt Card */}
      <div style={{ padding: '0.875rem', borderRadius: '6px', backgroundColor: 'var(--studio-primary-glow)', borderLeft: '4px solid var(--studio-primary)' }}>
        <strong style={{ fontSize: '0.8125rem', color: 'var(--studio-primary)', display: 'block', marginBottom: '4px' }}>
          INTERVIEW DEFENSE PROMPT:
        </strong>
        <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--studio-text)' }}>
          "{question}"
        </span>
      </div>

      {/* 5-Dimension Qualitative Rubric Grid as Accessible Fieldsets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--studio-text-muted)' }}>
          Self-Assessment Rubric (Use arrow keys to select score 1 to 4):
        </div>

        {checkpoints.map((cp, idx) => {
          const currentScore = scores[cp.dimension];
          return (
            <fieldset 
              key={idx} 
              style={{ 
                padding: '0.875rem', 
                borderRadius: '8px', 
                border: '1px solid var(--studio-border)',
                backgroundColor: 'var(--studio-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.625rem',
                margin: 0
              }}
            >
              <legend style={{ 
                padding: '0 6px', 
                fontSize: '0.8125rem', 
                fontWeight: 700, 
                textTransform: 'capitalize', 
                color: 'var(--studio-text)' 
              }}>
                {idx + 1}. {cp.dimension} Dimension
              </legend>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--studio-text-muted)', lineHeight: 1.45, flex: 1, minWidth: '240px' }}>
                  {cp.prompt}
                </p>
                
                {/* Semantic Accessible Radio Group (1 - 4) with Roving TabIndex & Tiered Level Indicators */}
                <div 
                  role="radiogroup" 
                  aria-label={`${cp.dimension} dimension rating`}
                  style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}
                >
                  {[
                    { score: 1, label: 'L1', tag: 'Novice' },
                    { score: 2, label: 'L2', tag: 'Working' },
                    { score: 3, label: 'L3', tag: 'Target' },
                    { score: 4, label: 'L4', tag: 'Staff' }
                  ].map(({ score: scoreVal, label, tag }) => {
                    const isChecked = currentScore === scoreVal;
                    return (
                      <button
                        key={scoreVal}
                        type="button"
                        role="radio"
                        aria-checked={isChecked}
                        tabIndex={typeof currentScore === 'number' ? (isChecked ? 0 : -1) : (scoreVal === 1 ? 0 : -1)}
                        onClick={() => handleScoreChange(cp.dimension, scoreVal)}
                        onKeyDown={(e) => onKeyDownRadioGroup(e, cp.dimension)}
                        style={{
                          height: '32px',
                          padding: '0 8px',
                          borderRadius: '6px',
                          border: `1.5px solid ${isChecked ? 'var(--studio-primary)' : 'var(--studio-border)'}`,
                          backgroundColor: isChecked ? 'var(--studio-primary)' : 'var(--studio-surface-subtle)',
                          color: isChecked ? 'var(--studio-text-on-accent)' : 'var(--studio-text)',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: isChecked ? '0 0 10px var(--studio-primary-glow)' : 'none'
                        }}
                        aria-label={`${cp.dimension}, ${label} (${tag}), ${isChecked ? 'checked' : 'not checked'}`}
                      >
                        <span>{label}</span>
                        <span style={{ 
                          fontSize: '10px', 
                          fontWeight: 600, 
                          opacity: isChecked ? 0.95 : 0.75,
                          textTransform: 'uppercase'
                        }}>
                          {tag}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Inline Selected Descriptor */}
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--studio-text)',
                backgroundColor: 'var(--studio-surface-subtle)',
                border: '1px solid var(--studio-border)',
                padding: '0.4rem 0.65rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {typeof currentScore === 'number' ? (
                  <>
                    <span style={{ fontWeight: 700, color: 'var(--studio-primary)' }}>
                      Level {currentScore}:
                    </span>
                    <span>{getScoreDescriptor(cp.dimension, currentScore)}</span>
                  </>
                ) : (
                  <span style={{ fontStyle: 'italic', color: 'var(--studio-text-muted)' }}>
                    No rating selected yet. Choose a level (L1–L4) above.
                  </span>
                )}
              </div>

              {/* Scoring Guide Details */}
              <details style={{ fontSize: '0.71875rem', color: 'var(--studio-text-muted)' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--studio-text-muted)' }}>
                  Scoring Guide (Levels 1–4)
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '5px', paddingLeft: '8px' }}>
                  {[1, 2, 3, 4].map((lvl) => (
                    <div key={lvl} style={{ color: lvl === currentScore ? 'var(--studio-primary)' : 'var(--studio-text-muted)' }}>
                      <strong>Level {lvl}:</strong> {getScoreDescriptor(cp.dimension, lvl)}
                    </div>
                  ))}
                </div>
              </details>
            </fieldset>
          );
        })}
      </div>

      {/* Notes Textarea */}
      <div>
        <label htmlFor="oral-notes" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '4px', color: 'var(--studio-text)' }}>
          Unscripted Delivery Notes / Stumble Points:
        </label>
        <textarea
          id="oral-notes"
          value={oralNotes}
          onChange={(e) => setOralNotes(e.target.value)}
          placeholder="Note any concepts you paused or hesitated on (e.g. forgot to mention register vs boot)..."
          rows={3}
          style={{
            width: '100%',
            padding: '0.625rem',
            borderRadius: '6px',
            border: '1px solid var(--studio-border)',
            backgroundColor: 'var(--studio-surface)',
            color: 'var(--studio-text)',
            fontSize: '0.8125rem',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Assessment Feedback Alerts */}
      {assessmentError && (
        <Callout variant="warning">
          <CalloutTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} />
            Incomplete Oral Assessment
          </CalloutTitle>
          <CalloutContent style={{ fontSize: '0.8125rem' }}>
            {assessmentError}
          </CalloutContent>
        </Callout>
      )}

      {attemptResult && !attemptResult.passed && (
        <Callout variant="warning">
          <CalloutTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} />
            Oral Defense Below 14-Point Threshold ({attemptResult.totalScore}/20)
          </CalloutTitle>
          <CalloutContent style={{ fontSize: '0.8125rem' }}>
            Oral recall defense requires at least 14/20 points across all 5 dimensions to unlock Tracer Replay. Review your stumble points above and retry your defense when ready.
          </CalloutContent>
        </Callout>
      )}

      {attemptResult && attemptResult.passed && (
        <Callout variant="success">
          <CalloutTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} />
            Oral Defense Verified ({attemptResult.totalScore}/20)
          </CalloutTitle>
          <CalloutContent style={{ fontSize: '0.8125rem' }}>
            Unscripted oral defense meets Staff-level criteria! Step 5: Tracer Replay is now unlocked.
          </CalloutContent>
        </Callout>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--studio-border)' }}>
        <Button 
          variant={hesitationFlagged ? "danger-outline" : "default-outline"}
          size="small"
          onClick={handleFlagHesitationManual}
          disabled={hesitationFlagged}
        >
          <Flag size={14} style={{ marginRight: '4px' }} />
          {hesitationFlagged ? "Flagged for Sunday Review" : "Flag Hesitation"}
        </Button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {savedSuccess && (
            <Tag variant="success" size="small">
              <CheckCircle2 size={12} style={{ marginRight: '4px' }} />
              Saved to IndexedDB
            </Tag>
          )}

          <Button 
            variant="primary-fill"
            size="medium"
            onClick={handleSaveAssessment}
          >
            Submit Oral Assessment
          </Button>
        </div>
      </div>

    </div>
  );
}
