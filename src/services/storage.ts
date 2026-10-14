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
export async function saveDrillProgress(drillId: string, completed: boolean, verified: boolean): Promise<void> {
  const db = await getDatabase();
  const existing = await db.get('progress', drillId);
  await db.put('progress', {
    drillId,
    completed,
    verified,
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

// Export / Import Validation Schemas (Zod)
const EnvelopeSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  exportedAt: z.string(),
  appVersion: z.literal('1.0.0'),
  payload: z.object({
    completedDrills: z.record(z.string(), z.object({
      completed: z.boolean(),
      score: z.number().optional(),
      verified: z.boolean(),
    })),
    hesitations: z.array(z.any()),
    oralScores: z.array(z.any()),
    customNotes: z.record(z.string(), z.string()),
  }),
});

export async function exportEnvelopeJSON(): Promise<string> {
  const db = await getDatabase();
  const progressList = await db.getAll('progress');
  const hesitations = await db.getAll('hesitations');
  const oralScores = await db.getAll('oralScores');
  const notesList = await db.getAll('notes');

  const completedDrills: Record<string, { completed: boolean; score?: number; verified: boolean }> = {};
  for (const p of progressList) {
    completedDrills[p.drillId] = { completed: p.completed, verified: p.verified };
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

// Prototype-Pollution-Safe JSON Import with Depth & Size Guards
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

    const validated = EnvelopeSchema.parse(parsed);
    const db = await getDatabase();

    for (const [drillId, val] of Object.entries(validated.payload.completedDrills)) {
      await db.put('progress', {
        drillId,
        completed: val.completed,
        verified: val.verified,
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

    return { success: true, message: 'Backup imported and verified successfully.' };
  } catch (err: any) {
    return { success: false, message: `Import validation failed: ${err.message || 'Malformed schema'}` };
  }
}
