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

export interface LifecycleStepData {
  id: string;
  stepNum: number;
  label: string;
  sublabel: string;
  phase: 'bootstrap' | 'middleware' | 'resolution' | 'execution' | 'termination';
  explanation: string;
  assumptions: string;
  interviewNote: string;
}

export const LIFECYCLE_STEPS: LifecycleStepData[] = [
  {
    id: 'node-client',
    stepNum: 1,
    label: 'Client HTTP Ingress',
    sublabel: 'GET /api/posts',
    phase: 'bootstrap',
    explanation: 'Client sends raw HTTP request (headers, method, body, cookies). Web server (Nginx/FrankenPHP) routes entry to public/index.php.',
    assumptions: 'Deterministic HTTP/1.1 or HTTP/2 request with standard headers.',
    interviewNote: 'The web server does not execute Laravel logic directly; it invokes PHP-FPM or persistent FrankenPHP worker.',
  },
  {
    id: 'node-index',
    stepNum: 2,
    label: 'public/index.php',
    sublabel: 'Composer Autoload & Entry',
    phase: 'bootstrap',
    explanation: 'Requires vendor/autoload.php and initializes the Laravel application context from bootstrap/app.php.',
    assumptions: 'PSR-4 compliant autoloader pre-compiled for production speed.',
    interviewNote: 'In Laravel 11/12, bootstrap/app.php replaces old Kernel class hierarchies, defining routing and middleware declaratively.',
  },
  {
    id: 'node-kernel',
    stepNum: 3,
    label: 'HTTP Kernel Bootstrap',
    sublabel: 'Config, Providers & Facades',
    phase: 'bootstrap',
    explanation: 'Bootstraps core services: Environment, Config, Exception handling, Service Providers (calls register() then boot() on all registered providers).',
    assumptions: 'Providers register bindings before any service boot() is invoked.',
    interviewNote: 'Crucial interview question: Why is service provider register() separated from boot()? (Register binds singletons; boot runs after ALL bindings exist).',
  },
  {
    id: 'node-global-mw',
    stepNum: 4,
    label: 'Global Middleware',
    sublabel: 'TrustProxies, TrimStrings, CORS',
    phase: 'middleware',
    explanation: 'Request enters pipeline stack. Modifies request headers, checks maintenance mode, sanitizes inputs, and handles CORS preflights.',
    assumptions: 'All global middleware pass without throwing early 503 or 403 responses.',
    interviewNote: 'Middleware uses the Onion pattern (Pipeline design pattern) wrapping around the core route dispatcher.',
  },
  {
    id: 'node-router',
    stepNum: 5,
    label: 'Routing Pipeline',
    sublabel: 'Route Match & Route Middleware',
    phase: 'middleware',
    explanation: 'Matches URI against routes/api.php. Dispatches route-specific middleware (auth:sanctum, throttle:api, role checks).',
    assumptions: 'Route is matched; model route binding resolves implicitly by ID if configured.',
    interviewNote: 'Explain route caching: route:cache generates a fast lookup array, bypassing route compilation on every request.',
  },
  {
    id: 'node-container',
    stepNum: 6,
    label: 'Service Container',
    sublabel: 'Reflection & DI Resolution',
    phase: 'resolution',
    explanation: 'The IoC container inspects PostController constructor parameters using PHP Reflection. Automatically resolves and injects dependencies.',
    assumptions: 'All injected dependencies are registered or resolvable via concrete class names.',
    interviewNote: 'Facade vs DI: Facades dynamically proxy static calls to container bindings via __callStatic(). DI makes dependencies explicit and easy to mock in Pest.',
  },
  {
    id: 'node-controller',
    stepNum: 7,
    label: 'Controller & Eloquent',
    sublabel: 'PostController@index',
    phase: 'execution',
    explanation: 'Business logic runs. Executes Eloquent queries against the data layer. If eager loading is missing, N+1 query loop multiplies queries!',
    assumptions: 'Eager loading with([\'author\', \'comments\']) satisfies query budget <= 3.',
    interviewNote: 'Explain N+1 prevention: Eloquent executes whereIn() queries to batch related rows, rather than fetching in a foreach loop.',
  },
  {
    id: 'node-response',
    stepNum: 8,
    label: 'HTTP Response Creation',
    sublabel: 'JsonResponse (200 OK)',
    phase: 'execution',
    explanation: 'Controller returns JSON payload. Response flows back outward through the middleware pipeline where headers (ETag, Cache-Control) are attached.',
    assumptions: 'Standard application/json content-type returned.',
    interviewNote: 'Controllers can return Eloquent models directly because Laravel implements Jsonable and Arrayable interfaces.',
  },
  {
    id: 'node-terminating',
    stepNum: 9,
    label: 'Terminating Middleware',
    sublabel: 'Session Save & Log Handlers',
    phase: 'termination',
    explanation: 'After response is sent to the client (fast-cgi finish request), terminate() middleware hooks fire to save session data, flush telemetry, and trigger deferred jobs.',
    assumptions: 'Response already delivered to client; cleanup tasks do not delay user latency.',
    interviewNote: 'A common senior interview question: What happens after the client receives the response? (Terminating middleware, queue dispatching).',
  },
];

const PHASE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  bootstrap: { bg: 'rgba(2, 132, 199, 0.12)', text: '#0284c7', border: 'rgba(2, 132, 199, 0.3)' },
  middleware: { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
  resolution: { bg: 'rgba(124, 58, 237, 0.12)', text: '#8b5cf6', border: 'rgba(124, 58, 237, 0.3)' },
  execution: { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
  termination: { bg: 'rgba(100, 116, 139, 0.12)', text: '#94a3b8', border: 'rgba(100, 116, 139, 0.3)' },
};

// Custom React Flow Node Component
function LifecycleCustomNode({ data }: NodeProps) {
  const step = data.step as LifecycleStepData;
  const isActive = Boolean(data.isActive);
  const isPast = Boolean(data.isPast);
  const phaseTheme = PHASE_COLORS[step.phase] || PHASE_COLORS.bootstrap;

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
      {/* Handles */}
      <Handle type="target" position={Position.Top} style={{ background: 'var(--studio-border-strong)', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--studio-border-strong)', width: 8, height: 8 }} />

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
          <span>Active Ingress Packet</span>
        </div>
      )}
    </div>
  );
}

const nodeTypes = {
  lifecycleNode: LifecycleCustomNode,
};

export function LifecycleTracer() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedNodeData, setSelectedNodeData] = useState<LifecycleStepData>(LIFECYCLE_STEPS[0]);
  const [viewMode, setViewMode] = useState<'canvas' | 'table'>('canvas');

  // Auto-play interval
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isPlaying) {
      timer = setInterval(() => {
        setActiveStep((prev) => {
          if (prev >= LIFECYCLE_STEPS.length) {
            setIsPlaying(false);
            return 1;
          }
          return prev + 1;
        });
      }, 2000);
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  // Keep selected node in sync when step changes
  useEffect(() => {
    const stepData = LIFECYCLE_STEPS.find((s) => s.stepNum === activeStep);
    if (stepData) {
      setSelectedNodeData(stepData);
    }
  }, [activeStep]);

  // React Flow Nodes with Custom Node Types
  const nodes: Node[] = useMemo(() => {
    return LIFECYCLE_STEPS.map((step, idx) => {
      const isActive = step.stepNum === activeStep;
      const isPast = step.stepNum < activeStep;

      // 3-column snake layout
      const row = Math.floor(idx / 3);
      const col = row % 2 === 0 ? idx % 3 : 2 - (idx % 3);
      const x = col * 280 + 30;
      const y = row * 160 + 30;

      return {
        id: step.id,
        type: 'lifecycleNode',
        position: { x, y },
        data: {
          step,
          isActive,
          isPast,
        },
      };
    });
  }, [activeStep]);

  // React Flow Edges with SmoothStep
  const edges: Edge[] = useMemo(() => {
    const result: Edge[] = [];
    for (let i = 0; i < LIFECYCLE_STEPS.length - 1; i++) {
      const source = LIFECYCLE_STEPS[i];
      const target = LIFECYCLE_STEPS[i + 1];
      const isEdgeActive = source.stepNum === activeStep;
      const isEdgePast = source.stepNum < activeStep;

      result.push({
        id: `edge-${source.id}-${target.id}`,
        source: source.id,
        target: target.id,
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
  }, [activeStep]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '520px', backgroundColor: 'var(--studio-bg)' }}>
      
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
          <Tag variant="primary" size="small">
            Tier 2: Deterministic Simulation
          </Tag>
          <span style={{ fontSize: '0.8125rem', color: 'var(--studio-text-muted)' }}>
            Step {activeStep} of {LIFECYCLE_STEPS.length}: <strong style={{ color: 'var(--studio-text)' }}>{selectedNodeData.label}</strong>
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
            onClick={() => setActiveStep(prev => Math.min(LIFECYCLE_STEPS.length, prev + 1))}
            disabled={activeStep >= LIFECYCLE_STEPS.length}
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
      <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
        
        {viewMode === 'canvas' ? (
          <div style={{ flex: 1, minHeight: '440px', backgroundColor: 'var(--studio-bg)' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => {
                const s = LIFECYCLE_STEPS.find(item => item.id === node.id);
                if (s) {
                  setActiveStep(s.stepNum);
                  setSelectedNodeData(s);
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
                {LIFECYCLE_STEPS.map((step) => (
                  <tr 
                    key={step.id} 
                    onClick={() => {
                      setActiveStep(step.stepNum);
                      setSelectedNodeData(step);
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
              Step {selectedNodeData.stepNum}/9
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
