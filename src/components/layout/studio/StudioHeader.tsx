import React from 'react';
import { Button } from '@govtechmy/myds-react/button';
import { Tag } from '@govtechmy/myds-react/tag';
import { 
  Sun, 
  Moon, 
  Flag,
  LayoutDashboard,
  Layers,
  Clock,
  X
} from 'lucide-react';
import { type DrillDefinition } from '../../../types';
import { ACTIVE_WEEKS } from '../../../drills/registry';
import { CURRICULUM_TASKS } from '../../../data/curriculumTasks';
import { type BridgeHealth } from '../../../services/bridgeClient';
import { UtilitiesMenu } from '../../common/UtilitiesMenu';

export interface StudioHeaderProps {
  selectedWeek: number;
  activeDrill: DrillDefinition;
  onSelectWeek: (week: number) => void;
  onNavigateHome?: () => void;
  onNavigateArchitecture?: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  bridgeStatus: BridgeHealth;
  sundayCount: number;
  sprintSeconds: number;
  sprintActive: boolean;
  onToggleSprintActive: () => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
  onOpenResetModal: () => void;
  clearTriggerBtnRef: React.RefObject<HTMLButtonElement | null>;
  importNotice: { type: 'success' | 'danger'; text: string } | null;
  onDismissImportNotice: () => void;
}

function formatSprintTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function StudioHeader({
  selectedWeek,
  activeDrill,
  onSelectWeek,
  onNavigateHome,
  onNavigateArchitecture,
  isDark,
  onToggleTheme,
  bridgeStatus,
  sundayCount,
  sprintSeconds,
  sprintActive,
  onToggleSprintActive,
  onExportBackup,
  onImportBackup,
  onOpenResetModal,
  clearTriggerBtnRef,
  importNotice,
  onDismissImportNotice,
}: StudioHeaderProps) {
  const currentTask = CURRICULUM_TASKS.find(t => t.week === activeDrill.week);
  const currentTrack = currentTask?.trackDomain || 'framework';
  const trackColorVar = `var(--studio-track-${currentTrack})`;
  const trackGlowVar = `var(--studio-track-${currentTrack}-glow)`;

  return (
    <>
      <header className="studio-header">
        {/* Zone 1: Identity & Module Selector */}
        <div className="studio-header-zone-left" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {onNavigateHome && (
            <Button
              id="back-to-hub-btn"
              variant="default-outline"
              size="small"
              onClick={onNavigateHome}
              aria-label="Return to Curriculum Hub"
              style={{ padding: '3px 8px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
            >
              <LayoutDashboard size={13} style={{ marginRight: '5px' }} />
              Curriculum
            </Button>
          )}

          {onNavigateArchitecture && (
            <Button
              id="studio-to-architecture-btn"
              variant="default-outline"
              size="small"
              onClick={onNavigateArchitecture}
              aria-label="View Technical Architecture & How It Works"
              style={{ padding: '3px 8px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
            >
              <Layers size={13} style={{ marginRight: '5px' }} />
              How It Works
            </Button>
          )}

          <div style={{ 
            width: '26px', 
            height: '26px', 
            borderRadius: '6px', 
            backgroundColor: trackColorVar, 
            color: 'var(--studio-primary-contrast)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontWeight: 700, 
            fontSize: '0.75rem',
            boxShadow: `0 0 10px ${trackGlowVar}`,
            flexShrink: 0,
            transition: 'background-color 0.2s ease, box-shadow 0.2s ease'
          }}>
            SC
          </div>

          <select
            id="studio-week-picker"
            value={selectedWeek}
            onChange={(e) => onSelectWeek(Number(e.target.value))}
            aria-label="Select curriculum week"
            className="studio-week-select"
          >
            {ACTIVE_WEEKS.map((wk) => {
              const task = CURRICULUM_TASKS.find(t => t.week === wk);
              return (
                <option key={wk} value={wk}>
                  Week {wk}: {task ? task.module : `Week ${wk}`}
                </option>
              );
            })}
          </select>

          <span style={{ 
            fontSize: '0.8125rem', 
            fontWeight: 600, 
            color: 'var(--studio-text)',
            padding: '2px 8px',
            borderRadius: '6px',
            backgroundColor: 'var(--studio-surface-subtle)',
            border: '1px solid var(--studio-border)',
            flex: 1,
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }} title={activeDrill.title}>
            {activeDrill.title}
          </span>
        </div>

        {/* Zone 2: Context, Tier & Sprint Timer */}
        <div className="studio-header-zone-center">
          <Tag variant={activeDrill.tier === 3 ? "warning" : "primary"} size="small">
            Tier {activeDrill.tier}: {activeDrill.engine === 'postgresql-docker' ? 'Docker PostgreSQL' : activeDrill.engine === 'sqlite-wasm' ? 'WASM SQLite' : 'Simulation'}
          </Tag>

          {/* Week 7 Sprint Timer Badge (if active) */}
          {activeDrill.week === 7 && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: sprintSeconds <= 300 ? 'var(--studio-danger-subtle)' : 'var(--studio-surface-subtle)',
              border: `1px solid ${sprintSeconds <= 300 ? 'var(--studio-danger)' : 'var(--studio-border)'}`,
              fontSize: '0.75rem',
              color: sprintSeconds <= 300 ? 'var(--studio-danger)' : 'var(--studio-text)',
              fontWeight: 600,
              fontFamily: 'var(--studio-font-mono)'
            }}>
              <Clock size={12} color={sprintSeconds <= 300 ? 'var(--studio-danger)' : 'var(--studio-primary)'} />
              <span>Sprint: {formatSprintTime(sprintSeconds)}</span>
              <button
                type="button"
                onClick={onToggleSprintActive}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '0 2px',
                  fontWeight: 700,
                  fontSize: '0.75rem'
                }}
                aria-label={sprintActive ? "Pause Sprint Timer" : "Start Sprint Timer"}
              >
                {sprintActive ? "⏸" : "▶"}
              </button>
            </div>
          )}
        </div>

        {/* Zone 3: Diagnostics, Telemetry & Studio Controls */}
        <div className="studio-header-zone-right">
          <Tag variant={bridgeStatus.connected ? "success" : "default"} size="small">
            <span className={bridgeStatus.connected ? "studio-pulse" : ""} style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: bridgeStatus.connected ? 'var(--studio-success)' : 'var(--studio-text-faint)',
              marginRight: '5px',
              display: 'inline-block'
            }} />
            {bridgeStatus.connected ? "Bridge Active" : "Bridge Offline"}
          </Tag>

          <Tag variant={sundayCount > 0 ? "warning" : "default"} size="small">
            <Flag size={11} style={{ marginRight: '4px' }} />
            Review ({sundayCount})
          </Tag>

          <Button 
            id="theme-toggle-btn"
            variant="default-outline" 
            size="small" 
            onClick={onToggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            style={{ padding: '3px 8px' }}
          >
            {isDark ? <Sun size={13} color="var(--studio-warning)" /> : <Moon size={13} color="var(--studio-primary)" />}
          </Button>

          {/* Grouped Actions: Export / Import / Reset */}
          <UtilitiesMenu
            idPrefix="studio"
            onExportBackup={onExportBackup}
            onImportBackup={onImportBackup}
            onOpenResetModal={onOpenResetModal}
            clearTriggerBtnRef={clearTriggerBtnRef}
          />
        </div>
      </header>

      {/* Dismissible Backup Import / Restore Notice */}
      {importNotice && (
        <div style={{ padding: '0.5rem 1.25rem', backgroundColor: 'var(--studio-surface-subtle)', borderBottom: '1px solid var(--studio-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1200px', margin: '0 auto' }}>
            <span style={{ fontSize: '0.8125rem', color: importNotice.type === 'success' ? 'var(--studio-success)' : 'var(--studio-danger)' }}>
              {importNotice.text}
            </span>
            <Button variant="default-outline" size="small" onClick={onDismissImportNotice} aria-label="Dismiss notice">
              <X size={12} />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
