import React from 'react';
import { 
  Dialog, 
  DialogBody,
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter, 
  DialogClose 
} from '@govtechmy/myds-react/dialog';
import { Button } from '@govtechmy/myds-react/button';
import { Tag } from '@govtechmy/myds-react/tag';
import { 
  Award, 
  CheckCircle2, 
  ArrowRight, 
  Download, 
  Sparkles, 
  Terminal, 
  ShieldCheck, 
  Lightbulb, 
  Layers, 
  FileText
} from 'lucide-react';
import type { DrillMasterySummary } from '../../types';

export interface PostDrillSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: DrillMasterySummary | null;
  onAdvanceToNextWeek: (nextWeekNumber: number) => void;
  onReturnToHome: () => void;
  onExportEnvelope: () => void;
}

export const PostDrillSummaryDialog: React.FC<PostDrillSummaryDialogProps> = ({
  open,
  onOpenChange,
  summary,
  onAdvanceToNextWeek,
  onReturnToHome,
  onExportEnvelope,
}) => {
  if (!summary) return null;

  const handleAdvance = () => {
    if (summary.nextWeekNumber) {
      onOpenChange(false);
      onAdvanceToNextWeek(summary.nextWeekNumber);
    } else {
      onOpenChange(false);
      onReturnToHome();
    }
  };

  const handleHome = () => {
    onOpenChange(false);
    onReturnToHome();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogBody 
        id="post-drill-mastery-dialog"
        aria-modal="true"
        aria-labelledby="mastery-summary-title"
        aria-describedby="mastery-summary-description"
        style={{
          maxWidth: '860px',
          width: '94vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--studio-surface)',
          border: '1px solid var(--studio-border-strong)',
          borderRadius: '12px',
          boxShadow: 'var(--studio-shadow-float)',
          overflow: 'hidden',
          padding: 0,
        }}
      >
        {/* Celebratory Banner Header */}
        <div style={{
          position: 'relative',
          padding: '1.25rem 1.5rem',
          background: 'linear-gradient(135deg, var(--studio-surface-subtle) 0%, var(--studio-surface) 100%)',
          borderBottom: '1px solid var(--studio-border)',
          overflow: 'hidden',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Subtle Celebration Glow */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '160px',
            height: '160px',
            borderRadius: '50%',
            background: 'var(--studio-success-glow)',
            filter: 'blur(32px)',
            pointerEvents: 'none',
          }} />

          <DialogHeader style={{ margin: 0, padding: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                backgroundColor: 'var(--studio-success-subtle)',
                border: '1px solid var(--studio-success-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--studio-success)',
                boxShadow: '0 0 12px var(--studio-success-glow)',
                flexShrink: 0
              }}>
                <Award size={24} />
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingRight: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                  <Tag variant="success" size="small">
                    Stage 5/5 Mastered
                  </Tag>
                  <Tag variant="primary" size="small">
                    Week {summary.week}: {summary.module}
                  </Tag>
                  {summary.verificationSource === 'local-runtime' && (
                    <Tag variant="warning" size="small">
                      Authenticated PG 16.4
                    </Tag>
                  )}
                </div>
                <DialogTitle 
                  id="mastery-summary-title"
                  style={{
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    color: 'var(--studio-text)',
                    margin: 0,
                    lineHeight: 1.3
                  }}
                >
                  {summary.title}
                </DialogTitle>
                <DialogDescription 
                  id="mastery-summary-description"
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--studio-text-muted)',
                    margin: '0.2rem 0 0 0'
                  }}
                >
                  Technical assertions verified · Oral defense evaluated · Invariants reinforced · Completed {new Date(summary.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable Multi-Card Scorecard Content */}
        <DialogContent style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          backgroundColor: 'var(--studio-bg)',
          boxSizing: 'border-box',
          maxHeight: 'calc(90vh - 160px)'
        }}>
          {/* Top Row: Two Parallel Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '1rem'
          }}>
            {/* Card 1: Technical & Runtime Verification */}
            <div style={{
              backgroundColor: 'var(--studio-surface)',
              borderRadius: '8px',
              border: '1px solid var(--studio-border)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Terminal size={15} style={{ color: 'var(--studio-primary)' }} />
                  Runtime Verification
                </span>
                <span style={{ 
                  fontSize: '0.6875rem', 
                  padding: '0.15rem 0.5rem', 
                  borderRadius: '4px', 
                  backgroundColor: 'var(--studio-success-subtle)', 
                  color: 'var(--studio-success)',
                  fontWeight: 600
                }}>
                  Tier {summary.tier} {summary.verificationSource === 'local-runtime' ? 'Docker Engine' : summary.tier === 1 ? 'WASM SQLite' : 'Simulation'}
                </span>
              </div>

              {/* Execution Benchmark Telemetry */}
              {summary.benchmark && (
                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  backgroundColor: 'var(--studio-surface-subtle)',
                  border: '1px solid var(--studio-border)',
                  fontSize: '0.75rem'
                }}>
                  {summary.benchmark.queryCount !== undefined && (
                    <div>
                      <span style={{ color: 'var(--studio-text-muted)' }}>Query Count: </span>
                      <strong style={{ color: 'var(--studio-text)' }}>{summary.benchmark.queryCount}</strong>
                    </div>
                  )}
                  {summary.benchmark.reductionPercentage !== undefined && (
                    <div>
                      <span style={{ color: 'var(--studio-text-muted)' }}>Cost Reduction: </span>
                      <strong style={{ color: 'var(--studio-success)' }}>-{summary.benchmark.reductionPercentage}%</strong>
                    </div>
                  )}
                  {summary.benchmark.latencyMs !== undefined && (
                    <div>
                      <span style={{ color: 'var(--studio-text-muted)' }}>Latency: </span>
                      <strong style={{ color: 'var(--studio-text)' }}>{summary.benchmark.latencyMs}ms</strong>
                    </div>
                  )}
                  {summary.benchmark.executionTimeMs !== undefined && (
                    <div>
                      <span style={{ color: 'var(--studio-text-muted)' }}>Exec Time: </span>
                      <strong style={{ color: 'var(--studio-text)' }}>{summary.benchmark.executionTimeMs}ms</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Checklist of Passed Assertions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--studio-text-muted)', fontWeight: 600 }}>
                  Passed Technical Invariants ({summary.assertions.length})
                </span>
                {summary.assertions.map(a => (
                  <div 
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.75rem',
                      color: 'var(--studio-text)',
                      padding: '0.25rem 0'
                    }}
                  >
                    <CheckCircle2 size={14} style={{ color: 'var(--studio-success)', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{a.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 2: Oral Defense Assessment */}
            <div style={{
              backgroundColor: 'var(--studio-surface)',
              borderRadius: '8px',
              border: '1px solid var(--studio-border)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <ShieldCheck size={15} style={{ color: 'var(--studio-accent-violet)' }} />
                  Oral Defense Scorecard
                </span>
                {summary.oralScore ? (
                  <span style={{ 
                    fontSize: '0.75rem', 
                    padding: '0.15rem 0.5rem', 
                    borderRadius: '4px', 
                    backgroundColor: 'var(--studio-accent-violet-subtle)', 
                    color: 'var(--studio-accent-violet)',
                    fontWeight: 700 
                  }}>
                    {summary.oralScore.totalPoints} / {summary.oralScore.maxPoints} ({summary.oralScore.percentage}%)
                  </span>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)' }}>Self-Evaluated</span>
                )}
              </div>

              {summary.oralScore ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[
                    { label: 'Technical Correctness', score: summary.oralScore.scores.correctness },
                    { label: 'Systemic Trade-Offs', score: summary.oralScore.scores.tradeoff },
                    { label: 'Failure Modes & Recovery', score: summary.oralScore.scores.failure },
                    { label: 'Conceptual Clarity', score: summary.oralScore.scores.clarity }
                  ].map(dim => (
                    <div key={dim.label} style={{ fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                        <span style={{ color: 'var(--studio-text-muted)' }}>{dim.label}</span>
                        <strong style={{ color: 'var(--studio-text)' }}>{dim.score} / 4</strong>
                      </div>
                      <div style={{
                        height: '4px',
                        width: '100%',
                        backgroundColor: 'var(--studio-surface-subtle)',
                        borderRadius: '2px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${(dim.score / 4) * 100}%`,
                          backgroundColor: dim.score >= 4 ? 'var(--studio-success)' : dim.score >= 3 ? 'var(--studio-primary)' : 'var(--studio-warning)',
                          borderRadius: '2px',
                          transition: 'width 0.4s ease'
                        }} />
                      </div>
                    </div>
                  ))}

                  {summary.oralScore.deliveryNotes && (
                    <div style={{
                      marginTop: '0.25rem',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '4px',
                      backgroundColor: 'var(--studio-surface-subtle)',
                      borderLeft: '3px solid var(--studio-accent-violet)',
                      fontSize: '0.6875rem',
                      color: 'var(--studio-text-muted)',
                      fontStyle: 'italic'
                    }}>
                      "{summary.oralScore.deliveryNotes}"
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)', fontStyle: 'italic' }}>
                  Oral rubric self-evaluated in Step 4. All rubric dimensions acknowledged.
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Learning Integrity & Pedagogical Telemetry */}
          <div style={{
            backgroundColor: 'var(--studio-surface)',
            borderRadius: '8px',
            border: '1px solid var(--studio-border)',
            padding: '0.875rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: 'var(--studio-primary-subtle)',
                color: 'var(--studio-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Lightbulb size={18} />
              </div>
              <div>
                <strong style={{ fontSize: '0.75rem', color: 'var(--studio-text)', display: 'block' }}>
                  Pedagogical Integrity & Scaffolding
                </strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)' }}>
                  {summary.pedagogicalFraming}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <span style={{
                fontSize: '0.6875rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                backgroundColor: 'var(--studio-surface-subtle)',
                border: '1px solid var(--studio-border)',
                color: 'var(--studio-text-muted)'
              }}>
                Hints: <strong>{summary.hintsUsed}</strong>
              </span>
              <span style={{
                fontSize: '0.6875rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                backgroundColor: 'var(--studio-surface-subtle)',
                border: '1px solid var(--studio-border)',
                color: 'var(--studio-text-muted)'
              }}>
                Solution: <strong>{summary.solutionRevealed ? 'Revealed' : 'Unopened'}</strong>
              </span>
            </div>
          </div>

          {/* Card 4: Key Systems Architecture Takeaways */}
          <div style={{
            backgroundColor: 'var(--studio-surface)',
            borderRadius: '8px',
            border: '1px solid var(--studio-border)',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Layers size={15} style={{ color: 'var(--studio-success)' }} />
              Production Architecture Invariants Mastered
            </span>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.75rem', color: 'var(--studio-text-muted)', lineHeight: 1.6 }}>
              {summary.keyInvariants.map((inv, idx) => (
                <li key={idx} style={{ marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--studio-text)' }}>{inv}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Optional Week 6 STAR Story Snippet */}
          {summary.starStory && (
            <div style={{
              backgroundColor: 'var(--studio-surface)',
              borderRadius: '8px',
              border: '1px solid var(--studio-border)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <FileText size={15} style={{ color: 'var(--studio-primary)' }} />
                STAR Architecture Defense Portfolio Card
              </span>
              <div style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
                <div style={{ padding: '0.35rem 0.5rem', backgroundColor: 'var(--studio-surface-subtle)', borderRadius: '4px' }}>
                  <strong style={{ color: 'var(--studio-text)' }}>Situation: </strong>{summary.starStory.situation}
                </div>
                <div style={{ padding: '0.35rem 0.5rem', backgroundColor: 'var(--studio-surface-subtle)', borderRadius: '4px' }}>
                  <strong style={{ color: 'var(--studio-text)' }}>Task: </strong>{summary.starStory.task}
                </div>
                <div style={{ padding: '0.35rem 0.5rem', backgroundColor: 'var(--studio-surface-subtle)', borderRadius: '4px' }}>
                  <strong style={{ color: 'var(--studio-text)' }}>Action: </strong>{summary.starStory.action}
                </div>
                <div style={{ padding: '0.35rem 0.5rem', backgroundColor: 'var(--studio-surface-subtle)', borderRadius: '4px' }}>
                  <strong style={{ color: 'var(--studio-text)' }}>Result: </strong>{summary.starStory.result}
                </div>
              </div>
            </div>
          )}
        </DialogContent>

        {/* Action Controls Footer */}
        <DialogFooter style={{
          padding: '1rem 1.5rem',
          backgroundColor: 'var(--studio-surface)',
          borderTop: '1px solid var(--studio-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Tertiary Action: Export Proof-of-Work Envelope */}
          <Button 
            id="export-mastery-envelope-btn"
            variant="default-outline" 
            size="small" 
            onClick={onExportEnvelope}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <Download size={14} />
            Download Proof-of-Work Envelope (V2)
          </Button>

          {/* Primary & Secondary Action Cluster */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <DialogClose asChild>
              <Button variant="default-outline" size="small">
                Close
              </Button>
            </DialogClose>

            <Button 
              id="return-curriculum-matrix-btn"
              variant="default-outline" 
              size="small" 
              onClick={handleHome}
            >
              Curriculum Hub
            </Button>

            <Button 
              id="advance-next-week-btn"
              variant="primary-fill" 
              size="small" 
              onClick={handleAdvance}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
            >
              {summary.isCurriculumCompleted ? (
                <>
                  <Sparkles size={14} />
                  Curriculum Complete!
                </>
              ) : (
                <>
                  Advance to Week {summary.nextWeekNumber}
                  <ArrowRight size={14} />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogBody>
    </Dialog>
  );
};
