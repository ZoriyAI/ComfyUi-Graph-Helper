import { ClipboardCopy, FolderOpen } from 'lucide-react';
import type { Command } from './registry';
import { copyDiagnostics, openLogsFolder } from '../services/diagnostics/diagnostics';

/** Help ▸ Open logs folder and Help ▸ Copy diagnostics. */
export function buildDiagnosticsCommands(): Command[] {
  return [
    { id: 'help.openLogs', group: 'help', labelKey: 'diagnostics.openLogs', icon: FolderOpen, enabled: () => true, run: () => openLogsFolder() },
    { id: 'help.copyDiagnostics', group: 'help', labelKey: 'diagnostics.copy', icon: ClipboardCopy, enabled: () => true, run: () => void copyDiagnostics() },
  ];
}
