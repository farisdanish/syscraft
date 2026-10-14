/**
 * SysCraft Tier 3 Loopback Capability Bridge Client
 * Communicates with http://127.0.0.1:49152 for real Docker runtime test execution.
 */

const BRIDGE_BASE_URL = 'http://127.0.0.1:49152';

export interface BridgeHealth {
  connected: boolean;
  status?: string;
  version?: string;
  network?: string;
  dockerAvailable?: boolean;
  postgresReady?: boolean;
  runnerImageReady?: boolean;
  error?: string;
}

export interface BridgeRunResult {
  commandId: string;
  exitCode: number;
  passed: boolean;
  executionVerified: boolean;
  stdout: string;
  stderr: string;
  timestamp: string;
  error?: string;
}

export async function checkBridgeHealth(): Promise<BridgeHealth> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1800);

  try {
    const res = await fetch(`${BRIDGE_BASE_URL}/api/bridge/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { connected: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    return {
      connected: true,
      status: data.status,
      version: data.version,
      network: data.network,
      dockerAvailable: data.dockerAvailable,
      postgresReady: data.postgresReady,
      runnerImageReady: data.runnerImageReady,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      connected: false,
      error: err instanceof Error ? err.message : 'Bridge unreachable',
    };
  }
}

export async function requestCapabilityToken(): Promise<string | null> {
  try {
    const res = await fetch(`${BRIDGE_BASE_URL}/api/bridge/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token || null;
  } catch {
    return null;
  }
}

export async function runBridgeCommand(
  commandId: string,
  userCode?: string,
  filename?: string
): Promise<BridgeRunResult> {
  const token = await requestCapabilityToken();
  if (!token) {
    return {
      commandId,
      exitCode: 1,
      passed: false,
      executionVerified: false,
      stdout: '',
      stderr: 'Failed to acquire capability token from bridge daemon.',
      timestamp: new Date().toISOString(),
      error: 'Token acquisition failed',
    };
  }

  try {
    const res = await fetch(`${BRIDGE_BASE_URL}/api/bridge/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commandId,
        capabilityToken: token,
        userCode,
        filename,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        commandId,
        exitCode: res.status,
        passed: false,
        executionVerified: false,
        stdout: '',
        stderr: errText,
        timestamp: new Date().toISOString(),
        error: `Bridge execution failed with HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      commandId: data.commandId,
      exitCode: data.exitCode,
      passed: Boolean(data.passed ?? (data.exitCode === 0)),
      executionVerified: Boolean(data.executionVerified ?? true),
      stdout: data.stdout,
      stderr: data.stderr,
      timestamp: data.timestamp,
    };
  } catch (err) {
    return {
      commandId,
      exitCode: 1,
      passed: false,
      executionVerified: false,
      stdout: '',
      stderr: err instanceof Error ? err.message : 'Bridge execution error',
      timestamp: new Date().toISOString(),
      error: 'Execution communication failure',
    };
  }
}
