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
  error?: string;
}

export interface BridgeRunResult {
  commandId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  verified: boolean;
  timestamp: string;
  error?: string;
}

export async function checkBridgeHealth(): Promise<BridgeHealth> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

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

export async function runBridgeCommand(commandId: string): Promise<BridgeRunResult> {
  const token = await requestCapabilityToken();
  if (!token) {
    return {
      commandId,
      exitCode: 1,
      stdout: '',
      stderr: 'Failed to acquire capability token from bridge daemon.',
      verified: false,
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
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        commandId,
        exitCode: res.status,
        stdout: '',
        stderr: errText,
        verified: false,
        timestamp: new Date().toISOString(),
        error: `Bridge execution failed with HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      commandId: data.commandId,
      exitCode: data.exitCode,
      stdout: data.stdout,
      stderr: data.stderr,
      verified: Boolean(data.verified),
      timestamp: data.timestamp,
    };
  } catch (err) {
    return {
      commandId,
      exitCode: 1,
      stdout: '',
      stderr: err instanceof Error ? err.message : 'Bridge execution error',
      verified: false,
      timestamp: new Date().toISOString(),
      error: 'Execution communication failure',
    };
  }
}
