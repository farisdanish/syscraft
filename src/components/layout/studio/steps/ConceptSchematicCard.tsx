import React, { useState } from 'react';
import { Tag } from '@govtechmy/myds-react/tag';
import { 
  Database, 
  AlertTriangle, 
  Zap, 
  Cpu, 
  GitBranch,
  Repeat
} from 'lucide-react';
import type { DrillDefinition } from '../../../../types';

interface ConceptSchematicCardProps {
  drill: DrillDefinition;
}

export const ConceptSchematicCard: React.FC<ConceptSchematicCardProps> = ({ drill }) => {
  const [activeTab, setActiveTab] = useState<'defect' | 'optimized'>('defect');

  // Render drill-specific visual schematics
  const renderWeek1Schematic = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {/* Toggle Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setActiveTab('defect')}
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeTab === 'defect' ? 'var(--studio-danger)' : 'var(--studio-border)',
              backgroundColor: activeTab === 'defect' ? 'var(--studio-danger-subtle)' : 'var(--studio-surface)',
              color: activeTab === 'defect' ? 'var(--studio-danger)' : 'var(--studio-text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.15s ease'
            }}
          >
            <AlertTriangle size={13} />
            Defect: N+1 Loop Explosion (51 Queries)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('optimized')}
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeTab === 'optimized' ? 'var(--studio-success)' : 'var(--studio-border)',
              backgroundColor: activeTab === 'optimized' ? 'var(--studio-success-subtle)' : 'var(--studio-surface)',
              color: activeTab === 'optimized' ? 'var(--studio-success)' : 'var(--studio-text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.15s ease'
            }}
          >
            <Zap size={13} />
            Solution: Batched Eager Loading (≤3 Queries)
          </button>
        </div>

        {/* Visual Diagram Box */}
        {activeTab === 'defect' ? (
          <div style={{
            padding: '1rem',
            borderRadius: '8px',
            backgroundColor: 'var(--studio-surface-subtle)',
            border: '1px solid var(--studio-danger-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--studio-danger)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Repeat size={14} />
                Unoptimized Access inside foreach ($posts as $post)
              </span>
              <Tag variant="danger" size="small">51 Database Roundtrips</Tag>
            </div>

            {/* Architecture Node Flow */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'center' }}>
              {/* Step 1 Node */}
              <div style={{ padding: '0.65rem', borderRadius: '6px', backgroundColor: 'var(--studio-surface)', border: '1px solid var(--studio-border)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--studio-text-faint)', textTransform: 'uppercase', fontWeight: 600 }}>1. Controller Ingress</div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--studio-text)', marginTop: '2px' }}>Post::all()</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--studio-text-muted)', marginTop: '4px' }}>Issues 1 query to fetch 25 post rows.</div>
              </div>

              {/* Step 2 Node (The multiplier loop) */}
              <div style={{ padding: '0.65rem', borderRadius: '6px', backgroundColor: 'var(--studio-danger-subtle)', border: '1px solid var(--studio-danger-border)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--studio-danger)', textTransform: 'uppercase', fontWeight: 700 }}>2. Relation Access in Loop</div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--studio-text)', marginTop: '2px' }}>$post-&gt;author &amp; comments</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--studio-danger)', marginTop: '4px' }}>Fires 2 roundtrips PER row (25 &times; 2 = 50 queries)!</div>
              </div>

              {/* Step 3 Node (Database saturation) */}
              <div style={{ padding: '0.65rem', borderRadius: '6px', backgroundColor: 'var(--studio-surface)', border: '1px solid var(--studio-border)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--studio-text-faint)', textTransform: 'uppercase', fontWeight: 600 }}>3. Database Saturation</div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--studio-danger)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Database size={14} /> Total: 51 Queries
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--studio-text-muted)', marginTop: '4px' }}>Connection starvation &amp; high I/O latency.</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            padding: '1rem',
            borderRadius: '8px',
            backgroundColor: 'var(--studio-surface-subtle)',
            border: '1px solid var(--studio-success-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--studio-success)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Zap size={14} />
                Eager Pre-Loading with Post::with([...])-&gt;get()
              </span>
              <Tag variant="success" size="small">Collapsed to &le; 3 Queries</Tag>
            </div>

            {/* Architecture Node Flow */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'center' }}>
              {/* Step 1 Node */}
              <div style={{ padding: '0.65rem', borderRadius: '6px', backgroundColor: 'var(--studio-surface)', border: '1px solid var(--studio-border)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--studio-text-faint)', textTransform: 'uppercase', fontWeight: 600 }}>1. Declarative Ingress</div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--studio-track-framework)', marginTop: '2px' }}>Post::with([...])-&gt;get()</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--studio-text-muted)', marginTop: '4px' }}>Tells Eloquent up-front what relations are needed.</div>
              </div>

              {/* Step 2 Node */}
              <div style={{ padding: '0.65rem', borderRadius: '6px', backgroundColor: 'var(--studio-success-subtle)', border: '1px solid var(--studio-success-border)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--studio-success)', textTransform: 'uppercase', fontWeight: 700 }}>2. Batched WHERE IN Queries</div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--studio-text)', marginTop: '2px' }}>WHERE post_id IN (...)</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--studio-success)', marginTop: '4px' }}>All related records loaded in 2 batched roundtrips!</div>
              </div>

              {/* Step 3 Node */}
              <div style={{ padding: '0.65rem', borderRadius: '6px', backgroundColor: 'var(--studio-surface)', border: '1px solid var(--studio-border)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--studio-text-faint)', textTransform: 'uppercase', fontWeight: 600 }}>3. Optimal Throughput</div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--studio-success)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Database size={14} /> Total: &le; 3 Queries
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--studio-text-muted)', marginTop: '4px' }}>Constant O(1) query budget regardless of row count.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Generic fallback schematic for other weeks
  const renderGenericSchematic = () => {
    return (
      <div style={{
        padding: '1rem',
        borderRadius: '8px',
        backgroundColor: 'var(--studio-surface-subtle)',
        border: '1px solid var(--studio-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--studio-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Cpu size={14} />
            Architecture Contract: {drill.title}
          </span>
          <Tag variant="primary" size="small">Tier {drill.tier} Runtime</Tag>
        </div>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--studio-text-muted)', lineHeight: 1.5 }}>
          {drill.conceptBrief.thesis}
        </p>
      </div>
    );
  };

  return (
    <div style={{
      padding: '1rem',
      borderRadius: '8px',
      border: '1px solid var(--studio-border)',
      backgroundColor: 'var(--studio-surface)',
      boxShadow: 'var(--studio-shadow-sm)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ 
          margin: 0, 
          fontSize: '0.875rem', 
          fontWeight: 700, 
          textTransform: 'uppercase', 
          letterSpacing: '0.04em',
          color: 'var(--studio-text)', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px' 
        }}>
          <GitBranch size={16} color="var(--studio-primary)" />
          Architectural Dataflow Schematic
        </h2>
        <span style={{ fontSize: '0.6875rem', color: 'var(--studio-text-muted)' }}>
          Spatial Mental Model
        </span>
      </div>

      {drill.week === 1 ? renderWeek1Schematic() : renderGenericSchematic()}
    </div>
  );
};
