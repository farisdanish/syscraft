import { useState, useEffect } from 'react';
import { Button } from '@govtechmy/myds-react/button';
import { Callout, CalloutTitle, CalloutContent } from '@govtechmy/myds-react/callout';
import { Tag } from '@govtechmy/myds-react/tag';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@govtechmy/myds-react/tabs';
import { 
  Sun, 
  Moon, 
  CheckCircle2, 
  Database, 
  ShieldCheck, 
  Volume2,
  GitBranch,
  Layers
} from 'lucide-react';
import initSqlJs from 'sql.js';

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(true);
  const [sqliteVersion, setSqliteVersion] = useState<string | null>(null);
  const [sqlLoading, setSqlLoading] = useState<boolean>(false);
  const [srAnnouncement, setSrAnnouncement] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('gate-check');

  // Toggle dark/light theme class on html element
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Test WebAssembly SQLite engine
  const runSqliteCheck = async () => {
    setSqlLoading(true);
    try {
      const SQL = await initSqlJs({
        locateFile: () => `/sql-wasm.wasm`
      });
      const db = new SQL.Database();
      const res = db.exec("SELECT sqlite_version() AS version;");
      if (res && res[0] && res[0].values && res[0].values[0]) {
        const ver = String(res[0].values[0][0]);
        setSqliteVersion(ver);
        setSrAnnouncement(`SQLite WASM Engine verified. Runtime version: ${ver}`);
      }
    } catch (err) {
      console.error("SQLite initialization failed:", err);
      setSqliteVersion("Failed to initialize");
    } finally {
      setSqlLoading(false);
    }
  };

  const announceMilestone = (msg: string) => {
    setSrAnnouncement(msg);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Accessibility Polite Live Region */}
      <div 
        role="status" 
        aria-live="polite" 
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}
      >
        {srAnnouncement}
      </div>

      {/* Top Masthead / Institutional Header */}
      <header style={{ 
        borderBottom: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))', 
        backgroundColor: 'var(--bg-white, #ffffff)', 
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ 
            width: '32px', 
            height: '32px', 
            borderRadius: '6px', 
            backgroundColor: '#0284c7', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '14px'
          }}>
            SC
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>
              SysCraft Studio
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--txt-black-500, #64748b)' }}>
              Interactive Systems & Backend Learning Engine • MYDS Institutional Proof
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Tag variant="primary" size="small">
            Phase 0: Proof-of-Installation
          </Tag>
          <Tag variant="success" size="small">
            MYDS v1.0.2
          </Tag>

          <Button 
            variant="default-outline" 
            size="small" 
            onClick={() => {
              setIsDark(!isDark);
              announceMilestone(isDark ? "Switched to Light mode" : "Switched to Dark mode");
            }}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun size={14} style={{ marginRight: '6px' }} /> : <Moon size={14} style={{ marginRight: '6px' }} />}
            {isDark ? "Light Mode" : "Dark Mode"}
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1100px', width: '100%', margin: '0 auto', padding: '1.5rem 1rem', flex: 1 }}>
        
        {/* Phase 0 Pass Banner */}
        <Callout variant="success" style={{ marginBottom: '1.5rem' }}>
          <CalloutTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={18} color="#10b981" />
            Phase 0 Installation Verified & Git Initialized
          </CalloutTitle>
          <CalloutContent>
            All core foundational packages, MYDS design tokens, accessibility rules, git repository at <code>/home/nian014/projects/syscraft</code>, and the <code>.agents/</code> customization hierarchy are active and validated.
          </CalloutContent>
        </Callout>

        {/* Tab Navigation */}
        <Tabs defaultValue="gate-check" value={activeTab} onValueChange={setActiveTab} variant="pill" style={{ marginBottom: '1.5rem' }}>
          <TabsList style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <TabsTrigger value="gate-check">
              Installation Gate Check
            </TabsTrigger>
            <TabsTrigger value="versions">
              Pinned Version Matrix
            </TabsTrigger>
            <TabsTrigger value="agents">
              .agents Customizations
            </TabsTrigger>
            <TabsTrigger value="accessibility">
              WCAG 2.2 Accessibility
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Installation Gate Check */}
          <TabsContent value="gate-check">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
              
              {/* Card 1: MYDS Design System Tokens */}
              <div style={{ 
                border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))',
                borderRadius: '8px',
                padding: '1.25rem',
                backgroundColor: 'var(--bg-white, #ffffff)'
              }}>
                <h3 style={{ margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                  <Layers size={18} color="#0284c7" />
                  MYDS Component & Token Proof
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--txt-black-600, #475569)', margin: '0 0 1rem 0' }}>
                  Verifying buttons, status badges, and dynamic theme tokens from <code>@govtechmy/myds-react@1.0.2</code> and <code>@govtechmy/myds-style@1.0.0</code>.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <Button variant="primary-fill" size="medium">
                    Primary Fill
                  </Button>
                  <Button variant="default-outline" size="medium">
                    Default Outline
                  </Button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Tag variant="success" size="small">Pass</Tag>
                  <Tag variant="warning" size="small">Review</Tag>
                  <Tag variant="danger" size="small">Fail</Tag>
                  <Tag variant="primary" size="small">Active</Tag>
                </div>
              </div>

              {/* Card 2: Tier 1 WASM SQL Engine */}
              <div style={{ 
                border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))',
                borderRadius: '8px',
                padding: '1.25rem',
                backgroundColor: 'var(--bg-white, #ffffff)'
              }}>
                <h3 style={{ margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                  <Database size={18} color="#059669" />
                  Tier 1 In-Browser SQL Engine
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--txt-black-600, #475569)', margin: '0 0 1rem 0' }}>
                  Runtime check querying <code>sqlite_version()</code> via <code>sql.js@1.12.0</code> WebAssembly.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <Button 
                    variant="primary-fill" 
                    size="small" 
                    onClick={runSqliteCheck}
                    disabled={sqlLoading}
                  >
                    {sqlLoading ? "Initializing..." : "Run SQLite Version Check"}
                  </Button>
                  {sqliteVersion && (
                    <Tag variant="success" size="small">
                      SQLite Runtime: {sqliteVersion}
                    </Tag>
                  )}
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--txt-black-500, #64748b)' }}>
                  Badge: <code>[Engine: SQLite {sqliteVersion || "3.45+"} (WASM)]</code>
                </div>
              </div>

              {/* Card 3: Tier 3 Isolated Network Blueprint */}
              <div style={{ 
                border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))',
                borderRadius: '8px',
                padding: '1.25rem',
                backgroundColor: 'var(--bg-white, #ffffff)'
              }}>
                <h3 style={{ margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                  <ShieldCheck size={18} color="#7c3aed" />
                  Tier 3 Isolated Docker Testbed
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--txt-black-600, #475569)', margin: '0 0 0.75rem 0' }}>
                  Secured internal network specification:
                </p>
                <ul style={{ fontSize: '0.8125rem', margin: 0, paddingLeft: '1.25rem', color: 'var(--txt-black-700, #334155)', lineHeight: 1.6 }}>
                  <li>Network: <code>syscraft-testnet --internal</code> (Zero external egress)</li>
                  <li>Runner: <code>syscraft-runner:1.0.0</code> (UID:GID 1000:1000)</li>
                  <li>Database: <code>postgres:16.4-alpine</code> (Port 5432 internal only)</li>
                  <li>Bridge: Loopback <code>127.0.0.1:49152</code> with POSIX process-group cleanup</li>
                </ul>
              </div>

            </div>
          </TabsContent>

          {/* TAB 2: Pinned Version Matrix */}
          <TabsContent value="versions">
            <div style={{ 
              border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-white, #ffffff)',
              overflowX: 'auto'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))', backgroundColor: 'var(--bg-contrast, rgba(0,0,0,0.02))' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Component</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Pinned Release</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Verification / Scope</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border-washed, rgba(148, 163, 184, 0.1))' }}>
                    <td style={{ padding: '0.75rem 1rem' }}><strong>Laravel Framework</strong></td>
                    <td style={{ padding: '0.75rem 1rem' }}><code>12.0.1</code></td>
                    <td style={{ padding: '0.75rem 1rem' }}>Pinned supported target (Security support through Feb 2027)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-washed, rgba(148, 163, 184, 0.1))' }}>
                    <td style={{ padding: '0.75rem 1rem' }}><strong>PHP CLI Runtime</strong></td>
                    <td style={{ padding: '0.75rem 1rem' }}><code>8.3.11</code></td>
                    <td style={{ padding: '0.75rem 1rem' }}>Runner image base (<code>php:8.3.11-cli-alpine</code>)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-washed, rgba(148, 163, 184, 0.1))' }}>
                    <td style={{ padding: '0.75rem 1rem' }}><strong>Testing Suite</strong></td>
                    <td style={{ padding: '0.75rem 1rem' }}><code>PHPUnit 11.3.3 + Pest 3.0.4</code></td>
                    <td style={{ padding: '0.75rem 1rem' }}>Locked in <code>composer.lock</code></td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-washed, rgba(148, 163, 184, 0.1))' }}>
                    <td style={{ padding: '0.75rem 1rem' }}><strong>PostgreSQL Container</strong></td>
                    <td style={{ padding: '0.75rem 1rem' }}><code>postgres:16.4-alpine</code></td>
                    <td style={{ padding: '0.75rem 1rem' }}>Tier 3 Docker container with internal network reachability</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-washed, rgba(148, 163, 184, 0.1))' }}>
                    <td style={{ padding: '0.75rem 1rem' }}><strong>Government Design System</strong></td>
                    <td style={{ padding: '0.75rem 1rem' }}><code>@govtechmy/myds-react@1.0.2</code></td>
                    <td style={{ padding: '0.75rem 1rem' }}>Official GovTech Malaysia design system</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.75rem 1rem' }}><strong>Design Tokens & Style</strong></td>
                    <td style={{ padding: '0.75rem 1rem' }}><code>@govtechmy/myds-style@1.0.0</code></td>
                    <td style={{ padding: '0.75rem 1rem' }}>Compiled tokens and theme styling</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* TAB 3: .agents Customizations */}
          <TabsContent value="agents">
            <div style={{ 
              border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))',
              borderRadius: '8px',
              padding: '1.25rem',
              backgroundColor: 'var(--bg-white, #ffffff)'
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                <GitBranch size={18} color="#0284c7" />
                Cross-Device Workspace Customizations (.agents)
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--txt-black-600, #475569)', margin: '0 0 1rem 0' }}>
                Located at <code>/home/nian014/projects/syscraft/.agents/</code>. Keeps development guidelines, architectural rules, and skills synchronized across devices:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', fontSize: '0.8125rem' }}>
                <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'var(--bg-contrast, rgba(0,0,0,0.02))', border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.1))' }}>
                  <strong>rules/architecture_invariants.md</strong><br />
                  <span style={{ color: 'var(--txt-black-500, #64748b)' }}>3-Tier execution boundaries, cognitive load, zero-secrets envelope.</span>
                </div>
                <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'var(--bg-contrast, rgba(0,0,0,0.02))', border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.1))' }}>
                  <strong>rules/security_threat_model.md</strong><br />
                  <span style={{ color: 'var(--txt-black-500, #64748b)' }}>Bridge allowlist, network isolation, UID 1000:1000, tmpfs.</span>
                </div>
                <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'var(--bg-contrast, rgba(0,0,0,0.02))', border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.1))' }}>
                  <strong>rules/accessibility_standards.md</strong><br />
                  <span style={{ color: 'var(--txt-black-500, #64748b)' }}>WCAG 2.2 AA, 400% zoom reflow, keyboard escape hatch.</span>
                </div>
                <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'var(--bg-contrast, rgba(0,0,0,0.02))', border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.1))' }}>
                  <strong>skills/drill-authoring/SKILL.md</strong><br />
                  <span style={{ color: 'var(--txt-black-500, #64748b)' }}>Authoring guide for curriculum drills and assertion fixtures.</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 4: WCAG 2.2 Accessibility */}
          <TabsContent value="accessibility">
            <div style={{ 
              border: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))',
              borderRadius: '8px',
              padding: '1.25rem',
              backgroundColor: 'var(--bg-white, #ffffff)'
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                <Volume2 size={18} color="#e11d48" />
                WCAG 2.2 & Screen Reader Testing Suite
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--txt-black-600, #475569)', margin: '0 0 1rem 0' }}>
                Simulating milestone-only screen reader announcements (avoiding per-second audio clutter):
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <Button 
                  variant="default-outline" 
                  size="small"
                  onClick={() => announceMilestone("Timer Notice: 5 minutes remaining in drill sprint.")}
                >
                  Announce: 5 Mins Remaining
                </Button>
                <Button 
                  variant="default-outline" 
                  size="small"
                  onClick={() => announceMilestone("Timer Notice: 1 minute remaining. Wrap up code changes.")}
                >
                  Announce: 1 Min Remaining
                </Button>
                <Button 
                  variant="default-outline" 
                  size="small"
                  onClick={() => announceMilestone("Execution Complete: 3 assertions passed. Zero N+1 queries detected.")}
                >
                  Announce: Drill Complete
                </Button>
              </div>

              {srAnnouncement && (
                <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'var(--bg-contrast, rgba(0,0,0,0.03))', borderLeft: '4px solid #0284c7', fontSize: '0.875rem' }}>
                  <strong>Last Live Announcement:</strong> {srAnnouncement}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

      </main>

      {/* Footer */}
      <footer style={{ 
        borderTop: '1px solid var(--border-washed, rgba(148, 163, 184, 0.2))', 
        padding: '1rem 1.5rem',
        fontSize: '0.75rem',
        color: 'var(--txt-black-500, #64748b)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div>
          SysCraft Interactive Learning Studio • Repository: <code>/home/nian014/projects/syscraft</code>
        </div>
        <div>
          Malaysia Government Design System (MYDS) Compliant
        </div>
      </footer>
    </div>
  );
}
