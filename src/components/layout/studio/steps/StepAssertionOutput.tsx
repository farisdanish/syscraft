import React from 'react';
import { Button } from '@govtechmy/myds-react/button';
import { Tag } from '@govtechmy/myds-react/tag';
import { Callout, CalloutTitle, CalloutContent } from '@govtechmy/myds-react/callout';
import { CheckCircle2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
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
        <h3 style={{ margin: 0, fontSize: '1.0625rem', color: 'var(--studio-text)' }}>
          Step 3: Verification &amp; Assertion Output
        </h3>

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Tag variant={tier3Result.exitCode === 0 ? "success" : "danger"} size="small">
                  {tier3Result.exitCode === 0 
                    ? `Tier 3: [${activeDrill.week === 7 ? 'PHP 8.3 / Auth Testbed' : activeDrill.week === 3 ? 'PHP 8.3 / IoC Container' : 'PostgreSQL 16.4'} Runtime Passed]` 
                    : "Tier 3: [Failed]"}
                </Tag>
                <strong style={{ fontSize: '0.875rem', color: 'var(--studio-text)' }}>
                  syscraft-runner:1.0.0 (Isolated Docker syscraft-testnet)
                </strong>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--studio-text-muted)' }}>
                Exit Code: {tier3Result.exitCode} • Verified: {tier3Result.executionVerified ? "Yes" : "No"}
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
                {testResults.simulatedLatencyMs ? `Simulated execution time: ~${testResults.simulatedLatencyMs}ms • ` : ''}
                {testResults.queriesExecuted ? `Queries Executed: ${testResults.queriesExecuted} queries.` : testResults.message || 'Inspection complete.'}
              </CalloutContent>
            </Callout>

            {/* Assertion List Card */}
            {testResults.assertionResults && (
              <div style={{ padding: '1rem', borderRadius: '8px', border: '1px solid var(--studio-border)', backgroundColor: 'var(--studio-surface)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--studio-text)' }}>
                  EVALUATED ASSERTIONS:
                </div>
                {testResults.assertionResults.map((a: any, i: number) => (
                  <div key={i} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '4px',
                    backgroundColor: 'var(--studio-surface-subtle)',
                    marginBottom: '0.375rem',
                    fontSize: '0.8125rem',
                    color: 'var(--studio-text)'
                  }}>
                    <span>{a.name} — <span style={{ color: 'var(--studio-text-muted)' }}>{a.message}</span></span>
                    <Tag variant={a.passed ? "success" : "danger"} size="small">
                      {a.passed ? "PASS" : "FAIL"}
                    </Tag>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : !tier3Result ? (
          <Callout variant="warning">
            <CalloutTitle>No test run recorded yet</CalloutTitle>
            <CalloutContent>Return to Step 2 and click "Run Test Harness" or "Run in Docker" to evaluate your code.</CalloutContent>
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
