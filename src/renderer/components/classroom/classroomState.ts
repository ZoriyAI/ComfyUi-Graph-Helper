/** One local working copy. Explicit JSON export/import moves it between devices without sharing pupil data. */
import { create } from 'zustand';
import { z } from 'zod';
import { MATERIAL_FILE_LIMIT, MATERIAL_KINDS, readClassroomMaterial, type ClassroomMaterial } from '../../../shared/education/material';
import { i18n } from '../../i18n';

export const CLASSROOM_STORAGE_KEY = 'nodewise.classroom.v1';
const briefSchema = z.object({
  kind: z.enum(MATERIAL_KINDS), language: z.enum(['en','ru']), topic: z.string().max(180),
  age: z.string().max(120), objective: z.string().max(1200), source: z.string().max(8000),
});
export type ClassroomBrief = z.infer<typeof briefSchema>;
let languagePending = true;
const blank = (): ClassroomBrief => ({ kind: 'cards', language: i18n.language?.startsWith('ru') ? 'ru' : 'en', topic: '', age: '', objective: '', source: '' });

function restore(): { brief: ClassroomBrief; material: ClassroomMaterial | null; saved: boolean } {
  try {
    const raw = localStorage.getItem(CLASSROOM_STORAGE_KEY);
    if (!raw || raw.length > MATERIAL_FILE_LIMIT * 2) return { brief: blank(), material: null, saved: true };
    const value: unknown = JSON.parse(raw);
    const stored = z.object({ brief: briefSchema, material: z.unknown() }).parse(value);
    languagePending = false;
    return { brief: stored.brief, material: stored.material ? readClassroomMaterial(stored.material) : null, saved: true };
  } catch { return { brief: blank(), material: null, saved: false }; }
}

interface ClassroomState {
  open: boolean; step: number; brief: ClassroomBrief; material: ClassroomMaterial | null;
  incoming: ClassroomMaterial | null; saved: boolean;
  show: (incoming?: ClassroomMaterial) => void; close: () => void;
  setBrief: (patch: Partial<ClassroomBrief>) => void; setMaterial: (material: ClassroomMaterial) => void;
  setStep: (step: number) => void; acceptIncoming: () => void; discardIncoming: () => void; reset: () => void;
}
const initial = restore();
export const useClassroomStore = create<ClassroomState>((set, get) => {
  const persist = (brief: ClassroomBrief, material: ClassroomMaterial | null) => {
    let saved = true;
    try { localStorage.setItem(CLASSROOM_STORAGE_KEY, JSON.stringify({ brief, material })); } catch { saved = false; }
    set({ brief, material, saved });
  };
  return {
    ...initial, open: false, incoming: null, step: initial.material ? 2 : 0,
    show: (incoming) => {
      if (languagePending) { persist({ ...get().brief, language: i18n.language?.startsWith('ru') ? 'ru' : 'en' }, get().material); languagePending = false; }
      set({ open: true, ...(incoming ? { incoming: readClassroomMaterial(incoming) } : {}) });
    },
    close: () => set({ open: false }),
    setBrief: (patch) => persist(briefSchema.parse({ ...get().brief, ...patch }), get().material),
    setMaterial: (material) => persist(get().brief, readClassroomMaterial(material)),
    setStep: (step) => set({ step }),
    acceptIncoming: () => {
      const material = get().incoming; if (!material) return;
      persist({ ...blank(), kind: material.kind, language: material.language, topic: material.title, age: material.age, objective: material.objective }, material);
      set({ incoming: null, step: 2 });
    },
    discardIncoming: () => set({ incoming: null }),
    reset: () => { persist(blank(), null); set({ step: 0, incoming: null }); },
  };
});
export function openClassroom(incoming?: ClassroomMaterial): void { useClassroomStore.getState().show(incoming); }
