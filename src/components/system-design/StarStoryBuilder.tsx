import { useState } from 'react';
import { Button } from '@govtechmy/myds-react/button';
import { Tag } from '@govtechmy/myds-react/tag';
import { Callout, CalloutTitle, CalloutContent } from '@govtechmy/myds-react/callout';
import { Download, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import type { StarStory } from '../../types';

export type { StarStory };

export interface StarStoryBuilderProps {
  onExportRfc?: (rfcMarkdown: string) => void;
  onOpenRubric?: () => void;
  isDark?: boolean;
  stories?: StarStory[];
  onChangeStories?: (stories: StarStory[]) => void;
}

const STORAGE_KEY = 'syscraft-star-stories';

const DEFAULT_STORIES: StarStory[] = [
  {
    id: 'spike-defense',
    title: 'Surge Ingestion & Backpressure Buffer Saturation',
    category: 'Distributed Systems & Queue Backpressure',
    situation: 'A category-5 storm front triggered sensor anomalies across 25,000 meteorological stations, spiking telemetry traffic by 5x (500,000 req/sec) and threatening to exhaust in-memory buffer RAM within 120 seconds.',
    task: 'Prevent gateway cluster failure, maintain zero telemetry loss for primary alert stations, and keep p95 ingestion latency below 50ms without crashing downstream PostgreSQL workers.',
    action: 'Dynamically scaled Redis Streams partition shards from 16 to 64, applied token-bucket rate limiting returning HTTP 429 with Retry-After for non-critical stations, and increased worker batch transaction sizes from 250 to 1,000 rows.',
    result: 'Maintained 99.995% ingress availability, eliminated connection pool exhaustion, and reduced average batch write latency to 28ms with zero data loss on severe alert channels.',
  },
  {
    id: 'replication-lag',
    title: 'Replication Lag & Read Inconsistency during Emergency Broadcast',
    category: 'High-Availability Database Engineering',
    situation: 'During an active flash flood emergency, 150,000 concurrent citizen dashboard users queried real-time station water levels. PostgreSQL streaming replication lag ballooned to 45 seconds, causing public dashboards to display stale metrics.',
    task: 'Eliminate read-after-write anomalies for emergency response personnel while shielding the primary database from read overload.',
    action: 'Implemented read-your-writes routing: authenticated emergency responders were routed to primary via sticky session tokens, while public read traffic was served from a Redis caching layer with a 5-second TTL and HTTP Cache-Control stale-while-revalidate headers.',
    result: 'Offloaded 96% of read traffic from database replicas, eliminated stale read complaints from incident commanders, and maintained dashboard response times under 40ms.',
  },
];

function loadInitialStories(propStories?: StarStory[]): StarStory[] {
  if (propStories && propStories.length > 0) {
    return propStories;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as StarStory[];
        }
      }
    } catch {
      // ignore parse errors
    }
  }
  return DEFAULT_STORIES;
}

export function StarStoryBuilder({ onExportRfc, onOpenRubric, stories: propStories, onChangeStories }: StarStoryBuilderProps) {
  const [localStories, setLocalStories] = useState<StarStory[]>(() => loadInitialStories(propStories));
  const [activeStoryId, setActiveStoryId] = useState<string>('spike-defense');
  const [copied, setCopied] = useState<boolean>(false);

  const stories = propStories && propStories.length > 0 ? propStories : localStories;
  const activeStory = stories.find((s) => s.id === activeStoryId) || stories[0];

  const handleUpdateField = (field: keyof StarStory, value: string) => {
    const updated = stories.map((s) => (s.id === activeStoryId ? { ...s, [field]: value } : s));
    setLocalStories(updated);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
    } catch {
      // ignore quota errors
    }
    onChangeStories?.(updated);
  };

  const generateRfcMarkdown = (): string => {
    const timestamp = new Date().toISOString();
    return `# Architecture RFC: High-Throughput Weather Data Ingestion Pipeline
**Generated via SysCraft Studio** | **Date:** ${timestamp}
**Target SLA:** 99.99% Ingestion Availability | **Throughput:** 100,000 req/sec

---

## 1. Executive Summary
This document specifies the technical design for ingesting, buffering, and persisting real-time sensor observations from 25,000 distributed IoT weather stations. The system is designed to withstand 5x burst traffic surges without data loss.

## 2. Ingestion & Storage Architecture
- **Ingress Gateway:** Edge API Gateway terminating TLS, applying token-bucket rate-limiting, and producing to buffer streams within 15ms.
- **Buffer Mechanism:** Redis Streams with 64 consumer group shards partitioned by \`hash(station_id)\` to guarantee per-station ordering.
- **Worker Batching:** Asynchronous Go/PHP CLI workers processing micro-batches of 500 rows per transaction.
- **Relational Storage:** PostgreSQL 16.4 partitioned by \`RANGE (recorded_at)\` in daily hypertables, maintaining index selectivity and allowing fast partition pruning.

## 3. Defense Interview Stories (STAR Method)

${stories
  .map(
    (s, idx) => `### Story #${idx + 1}: ${s.title}
*Domain: ${s.category}*

* **Situation:** ${s.situation}
* **Task:** ${s.task}
* **Action:** ${s.action}
* **Result:** ${s.result}
`
  )
  .join('\n')}

---
*Verified against Senior Backend Systems Design Standards (SysCraft)*
`;
  };

  const handleExport = () => {
    const md = generateRfcMarkdown();

    // 1. Copy to clipboard
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      void navigator.clipboard.writeText(md).catch(() => {
        // Fallback for restricted clipboard contexts
      });
    }

    // 2. Trigger browser file download
    try {
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `weather-pipeline-rfc-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Ignore
    }

    // 3. Notify parent listener
    if (onExportRfc) {
      onExportRfc(md);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem', overflowY: 'auto' }}>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--studio-border)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--studio-text)' }}>
              STAR Architectural Story Builder
            </h3>
            <Tag variant="primary" size="small">Week 6 Senior Defense</Tag>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--studio-text-muted)' }}>
            Author structured interview defenses for production failure scenarios and export an engineering RFC.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {onOpenRubric && (
            <Button variant="default-outline" size="small" onClick={onOpenRubric}>
              <ShieldCheck size={14} style={{ marginRight: '0.35rem' }} />
              Open Oral Rubric
            </Button>
          )}
          <Button variant="primary-fill" size="small" onClick={handleExport}>
            <Download size={14} style={{ marginRight: '0.35rem' }} />
            {copied ? 'Exported!' : 'Export Architecture RFC'}
          </Button>
        </div>
      </div>

      {/* Story Selector Pills */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {stories.map((story) => {
          const isSelected = story.id === activeStoryId;
          return (
            <button
              key={story.id}
              type="button"
              onClick={() => setActiveStoryId(story.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.85rem',
                borderRadius: '8px',
                border: isSelected ? '1.5px solid var(--studio-primary)' : '1px solid var(--studio-border)',
                background: isSelected ? 'var(--studio-surface-hover)' : 'var(--studio-surface)',
                color: isSelected ? 'var(--studio-text)' : 'var(--studio-text-muted)',
                fontWeight: isSelected ? 600 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Sparkles size={14} color={isSelected ? 'var(--studio-primary)' : 'var(--studio-text-muted)'} />
              <span>{story.title}</span>
            </button>
          );
        })}
      </div>

      {/* Story Content Form */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          background: 'var(--studio-surface)',
          padding: '1rem',
          borderRadius: '10px',
          border: '1px solid var(--studio-border)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--studio-text-muted)', fontWeight: 600 }}>
              {activeStory.category}
            </span>
            <Tag 
              variant={
                [activeStory.situation, activeStory.task, activeStory.action, activeStory.result].filter(v => v.trim().length > 0).length === 4 
                  ? "success" 
                  : "default"
              } 
              size="small"
            >
              {[activeStory.situation, activeStory.task, activeStory.action, activeStory.result].filter(v => v.trim().length > 0).length}/4 Dimensions Complete
            </Tag>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--studio-success)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <CheckCircle2 size={13} /> STAR Structure Aligned
          </span>
        </div>

        {/* Situation */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--studio-text)' }}>
              <span style={{ color: 'var(--studio-primary)', fontWeight: 700 }}>[S]</span> Situation (Context &amp; Incident Scale)
            </label>
            <span style={{ fontSize: '0.6875rem', color: 'var(--studio-text-faint)', fontFamily: 'var(--studio-font-mono)' }}>
              {activeStory.situation.length} chars
            </span>
          </div>
          <textarea
            value={activeStory.situation}
            onChange={(e) => handleUpdateField('situation', e.target.value)}
            rows={2}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--studio-border)',
              background: 'var(--studio-surface-subtle)',
              color: 'var(--studio-text)',
              fontSize: '0.82rem',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Task */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--studio-text)' }}>
              <span style={{ color: 'var(--studio-primary)', fontWeight: 700 }}>[T]</span> Task (Engineering Objective &amp; SLA Boundary)
            </label>
            <span style={{ fontSize: '0.6875rem', color: 'var(--studio-text-faint)', fontFamily: 'var(--studio-font-mono)' }}>
              {activeStory.task.length} chars
            </span>
          </div>
          <textarea
            value={activeStory.task}
            onChange={(e) => handleUpdateField('task', e.target.value)}
            rows={2}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--studio-border)',
              background: 'var(--studio-surface-subtle)',
              color: 'var(--studio-text)',
              fontSize: '0.82rem',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Action */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--studio-text)' }}>
              <span style={{ color: 'var(--studio-primary)', fontWeight: 700 }}>[A]</span> Action (Concrete Systems Engineering Implementation)
            </label>
            <span style={{ fontSize: '0.6875rem', color: 'var(--studio-text-faint)', fontFamily: 'var(--studio-font-mono)' }}>
              {activeStory.action.length} chars
            </span>
          </div>
          <textarea
            value={activeStory.action}
            onChange={(e) => handleUpdateField('action', e.target.value)}
            rows={3}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--studio-border)',
              background: 'var(--studio-surface-subtle)',
              color: 'var(--studio-text)',
              fontSize: '0.82rem',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Result */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--studio-text)' }}>
              <span style={{ color: 'var(--studio-primary)', fontWeight: 700 }}>[R]</span> Result (Measurable Telemetry &amp; Business Impact)
            </label>
            <span style={{ fontSize: '0.6875rem', color: 'var(--studio-text-faint)', fontFamily: 'var(--studio-font-mono)' }}>
              {activeStory.result.length} chars
            </span>
          </div>
          <textarea
            value={activeStory.result}
            onChange={(e) => handleUpdateField('result', e.target.value)}
            rows={2}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--studio-border)',
              background: 'var(--studio-surface-subtle)',
              color: 'var(--studio-text)',
              fontSize: '0.82rem',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>
      </div>

      {/* Helpful Hint Callout */}
      <Callout variant="info">
        <CalloutTitle>Senior Interview Tip</CalloutTitle>
        <CalloutContent>
          In systems interviews, avoid generic statements like "we fixed the performance". Give exact metrics:
          mention throughput changes, latency percentiles (p95/p99), and how failovers were simulated without impacting SLA.
        </CalloutContent>
      </Callout>
    </div>
  );
}
