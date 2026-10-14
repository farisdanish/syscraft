import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { z } from 'zod';
import type { ExportEnvelopeV1, HesitationLogItem, OralRubricScore } from '../types';

interface SysCraftDB extends DBSchema {
  progress: {
    key: string;
    value: {
      drillId: string;
      completed: boolean;
      verified: boolean;
      verificationSource?: 'simulation' | 'local-runtime' | 'self-reported';
      completedAt: string;
      attempts: number;
    };
  };
  hesitations: {
    key: string;
    value: HesitationLogItem;
    indexes: { 'by-sunday': string };
  };
  oralScores: {
    key: string;
    value: OralRubricScore;
  };
  notes: {
    key: string;
    value: { drillId: string; content: string; updatedAt: string };
  };
}

const DB_NAME = 'syscraft_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<SysCraftDB>> | null = null;

export function getDatabase(): Promise<IDBPDatabase<SysCraftDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SysCraftDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'drillId' });
        }
        if (!db.objectStoreNames.contains('hesitations')) {
          const hesitationStore = db.createObjectStore('hesitations', { keyPath: 'id' });
          hesitationStore.createIndex('by-sunday', 'reviewedSunday');
        }
        if (!db.objectStoreNames.contains('oralScores')) {
          db.createObjectStore('oralScores', { keyPath: 'timestamp' });
        }
        if (!db.objectStoreNames.contains('notes')) {
          db.createObjectStore('notes', { keyPath: 'drillId' });
        }
      },
    });
  }
  return dbPromise;
}

// Progress Operations
export async function saveDrillProgress(
  drillId: string, 
  completed: boolean, 
  verified: boolean,
  verificationSource: 'simulation' | 'local-runtime' | 'self-reported' = 'simulation'
): Promise<void> {
  const db = await getDatabase();
  const existing = await db.get('progress', drillId);
  await db.put('progress', {
    drillId,
    completed,
    verified,
    verificationSource,
    completedAt: new Date().toISOString(),
    attempts: (existing?.attempts || 0) + 1,
  });
}

export async function getDrillProgress(drillId: string) {
  const db = await getDatabase();
  return db.get('progress', drillId);
}

export async function getAllProgress() {
  const db = await getDatabase();
  return db.getAll('progress');
}

// Hesitation Tracker Operations
export async function logHesitation(item: Omit<HesitationLogItem, 'id' | 'createdAt' | 'reviewedSunday'>): Promise<string> {
  const db = await getDatabase();
  const id = `hesitation_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const record: HesitationLogItem = {
    ...item,
    id,
    createdAt: new Date().toISOString(),
    reviewedSunday: false,
  };
  await db.put('hesitations', record);
  return id;
}

export async function getSundayHesitations(): Promise<HesitationLogItem[]> {
  const db = await getDatabase();
  const all = await db.getAll('hesitations');
  return all.filter(h => !h.reviewedSunday);
}

export async function markHesitationReviewed(id: string): Promise<void> {
  const db = await getDatabase();
  const item = await db.get('hesitations', id);
  if (item) {
    item.reviewedSunday = true;
    await db.put('hesitations', item);
  }
}

// Oral Rubric Operations
export async function saveOralScore(score: OralRubricScore): Promise<void> {
  const db = await getDatabase();
  await db.put('oralScores', score);
}

export async function getOralScoresForDrill(drillId: string): Promise<OralRubricScore[]> {
  const db = await getDatabase();
  const all = await db.getAll('oralScores');
  return all.filter(s => s.drillId === drillId);
}

// Export / Import Validation Schemas (Strict Zod Validation)
const HesitationSchema = z.object({
  id: z.string(),
  drillId: z.string(),
  week: z.number(),
  topic: z.string(),
  timeToFirstActionSeconds: z.number(),
  retryCount: z.number(),
  hintsRequested: z.number(),
  failedAssertionCount: z.number(),
  rubricMisses: z.array(z.string().max(500)),
  learnerFlagged: z.boolean(),
  createdAt: z.string(),
  reviewedSunday: z.boolean(),
});

const OralRubricScoreSchema = z.object({
  drillId: z.string(),
  timestamp: z.string(),
  dimensionScores: z.object({
    correctness: z.number().min(1).max(4),
    tradeoff: z.number().min(1).max(4),
    failure: z.number().min(1).max(4),
    clarity: z.number().min(1).max(4),
    challenge: z.number().min(1).max(4),
  }),
  durationSeconds: z.number(),
  unscriptedPass: z.boolean(),
  notes: z.string().max(2000),
});

const EnvelopeSchema = z.object({
  schemaVersion: z.string().regex(/^1\.\d+\.\d+$/),
  exportedAt: z.string(),
  appVersion: z.string().regex(/^1\.\d+\.\d+$/),
  payload: z.object({
    completedDrills: z.record(z.string(), z.object({
      completed: z.boolean(),
      score: z.number().optional(),
      verified: z.boolean(),
      verificationSource: z.enum(['simulation', 'local-runtime', 'self-reported']).optional(),
    })),
    hesitations: z.array(HesitationSchema),
    oralScores: z.array(OralRubricScoreSchema),
    customNotes: z.record(z.string(), z.string().max(10000)),
  }),
});

// Recursive object depth guard
function checkObjectDepth(obj: unknown, maxDepth = 6, currentDepth = 0): boolean {
  if (currentDepth > maxDepth) return false;
  if (typeof obj !== 'object' || obj === null) return true;
  for (const key of Object.keys(obj)) {
    if (!checkObjectDepth((obj as Record<string, unknown>)[key], maxDepth, currentDepth + 1)) {
      return false;
    }
  }
  return true;
}

export async function exportEnvelopeJSON(): Promise<string> {
  const db = await getDatabase();
  const progressList = await db.getAll('progress');
  const hesitations = await db.getAll('hesitations');
  const oralScores = await db.getAll('oralScores');
  const notesList = await db.getAll('notes');

  const completedDrills: Record<string, { completed: boolean; score?: number; verified: boolean; verificationSource?: 'simulation' | 'local-runtime' | 'self-reported' }> = {};
  for (const p of progressList) {
    completedDrills[p.drillId] = { 
      completed: p.completed, 
      verified: p.verified,
      verificationSource: p.verificationSource || 'simulation',
    };
  }

  const customNotes: Record<string, string> = {};
  for (const n of notesList) {
    customNotes[n.drillId] = n.content;
  }

  const envelope: ExportEnvelopeV1 = {
    schemaVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    payload: {
      completedDrills,
      hesitations,
      oralScores,
      customNotes,
    },
  };

  return JSON.stringify(envelope, null, 2);
}

// Prototype-Pollution-Safe JSON Import with Strict Depth & Size Guards
export async function importEnvelopeJSON(jsonString: string): Promise<{ success: boolean; message: string }> {
  if (jsonString.length > 2 * 1024 * 1024) {
    return { success: false, message: 'Payload exceeds maximum permitted size of 2MB.' };
  }

  try {
    const parsed = JSON.parse(jsonString, (key, value) => {
      if (key === '__proto__' || key === 'constructor') {
        return undefined;
      }
      return value;
    });

    if (!checkObjectDepth(parsed, 6)) {
      return { success: false, message: 'Payload rejected: Object nesting exceeds maximum permitted depth of 6.' };
    }

    const validated = EnvelopeSchema.parse(parsed);
    const db = await getDatabase();

    for (const [drillId, val] of Object.entries(validated.payload.completedDrills)) {
      await db.put('progress', {
        drillId,
        completed: val.completed,
        verified: val.verified,
        verificationSource: val.verificationSource || 'simulation',
        completedAt: new Date().toISOString(),
        attempts: 1,
      });
    }

    for (const h of validated.payload.hesitations) {
      if (h.id && h.drillId) {
        await db.put('hesitations', h);
      }
    }

    for (const score of validated.payload.oralScores) {
      if (score.timestamp && score.drillId) {
        await db.put('oralScores', score);
      }
    }

    if (validated.payload.customNotes) {
      for (const [drillId, content] of Object.entries(validated.payload.customNotes)) {
        if (typeof content === 'string') {
          await db.put('notes', { drillId, content, updatedAt: new Date().toISOString() });
        }
      }
    }

    return { success: true, message: 'Backup imported, schema-validated, and restored successfully.' };
  } catch (err: any) {
    return { success: false, message: `Import validation failed: ${err.message || 'Malformed schema'}` };
  }
}
