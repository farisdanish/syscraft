import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@govtechmy/myds-react/button';
import { Tag } from '@govtechmy/myds-react/tag';
import { Callout, CalloutTitle, CalloutContent } from '@govtechmy/myds-react/callout';
import {
  Sun,
  Moon,
  Play,
  CheckCircle2,
  AlertCircle,
  Flag,
  Lock,
  Sparkles,
  ArrowRight,
  Clock,
  ShieldCheck,
  X,
  Layers,
  Code2,
  Database,
  Cpu,
  Shield
} from 'lucide-react';
import { 
  CURRICULUM_TASKS, 
  resolveTaskStatus, 
  resolveTaskAvailability,
  resolveNextActionableTask,
  resolveCtaPresentation
} from '../../data/curriculumTasks';
import { ResetProgressModal } from '../layout/studio/ResetProgressModal';
import { UtilitiesMenu } from '../common/UtilitiesMenu';
import type { TaskState, HesitationLogItem } from '../../types';
import { 
  getAllTaskStates, 
  getSundayHesitations, 
  clearLearnerProgress, 
  exportEnvelopeJSON, 
  importEnvelopeJSON 
} from '../../services/storage';

interface HomeHubProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onLaunchWorkbench: (week: number) => void;
  onNavigateArchitecture: () => void;
}

export function HomeHub({
  isDark,
  onToggleTheme,
  onLaunchWorkbench,
  onNavigateArchitecture
}: HomeHubProps) {
  const [taskStates, setTaskStates] = useState<Record<string, TaskState>>({});
  const [hesitations, setHesitations] = useState<HesitationLogItem[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  
  // Modal State & Accessibility Refs
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const clearTriggerBtnRef = useRef<HTMLButtonElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load telemetry data from IndexedDB
  const refreshHubData = useCallback(async () => {
    try {
      const storedTasks = await getAllTaskStates();
      const stateMap: Record<string, TaskState> = {};
      for (const t of storedTasks) {
        stateMap[t.taskId] = t;
      }
      setTaskStates(stateMap);

      const unreviewedHesitations = await getSundayHesitations();
      setHesitations(unreviewedHesitations);
    } catch (err) {
      console.error('[HomeHub] Failed to load learner telemetry:', err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadInitialData = async () => {
      try {
        const storedTasks = await getAllTaskStates();
        if (!active) return;
        const stateMap: Record<string, TaskState> = {};
        for (const t of storedTasks) {
          stateMap[t.taskId] = t;
        }
        setTaskStates(stateMap);

        const unreviewedHesitations = await getSundayHesitations();
        if (!active) return;
        setHesitations(unreviewedHesitations);
      } catch (err) {
        console.error('[HomeHub] Failed to load learner telemetry:', err);
      }
    };

    void loadInitialData();
    return () => {
      active = false;
    };
  }, []);



  // Telemetry Metrics
  const activeTasks = CURRICULUM_TASKS.filter(t => t.statusActiveInMvp);
  const totalActive = activeTasks.length;
  
  const masteredCount = activeTasks.filter(t => {
    const s = resolveTaskStatus(t, taskStates[t.id], taskStates);
    return s === 'completed' || s === 'verified';
  }).length;

  const action = resolveNextActionableTask(CURRICULUM_TASKS, taskStates);
  const cta = resolveCtaPresentation(action, CURRICULUM_TASKS);
  const progressPercent = totalActive > 0 ? Math.round((masteredCount / totalActive) * 100) : 0;

  // Actions
  const handleExportEnvelope = async () => {
    try {
      const envelopeStr = await exportEnvelopeJSON();
      const blob = new Blob([envelopeStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `syscraft-envelope-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setNotification({ type: 'success', text: 'Encrypted learner envelope exported successfully.' });
    } catch (err) {
      console.error('[HomeHub] Export failed:', err);
      setNotification({ type: 'danger', text: 'Failed to export envelope: ' + (err instanceof Error ? err.message : String(err)) });
    }
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await importEnvelopeJSON(parsed);
      await refreshHubData();
      setNotification({ type: 'success', text: 'Learner envelope imported successfully.' });
    } catch (err) {
      console.error('[HomeHub] Import failed:', err);
      setNotification({ type: 'danger', text: 'Failed to import envelope: ' + (err instanceof Error ? err.message : String(err)) });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmReset = async () => {
    setShowResetModal(false);
    clearTriggerBtnRef.current?.focus();
    try {
      await clearLearnerProgress();
      await refreshHubData();
      setNotification({ type: 'success', text: 'All learner progress and drill sessions have been reset.' });
    } catch (err) {
      console.error('[HomeHub] Clear failed:', err);
      setNotification({ type: 'danger', text: 'Failed to reset progress: ' + (err instanceof Error ? err.message : String(err)) });
    }
  };

  return (
    <div className="home-container">
      {/* Top Application Header */}
      <header className="home-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: 'var(--studio-primary)',
            color: 'var(--studio-primary-contrast)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.9375rem',
            boxShadow: 'var(--studio-shadow-glow)'
          }}>
            SC
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, color: 'var(--studio-text)', lineHeight: 1.2 }}>
              SysCraft
            </h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)' }}>
              Interactive Systems &amp; Backend Learning Studio
            </span>
          </div>

          {/* Navigation Tabs - Segmented Control */}
          <div style={{ marginLeft: '1.25rem', display: 'inline-flex', alignItems: 'center', backgroundColor: 'var(--studio-surface-subtle)', padding: '2px', borderRadius: '6px', border: '1px solid var(--studio-border)' }}>
            <Button
              id="nav-curriculum-btn"
              variant="default-outline"
              size="small"
              onClick={() => {}}
              style={{ backgroundColor: 'var(--studio-surface-hover)', borderColor: 'var(--studio-border)', padding: '3px 10px', fontWeight: 600 }}
              aria-current="page"
            >
              Curriculum
            </Button>
            <Button
              id="nav-how-it-works-btn"
              variant="default-outline"
              size="small"
              onClick={onNavigateArchitecture}
              style={{ border: 'none', backgroundColor: 'transparent', padding: '3px 10px' }}
              aria-label="View Technical Architecture & How It Works"
            >
              <Layers size={13} style={{ marginRight: '4px' }} />
              How It Works
            </Button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Quick Direct Launch - Sole primary-fill button in header */}
          <Button
            id="hub-launch-workbench-btn"
            variant="primary-fill"
            size="small"
            onClick={() => onLaunchWorkbench(action.week)}
            aria-label={`Open Studio Workbench at Week ${action.week}`}
          >
            <Play size={13} style={{ marginRight: '5px' }} />
            Open Workbench
          </Button>

          {/* Shared Utilities Menu */}
          <UtilitiesMenu
            idPrefix="hub"
            onExportBackup={handleExportEnvelope}
            onImportBackup={() => fileInputRef.current?.click()}
            onOpenResetModal={() => setShowResetModal(true)}
            clearTriggerBtnRef={clearTriggerBtnRef}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportFileChange}
            aria-hidden="true"
          />

          {/* Theme Toggle */}
          <Button
            id="hub-theme-toggle-btn"
            variant="default-outline"
            size="small"
            onClick={onToggleTheme}
            aria-label={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
          >
            {isDark ? <Sun size={14} color="var(--studio-warning)" /> : <Moon size={14} color="var(--studio-primary)" />}
          </Button>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="home-main" style={{ gap: '1rem' }}>
        {/* Banner Notification Toast */}
        {notification && (
          <div style={{ position: 'relative' }}>
            <Callout variant={notification.type === 'success' ? 'success' : 'danger'}>
              <CalloutTitle style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {notification.type === 'success' ? 'Success' : 'Notice'}
                </span>
                <button
                  type="button"
                  onClick={() => setNotification(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '2px' }}
                  aria-label="Dismiss notice"
                >
                  <X size={14} />
                </button>
              </CalloutTitle>
              <CalloutContent>{notification.text}</CalloutContent>
            </Callout>
          </div>
        )}

        {/* Hero Banner: High-Level, Outcome-Oriented */}
        <section className="home-hero" aria-label="Curriculum Overview">
          <div style={{ maxWidth: '840px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
              <Tag variant="primary" size="small">7-Week Backend Engineering Track</Tag>
              <Tag variant="success" size="small">Hands-On Systems Practice</Tag>
            </div>
            <h2 style={{ margin: '0 0 0.45rem 0', fontSize: '1.4rem', fontWeight: 700, color: 'var(--studio-text)', lineHeight: 1.3 }}>
              Master Backend Engineering &amp; Systems Design
            </h2>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--studio-text-muted)', lineHeight: 1.55 }}>
              Interactive code challenges, database query plan labs, and structured architectural defense to prepare you for senior backend interviews and high-scale production systems.
            </p>
            {/* Disciplines Row as Compact Pills with Track Colors */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.65rem' }}>
              <span className="home-topic-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: 'var(--studio-track-framework-subtle)', borderColor: 'rgba(2, 132, 199, 0.25)' }}>
                <Code2 size={13} color="var(--studio-track-framework)" />
                <strong style={{ color: 'var(--studio-text)' }}>Framework Internals:</strong> Lifecycle &amp; N+1 budgets
              </span>
              <span className="home-topic-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: 'var(--studio-track-database-subtle)', borderColor: 'rgba(5, 150, 105, 0.25)' }}>
                <Database size={13} color="var(--studio-track-database)" />
                <strong style={{ color: 'var(--studio-text)' }}>Database Engineering:</strong> B-Tree seeks &amp; EXPLAIN
              </span>
              <span className="home-topic-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: 'var(--studio-track-distributed-subtle)', borderColor: 'rgba(124, 58, 237, 0.25)' }}>
                <Cpu size={13} color="var(--studio-track-distributed)" />
                <strong style={{ color: 'var(--studio-text)' }}>Distributed Queues:</strong> Retries &amp; dead-letter routing
              </span>
              <span className="home-topic-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: 'var(--studio-track-security-subtle)', borderColor: 'rgba(225, 29, 72, 0.25)' }}>
                <Shield size={13} color="var(--studio-track-security)" />
                <strong style={{ color: 'var(--studio-text)' }}>Architecture &amp; Security:</strong> STAR defense &amp; policy gates
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
            <Button
              id="hero-start-drill-btn"
              variant="primary-fill"
              size="medium"
              onClick={() => onLaunchWorkbench(action.week)}
              style={{ fontWeight: 600, whiteSpace: 'nowrap' }}
              aria-label={cta.ariaLabel}
            >
              <Play size={15} style={{ marginRight: '6px' }} />
              {cta.label}
            </Button>

            <Button
              id="hero-how-it-works-btn"
              variant="default-outline"
              size="small"
              onClick={onNavigateArchitecture}
              style={{ whiteSpace: 'nowrap' }}
            >
              <Layers size={13} style={{ marginRight: '5px' }} />
              How It Works &amp; Architecture →
            </Button>
          </div>
        </section>

        {/* Single Slim Summary Bar */}
        <section aria-label="Learner Telemetry Summary" className="home-telemetry-hud">
          {/* Mastery Item */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '220px', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--studio-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Curriculum Mastery
              </span>
              <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--studio-text)' }}>
                {progressPercent}% <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--studio-text-muted)' }}>({masteredCount} of {totalActive} Mastered)</span>
              </span>
            </div>
            <div style={{ flex: 1, minWidth: '70px', height: '7px', backgroundColor: 'var(--studio-border)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ 
                height: '100%', 
                width: `${progressPercent}%`, 
                background: 'linear-gradient(90deg, var(--studio-primary) 0%, var(--studio-success) 100%)', 
                boxShadow: progressPercent > 0 ? '0 0 8px var(--studio-success-glow)' : 'none',
                transition: 'width 0.4s ease' 
              }} />
            </div>
          </div>

          <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--studio-border)' }} />

          {/* Active Drill Item */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={15} color="var(--studio-primary)" />
            <div>
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--studio-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                Active Drill
              </span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--studio-text)' }}>
                {action.kind === 'in_progress'
                  ? `Week ${action.week}: Draft auto-saved`
                  : action.kind === 'review'
                  ? 'None (Curriculum Complete)'
                  : `None (Next: Week ${action.week})`}
              </span>
            </div>
          </div>

          <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--studio-border)' }} />

          {/* Sunday Review Queue */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Flag size={15} color={hesitations.length > 0 ? 'var(--studio-warning)' : 'var(--studio-text-muted)'} />
            <div>
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--studio-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                Sunday Oral Defense
              </span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: hesitations.length > 0 ? 'var(--studio-warning)' : 'var(--studio-text)' }}>
                {hesitations.length > 0 ? `${hesitations.length} Hesitations Flagged` : '0 Queued'}
              </span>
            </div>
          </div>
        </section>

        {/* 7-Week Curriculum Roadmap Matrix: Center Stage! */}
        <section aria-label="Curriculum Matrix">
          <div className="home-section-header">
            <div>
              <h3 className="home-section-title">
                <Layers size={17} color="var(--studio-primary)" />
                7-Week Curriculum Roadmap
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)' }}>
                All 7 modules are active interactive drills across SQLite WASM, Docker PostgreSQL, and Laravel Internals.
              </span>
            </div>
          </div>

          <div className="home-matrix-grid">
            {CURRICULUM_TASKS.map((task) => {
              const state = taskStates[task.id];
              const status = resolveTaskStatus(task, state, taskStates);
              const availability = resolveTaskAvailability(task, status);

              const isCompleted = status === 'completed' || status === 'verified';
              const isVerified = status === 'verified';
              const isInProgress = status === 'in_progress';
              const isLocked = status === 'locked';
              const isPlanned = status === 'planned';

              const track = task.trackDomain || 'framework';
              const trackColorVar = `var(--studio-track-${track})`;

              return (
                <div 
                  key={task.id} 
                  className={`home-module-card ${task.statusActiveInMvp ? 'active-drill' : 'planned-drill'}`}
                  data-track={track}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                    {/* Header Row: Week pill & Status tag */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ 
                        fontSize: '0.6875rem', 
                        fontWeight: 700, 
                        letterSpacing: '0.05em', 
                        color: task.statusActiveInMvp ? trackColorVar : 'var(--studio-text-muted)'
                      }}>
                        WEEK {task.week} • {task.module.toUpperCase()}
                      </span>

                      {/* Status Badges */}
                      {isVerified && <Tag variant="success" size="small"><ShieldCheck size={11} style={{ marginRight: '3px' }} /> Verified (PG 16.4)</Tag>}
                      {!isVerified && isCompleted && <Tag variant="success" size="small"><CheckCircle2 size={11} style={{ marginRight: '3px' }} /> Mastered</Tag>}
                      {isInProgress && <Tag variant="warning" size="small"><Clock size={11} style={{ marginRight: '3px' }} /> In Progress</Tag>}
                      {isLocked && <Tag variant="default" size="small"><Lock size={11} style={{ marginRight: '3px' }} /> Locked</Tag>}
                      {isPlanned && <Tag variant="default" size="small"><Sparkles size={11} style={{ marginRight: '3px' }} /> Planned</Tag>}
                      {!isCompleted && !isInProgress && !isLocked && !isPlanned && (
                        <Tag variant="primary" size="small">Ready to Start</Tag>
                      )}
                    </div>

                    {/* Title */}
                    <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--studio-text)', lineHeight: 1.35 }}>
                      {task.title}
                    </h4>

                    {/* Description */}
                    <p style={{ margin: 0, fontSize: '0.78125rem', color: 'var(--studio-text-muted)', lineHeight: 1.5 }}>
                      {task.description}
                    </p>

                    {/* Meta tags: Estimated Time & Prerequisites */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                      <span style={{ fontSize: '0.71875rem', color: 'var(--studio-text-faint)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={11} /> {task.estimatedMinutes} mins
                      </span>
                      {task.prerequisites.length > 0 && (
                        <span style={{ fontSize: '0.71875rem', color: 'var(--studio-text-faint)' }}>
                          Prereq: Week {task.prerequisites.map(p => p.match(/^w(\d+)/)?.[1] || p).join(', ')}
                        </span>
                      )}
                    </div>

                    {/* Topics Pills */}
                    {task.topics && task.topics.length > 0 && (
                      <div className="home-topics-pills">
                        {task.topics.map((topic, i) => (
                          <span key={i} className="home-topic-pill">{topic}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Action Footer */}
                  <div style={{ borderTop: '1px solid var(--studio-border)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                    {availability === 'active' ? (
                      <Button
                        id={`launch-module-week-${task.week}-btn`}
                        variant={isCompleted ? "default-outline" : (isInProgress ? "primary-fill" : "primary-outline")}
                        size="small"
                        onClick={() => onLaunchWorkbench(task.week)}
                        aria-label={`Launch Week ${task.week} workbench`}
                      >
                        {isCompleted ? (
                          <>
                            <CheckCircle2 size={13} style={{ marginRight: '5px' }} />
                            Review Drill
                          </>
                        ) : isInProgress ? (
                          <>
                            <Play size={13} style={{ marginRight: '5px' }} />
                            Resume Drill
                          </>
                        ) : (
                          <>
                            <ArrowRight size={13} style={{ marginRight: '5px' }} />
                            Launch Workbench
                          </>
                        )}
                      </Button>
                    ) : availability === 'blocked' ? (
                      <Button variant="default-outline" size="small" disabled>
                        <Lock size={12} style={{ marginRight: '5px' }} />
                        Prerequisites Required
                      </Button>
                    ) : (
                      <Button variant="default-outline" size="small" disabled style={{ opacity: 0.65 }}>
                        <Sparkles size={12} style={{ marginRight: '5px' }} />
                        Planned Expansion
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Sunday Hesitation Review Queue Section (if entries exist) */}
        {hesitations.length > 0 && (
          <section aria-label="Sunday Review Queue">
            <div className="home-section-header">
              <h3 className="home-section-title">
                <Flag size={17} color="var(--studio-warning)" />
                Sunday Oral Defense Review Queue ({hesitations.length} items flagged)
              </h3>
            </div>

            <div style={{ 
              backgroundColor: 'var(--studio-surface)', 
              border: '1px solid var(--studio-border)', 
              borderRadius: '8px', 
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--studio-text-muted)' }}>
                Items flagged during drills (excessive retries, failed assertions, or hesitation stalls) are queued here for unscripted oral defense on Sunday.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem', marginTop: '0.25rem' }}>
                {hesitations.map((item) => (
                  <div key={item.id} style={{
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--studio-border)',
                    backgroundColor: 'var(--studio-surface-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Tag variant="warning" size="small">Week {item.week}</Tag>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--studio-text-faint)' }}>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <strong style={{ fontSize: '0.8125rem', color: 'var(--studio-text)' }}>{item.topic}</strong>
                    <div style={{ fontSize: '0.71875rem', color: 'var(--studio-text-muted)' }}>
                      Failed Assertions: {item.failedAssertionCount} • Retries: {item.retryCount}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="home-footer">
        <div>
          <span>SysCraft Studio v1.0.0</span>
          <span style={{ margin: '0 8px' }}>•</span>
          <button
            type="button"
            onClick={onNavigateArchitecture}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: '0.75rem',
              color: 'var(--studio-primary)',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
          >
            How It Works (Technical Realism Architecture)
          </button>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: '0.75rem',
              color: 'var(--studio-danger)',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Clear All Learner Data
          </button>
        </div>
      </footer>

      {/* Accessible WCAG 2.2 AA Reset Confirmation Modal */}
      <ResetProgressModal
        isOpen={showResetModal}
        onClose={() => {
          setShowResetModal(false);
          clearTriggerBtnRef.current?.focus();
        }}
        onConfirm={handleConfirmReset}
        title="Reset All Learner Progress?"
        description="This will clear all saved draft code, drill sessions, oral rubric defense scores, and Sunday review hesitations across all weeks in IndexedDB. This action cannot be undone."
      />
    </div>
  );
}
