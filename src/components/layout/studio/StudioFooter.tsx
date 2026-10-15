import React from 'react';
import { Tag } from '@govtechmy/myds-react/tag';
import type { DrillDefinition } from '../../../types';
import type { BridgeHealth, BridgeRunResult } from '../../../services/bridgeClient';

export interface StudioFooterProps {
  activeDrill: DrillDefinition;
  tier3Result: BridgeRunResult | null;
  runtimeSqlVersion: string;
  drillCompleted: boolean;
  verificationSource: 'simulation' | 'local-runtime' | 'self-reported';
  bridgeStatus: BridgeHealth;
  politeNotice: string;
}

export const StudioFooter: React.FC<StudioFooterProps> = ({
  activeDrill,
  tier3Result,
  runtimeSqlVersion,
  drillCompleted,
  verificationSource,
  bridgeStatus,
  politeNotice,
}) => {
  return (
    <footer className="studio-footer">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Tag 
          variant={
            tier3Result && tier3Result.exitCode === 0 
              ? "success" 
              : activeDrill.week === 1 || activeDrill.week === 2 
              ? "primary" 
              : activeDrill.week === 3 || activeDrill.week === 4 
              ? "success" 
              : activeDrill.week === 5 || activeDrill.week === 6 
              ? "warning" 
              : "danger"
          } 
          size="small"
        >
          {tier3Result && tier3Result.exitCode === 0 
            ? `[Tier 3: ${activeDrill.week === 7 ? 'PHP 8.3 / Auth Testbed' : activeDrill.week === 3 ? 'PHP 8.3 / IoC Container' : 'PostgreSQL 16.4'} Runtime Passed]`
            : activeDrill.week === 1 
              ? "[Tier 2: Deterministic Simulation]" 
              : activeDrill.week === 2
              ? `[Tier 1: SQLite ${runtimeSqlVersion} (WASM)]`
              : activeDrill.week === 3
              ? "[Tier 3: IoC Service Container]"
              : activeDrill.week === 4 
              ? `[Engine: SQLite ${runtimeSqlVersion} (WASM)]` 
              : activeDrill.week === 5
              ? "[Tier 2: Async Queue Worker Simulation]"
              : activeDrill.week === 6 
              ? "[Tier 1: Systems Design / STAR Validator]" 
              : "[Tier 2: Security Policy Evaluator]"}
        </Tag>
        <Tag variant={drillCompleted ? "success" : "default"} size="small">
          {drillCompleted 
            ? (verificationSource === 'local-runtime' ? "Runtime Passed" : "Simulation Passed") 
            : "In Progress"}
        </Tag>
        <Tag variant={bridgeStatus.connected ? "success" : "default"} size="small">
          Bridge: {bridgeStatus.connected ? "127.0.0.1:49152 (Online)" : "Offline"}
        </Tag>
        {politeNotice && (
          <span 
            role="status" 
            aria-live="polite" 
            style={{ fontSize: '0.75rem', color: 'var(--studio-primary)', fontWeight: 500, marginLeft: '0.5rem' }}
          >
            {politeNotice}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.6875rem', color: 'var(--studio-text-muted)' }}>
        <span>Runner: <strong>PHP 8.3.11 / PostgreSQL 16.4 (Testbed Prototype)</strong></span>
        <span>•</span>
        <span>MYDS Standards Compliant</span>
        <span>•</span>
        <span>Tab/Esc Navigation Enabled</span>
      </div>
    </footer>
  );
};
