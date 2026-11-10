import { ClipboardCopy, FolderOpen, ScrollText } from 'lucide-react';
import type { Command } from './registry';
import { copyDiagnostics, openLogsFolder } from '../services/diagnostics/diagnostics';
import { openModelLog } from '../state/modelLogState';

/** Help ▸ Conversation log, Help ▸ Open logs folder and Help ▸ Copy diagnostics. */
export function buildDiagnosticsCommands(): Command[] {
  return [
    { id: 'help.modelLog', group: 'help', labelKey: 'modelLog.menu', hintKey: 'modelLog.menuHint', icon: ScrollText, enabled: () => true, run: () => openModelLog() },
    { id: 'help.openLogs', group: 'help', labelKey: 'diagnostics.openLogs', icon: FolderOpen, enabled: () => true, run: () => openLogsFolder() },
    { id: 'help.copyDiagnostics', group: 'help', labelKey: 'diagnostics.copy', icon: ClipboardCopy, enabled: () => true, run: () => void copyDiagnostics() },
  ];
}
