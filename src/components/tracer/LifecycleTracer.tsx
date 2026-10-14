import { useState, useEffect, useMemo } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  Handle,
  Position,
  MarkerType,
  type Node, 
  type Edge,
  type NodeProps
} from '@xyflow/react';
import { Button } from '@govtechmy/myds-react/button';
import { Tag } from '@govtechmy/myds-react/tag';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft, 
  Info, 
  Table as TableIcon,
  Activity,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export { 
  type LifecycleStepData, 
  LARAVEL_LIFECYCLE_STEPS, 
  BTREE_INDEX_TRACER_STEPS, 
  LIFECYCLE_STEPS 
} from './tracerSteps';
import { 
  type LifecycleStepData, 
  LARAVEL_LIFECYCLE_STEPS 
} from './tracerSteps';

const PHASE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  bootstrap: { bg: 'rgba(2, 132, 199, 0.12)', text: '#0284c7', border: 'rgba(2, 132, 199, 0.3)' },
  middleware: { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
  resolution: { bg: 'rgba(124, 58, 237, 0.12)', text: '#8b5cf6', border: 'rgba(124, 58, 237, 0.3)' },
  execution: { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
  termination: { bg: 'rgba(100, 116, 139, 0.12)', text: '#94a3b8', border: 'rgba(100, 116, 139, 0.3)' },
};

// Planar snake pipeline handle topology (strictly non-overlapping)
const HANDLE_CONFIGS: Record<number, { target?: Position; source?: Position }> = {
  1: { source: Position.Right },
  2: { target: Position.Left, source: Position.Right },
  3: { target: Position.Left, source: Position.Bottom },
  4: { target: Position.Top, source: Position.Left },
  5: { target: Position.Right, source: Position.Left },
  6: { target: Position.Right, source: Position.Bottom },
  7: { target: Position.Top, source: Position.Right },
  8: { target: Position.Left, source: Position.Right },
  9: { target: Position.Left },
};

export interface LifecycleTracerProps {
  steps?: LifecycleStepData[];
  engineBadge?: string;
  badgeVariant?: 'primary' | 'success' | 'warning' | 'default';
  packetName?: string;
}

// Custom React Flow Node Component
function LifecycleCustomNode({ data }: NodeProps) {
  const step = data.step as LifecycleStepData;
  const isActive = Boolean(data.isActive);
  const isPast = Boolean(data.isPast);
  const packetName = (data.packetName as string) || 'Active Ingress Packet';
  const phaseTheme = PHASE_COLORS[step.phase] || PHASE_COLORS.bootstrap;
  const config = HANDLE_CONFIGS[step.stepNum] || {};

  return (
    <div style={{
      width: '240px',
      borderRadius: '10px',
      backgroundColor: 'var(--studio-surface)',
      border: `2px solid ${isActive ? 'var(--studio-primary)' : isPast ? 'var(--studio-success)' : 'var(--studio-border)'}`,
      boxShadow: isActive ? 'var(--studio-shadow-glow)' : 'var(--studio-shadow-sm)',
      padding: '12px',
      position: 'relative',
      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'pointer',
      transform: isActive ? 'scale(1.03)' : 'scale(1)',
    }}>
      {/* Planar Non-Overlapping Directional Handles */}
      {config.target && (
        <Handle 
          id="target"
          type="target" 
          position={config.target} 
          style={{ 
            background: isActive ? 'var(--studio-primary)' : isPast ? 'var(--studio-success)' : 'var(--studio-border-strong)', 
            width: 8, 
            height: 8,
            border: '2px solid var(--studio-surface)',
          }} 
        />
      )}
      {config.source && (
        <Handle 
          id="source"
          type="source" 
          position={config.source} 
          style={{ 
            background: isActive ? 'var(--studio-primary)' : isPast ? 'var(--studio-success)' : 'var(--studio-border-strong)', 
            width: 8, 
            height: 8,
            border: '2px solid var(--studio-surface)',
          }} 
        />
      )}

      {/* Top Meta Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: isActive ? 'var(--studio-primary)' : isPast ? 'var(--studio-success)' : 'var(--studio-surface-subtle)',
            color: isActive || isPast ? '#ffffff' : 'var(--studio-text-muted)',
            fontSize: '11px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {isPast && !isActive ? '✓' : step.stepNum}
          </span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--studio-text-muted)' }}>
            STEP {step.stepNum}
          </span>
        </div>

        <span style={{
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          padding: '2px 6px',
          borderRadius: '4px',
          backgroundColor: phaseTheme.bg,
          color: phaseTheme.text,
          border: `1px solid ${phaseTheme.border}`
        }}>
          {step.phase}
        </span>
      </div>

      {/* Title */}
      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--studio-text)', marginBottom: '4px' }}>
        {step.label}
      </div>

      {/* Sublabel / Monospace Pill */}
      <div style={{
        fontFamily: 'monospace',
        fontSize: '11px',
        color: isActive ? 'var(--studio-primary)' : 'var(--studio-text-muted)',
        backgroundColor: 'var(--studio-surface-subtle)',
        padding: '3px 6px',
        borderRadius: '4px',
        border: '1px solid var(--studio-border)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {step.sublabel}
      </div>

      {/* Active Glowing Packet Signal */}
      {isActive && (
        <div style={{
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--studio-primary)'
        }}>
          <Sparkles size={12} />
          <span>{packetName}</span>
        </div>
      )}
    </div>
  );
}

const nodeTypes = {
  lifecycleNode: LifecycleCustomNode,
};

export function LifecycleTracer({
  steps = LARAVEL_LIFECYCLE_STEPS,
  engineBadge = 'Tier 2: Deterministic Simulation',
  badgeVariant = 'primary',
  packetName = 'Active Ingress Packet',
}: LifecycleTracerProps = {}) {
  const currentSteps = steps && steps.length > 0 ? steps : LARAVEL_LIFECYCLE_STEPS;

  const [activeStep, setActiveStep] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'canvas' | 'table'>('canvas');

  const selectedNodeData = currentSteps.find((s) => s.stepNum === activeStep) || currentSteps[0];

  // Auto-play interval
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isPlaying) {
      timer = setInterval(() => {
        setActiveStep((prev) => {
          if (prev >= currentSteps.length) {
            setIsPlaying(false);
            return 1;
          }
          return prev + 1;
        });
      }, 2000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, currentSteps.length]);

  // React Flow Nodes with Custom Node Types
  const nodes: Node[] = useMemo(() => {
    return currentSteps.map((step, idx) => {
      const isActive = step.stepNum === activeStep;
      const isPast = step.stepNum < activeStep;

      // 3-column snake layout with comfortable spacing
      const row = Math.floor(idx / 3);
      const col = row % 2 === 0 ? idx % 3 : 2 - (idx % 3);
      const x = col * 300 + 30;
      const y = row * 170 + 30;

      return {
        id: step.id,
        type: 'lifecycleNode',
        position: { x, y },
        data: {
          step,
          isActive,
          isPast,
          packetName,
        },
      };
    });
  }, [activeStep, currentSteps, packetName]);

  // React Flow Edges with SmoothStep & Planar Handle Bindings
  const edges: Edge[] = useMemo(() => {
    const result: Edge[] = [];
    for (let i = 0; i < currentSteps.length - 1; i++) {
      const source = currentSteps[i];
      const target = currentSteps[i + 1];
      const isEdgeActive = source.stepNum === activeStep;
      const isEdgePast = source.stepNum < activeStep;

      result.push({
        id: `edge-${source.id}-${target.id}`,
        source: source.id,
        target: target.id,
        sourceHandle: 'source',
        targetHandle: 'target',
        type: 'smoothstep',
        animated: isEdgeActive,
        style: {
          stroke: isEdgeActive ? 'var(--studio-primary)' : isEdgePast ? 'var(--studio-success)' : 'var(--studio-border-strong)',
          strokeWidth: isEdgeActive ? 3 : 1.5,
          transition: 'stroke 0.25s ease, stroke-width 0.25s ease',
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isEdgeActive ? 'var(--studio-primary)' : isEdgePast ? 'var(--studio-success)' : 'var(--studio-border-strong)',
        },
      });
    }
    return result;
  }, [activeStep, currentSteps]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, backgroundColor: 'var(--studio-bg)' }}>
      
      {/* Simulation Banner & Controls Bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '0.75rem 1.25rem',
        borderBottom: '1px solid var(--studio-border)',
        backgroundColor: 'var(--studio-surface)',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Tag variant={badgeVariant} size="small">
            {engineBadge}
          </Tag>
          <span style={{ fontSize: '0.8125rem', color: 'var(--studio-text-muted)' }}>
            Step {activeStep} of {currentSteps.length}: <strong style={{ color: 'var(--studio-text)' }}>{selectedNodeData.label}</strong>
          </span>
        </div>

        {/* Playback & View Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <Button 
            variant="default-outline" 
            size="small"
            onClick={() => setActiveStep(prev => Math.max(1, prev - 1))}
            disabled={activeStep <= 1}
            aria-label="Previous step"
          >
            <ChevronLeft size={14} />
          </Button>

          <Button 
            variant={isPlaying ? "danger-outline" : "primary-fill"} 
            size="small"
            onClick={() => setIsPlaying(!isPlaying)}
            aria-label={isPlaying ? "Pause simulation" : "Play simulation"}
          >
            {isPlaying ? <Pause size={14} style={{ marginRight: '4px' }} /> : <Play size={14} style={{ marginRight: '4px' }} />}
            {isPlaying ? "Pause" : "Play Flow"}
          </Button>

          <Button 
            variant="default-outline" 
            size="small"
            onClick={() => setActiveStep(prev => Math.min(currentSteps.length, prev + 1))}
            disabled={activeStep >= currentSteps.length}
            aria-label="Next step"
          >
            <ChevronRight size={14} />
          </Button>

          <Button 
            variant="default-outline" 
            size="small"
            onClick={() => {
              setIsPlaying(false);
              setActiveStep(1);
            }}
            aria-label="Reset simulation"
          >
            <RotateCcw size={14} />
          </Button>

          <Button 
            variant="default-outline" 
            size="small"
            onClick={() => setViewMode(viewMode === 'canvas' ? 'table' : 'canvas')}
            aria-label="Toggle accessible table view"
          >
            {viewMode === 'canvas' ? <TableIcon size={14} style={{ marginRight: '4px' }} /> : <Activity size={14} style={{ marginRight: '4px' }} />}
            {viewMode === 'canvas' ? "Table View" : "Flow Canvas"}
          </Button>
        </div>
      </div>

      {/* Main Visual or Accessible Table Body */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        
        {viewMode === 'canvas' ? (
          <div style={{ flex: 1, minHeight: 0, height: '100%', backgroundColor: 'var(--studio-bg)' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => {
                const s = currentSteps.find(item => item.id === node.id);
                if (s) {
                  setActiveStep(s.stepNum);
                }
              }}
              fitView
              attributionPosition="bottom-left"
            >
              <Background color="var(--studio-border-strong)" gap={20} size={1.2} />
              <Controls />
            </ReactFlow>
          </div>
        ) : (
          /* WCAG 2.2 Accessible Table Alternative */
          <div style={{ flex: 1, padding: '1.25rem', overflowY: 'auto', backgroundColor: 'var(--studio-surface)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--studio-border)', textAlign: 'left', color: 'var(--studio-text-muted)' }}>
                  <th style={{ padding: '0.625rem' }}>Step</th>
                  <th style={{ padding: '0.625rem' }}>Component</th>
                  <th style={{ padding: '0.625rem' }}>Phase</th>
                  <th style={{ padding: '0.625rem' }}>Explanation</th>
                </tr>
              </thead>
              <tbody>
                {currentSteps.map((step) => (
                  <tr 
                    key={step.id} 
                    onClick={() => {
                      setActiveStep(step.stepNum);
                    }}
                    style={{ 
                      borderBottom: '1px solid var(--studio-border)',
                      backgroundColor: step.stepNum === activeStep ? 'var(--studio-primary-glow)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <td style={{ padding: '0.625rem', fontWeight: 600 }}>#{step.stepNum}</td>
                    <td style={{ padding: '0.625rem' }}>
                      <strong style={{ color: 'var(--studio-text)' }}>{step.label}</strong>
                      <br />
                      <span style={{ color: 'var(--studio-text-muted)', fontFamily: 'monospace', fontSize: '11px' }}>{step.sublabel}</span>
                    </td>
                    <td style={{ padding: '0.625rem' }}>
                      <Tag variant="primary" size="small">{step.phase}</Tag>
                    </td>
                    <td style={{ padding: '0.625rem', color: 'var(--studio-text)' }}>{step.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Node Inspector Drawer */}
        <div style={{ 
          width: '340px', 
          borderLeft: '1px solid var(--studio-border)',
          backgroundColor: 'var(--studio-surface)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.875rem',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--studio-text-muted)', fontWeight: 700 }}>
              Step Inspector
            </span>
            <Tag variant="success" size="small">
              <CheckCircle2 size={11} style={{ marginRight: '3px' }} />
              Step {selectedNodeData.stepNum}/{currentSteps.length}
            </Tag>
          </div>

          <h4 style={{ margin: 0, fontSize: '1.0625rem', color: 'var(--studio-text)', fontWeight: 700 }}>
            {selectedNodeData.label}
          </h4>
          <div style={{ fontSize: '0.75rem', color: 'var(--studio-primary)', fontFamily: 'monospace' }}>
            <code>{selectedNodeData.sublabel}</code>
          </div>

          <div style={{ fontSize: '0.8125rem', lineHeight: 1.55, color: 'var(--studio-text)' }}>
            {selectedNodeData.explanation}
          </div>

          {/* Stated Assumptions Block */}
          <div style={{ 
            padding: '0.75rem', 
            borderRadius: '8px', 
            backgroundColor: 'var(--studio-surface-subtle)',
            border: '1px solid var(--studio-border)',
            fontSize: '0.75rem'
          }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', color: 'var(--studio-text)' }}>
              <Info size={13} color="var(--studio-primary)" />
              Documented Assumptions:
            </strong>
            <span style={{ color: 'var(--studio-text-muted)', lineHeight: 1.45 }}>{selectedNodeData.assumptions}</span>
          </div>

          {/* Senior Interview Defense Tip */}
          <div style={{ 
            padding: '0.75rem', 
            borderRadius: '8px', 
            backgroundColor: 'var(--studio-primary-glow)',
            borderLeft: '3px solid var(--studio-primary)',
            fontSize: '0.75rem',
            lineHeight: 1.5
          }}>
            <strong style={{ color: 'var(--studio-primary)', display: 'block', marginBottom: '3px' }}>
              Senior Interview Checkpoint:
            </strong>
            <span style={{ color: 'var(--studio-text)' }}>{selectedNodeData.interviewNote}</span>
          </div>
        </div>

      </div>

    </div>
  );
}
