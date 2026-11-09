import {
  Ghost, Columns2, Compass, Database, FileCheck2, FilePlus2, FolderInput, FolderOpen, FolderOutput, Group, History, Info, Keyboard,
  LogOut, Map as MapIcon, Maximize, MessageCircleQuestion, MessageSquare, MessageSquareText, Navigation, PanelLeft, PanelRight, Pause, Play,
  Plus, Redo2, RefreshCw, Save, Settings, SquareDashedMousePointer, Square, Trash2, Undo2, Ungroup, Combine, ZoomIn, ZoomOut, RotateCcw,
} from 'lucide-react';
import { i18n } from '../i18n';
import { addCommandStateSource, registerCommands, type Command } from './registry';
import { canvasHandle } from './canvasHandle';
import {
  addGroup, askAboutSelection, canEditGraph, checkGraph, createSubgraph, deleteSelection, dissolveSubgraph, endRun, exportWorkflowFile, focusChat,
  importCatalogSnapshot, importWorkflowFile, openAddNode, openProjectFile, pauseRun, requestNewProject, resumeRun, saveProjectFile,
  saveSettingsPatch, selectAllNodes, selectedEdgeIds, selectedNodes, selectedSubgraphInstance,
} from './actions';
import { useUiStore } from '../state/uiState';
import { canUseSplit, useDockStore } from '../state/dockState';
import { useGraphStore } from '../state/graphState';
import { useChatStore } from '../state/chatState';
import { useKnowledgeStore } from '../state/knowledgeState';
import { openProposals, useProposalsStore } from '../state/proposalsState';
import { PROVIDER_CHOICES, useProviderStore } from '../state/providerState';
import { useProjectionStore } from '../services/commands/projection';
import { useCanvasStore } from '../components/graph/canvasStore';
import { acceptAllProposals } from '../components/graph/CanvasToolbar';
import { openReplay } from '../components/graph/ReplayPlayer';
import { startGraphTour } from '../components/graph/tour/startTour';
import { runSyncNow, setAutoSync } from '../components/sync/SyncIndicator';
import { RAIL_WIDTH } from '../state/uiState';
import { savePreferencesPatch } from '../state/preferencesState';

const always = () => true;
const never = () => false;

function hasNodes(): boolean {
  return useGraphStore.getState().nodes.length > 0;
}

function replaying(): boolean {
  return Boolean(useCanvasStore.getState().replay);
}

function motionMode(): string {
  return document.documentElement.dataset.motion || 'system';
}

/** Value of a provider choice → command id ('' is "not configured"). */
export function providerCommandId(value: string): string {
  return `assistant.provider.${value || 'none'}`;
}

export const MOTION_CHOICES: Array<{ value: 'system' | 'on' | 'reduced' | 'off'; labelKey: string }> = [
  { value: 'system', labelKey: 'settings.motionSystem' },
  { value: 'on', labelKey: 'settings.motionOn' },
  { value: 'reduced', labelKey: 'settings.motionReduced' },
  { value: 'off', labelKey: 'settings.motionOff' },
];

export const LANGUAGE_CHOICES: Array<{ value: 'en' | 'ru'; labelKey: string }> = [
  { value: 'ru', labelKey: 'settings.languageRussian' },
  { value: 'en', labelKey: 'settings.languageEnglish' },
];

/** Every command of the app. The menu bar lays them out; the toolbar, context menu and hotkeys pick from them. */
export function buildAppCommands(): Command[] {
  const commands: Command[] = [
    // File
    { id: 'file.new', group: 'file', labelKey: 'menu.newProject', hintKey: 'menu.newProjectHint', icon: FilePlus2, shortcut: 'Mod+N', enabled: always, run: requestNewProject },
    { id: 'file.open', group: 'file', labelKey: 'project.open', icon: FolderOpen, shortcut: 'Mod+O', enabled: always, run: openProjectFile },
    { id: 'file.save', group: 'file', labelKey: 'project.save', icon: Save, shortcut: 'Mod+S', enabled: always, run: saveProjectFile },
    { id: 'file.import', group: 'file', labelKey: 'toolbar.import', hintKey: 'menu.importHint', icon: FolderInput, shortcut: 'Mod+I', enabled: always, run: importWorkflowFile },
    { id: 'file.export', group: 'file', labelKey: 'toolbar.export', hintKey: 'shell.exportHint', icon: FolderOutput, shortcut: 'Mod+E', enabled: always, run: exportWorkflowFile },
    { id: 'file.catalog', group: 'file', labelKey: 'toolbar.catalog', hintKey: 'menu.catalogHint', icon: Database, enabled: always, run: importCatalogSnapshot },
    { id: 'file.settings', group: 'file', labelKey: 'menu.settings', icon: Settings, shortcut: 'Mod+,', enabled: always, run: () => useUiStore.getState().openSettings() },
    { id: 'file.quit', group: 'file', labelKey: 'menu.quit', icon: LogOut, shortcut: 'Mod+Q', enabled: always, run: () => window.close() },

    // Edit
    { id: 'edit.undo', group: 'edit', labelKey: 'toolbar.undo', hintKey: 'toolbar.undoHint', icon: Undo2, shortcut: 'Mod+Z', enabled: never, run: () => undefined },
    { id: 'edit.redo', group: 'edit', labelKey: 'toolbar.redo', hintKey: 'toolbar.redoHint', icon: Redo2, shortcut: 'Mod+Shift+Z', enabled: never, run: () => undefined },
    { id: 'edit.selectAll', group: 'edit', labelKey: 'menu.selectAll', icon: SquareDashedMousePointer, shortcut: 'Mod+A', enabled: () => canEditGraph() && hasNodes(), run: selectAllNodes },
    {
      id: 'edit.delete', group: 'edit', labelKey: 'menu.deleteSelection', icon: Trash2, shortcut: 'Delete', shortcutDisplayOnly: true,
      enabled: () => canEditGraph() && (selectedNodes().length > 0 || selectedEdgeIds().length > 0),
      run: deleteSelection,
    },

    // Graph
    { id: 'graph.addNode', group: 'graph', labelKey: 'contextMenu.addNode', icon: Plus, shortcut: 'Mod+K', enabled: () => !replaying(), run: () => openAddNode(null) },
    {
      id: 'graph.createSubgraph', group: 'graph', labelKey: 'contextMenu.createSubgraph', icon: Combine, shortcut: 'Mod+G',
      enabled: () => canEditGraph() && selectedNodes().length > 0,
      run: () => void createSubgraph(selectedNodes().map((node) => node.id)),
    },
    {
      id: 'graph.dissolveSubgraph', group: 'graph', labelKey: 'contextMenu.dissolve', icon: Ungroup,
      enabled: () => canEditGraph() && selectedSubgraphInstance() !== null,
      run: () => {
        const node = selectedSubgraphInstance();
        if (node) void dissolveSubgraph(node.id);
      },
    },
    {
      id: 'graph.addGroup', group: 'graph', labelKey: 'contextMenu.addGroup', icon: Group,
      enabled: () => canEditGraph() && selectedNodes().length > 0,
      run: () => void addGroup(selectedNodes().map((node) => node.id)),
    },
    { id: 'graph.check', group: 'graph', labelKey: 'shell.checkGraph', hintKey: 'shell.checkGraphHint', icon: FileCheck2, shortcut: 'Mod+Shift+C', enabled: always, run: checkGraph },
    {
      id: 'graph.acceptAll', group: 'graph', labelKey: 'contextMenu.acceptAll', icon: Ghost,
      enabled: () => canEditGraph() && openProposals(useProposalsStore.getState().proposals).length > 0,
      run: acceptAllProposals,
    },
    {
      id: 'graph.tour', group: 'graph', labelKey: 'menu.tour', icon: Compass,
      enabled: () => !replaying() && (hasNodes() || useUiStore.getState().tour !== null),
      checked: () => useUiStore.getState().tour !== null,
      run: () => {
        if (useUiStore.getState().tour) useUiStore.getState().stopTour();
        else void startGraphTour();
      },
    },
    {
      id: 'graph.replay', group: 'graph', labelKey: 'canvas.replay', icon: History,
      enabled: always,
      checked: replaying,
      run: () => {
        if (replaying()) useCanvasStore.getState().setReplay(null);
        else void openReplay();
      },
    },

    // View
    { id: 'view.fit', group: 'view', labelKey: 'contextMenu.fit', icon: Maximize, shortcut: 'Shift+1', enabled: always, run: () => canvasHandle()?.fit() },
    { id: 'view.zoomIn', group: 'view', labelKey: 'menu.zoomIn', icon: ZoomIn, shortcut: 'Mod+=', enabled: always, run: () => canvasHandle()?.zoomIn() },
    { id: 'view.zoomOut', group: 'view', labelKey: 'menu.zoomOut', icon: ZoomOut, shortcut: 'Mod+-', enabled: always, run: () => canvasHandle()?.zoomOut() },
    { id: 'view.zoomReset', group: 'view', labelKey: 'menu.zoomReset', icon: RotateCcw, shortcut: 'Mod+0', enabled: always, run: () => canvasHandle()?.zoomReset() },
    {
      id: 'view.rail', group: 'view', labelKey: 'menu.library', icon: PanelLeft, shortcut: 'Mod+B', enabled: always,
      checked: () => useUiStore.getState().railOpen,
      run: () => useUiStore.getState().setRail(!useUiStore.getState().railOpen),
    },
    {
      id: 'view.dock', group: 'view', labelKey: 'menu.tools', icon: PanelRight, shortcut: 'Mod+J', enabled: always,
      checked: () => !useDockStore.getState().collapsed,
      run: () => useDockStore.getState().setCollapsed(!useDockStore.getState().collapsed),
    },
    {
      id: 'view.showBoth', group: 'view', labelKey: 'dock.showBoth', hintKey: 'dock.showBothTitle', icon: Columns2,
      enabled: () => canUseSplit(window.innerWidth),
      checked: () => useDockStore.getState().split,
      run: () => {
        const next = !useDockStore.getState().split;
        if (next && window.innerWidth - RAIL_WIDTH - 560 < 560) useUiStore.getState().setRail(false);
        useDockStore.getState().setSplit(next);
      },
    },
    {
      id: 'view.descriptions', group: 'view', labelKey: 'menu.descriptions', hintKey: 'canvas.descriptions', icon: MessageSquareText, enabled: always,
      checked: () => useCanvasStore.getState().descriptionsOn,
      run: () => useCanvasStore.getState().setDescriptionsOn(!useCanvasStore.getState().descriptionsOn),
    },
    {
      id: 'view.minimap', group: 'view', labelKey: 'menu.minimap', icon: MapIcon, enabled: always,
      checked: () => useCanvasStore.getState().minimapOn,
      run: () => useCanvasStore.getState().setMinimapOn(!useCanvasStore.getState().minimapOn),
    },
    {
      id: 'view.followAgent', group: 'view', labelKey: 'canvas.followAgent', icon: Navigation, enabled: always,
      checked: () => useUiStore.getState().followAgent,
      run: () => {
        const next = !useUiStore.getState().followAgent;
        useUiStore.getState().setFollowAgent(next);
        // The explicit toggle is remembered; the canvas switching it off on a manual pan is not.
        void savePreferencesPatch({ canvas: { followAgent: next } });
      },
    },
    {
      id: 'view.stopExplaining', group: 'view', labelKey: 'menu.stopExplaining', shortcut: 'Escape',
      enabled: () => useUiStore.getState().tour !== null || replaying(),
      run: () => {
        useUiStore.getState().stopTour();
        useCanvasStore.getState().setReplay(null);
      },
    },
    ...LANGUAGE_CHOICES.map((choice): Command => ({
      id: `view.language.${choice.value}`, group: 'view', labelKey: choice.labelKey, enabled: always,
      checked: () => (i18n.language || 'ru').startsWith(choice.value),
      run: () => saveSettingsPatch({ language: choice.value }),
    })),
    ...MOTION_CHOICES.map((choice): Command => ({
      id: `view.motion.${choice.value}`, group: 'view', labelKey: choice.labelKey, enabled: always,
      checked: () => motionMode() === choice.value,
      run: () => saveSettingsPatch({ motion: choice.value }),
    })),

    // Assistant
    { id: 'assistant.focusChat', group: 'assistant', labelKey: 'menu.focusChat', icon: MessageSquare, shortcut: 'Mod+/', enabled: always, run: focusChat },
    { id: 'assistant.askSelection', group: 'assistant', labelKey: 'menu.askSelection', icon: MessageCircleQuestion, enabled: () => !replaying() && selectedNodes().length > 0, run: askAboutSelection },
    {
      id: 'assistant.pause', group: 'assistant', labelKey: 'menu.pauseRun', icon: Pause,
      enabled: () => useProjectionStore.getState().activeRun?.status === 'running' || (useChatStore.getState().isStreaming && !useChatStore.getState().isPaused),
      run: pauseRun,
    },
    {
      id: 'assistant.resume', group: 'assistant', labelKey: 'menu.resumeRun', icon: Play,
      enabled: () => useProjectionStore.getState().activeRun?.status === 'paused',
      run: resumeRun,
    },
    { id: 'assistant.end', group: 'assistant', labelKey: 'menu.endRun', icon: Square, enabled: () => useProjectionStore.getState().activeRun !== null, run: endRun },
    ...PROVIDER_CHOICES.map((choice): Command => ({
      id: providerCommandId(choice.value), group: 'assistant', labelKey: choice.labelKey, enabled: always,
      checked: () => useProviderStore.getState().provider === choice.value,
      run: () => useProviderStore.getState().choose(choice.value),
    })),
    { id: 'assistant.settings', group: 'assistant', labelKey: 'menu.assistantSettings', icon: Settings, enabled: always, run: () => useUiStore.getState().openSettings('assistant') },

    // Sync
    {
      id: 'sync.now', group: 'sync', labelKey: 'sync.now', icon: RefreshCw,
      enabled: () => useKnowledgeStore.getState().sync?.state !== 'running',
      run: runSyncNow,
    },
    {
      id: 'sync.auto', group: 'sync', labelKey: 'sync.auto', enabled: () => useKnowledgeStore.getState().sync !== null,
      checked: () => useKnowledgeStore.getState().sync?.auto.enabled ?? false,
      run: () => {
        const sync = useKnowledgeStore.getState().sync;
        if (sync) return setAutoSync(!sync.auto.enabled, sync.auto.intervalMinutes);
        return undefined;
      },
    },
    { id: 'sync.settings', group: 'sync', labelKey: 'menu.syncSettings', icon: Settings, enabled: always, run: () => useUiStore.getState().openSettings('sync') },

    // Help
    { id: 'help.shortcuts', group: 'help', labelKey: 'menu.shortcuts', icon: Keyboard, shortcut: 'F1', enabled: always, run: () => useUiStore.getState().setDialog('shortcuts') },
    { id: 'help.about', group: 'help', labelKey: 'menu.about', icon: Info, enabled: always, run: () => useUiStore.getState().setDialog('about') },
  ];
  return commands;
}

function domSource(attribute: string) {
  return (listener: () => void) => {
    const observer = new MutationObserver(listener);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [attribute] });
    return () => observer.disconnect();
  };
}

function resizeSource(listener: () => void) {
  window.addEventListener('resize', listener);
  return () => window.removeEventListener('resize', listener);
}

let installed: (() => void) | null = null;

/** Registers the app's commands and the stores their state depends on. Idempotent. */
export function installAppCommands(): () => void {
  if (installed) return installed;
  const offs = [
    addCommandStateSource(useUiStore.subscribe),
    addCommandStateSource(useDockStore.subscribe),
    addCommandStateSource(useGraphStore.subscribe),
    addCommandStateSource(useCanvasStore.subscribe),
    addCommandStateSource(useChatStore.subscribe),
    addCommandStateSource(useKnowledgeStore.subscribe),
    addCommandStateSource(useProposalsStore.subscribe),
    addCommandStateSource(useProviderStore.subscribe),
    addCommandStateSource(useProjectionStore.subscribe),
    addCommandStateSource(domSource('data-motion')),
    addCommandStateSource(domSource('lang')),
    addCommandStateSource(resizeSource),
    registerCommands(buildAppCommands()),
  ];
  installed = () => {
    for (const off of offs) off();
    installed = null;
  };
  return installed;
}
