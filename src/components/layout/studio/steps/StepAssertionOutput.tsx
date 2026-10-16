import React from 'react';
import { Button } from '@govtechmy/myds-react/button';
import { Tag } from '@govtechmy/myds-react/tag';
import { Callout, CalloutTitle, CalloutContent } from '@govtechmy/myds-react/callout';
import { 
  CheckCircle2, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  BarChart3, 
  Terminal,
  Activity,
  Zap
} from 'lucide-react';
import type { DrillDefinition } from '../../../../types';
import type { BridgeRunResult } from '../../../../services/bridgeClient';

export interface StepAssertionOutputProps {
  activeDrill: DrillDefinition;
  testResults: any;
  tier3Result: BridgeRunResult | null;
  onBackToDrill: () => void;
  onConfirmAnalysis: () => void;
}

export const StepAssertionOutput: React.FC<StepAssertionOutputProps> = ({
  activeDrill,
  testResults,
  tier3Result,
  onBackToDrill,
  onConfirmAnalysis,
}) => {
  return (
    <div className="studio-scrollable-step">
      <div style={{ maxWidth: '860px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Step 3 Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Tag variant="primary" size="small">
              Step 3 of 5
            </Tag>
            <span style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)' }}>
              Week {activeDrill.week} Diagnostic Report
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--studio-text)' }}>
            Analysis &amp; Feedback • {activeDrill.title}
          </h2>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--studio-text-muted)', lineHeight: 1.5 }}>
            Authoritative evaluation of runtime assertions, query budgets, and execution feedback before oral defense.
          </p>
        </div>

        {/* High-Dopamine Performance Win Telemetry Banner */}
        {testResults?.passed && (
          <div style={{
            padding: '1.15rem 1.25rem',
            borderRadius: '10px',
            border: '1px solid var(--studio-success-border)',
            background: 'linear-gradient(135deg, var(--studio-success-subtle) 0%, var(--studio-surface) 65%)',
            boxShadow: '0 0 16px var(--studio-success-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }} className="studio-badge-pop">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--studio-success)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 10px var(--studio-success-glow)',
                  flexShrink: 0
                }}>
                  <Zap size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--studio-text)' }}>
                    Production Invariant Verified • High Throughput Established
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)' }}>
                    Architectural bottleneck successfully eliminated • Ready for Oral Defense
                  </span>
                </div>
              </div>
              <Tag variant="success" size="small">
                <CheckCircle2 size={12} style={{ marginRight: '4px' }} />
                All Invariants Satisfied
              </Tag>
            </div>

            {/* Metric Comparison Counters */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: '0.75rem'
            }}>
              <div style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                backgroundColor: 'var(--studio-surface)',
                border: '1px solid var(--studio-border)'
              }}>
                <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--studio-text-muted)', fontWeight: 600 }}>
                  Database Roundtrips
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '2px' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--studio-success)' }} className="studio-mono">
                    {testResults.queriesExecuted ?? 2} Queries
                  </span>
                  {activeDrill.week === 1 && (
                    <span style={{ fontSize: '0.71875rem', textDecoration: 'line-through', color: 'var(--studio-danger)' }}>
                      51 unconstrained
                    </span>
                  )}
                </div>
              </div>

              <div style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                backgroundColor: 'var(--studio-surface)',
                border: '1px solid var(--studio-border)'
              }}>
                <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--studio-text-muted)', fontWeight: 600 }}>
                  I/O Overhead Reduction
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '2px' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--studio-success)' }} className="studio-mono">
                    {activeDrill.week === 1 ? '+96.1%' : 'Optimized'}
                  </span>
                  <span style={{ fontSize: '0.71875rem', color: 'var(--studio-text-muted)' }}>
                    O(1) Fixed Budget
                  </span>
                </div>
              </div>

              <div style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                backgroundColor: 'var(--studio-surface)',
                border: '1px solid var(--studio-border)'
              }}>
                <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--studio-text-muted)', fontWeight: 600 }}>
                  Execution Latency
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '2px' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--studio-text)' }} className="studio-mono">
                    ~{testResults.simulatedLatencyMs ?? 4}ms
                  </span>
                  <span style={{ fontSize: '0.71875rem', color: 'var(--studio-success)' }}>
                    Zero Loop Latency
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tier 3 Canonical Docker Runtime Output Card */}
        {tier3Result && (
          <div style={{ 
            padding: '1rem', 
            borderRadius: '8px', 
            border: `1px solid ${tier3Result.exitCode === 0 ? 'var(--studio-success)' : 'var(--studio-danger)'}`, 
            backgroundColor: 'var(--studio-surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Terminal size={16} color="var(--studio-primary)" />
                <Tag variant={tier3Result.exitCode === 0 ? "success" : "danger"} size="small">
                  {tier3Result.exitCode === 0 
                    ? `Tier 3 Container: [Passed]` 
                    : "Tier 3 Container: [Failed]"}
                </Tag>
                <strong style={{ fontSize: '0.8125rem', color: 'var(--studio-text)' }}>
                  syscraft-runner:1.0.0 (syscraft-testnet)
                </strong>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)' }}>
                Exit Code: {tier3Result.exitCode} • Verified Runtime: {tier3Result.executionVerified ? "Yes" : "No"}
              </span>
            </div>

            {/* Sanitized Terminal Output */}
            <pre style={{ 
              margin: 0, 
              padding: '0.75rem', 
              borderRadius: '6px', 
              backgroundColor: 'var(--studio-surface-subtle)', 
              color: 'var(--studio-text)', 
              fontFamily: 'monospace', 
              fontSize: '0.75rem', 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-all',
              maxHeight: '260px',
              overflowY: 'auto',
              border: '1px solid var(--studio-border)'
            }}>
              {/* eslint-disable-next-line no-control-regex */}
              {(tier3Result.stdout || '').replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')}
            </pre>
          </div>
        )}

        {testResults ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <Callout variant={testResults.passed ? "success" : "danger"}>
              <CalloutTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {testResults.passed ? <CheckCircle2 size={18} color="var(--studio-success)" /> : <AlertCircle size={18} color="var(--studio-danger)" />}
                {testResults.passed 
                  ? (activeDrill.week === 1 ? "All Assertions Passed • Query Budget Satisfied" : "All Assertions Passed • Requirements Satisfied") 
                  : (activeDrill.week === 1 ? "Query Budget Violation • Assertions Failed" : "Requirements Violation • Assertions Failed")}
              </CalloutTitle>
              <CalloutContent>
                {testResults.simulatedLatencyMs ? `Simulated execution latency: ~${testResults.simulatedLatencyMs}ms • ` : ''}
                {testResults.queriesExecuted ? `Queries Executed: ${testResults.queriesExecuted} queries.` : testResults.message || 'Verification complete.'}
              </CalloutContent>
            </Callout>

            {/* Evaluated Assertions Checklist Card */}
            {testResults.assertionResults && (
              <div style={{ 
                padding: '1rem', 
                borderRadius: '8px', 
                border: '1px solid var(--studio-border)', 
                backgroundColor: 'var(--studio-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.625rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--studio-text)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <BarChart3 size={15} color="var(--studio-primary)" />
                    Detailed Assertion Verification
                  </span>
                  <Tag variant={testResults.passed ? "success" : "danger"} size="small">
                    {testResults.assertionResults.filter((a: any) => a.passed).length} / {testResults.assertionResults.length} Passed
                  </Tag>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {testResults.assertionResults.map((a: any, i: number) => (
                    <div key={i} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      backgroundColor: 'var(--studio-surface-subtle)',
                      border: '1px solid var(--studio-border)',
                      fontSize: '0.8125rem',
                      color: 'var(--studio-text)',
                      gap: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                        <span style={{ fontWeight: 600 }}>{a.name}</span>
                        {a.message && (
                          <span style={{ color: 'var(--studio-text-muted)', fontSize: '0.75rem' }}>{a.message}</span>
                        )}
                      </div>
                      <Tag variant={a.passed ? "success" : "danger"} size="small">
                        {a.passed ? "PASS" : "FAIL"}
                      </Tag>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : !tier3Result ? (
          <Callout variant="warning">
            <CalloutTitle style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={16} />
              No evaluation run recorded yet
            </CalloutTitle>
            <CalloutContent>
              {activeDrill.week === 4 ? (
                <>Return to Step 2: Focused Drill and click <strong>Execute &amp; Analyze Plan</strong> to evaluate your query plan.</>
              ) : (
                <>Return to Step 2: Focused Drill and click <strong>Run Test Harness</strong> or <strong>Run in Docker</strong> to evaluate your code.</>
              )}
            </CalloutContent>
          </Callout>
        ) : null}

        {/* Gate 3 Action Button: Confirm Analysis & Advance to Step 4 */}
        <div className="studio-step-actions">
          <Button variant="default-outline" size="small" onClick={onBackToDrill}>
            <ChevronLeft size={14} style={{ marginRight: '4px' }} />
            Back to Code Drill
          </Button>
          <Button 
            id="confirm-analysis-btn"
            variant="primary-fill" 
            size="small" 
            onClick={onConfirmAnalysis}
          >
            Confirm Analysis &amp; Advance to Oral Defense
            <ChevronRight size={14} style={{ marginLeft: '4px' }} />
          </Button>
        </div>
      </div>
    </div>
  );
};
