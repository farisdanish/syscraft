import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@govtechmy/myds-react/button';
import { Tag } from '@govtechmy/myds-react/tag';
import { Callout, CalloutTitle, CalloutContent } from '@govtechmy/myds-react/callout';
import {
  Sun,
  Moon,
  Play,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Flag,
  Lock,
  Sparkles,
  ArrowRight,
  Clock,
  ShieldCheck,
  X,
  Trash2,
  Layers,
  Code2,
  Database,
  Cpu,
  Shield
} from 'lucide-react';
import { CURRICULUM_TASKS, resolveTaskStatus, resolveTaskAvailability } from '../../data/curriculumTasks';
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
  const cancelResetBtnRef = useRef<HTMLButtonElement | null>(null);
  const confirmResetBtnRef = useRef<HTMLButtonElement | null>(null);
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

  // Modal Keyboard Trap & Escape Key Handler
  useEffect(() => {
    if (!showResetModal) return;

    const timer = setTimeout(() => {
      cancelResetBtnRef.current?.focus();
    }, 40);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowResetModal(false);
        clearTriggerBtnRef.current?.focus();
        return;
      }

      if (e.key === 'Tab') {
        const cancelBtn = cancelResetBtnRef.current;
        const confirmBtn = confirmResetBtnRef.current;
        if (!cancelBtn || !confirmBtn) return;

        if (e.shiftKey) {
          if (document.activeElement === cancelBtn) {
            e.preventDefault();
            confirmBtn.focus();
          }
        } else {
          if (document.activeElement === confirmBtn) {
            e.preventDefault();
            cancelBtn.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showResetModal]);

  // Telemetry Metrics
  const activeTasks = CURRICULUM_TASKS.filter(t => t.statusActiveInMvp);
  const totalActive = activeTasks.length;
  
  const masteredCount = activeTasks.filter(t => {
    const s = resolveTaskStatus(t, taskStates[t.id], taskStates);
    return s === 'completed' || s === 'verified';
  }).length;

  const inProgressTask = activeTasks.find(t => resolveTaskStatus(t, taskStates[t.id], taskStates) === 'in_progress');
  const inProgressCount = activeTasks.filter(t => resolveTaskStatus(t, taskStates[t.id], taskStates) === 'in_progress').length;
  const inProgressWeek = inProgressTask ? inProgressTask.week : 1;
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

          {/* Navigation Tabs */}
          <div style={{ marginLeft: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Button
              variant="primary-fill"
              size="small"
              style={{ fontWeight: 600, padding: '3px 10px' }}
              aria-current="page"
            >
              Curriculum
            </Button>
            <Button
              id="nav-how-it-works-btn"
              variant="default-outline"
              size="small"
              onClick={onNavigateArchitecture}
              style={{ padding: '3px 10px' }}
              aria-label="View Technical Architecture & How It Works"
            >
              <Layers size={13} style={{ marginRight: '4px' }} />
              How It Works
            </Button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Quick Direct Launch */}
          <Button
            id="hub-launch-workbench-btn"
            variant="primary-fill"
            size="small"
            onClick={() => onLaunchWorkbench(1)}
            aria-label="Open Studio Workbench"
          >
            <Play size={13} style={{ marginRight: '5px' }} />
            Open Workbench
          </Button>

          {/* Envelope Export */}
          <Button
            id="hub-export-btn"
            variant="default-outline"
            size="small"
            onClick={handleExportEnvelope}
            aria-label="Export Envelope JSON"
          >
            <Download size={13} style={{ marginRight: '5px' }} />
            Export
          </Button>

          {/* Envelope Import */}
          <Button
            id="hub-import-btn"
            variant="default-outline"
            size="small"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Import Envelope JSON"
          >
            <Upload size={13} style={{ marginRight: '5px' }} />
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportFileChange}
            aria-hidden="true"
          />

          {/* Reset Progress */}
          <Button
            ref={clearTriggerBtnRef}
            id="hub-reset-progress-btn"
            variant="default-outline"
            size="small"
            onClick={() => setShowResetModal(true)}
            aria-label="Reset Learner Progress"
          >
            <RotateCcw size={13} style={{ marginRight: '5px' }} />
            Reset
          </Button>

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
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
            <Button
              id="hero-start-drill-btn"
              variant="primary-fill"
              size="medium"
              onClick={() => onLaunchWorkbench(inProgressCount > 0 ? inProgressWeek : 1)}
              style={{ fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              <Play size={15} style={{ marginRight: '6px' }} />
              {inProgressCount > 0 ? 'Resume In-Progress Drill' : 'Start Week 1: Laravel Internals'}
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

        {/* 4 High-Level Learning Tracks */}
        <section aria-label="Core Engineering Disciplines">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.75rem'
          }}>
            <div style={{
              backgroundColor: 'var(--studio-surface)',
              border: '1px solid var(--studio-border)',
              borderRadius: '8px',
              padding: '0.6rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              boxShadow: 'var(--studio-shadow-sm)'
            }}>
              <Code2 size={20} color="var(--studio-primary)" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: '0.8125rem', color: 'var(--studio-text)', display: 'block' }}>
                  Framework Internals
                </strong>
                <span style={{ fontSize: '0.71875rem', color: 'var(--studio-text-muted)' }}>
                  Request lifecycle &amp; N+1 query budgets
                </span>
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--studio-surface)',
              border: '1px solid var(--studio-border)',
              borderRadius: '8px',
              padding: '0.6rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              boxShadow: 'var(--studio-shadow-sm)'
            }}>
              <Database size={20} color="var(--studio-primary)" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: '0.8125rem', color: 'var(--studio-text)', display: 'block' }}>
                  Database Engineering
                </strong>
                <span style={{ fontSize: '0.71875rem', color: 'var(--studio-text-muted)' }}>
                  B-tree seeks &amp; EXPLAIN plan analysis
                </span>
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--studio-surface)',
              border: '1px solid var(--studio-border)',
              borderRadius: '8px',
              padding: '0.6rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              boxShadow: 'var(--studio-shadow-sm)'
            }}>
              <Cpu size={20} color="var(--studio-primary)" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: '0.8125rem', color: 'var(--studio-text)', display: 'block' }}>
                  Distributed Queues
                </strong>
                <span style={{ fontSize: '0.71875rem', color: 'var(--studio-text-muted)' }}>
                  Idempotency, retries &amp; dead-letter routing
                </span>
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--studio-surface)',
              border: '1px solid var(--studio-border)',
              borderRadius: '8px',
              padding: '0.6rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              boxShadow: 'var(--studio-shadow-sm)'
            }}>
              <Shield size={20} color="var(--studio-primary)" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: '0.8125rem', color: 'var(--studio-text)', display: 'block' }}>
                  Architecture &amp; Security
                </strong>
                <span style={{ fontSize: '0.71875rem', color: 'var(--studio-text-muted)' }}>
                  STAR interview defense &amp; policy gates
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Streamlined Learner Telemetry Progress Strip */}
        <section aria-label="Learner Telemetry">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.75rem'
          }}>
            {/* Progress % */}
            <div className="home-metric-card" style={{ padding: '0.6rem 0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="home-metric-label">Curriculum Mastery</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--studio-primary)' }}>
                  {masteredCount} of {totalActive} Mastered
                </span>
              </div>
              <div className="home-metric-value" style={{ fontSize: '1.35rem', marginTop: '2px' }}>
                <span>{progressPercent}%</span>
              </div>
              <div style={{ 
                height: '4px', 
                backgroundColor: 'var(--studio-border)', 
                borderRadius: '2px', 
                overflow: 'hidden', 
                marginTop: '4px' 
              }}>
                <div style={{ 
                  height: '100%', 
                  width: `${progressPercent}%`, 
                  backgroundColor: 'var(--studio-primary)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>

            {/* In-Progress Modules */}
            <div className="home-metric-card" style={{ padding: '0.6rem 0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="home-metric-label">Active Drill</span>
                <Clock size={14} color="var(--studio-primary)" style={{ opacity: 0.8 }} />
              </div>
              <div className="home-metric-value" style={{ fontSize: '1.35rem', marginTop: '2px' }}>
                <span>{inProgressCount > 0 ? `Week ${inProgressWeek}` : 'None'}</span>
              </div>
              <span className="home-metric-subtext" style={{ fontSize: '0.71875rem' }}>
                {inProgressCount > 0 ? 'Draft progress auto-saved in browser' : 'Select a drill below to begin'}
              </span>
            </div>

            {/* Sunday Review Queue */}
            <div className="home-metric-card" style={{ padding: '0.6rem 0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="home-metric-label">Sunday Oral Defense</span>
                <Flag size={14} color="var(--studio-warning)" style={{ opacity: 0.8 }} />
              </div>
              <div className="home-metric-value" style={{ fontSize: '1.35rem', marginTop: '2px' }}>
                <span style={{ color: hesitations.length > 0 ? 'var(--studio-warning)' : 'inherit' }}>
                  {hesitations.length} Flagged
                </span>
              </div>
              <span className="home-metric-subtext" style={{ fontSize: '0.71875rem' }}>
                {hesitations.length > 0 ? 'Hesitation review items waiting' : 'No review hesitations queued'}
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

              return (
                <div 
                  key={task.id} 
                  className={`home-module-card ${task.statusActiveInMvp ? 'active-drill' : 'planned-drill'}`}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                    {/* Header Row: Week pill & Status tag */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ 
                        fontSize: '0.6875rem', 
                        fontWeight: 700, 
                        letterSpacing: '0.05em', 
                        color: task.statusActiveInMvp ? 'var(--studio-primary)' : 'var(--studio-text-muted)'
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
              color: 'var(--studio-text-faint)',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
          >
            Clear All Learner Data
          </button>
        </div>
      </footer>

      {/* Accessible WCAG 2.2 AA Reset Confirmation Modal */}
      {showResetModal && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
          aria-describedby="reset-modal-desc"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div style={{
            backgroundColor: 'var(--studio-surface)',
            border: '1px solid var(--studio-border)',
            borderRadius: '10px',
            maxWidth: '460px',
            width: '100%',
            padding: '1.25rem',
            boxShadow: 'var(--studio-shadow-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--studio-danger)' }}>
              <AlertCircle size={20} />
              <h3 id="reset-modal-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                Reset All Learner Progress?
              </h3>
            </div>

            <p id="reset-modal-desc" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--studio-text-muted)', lineHeight: 1.5 }}>
              This will clear all saved draft code, drill sessions, oral rubric defense scores, and Sunday review hesitations across all weeks in IndexedDB. This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem' }}>
              <Button
                ref={cancelResetBtnRef}
                variant="default-outline"
                size="small"
                onClick={() => {
                  setShowResetModal(false);
                  clearTriggerBtnRef.current?.focus();
                }}
              >
                Cancel
              </Button>

              <Button
                ref={confirmResetBtnRef}
                variant="danger-fill"
                size="small"
                onClick={handleConfirmReset}
              >
                <Trash2 size={13} style={{ marginRight: '4px' }} />
                Reset Everything
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
