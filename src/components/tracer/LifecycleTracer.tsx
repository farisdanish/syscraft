import { useState, useEffect, useMemo } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  type Node, 
  type Edge,
  MarkerType
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
  Activity
} from 'lucide-react';

interface LifecycleStepData {
  id: string;
  stepNum: number;
  label: string;
  sublabel: string;
  phase: 'bootstrap' | 'middleware' | 'resolution' | 'execution' | 'termination';
  explanation: string;
  assumptions: string;
  interviewNote: string;
}

const LIFECYCLE_STEPS: LifecycleStepData[] = [
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
      }, 1800);
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

  // React Flow Nodes
  const nodes: Node[] = useMemo(() => {
    return LIFECYCLE_STEPS.map((step, idx) => {
      const isActive = step.stepNum === activeStep;
      const isPast = step.stepNum < activeStep;

      // Position in a staggered 3-column snake layout
      const row = Math.floor(idx / 3);
      const col = row % 2 === 0 ? idx % 3 : 2 - (idx % 3);
      const x = col * 260 + 40;
      const y = row * 130 + 40;

      let bgColor = 'var(--bg-white, #ffffff)';
      let borderColor = 'var(--border-washed, #cbd5e1)';
      let textColor = 'var(--txt-black-900, #0f172a)';

      if (isActive) {
        bgColor = '#0284c7';
        borderColor = '#38bdf8';
        textColor = '#ffffff';
      } else if (isPast) {
        bgColor = 'var(--bg-contrast, rgba(0,0,0,0.03))';
        borderColor = '#10b981';
      }

      return {
        id: step.id,
        position: { x, y },
        data: { label: step.label, sublabel: step.sublabel, stepNum: step.stepNum },
        style: {
          background: bgColor,
          color: textColor,
          border: `2px solid ${borderColor}`,
          borderRadius: '8px',
          padding: '10px 14px',
          width: '210px',
          cursor: 'pointer',
          boxShadow: isActive ? '0 0 16px rgba(2, 132, 199, 0.45)' : 'none',
          transition: 'all 0.25s ease',
        },
      };
    });
  }, [activeStep]);

  // React Flow Edges
  const edges: Edge[] = useMemo(() => {
    const result: Edge[] = [];
    for (let i = 0; i < LIFECYCLE_STEPS.length - 1; i++) {
      const source = LIFECYCLE_STEPS[i];
      const target = LIFECYCLE_STEPS[i + 1];
      const isEdgeActive = source.stepNum === activeStep;

      result.push({
        id: `edge-${source.id}-${target.id}`,
        source: source.id,
        target: target.id,
        animated: isEdgeActive,
        style: {
          stroke: isEdgeActive ? '#0284c7' : '#94a3b8',
          strokeWidth: isEdgeActive ? 3 : 1.5,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isEdgeActive ? '#0284c7' : '#94a3b8',
        },
      });
    }
    return result;
  }, [activeStep]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '520px' }}>
      
      {/* Simulation Banner & Controls Bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '0.625rem 1rem',
        borderBottom: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))',
        backgroundColor: 'var(--bg-white, #ffffff)',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Tag variant="primary" size="small">
            Tier 2: Deterministic Simulation
          </Tag>
          <span style={{ fontSize: '0.8125rem', color: 'var(--txt-black-600, #475569)' }}>
            Step {activeStep} of {LIFECYCLE_STEPS.length}: <strong>{selectedNodeData.label}</strong>
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
            {isPlaying ? "Pause" : "Play"}
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
          <div style={{ flex: 1, minHeight: '380px' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
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
              <Background color="#94a3b8" gap={16} size={1} />
              <Controls />
            </ReactFlow>
          </div>
        ) : (
          /* WCAG 2.2 Accessible Table Alternative */
          <div style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-washed, rgba(148, 163, 184, 0.2))', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Step</th>
                  <th style={{ padding: '0.5rem' }}>Component</th>
                  <th style={{ padding: '0.5rem' }}>Phase</th>
                  <th style={{ padding: '0.5rem' }}>Explanation</th>
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
                      borderBottom: '1px solid var(--border-washed, rgba(148, 163, 184, 0.1))',
                      backgroundColor: step.stepNum === activeStep ? 'rgba(2, 132, 199, 0.12)' : 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <td style={{ padding: '0.5rem', fontWeight: 600 }}>#{step.stepNum}</td>
                    <td style={{ padding: '0.5rem' }}><strong>{step.label}</strong><br /><span style={{ color: 'var(--txt-black-500, #64748b)' }}>{step.sublabel}</span></td>
                    <td style={{ padding: '0.5rem' }}><Tag variant="primary" size="small">{step.phase}</Tag></td>
                    <td style={{ padding: '0.5rem' }}>{step.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Node Inspector Drawer */}
        <div style={{ 
          width: '320px', 
          borderLeft: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))',
          backgroundColor: 'var(--bg-white, #ffffff)',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--txt-black-500, #64748b)', fontWeight: 600 }}>
              Step Inspector
            </span>
            <Tag variant="success" size="small">
              Step {selectedNodeData.stepNum}/9
            </Tag>
          </div>

          <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--txt-black-900, #0f172a)' }}>
            {selectedNodeData.label}
          </h4>
          <div style={{ fontSize: '0.75rem', color: 'var(--txt-black-500, #64748b)' }}>
            <code>{selectedNodeData.sublabel}</code>
          </div>

          <div style={{ fontSize: '0.8125rem', lineHeight: 1.5, color: 'var(--txt-black-700, #334155)' }}>
            {selectedNodeData.explanation}
          </div>

          {/* Stated Assumptions Block */}
          <div style={{ 
            padding: '0.625rem', 
            borderRadius: '6px', 
            backgroundColor: 'var(--bg-contrast, rgba(0, 0, 0, 0.03))',
            border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.15))',
            fontSize: '0.75rem'
          }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
              <Info size={12} color="#0284c7" />
              Documented Assumptions:
            </strong>
            <span style={{ color: 'var(--txt-black-600, #475569)' }}>{selectedNodeData.assumptions}</span>
          </div>

          {/* Senior Interview Defense Tip */}
          <div style={{ 
            padding: '0.625rem', 
            borderRadius: '6px', 
            backgroundColor: 'rgba(2, 132, 199, 0.08)',
            borderLeft: '3px solid #0284c7',
            fontSize: '0.75rem',
            lineHeight: 1.45
          }}>
            <strong style={{ color: '#0284c7', display: 'block', marginBottom: '2px' }}>
              Senior Interview Checkpoint:
            </strong>
            {selectedNodeData.interviewNote}
          </div>
        </div>

      </div>

    </div>
  );
}
