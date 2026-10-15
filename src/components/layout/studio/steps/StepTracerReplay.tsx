import React, { lazy, Suspense } from 'react';
import { Button } from '@govtechmy/myds-react/button';
import { Tag } from '@govtechmy/myds-react/tag';
import { ChevronLeft, Award } from 'lucide-react';
import type { DrillDefinition } from '../../../../types';
import { 
  LARAVEL_LIFECYCLE_STEPS, 
  BTREE_INDEX_TRACER_STEPS,
  AUTH_POLICY_TRACER_STEPS,
  SENSOR_PIPELINE_TRACER_STEPS,
  CURSOR_PAGINATION_TRACER_STEPS,
  CONTAINER_DI_TRACER_STEPS,
  QUEUE_DLQ_TRACER_STEPS
} from '../../../tracer/tracerSteps';

const LifecycleTracer = lazy(() => 
  import('../../../tracer/LifecycleTracer').then(m => ({ default: m.LifecycleTracer }))
);

export interface StepTracerReplayProps {
  activeDrill: DrillDefinition;
  runtimeSqlVersion: string;
  isMastered: boolean;
  onBackToRubric: () => void;
  onCompleteMastery: () => void;
}

export const StepTracerReplay: React.FC<StepTracerReplayProps> = ({
  activeDrill,
  runtimeSqlVersion,
  isMastered,
  onBackToRubric,
  onCompleteMastery,
}) => {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', overflow: 'hidden' }}>
      <div style={{ 
        padding: '0.5rem 0.875rem', 
        borderRadius: '6px', 
        backgroundColor: 'var(--studio-surface)', 
        border: '1px solid var(--studio-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div>
          <strong style={{ fontSize: '0.8125rem', color: 'var(--studio-text)' }}>
            {activeDrill.week === 1 
              ? 'Step 5: Visual HTTP Request Lifecycle Tracer' 
              : activeDrill.week === 2
              ? 'Step 5: Visual Cursor Seek & RFC 9457 Ingestion Tracer'
              : activeDrill.week === 3
              ? 'Step 5: Visual Dependency Injection & IoC Container Tracer'
              : activeDrill.week === 4
              ? 'Step 5: Visual B-Tree Compound Index & Query Execution Tracer'
              : activeDrill.week === 5
              ? 'Step 5: Visual Resilient Queue & Dead-Letter Pipeline Tracer'
              : activeDrill.week === 6
              ? 'Step 5: Visual Sensor Ingestion Pipeline & Sharded Buffer Tracer'
              : 'Step 5: Visual Session Regeneration & Policy Authorization Gate Tracer'}
          </strong>
          <span style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)', display: 'block' }}>
            {activeDrill.week === 1
              ? 'Interactive state machine visualizing the Laravel request journey from HTTP ingress to terminating middleware.'
              : activeDrill.week === 2
              ? 'Interactive state machine visualizing seek-based cursor traversal, indexed pointer jumps, and RFC 9457 error negotiation.'
              : activeDrill.week === 3
              ? 'Interactive state machine visualizing Laravel Service Container interface resolution, constructor reflection, and singleton caching.'
              : activeDrill.week === 4
              ? 'Interactive state machine visualizing the SQLite storage engine B-Tree index traversal, key seek, and early LIMIT exit.'
              : activeDrill.week === 5
              ? 'Interactive state machine visualizing Redis queue worker popping, exponential retry backoff scheduling, and DLQ quarantine isolation.'
              : activeDrill.week === 6
              ? 'Interactive state machine visualizing high-throughput weather observation telemetry streaming through Redis buffer shards into partitioned PostgreSQL storage.'
              : 'Interactive state machine visualizing secure session ID rotation on login and zero-trust policy authorization gate checks on record mutation.'}
          </span>
        </div>
        <Tag 
          variant={
            activeDrill.week === 1 || activeDrill.week === 2 ? "primary" 
            : activeDrill.week === 3 || activeDrill.week === 4 ? "success" 
            : activeDrill.week === 5 || activeDrill.week === 6 ? "warning" 
            : "danger"
          } 
          size="small"
        >
          {activeDrill.week === 1 
            ? "Week 1: Laravel Internals" 
            : activeDrill.week === 2
            ? "Week 2: API Architecture"
            : activeDrill.week === 3
            ? "Week 3: Clean Architecture"
            : activeDrill.week === 4 
            ? "Week 4: Storage Engine" 
            : activeDrill.week === 5
            ? "Week 5: Async Processing"
            : activeDrill.week === 6 
            ? "Week 6: Systems Design" 
            : "Week 7: Auth & Security"}
        </Tag>
      </div>

      <div style={{ flex: 1, minHeight: 0, borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--studio-border)' }}>
        <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--studio-text-muted)' }}>Loading Lifecycle Tracer...</div>}>
          <LifecycleTracer 
            steps={
              activeDrill.week === 1 
                ? LARAVEL_LIFECYCLE_STEPS 
                : activeDrill.week === 2
                ? CURSOR_PAGINATION_TRACER_STEPS
                : activeDrill.week === 3
                ? CONTAINER_DI_TRACER_STEPS
                : activeDrill.week === 4 
                ? BTREE_INDEX_TRACER_STEPS 
                : activeDrill.week === 5
                ? QUEUE_DLQ_TRACER_STEPS
                : activeDrill.week === 6 
                ? SENSOR_PIPELINE_TRACER_STEPS 
                : AUTH_POLICY_TRACER_STEPS
            }
            engineBadge={
              activeDrill.week === 1 
                ? "Tier 2: Deterministic Simulation" 
                : activeDrill.week === 2
                ? "Tier 1: SQLite WASM / REST Engine"
                : activeDrill.week === 3
                ? "Tier 3: Laravel 12 IoC Container"
                : activeDrill.week === 4 
                ? `Tier 1: SQLite ${runtimeSqlVersion} (WASM Engine)` 
                : activeDrill.week === 5
                ? "Tier 2: Redis / Horizon Worker Sim"
                : activeDrill.week === 6 
                ? "Tier 1: Distributed Pipeline Flow" 
                : "Tier 3: PostgreSQL / Session Store"
            }
            badgeVariant={
              activeDrill.week === 1 || activeDrill.week === 2
                ? "primary" 
                : activeDrill.week === 3 || activeDrill.week === 4 
                ? "success" 
                : activeDrill.week === 5 || activeDrill.week === 6 
                ? "warning" 
                : "danger"
            }
            packetName={
              activeDrill.week === 1 
                ? "Active Ingress Packet" 
                : activeDrill.week === 2
                ? "Seek Cursor Request"
                : activeDrill.week === 3
                ? "Service Resolution Request"
                : activeDrill.week === 4 
                ? "Active Cursor Pointer" 
                : activeDrill.week === 5
                ? "Queue Job Payload"
                : activeDrill.week === 6 
                ? "Sensor Reading Packet" 
                : "Auth Session Token"
            }
          />
        </Suspense>
      </div>

      <div className="studio-step-actions">
        <Button variant="default-outline" size="small" onClick={onBackToRubric}>
          <ChevronLeft size={14} style={{ marginRight: '4px' }} />
          Back to Oral Rubric
        </Button>
        <Button 
          id="complete-mastery-btn"
          variant="primary-fill" 
          size="small" 
          onClick={onCompleteMastery}
        >
          <Award size={14} style={{ marginRight: '4px' }} />
          {isMastered ? "Drill Mastered (5/5 Complete)" : "Mark Drill Mastery Complete"}
        </Button>
      </div>
    </div>
  );
};
