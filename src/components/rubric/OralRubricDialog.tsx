import { useState, useEffect } from 'react';
import { Button } from '@govtechmy/myds-react/button';
import { Tag } from '@govtechmy/myds-react/tag';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Flag, 
  Award
} from 'lucide-react';
import type { RubricDimension, OralRubricScore } from '../../types';
import { saveOralScore, logHesitation } from '../../services/storage';

interface OralRubricDialogProps {
  drillId: string;
  week: number;
  topic: string;
  question: string;
  checkpoints: Array<{
    dimension: RubricDimension;
    prompt: string;
  }>;
  onCompleted?: () => void;
}

export function OralRubricDialog({
  drillId,
  week,
  topic,
  question,
  checkpoints,
  onCompleted,
}: OralRubricDialogProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(180); // 3 minutes
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [scores, setScores] = useState<Record<RubricDimension, number>>({
    correctness: 3,
    tradeoff: 3,
    failure: 3,
    clarity: 3,
    challenge: 3,
  });
  const [oralNotes, setOralNotes] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [hesitationFlagged, setHesitationFlagged] = useState<boolean>(false);
  const [politeAnnouncement, setPoliteAnnouncement] = useState<string>('');

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
  };

  const handleSaveAssessment = async () => {
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const passed = totalScore >= 14; // >= 14 out of 20 is a pass

    const scoreRecord: OralRubricScore = {
      drillId,
      timestamp: new Date().toISOString(),
      dimensionScores: scores,
      durationSeconds: 180 - secondsRemaining,
      unscriptedPass: passed,
      notes: oralNotes,
    };

    await saveOralScore(scoreRecord);
    setSavedSuccess(true);

    if (!passed) {
      // Auto-schedule for Sunday review if oral score < 14
      await logHesitation({
        drillId,
        week,
        topic,
        timeToFirstActionSeconds: 0,
        retryCount: 1,
        hintsRequested: 0,
        failedAssertionCount: 0,
        rubricMisses: Object.entries(scores).filter(([_, s]) => s <= 2).map(([d]) => d),
        learnerFlagged: true,
      });
      setHesitationFlagged(true);
    }

    if (onCompleted) {
      onCompleted();
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', backgroundColor: 'var(--bg-white, #ffffff)', borderRadius: '8px', border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))' }}>
      
      {/* Accessible polite announcement region */}
      <div 
        role="status" 
        aria-live="polite" 
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
      >
        {politeAnnouncement}
      </div>

      {/* Header & 3-Min Stopwatch */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))', paddingBottom: '0.75rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={20} color="#0284c7" />
            Unscripted Oral Recall Defense
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--txt-black-600, #475569)' }}>
            Speak your architectural explanation out loud without reading from notes.
          </p>
        </div>

        {/* Stopwatch Controller */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ 
            fontSize: '1.5rem', 
            fontWeight: 800, 
            fontFamily: 'monospace', 
            color: secondsRemaining <= 30 ? '#dc2626' : '#0284c7',
            padding: '4px 12px',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-contrast, rgba(0,0,0,0.04))'
          }}>
            {formatTime(secondsRemaining)}
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
          >
            <RotateCcw size={14} />
          </Button>
        </div>
      </div>

      {/* Oral Prompt Card */}
      <div style={{ padding: '0.875rem', borderRadius: '6px', backgroundColor: 'rgba(2, 132, 199, 0.08)', borderLeft: '4px solid #0284c7' }}>
        <strong style={{ fontSize: '0.8125rem', color: '#0284c7', display: 'block', marginBottom: '4px' }}>
          INTERVIEW DEFENSE PROMPT:
        </strong>
        <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--txt-black-900, #0f172a)' }}>
          "{question}"
        </span>
      </div>

      {/* 5-Dimension Qualitative Rubric Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--txt-black-700, #334155)' }}>
          Self-Assessment Rubric (Score 1 to 4 per dimension):
        </div>

        {checkpoints.map((cp, idx) => (
          <div key={idx} style={{ 
            padding: '0.75rem', 
            borderRadius: '6px', 
            border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))',
            backgroundColor: 'var(--bg-white, #ffffff)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'capitalize' }}>
                {idx + 1}. {cp.dimension} Checkpoint
              </span>
              
              {/* Score Selector (1 - 4) */}
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {[1, 2, 3, 4].map((scoreVal) => (
                  <button
                    key={scoreVal}
                    type="button"
                    onClick={() => handleScoreChange(cp.dimension, scoreVal)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-washed, #cbd5e1)',
                      backgroundColor: scores[cp.dimension] === scoreVal ? '#0284c7' : 'var(--bg-contrast, rgba(0,0,0,0.03))',
                      color: scores[cp.dimension] === scoreVal ? '#ffffff' : 'var(--txt-black-900, #0f172a)',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                    aria-label={`Score ${scoreVal} for ${cp.dimension}`}
                  >
                    {scoreVal}
                  </button>
                ))}
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--txt-black-600, #475569)', lineHeight: 1.45 }}>
              {cp.prompt}
            </p>
          </div>
        ))}
      </div>

      {/* Notes Textarea */}
      <div>
        <label htmlFor="oral-notes" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '4px' }}>
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
            border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.3))',
            backgroundColor: 'var(--bg-white, #ffffff)',
            color: 'var(--txt-black-900, #0f172a)',
            fontSize: '0.8125rem',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))' }}>
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
