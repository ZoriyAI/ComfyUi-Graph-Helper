/** Measured hardware and conservative file-based planning, never a promise of successful execution. */
export interface HardwareSnapshot {
  origin: string; measuredAt: number; ramTotal: number | null; ramFree: number | null;
  devices: Array<{ name: string; type: string; total: number | null; free: number | null }>;
}
export interface GraphResources {
  assessedAt: number; hardware: HardwareSnapshot | null;
  verdict: 'blocked' | 'risk' | 'unknown' | 'within-reference';
  models: Array<{ directory: string; name: string; sizeBytes: number | null; nodes: string[] }>;
  missingModels: Array<{ directory: string; name: string }>; missingClasses: string[];
  totalWeightFileBytes: number; largestWeightFileBytes: number; unknownSizes: number;
  stages: Array<{ nodeId: string; title: string; classType: string; subgraphId?: string; models: string[] }>;
  resolution: { width: number; height: number; frames: number; batch: number };
  unknownRuntimeModels: string[]; reasons: string[];
}
