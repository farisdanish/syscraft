import React, { useState, useMemo } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  Handle,
  Position,
  MarkerType,
  BackgroundVariant,
  type Node, 
  type Edge,
  type NodeProps
} from '@xyflow/react';
import { Button } from '@govtechmy/myds-react/button';
import { Table as TableIcon, Network, Shield } from 'lucide-react';

interface ArchitectureTopologyProps {
  isDark: boolean;
  bridgeConnected: boolean;
}

// Custom Node for Architecture Topology
const TopologyNodeComponent: React.FC<NodeProps> = ({ data }) => {
  const isHealthy = data.healthy !== false;
  return (
    <div style={{
      width: '230px',
      padding: '10px 12px',
      borderRadius: '8px',
      backgroundColor: 'var(--studio-surface)',
      border: `1.5px solid ${data.isBridge && !isHealthy ? 'var(--studio-warning)' : 'var(--studio-border-strong)'}`,
      boxShadow: 'var(--studio-shadow-sm)',
      color: 'var(--studio-text)',
      fontSize: '0.75rem',
      position: 'relative',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: 'var(--studio-primary)', width: 7, height: 7 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', gap: '4px' }}>
        <span style={{ fontWeight: 700, color: 'var(--studio-text-bright)', fontSize: '0.78125rem' }}>
          {String(data.label || '')}
        </span>
        {data.badge ? (
          <span style={{ 
            fontSize: '0.625rem', 
            padding: '1px 5px', 
            borderRadius: '4px', 
            backgroundColor: data.badgeVariant === 'success' ? 'var(--studio-success-subtle)' : data.badgeVariant === 'warning' ? 'var(--studio-warning-subtle)' : 'var(--studio-surface-subtle)',
            color: data.badgeVariant === 'success' ? 'var(--studio-success)' : data.badgeVariant === 'warning' ? 'var(--studio-warning)' : 'var(--studio-text-muted)',
            fontWeight: 600,
            whiteSpace: 'nowrap'
          }}>
            {String(data.badge)}
          </span>
        ) : null}
      </div>
      <p style={{ margin: 0, fontSize: '0.6875rem', color: 'var(--studio-text-muted)', lineHeight: 1.35 }}>
        {String(data.description || '')}
      </p>
      <div style={{ marginTop: '6px', fontSize: '0.625rem', color: 'var(--studio-text-faint)', borderTop: '1px solid var(--studio-border)', paddingTop: '4px' }}>
        {String(data.runtime || '')}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: 'var(--studio-primary)', width: 7, height: 7 }} />
    </div>
  );
};

// Group Node representing Docker Isolated Network
const NetworkGroupComponent: React.FC<NodeProps> = ({ data }) => {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      borderRadius: '10px',
      border: '2px dashed var(--studio-primary)',
      backgroundColor: 'var(--studio-primary-subtle)',
      padding: '10px 14px',
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--studio-primary)' }}>
        <Shield size={14} />
        <span>{String(data.label || 'syscraft-testnet (internal: true, zero egress)')}</span>
      </div>
      <span style={{ fontSize: '0.6875rem', color: 'var(--studio-text-muted)', display: 'block', marginTop: '2px' }}>
        Isolated Docker Bridge Network • No WAN / Host Routing
      </span>
    </div>
  );
};

export const ArchitectureTopology: React.FC<ArchitectureTopologyProps> = ({
  bridgeConnected,
}) => {
  const [showTableView, setShowTableView] = useState<boolean>(false);

  const nodeTypes = useMemo(() => ({
    topoNode: TopologyNodeComponent,
    netGroup: NetworkGroupComponent,
  }), []);

  const nodes: Node[] = useMemo(() => [
    // Client UI
    {
      id: 'client-gui',
      type: 'topoNode',
      position: { x: 20, y: 140 },
      data: {
        label: 'Browser Client',
        description: 'React 19 SPA, Monaco Editor, Zustand & IndexedDB v2',
        runtime: 'Web Standards / Chrome / Firefox',
        badge: 'UI Layer',
        badgeVariant: 'default',
      },
    },
    // Tier 1: WASM
    {
      id: 'tier1-wasm',
      type: 'topoNode',
      position: { x: 310, y: 30 },
      data: {
        label: 'Tier 1: Browser WASM',
        description: 'In-browser SQLite engine with EXPLAIN plan semantic parser',
        runtime: 'sql.js@1.12.0 WebAssembly',
        badge: 'Online (3.45.2)',
        badgeVariant: 'success',
      },
    },
    // Tier 2: FSM Sim
    {
      id: 'tier2-fsm',
      type: 'topoNode',
      position: { x: 310, y: 150 },
      data: {
        label: 'Tier 2: Deterministic Sim',
        description: '9-Step state machine simulating HTTP lifecycle & queue budgets',
        runtime: 'Pure TypeScript State Machine',
        badge: 'Online (FSM)',
        badgeVariant: 'success',
      },
    },
    // Tier 3: Network Isolation Boundary Group
    {
      id: 'group-docker-net',
      type: 'netGroup',
      position: { x: 290, y: 270 },
      style: { width: 620, height: 180 },
      data: {
        label: 'syscraft-testnet (internal: true, zero egress)',
      },
    },
    // Tier 3 Nodes inside Docker boundary
    {
      id: 'tier3-bridge',
      type: 'topoNode',
      position: { x: 310, y: 330 },
      data: {
        label: 'Tier 3: Local Bridge',
        description: 'Loopback daemon executing process-group isolated tests',
        runtime: 'Node.js 20+ on 127.0.0.1:49152',
        badge: bridgeConnected ? 'Connected' : 'Offline',
        badgeVariant: bridgeConnected ? 'success' : 'warning',
        isBridge: true,
        healthy: bridgeConnected,
      },
    },
    {
      id: 'tier3-runner',
      type: 'topoNode',
      position: { x: 620, y: 330 },
      data: {
        label: 'PHP Runner Container',
        description: 'Read-only ephemeral mount (/workspace/submission:ro)',
        runtime: 'syscraft/php-runner:8.3',
        badge: 'Testbed Prototype',
        badgeVariant: 'default',
      },
    },
    {
      id: 'tier3-postgres',
      type: 'topoNode',
      position: { x: 920, y: 330 },
      data: {
        label: 'PostgreSQL 16.4 Container',
        description: 'Isolated test database with real PDO query logging',
        runtime: 'postgres:16.4-alpine',
        badge: 'Pinned DB',
        badgeVariant: 'default',
      },
    },
  ], [bridgeConnected]);

  const edges: Edge[] = useMemo(() => [
    {
      id: 'e-client-wasm',
      source: 'client-gui',
      target: 'tier1-wasm',
      type: 'smoothstep',
      animated: true,
      style: { stroke: 'var(--studio-primary)', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--studio-primary)' },
    },
    {
      id: 'e-client-fsm',
      source: 'client-gui',
      target: 'tier2-fsm',
      type: 'smoothstep',
      animated: true,
      style: { stroke: 'var(--studio-primary)', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--studio-primary)' },
    },
    {
      id: 'e-client-bridge',
      source: 'client-gui',
      target: 'tier3-bridge',
      type: 'smoothstep',
      animated: bridgeConnected,
      style: { stroke: bridgeConnected ? 'var(--studio-success)' : 'var(--studio-warning)', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: bridgeConnected ? 'var(--studio-success)' : 'var(--studio-warning)' },
    },
    {
      id: 'e-bridge-runner',
      source: 'tier3-bridge',
      target: 'tier3-runner',
      type: 'smoothstep',
      animated: bridgeConnected,
      style: { stroke: bridgeConnected ? 'var(--studio-primary)' : 'var(--studio-edge-inactive)', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: bridgeConnected ? 'var(--studio-primary)' : 'var(--studio-edge-inactive)' },
    },
    {
      id: 'e-runner-pg',
      source: 'tier3-runner',
      target: 'tier3-postgres',
      type: 'smoothstep',
      animated: bridgeConnected,
      style: { stroke: bridgeConnected ? 'var(--studio-primary)' : 'var(--studio-edge-inactive)', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: bridgeConnected ? 'var(--studio-primary)' : 'var(--studio-edge-inactive)' },
    },
  ], [bridgeConnected]);

  return (
    <div style={{
      backgroundColor: 'var(--studio-surface)',
      border: '1px solid var(--studio-border)',
      borderRadius: '8px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: 'var(--studio-shadow-sm)',
    }}>
      {/* Topology Header & Accessible Table View Toggle */}
      <div style={{
        padding: '0.65rem 1rem',
        borderBottom: '1px solid var(--studio-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--studio-surface-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Network size={16} color="var(--studio-primary)" />
          <strong style={{ fontSize: '0.8125rem', color: 'var(--studio-text)' }}>
            Execution Topology &amp; Network Boundaries
          </strong>
        </div>

        <Button
          id="toggle-topology-table-view-btn"
          variant="default-outline"
          size="small"
          onClick={() => setShowTableView(prev => !prev)}
          aria-label={showTableView ? "Show interactive topology flowchart" : "Show accessible topology data table"}
          style={{ padding: '3px 8px', fontSize: '0.75rem' }}
        >
          <TableIcon size={12} style={{ marginRight: '5px' }} />
          {showTableView ? "Show Flowchart Diagram" : "Accessible Table View"}
        </Button>
      </div>

      {/* Viewport: Diagram or Accessible Semantic Table */}
      {showTableView ? (
        <div style={{ padding: '1rem', overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.75rem',
            color: 'var(--studio-text)',
            textAlign: 'left',
          }} aria-label="Execution Topology Overview">
            <thead>
              <tr style={{ borderBottom: '2px solid var(--studio-border)', backgroundColor: 'var(--studio-surface-subtle)' }}>
                <th style={{ padding: '8px 10px', fontWeight: 700 }}>Component</th>
                <th style={{ padding: '8px 10px', fontWeight: 700 }}>Tier / Layer</th>
                <th style={{ padding: '8px 10px', fontWeight: 700 }}>Runtime Environment</th>
                <th style={{ padding: '8px 10px', fontWeight: 700 }}>Network Boundary</th>
                <th style={{ padding: '8px 10px', fontWeight: 700 }}>Security Controls</th>
                <th style={{ padding: '8px 10px', fontWeight: 700 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--studio-border)' }}>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>Browser Client (React 19)</td>
                <td style={{ padding: '8px 10px' }}>UI / Presentation</td>
                <td style={{ padding: '8px 10px' }}>Standard Browser WebAPI</td>
                <td style={{ padding: '8px 10px' }}>Host / Browser Sandbox</td>
                <td style={{ padding: '8px 10px' }}>Client-side memory sandbox</td>
                <td style={{ padding: '8px 10px', color: 'var(--studio-success)', fontWeight: 600 }}>Active</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--studio-border)' }}>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>Tier 1: Browser WASM</td>
                <td style={{ padding: '8px 10px' }}>Tier 1 (Client Execution)</td>
                <td style={{ padding: '8px 10px' }}>sql.js (SQLite 3.45.2)</td>
                <td style={{ padding: '8px 10px' }}>Client-side WebAssembly</td>
                <td style={{ padding: '8px 10px' }}>No network egress required</td>
                <td style={{ padding: '8px 10px', color: 'var(--studio-success)', fontWeight: 600 }}>Online</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--studio-border)' }}>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>Tier 2: Deterministic Sim</td>
                <td style={{ padding: '8px 10px' }}>Tier 2 (Simulation)</td>
                <td style={{ padding: '8px 10px' }}>TypeScript 9-Step FSM</td>
                <td style={{ padding: '8px 10px' }}>In-Memory Javascript Engine</td>
                <td style={{ padding: '8px 10px' }}>Pure algorithmic invariants</td>
                <td style={{ padding: '8px 10px', color: 'var(--studio-success)', fontWeight: 600 }}>Online</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--studio-border)' }}>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>Tier 3: Local Bridge</td>
                <td style={{ padding: '8px 10px' }}>Tier 3 (Host Daemon)</td>
                <td style={{ padding: '8px 10px' }}>Node.js loopback daemon</td>
                <td style={{ padding: '8px 10px' }}>127.0.0.1:49152 (Host only)</td>
                <td style={{ padding: '8px 10px' }}>Strict loopback binding, PGID cleanup</td>
                <td style={{ padding: '8px 10px', color: bridgeConnected ? 'var(--studio-success)' : 'var(--studio-warning)', fontWeight: 600 }}>
                  {bridgeConnected ? 'Connected' : 'Offline'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--studio-border)' }}>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>Testbed Runner Container</td>
                <td style={{ padding: '8px 10px' }}>Tier 3 (Isolated Runner)</td>
                <td style={{ padding: '8px 10px' }}>syscraft/php-runner:8.3</td>
                <td style={{ padding: '8px 10px' }}>syscraft-testnet (internal: true)</td>
                <td style={{ padding: '8px 10px' }}>Read-only mount, unprivileged user (UID 1000)</td>
                <td style={{ padding: '8px 10px' }}>{bridgeConnected ? 'Available' : 'Standby'}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>PostgreSQL 16.4 Container</td>
                <td style={{ padding: '8px 10px' }}>Tier 3 (Isolated Database)</td>
                <td style={{ padding: '8px 10px' }}>postgres:16.4-alpine</td>
                <td style={{ padding: '8px 10px' }}>syscraft-testnet (zero egress)</td>
                <td style={{ padding: '8px 10px' }}>Zero WAN routing, internal network only</td>
                <td style={{ padding: '8px 10px' }}>{bridgeConnected ? 'Healthy' : 'Standby'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height: '480px', width: '100%', position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.5}
            maxZoom={1.5}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background 
              variant={BackgroundVariant.Dots} 
              gap={20} 
              size={1.5} 
              color="var(--studio-border-strong)" 
            />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      )}
    </div>
  );
};
