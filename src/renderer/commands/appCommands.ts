/**
 * Every command of the app's menus (File, Edit, Graph, View, Assistant, Sync, Help) and their installation.
 *
 * Who uses it: App.tsx calls installAppCommands once; components/shell/MenuBar.tsx lays the commands out and reads
 * the choice lists; components/graph/Onboarding.tsx reads LANGUAGE_CHOICES.
 * Why the install also starts watchers (undo history, project file, replay gate, view memory, catalog): they must
 * live exactly as long as the commands whose state they feed.
 */
import {
  Ghost, Columns2, Compass, Database, FileCheck2, FilePlus2, FolderInput, FolderOpen, FolderOutput, GraduationCap, Group, History, Info, Keyboard,
  LogOut, Map as MapIcon, Maximize, MessageCircleQuestion, MessageSquare, MessageSquareText, Navigation, PanelLeft, PanelRight, Pause, Play,
  Plus, Redo2, RefreshCw, Save, Settings, SquareDashedMousePointer, Square, Trash2, Undo2, Ungroup, Combine, ZoomIn, ZoomOut, RotateCcw,
  Workflow, BookOpen, LifeBuoy, Sparkles, ChevronsDownUp, Copy, ClipboardPaste, Scissors, CopyPlus, ShieldCheck, BookA, Globe, Bug, Download,
} from 'lucide-react';
import { useJourneyStore } from '../state/journeyState';
import { openHelp, openProjectLink, openWhatsNew, projectLinksAvailable } from '../services/help';
import { arrangeGraph } from '../components/graph/arrange';
import { toggleCollapseSelection } from '../components/graph/importLook';
import { levelNodes } from '../components/graph/lib/level';
import { i18n } from '../i18n';
import { addCommandStateSource, registerCommands, type Command } from './registry';
import { canvasHandle } from './canvasHandle';
import { guardBuild } from './buildGuard';
import { canRedo, canUndo, installUndoHistory, redo, redoHint, undo, undoHint } from './undo';
import { useUndoStore } from '../state/undoState';
import { installPortsNotice } from '../services/portsNotice';
import {
  addGroup, askAboutSelection, canEditGraph, canEditLevel, checkGraph, createSubgraph, deleteSelection, dissolveSubgraph, endRun, exportWorkflowFile, focusChat, openLessons,
  importCatalogSnapshot, importWorkflowFile, openAddNode, openProjectFile, pauseRun, requestNewProject, resumeRun, saveProjectFile, saveProjectFileAs,
  saveSettingsPatch, selectAllNodes, selectedEdgeIds, selectedNodes, selectedSubgraphInstance,
} from './actions';
import { useUiStore } from '../state/uiState';
import { canUseSplit, useDockStore } from '../state/dockState';
import { useGraphStore } from '../state/graphState';
import { useChatStore } from '../state/chatState';
import { useKnowledgeStore } from '../state/knowledgeState';
import { openProposals, useProposalsStore } from '../state/proposalsState';
import { providerChoices, useProviderStore } from '../state/providerState';
import { useProjectionStore } from '../services/commands/projection';
import { useCanvasStore } from '../components/graph/canvasStore';
import type { DescriptionsMode } from '../../shared/config/preferences';
import { acceptAllProposals, rejectAllProposals } from '../components/graph/CanvasToolbar';
import { openReplay } from '../components/graph/ReplayPlayer';
import { startGraphTour } from '../components/graph/tour/startTour';
import { runSyncNow, setAutoSync } from '../components/sync/SyncIndicator';
import { RAIL_WIDTH } from '../state/uiState';
import { savePreferencesPatch, usePreferencesStore } from '../state/preferencesState';
import { INTERFACE_SCALE, nextInterfaceScale } from '../../shared/config/preferences';
import { buildDiagnosticsCommands } from './diagnosticsCommands';
import { buildLessonFileCommands } from './lessonCommands';
import { Pin, Stethoscope } from 'lucide-react';
import { copySelection, cutSelection, duplicateSelection, hasClipboard, hasSelection, pasteClipboard, subscribeClipboard } from '../components/graph/lib/clipboard';
import { installProjectFileWatch } from '../services/projectFile';
import { installReplayGate } from './replayGate';
import { installViewMemory } from '../state/viewMemory';
import { installCatalogWatch } from '../services/catalogWatch';
import { buildEditingCommands } from './editingCommands';

const always = () => true;

/** The root graph has nodes. */
function hasNodes(): boolean {
  return useGraphStore.getState().nodes.length > 0;
}

/** The level on screen (the root graph or the open subgraph) has nodes. */
function hasLevelNodes(): boolean {
  return levelNodes().length > 0;
}

/** History replay is open. */
function replaying(): boolean {
  return Boolean(useCanvasStore.getState().replay);
}

/** The motion setting on screen (the data-motion attribute of the page), 'system' when unset. */
function motionMode(): string {
  return document.documentElement.dataset.motion || 'system';
}

/** Value of a provider choice → command id ('' is "not configured"). */
export function providerCommandId(value: string): string {
  return `assistant.provider.${value || 'none'}`;
}

/** The three description modes, as the View menu lists them. */
export const DESCRIPTION_MODE_CHOICES: Array<{ value: DescriptionsMode; labelKey: string }> = [
  { value: 'own', labelKey: 'canvas.descriptionsOwn' },
  { value: 'all', labelKey: 'canvas.descriptionsAll' },
  { value: 'off', labelKey: 'canvas.descriptionsOff' },
];

/** The motion settings, as View ▸ Motion lists them. */
export const MOTION_CHOICES: Array<{ value: 'system' | 'on' | 'reduced' | 'off'; labelKey: string }> = [
  { value: 'system', labelKey: 'settings.motionSystem' },
  { value: 'on', labelKey: 'settings.motionOn' },
  { value: 'reduced', labelKey: 'settings.motionReduced' },
  { value: 'off', labelKey: 'settings.motionOff' },
];

/** The interface languages, as View ▸ Language and the first-run card list them. */
export const LANGUAGE_CHOICES: Array<{ value: 'en' | 'ru'; labelKey: string }> = [
  { value: 'ru', labelKey: 'settings.languageRussian' },
  { value: 'en', labelKey: 'settings.languageEnglish' },
];

/** Moves the interface size one step up (1), down (-1) or back to normal (0), and keeps it in preferences. */
function stepInterfaceScale(direction: 1 | -1 | 0): void {
  const current = usePreferencesStore.getState().preferences.appearance.interfaceScale;
  const next = direction === 0 ? INTERFACE_SCALE.default : nextInterfaceScale(current, direction);
  window.electronAPI?.setInterfaceScale?.(next / 100);
  void savePreferencesPatch({ appearance: { interfaceScale: next } });
}

/** Every command of the app. The menu bar lays them out; the toolbar, context menu and hotkeys pick from them. */
export function buildAppCommands(): Command[] {
  const commands: Command[] = [
    // File
    { id: 'file.new', group: 'file', labelKey: 'menu.newProject', hintKey: 'menu.newProjectHint', icon: FilePlus2, shortcut: 'Mod+N', enabled: always, run: guardBuild(requestNewProject) },
    { id: 'file.open', group: 'file', labelKey: 'project.open', icon: FolderOpen, shortcut: 'Mod+O', enabled: always, run: guardBuild(openProjectFile) },
    { id: 'file.save', group: 'file', labelKey: 'project.save', icon: Save, shortcut: 'Mod+S', enabled: always, run: () => saveProjectFile() },
    { id: 'file.saveAs', group: 'file', labelKey: 'project.saveAs', icon: Save, shortcut: 'Mod+Shift+S', enabled: always, run: saveProjectFileAs },
    { id: 'file.import', group: 'file', labelKey: 'toolbar.import', hintKey: 'menu.importHint', icon: FolderInput, shortcut: 'Mod+I', enabled: always, run: guardBuild(importWorkflowFile) },
    { id: 'file.export', group: 'file', labelKey: 'toolbar.export', hintKey: 'shell.exportHint', icon: FolderOutput, shortcut: 'Mod+E', enabled: always, run: exportWorkflowFile },
    { id: 'file.catalog', group: 'file', labelKey: 'toolbar.catalog', hintKey: 'menu.catalogHint', icon: Database, enabled: always, run: importCatalogSnapshot },
    { id: 'file.settings', group: 'file', labelKey: 'menu.settings', icon: Settings, shortcut: 'Mod+,', enabled: always, run: () => useUiStore.getState().openSettings() },
    { id: 'file.quit', group: 'file', labelKey: 'menu.quit', icon: LogOut, shortcut: 'Mod+Q', enabled: always, run: () => window.close() },

    // Edit
    { id: 'edit.undo', group: 'edit', labelKey: 'toolbar.undo', hintKey: 'toolbar.undoNone', hint: undoHint, icon: Undo2, shortcut: 'Mod+Z', enabled: canUndo, run: undo },
    { id: 'edit.redo', group: 'edit', labelKey: 'toolbar.redo', hintKey: 'toolbar.redoNone', hint: redoHint, icon: Redo2, shortcut: 'Mod+Shift+Z', altShortcuts: ['Mod+Y'], enabled: canRedo, run: redo },
    // Copy, cut, paste and duplicate act on the level on screen, a subgraph included; a paste or a duplicate is one step.
    { id: 'edit.copy', group: 'edit', labelKey: 'menu.copy', icon: Copy, shortcut: 'Mod+C', enabled: () => canEditLevel() && hasSelection(), run: () => void copySelection() },
    { id: 'edit.cut', group: 'edit', labelKey: 'menu.cut', icon: Scissors, shortcut: 'Mod+X', enabled: () => canEditLevel() && hasSelection(), run: () => void cutSelection() },
    { id: 'edit.paste', group: 'edit', labelKey: 'menu.paste', icon: ClipboardPaste, shortcut: 'Mod+V', enabled: () => canEditLevel() && hasClipboard(), run: () => void pasteClipboard() },
    { id: 'edit.duplicate', group: 'edit', labelKey: 'menu.duplicate', icon: CopyPlus, shortcut: 'Mod+D', enabled: () => canEditLevel() && hasSelection(), run: () => void duplicateSelection() },
    { id: 'edit.selectAll', group: 'edit', labelKey: 'menu.selectAll', icon: SquareDashedMousePointer, shortcut: 'Mod+A', enabled: () => canEditLevel() && hasLevelNodes(), run: selectAllNodes },
    {
      id: 'edit.delete', group: 'edit', labelKey: 'menu.deleteSelection', icon: Trash2, shortcut: 'Delete', shortcutDisplayOnly: true,
      enabled: () => canEditLevel() && (selectedNodes().length > 0 || selectedEdgeIds().length > 0),
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
      // Mod+Shift+G: next to Mod+G (subgraph from selection) and free everywhere else (editing package).
      id: 'graph.addGroup', group: 'graph', labelKey: 'contextMenu.addGroup', icon: Group, shortcut: 'Mod+Shift+G',
      enabled: () => canEditGraph() && selectedNodes().length > 0,
      run: () => void addGroup(selectedNodes().map((node) => node.id)),
    },
    // Collapse the selected nodes to their title row, or open them again, as ComfyUI's Alt+C does.
    {
      id: 'graph.collapse', group: 'graph', labelKey: 'importLook.menuCollapse', icon: ChevronsDownUp, shortcut: 'Alt+C',
      enabled: () => canEditLevel() && selectedNodes().length > 0,
      run: () => void toggleCollapseSelection(),
    },
    // Layout: the selection (two or more nodes) or the whole graph, one undoable commit, then a fit.
    {
      id: 'graph.arrange', group: 'graph', labelKey: 'canvas.arrangeGraph', hintKey: 'canvas.arrangeHint', icon: Workflow, shortcut: 'Mod+Shift+L',
      enabled: () => canEditLevel() && hasLevelNodes(),
      run: arrangeGraph,
    },
    { id: 'graph.check', group: 'graph', labelKey: 'shell.checkGraph', hintKey: 'shell.checkGraphHint', icon: FileCheck2, shortcut: 'Mod+Shift+C', enabled: always, run: checkGraph },
    {
      id: 'graph.acceptAll', group: 'graph', labelKey: 'contextMenu.acceptAll', icon: Ghost,
      enabled: () => canEditGraph() && openProposals(useProposalsStore.getState().proposals).length > 0,
      run: acceptAllProposals,
    },
    {
      id: 'graph.rejectAll', group: 'graph', labelKey: 'contextMenu.rejectAll', icon: Ghost,
      enabled: () => openProposals(useProposalsStore.getState().proposals).length > 0,
      run: rejectAllProposals,
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
    // Accessibility: the whole interface larger or smaller (Settings ▸ Appearance holds the same choice). Ctrl+= and
    // Ctrl+- belong to the canvas zoom, so these hold Alt as well.
    { id: 'view.interfaceLarger', group: 'view', labelKey: 'a11y.interfaceLarger', icon: ZoomIn, shortcut: 'Mod+Alt+=', enabled: () => usePreferencesStore.getState().preferences.appearance.interfaceScale < INTERFACE_SCALE.max, run: () => stepInterfaceScale(1) },
    { id: 'view.interfaceSmaller', group: 'view', labelKey: 'a11y.interfaceSmaller', icon: ZoomOut, shortcut: 'Mod+Alt+-', enabled: () => usePreferencesStore.getState().preferences.appearance.interfaceScale > INTERFACE_SCALE.min, run: () => stepInterfaceScale(-1) },
    { id: 'view.interfaceReset', group: 'view', labelKey: 'a11y.interfaceReset', icon: RotateCcw, shortcut: 'Mod+Alt+0', enabled: () => usePreferencesStore.getState().preferences.appearance.interfaceScale !== INTERFACE_SCALE.default, run: () => stepInterfaceScale(0) },
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
        // The split dock is at least 560 px (SPLIT_MIN) and the canvas keeps 560 px (CANVAS_MIN): the library closes
        // when both would not fit beside it.
        if (next && window.innerWidth - RAIL_WIDTH - 560 < 560) useUiStore.getState().setRail(false);
        useDockStore.getState().setSplit(next);
      },
    },
    {
      id: 'view.descriptions', group: 'view', labelKey: 'menu.descriptions', hintKey: 'canvas.descriptions', icon: MessageSquareText, enabled: always,
      checked: () => useCanvasStore.getState().descriptionsMode !== 'off',
      // Cycles own → all → off; the View menu picks a mode directly through view.descriptions.<mode>.
      run: () => useCanvasStore.getState().cycleDescriptionsMode(),
    },
    ...DESCRIPTION_MODE_CHOICES.map((choice): Command => ({
      id: `view.descriptions.${choice.value}`, group: 'view', labelKey: choice.labelKey, enabled: always,
      checked: () => useCanvasStore.getState().descriptionsMode === choice.value,
      run: () => useCanvasStore.getState().setDescriptionsMode(choice.value),
    })),
    {
      id: 'view.pinNodes', group: 'view', labelKey: 'canvas.pinNodes', hintKey: 'canvas.pinNodesHint', icon: Pin, enabled: always,
      checked: () => useCanvasStore.getState().nodesPinned,
      run: () => useCanvasStore.getState().setNodesPinned(!useCanvasStore.getState().nodesPinned),
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
    { id: 'assistant.lessons', group: 'assistant', labelKey: 'menu.lessons', hintKey: 'lessons.modeHint', icon: GraduationCap, enabled: always, run: openLessons },
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
    ...providerChoices().map((choice): Command => ({
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
    { id: 'help.guide', group: 'help', labelKey: 'helpReader.guide', icon: BookOpen, enabled: always, run: () => openHelp('home') },
    { id: 'help.glossary', group: 'help', labelKey: 'helpReader.glossary', icon: BookA, enabled: always, run: () => openHelp('glossary') },
    { id: 'help.troubleshooting', group: 'help', labelKey: 'helpReader.troubleshooting', icon: LifeBuoy, enabled: always, run: () => openHelp('troubleshooting') },
    { id: 'help.whatsNew', group: 'help', labelKey: 'helpReader.whatsNew', icon: Sparkles, enabled: always, run: () => openWhatsNew() },
    { id: 'help.content', group: 'help', labelKey: 'helpReader.content', icon: ShieldCheck, enabled: always, run: () => openHelp('content-rules') },
    { id: 'help.site', group: 'help', labelKey: 'projectLinks.site', icon: Globe, enabled: projectLinksAvailable, run: () => void openProjectLink('site') },
    { id: 'help.reportProblem', group: 'help', labelKey: 'projectLinks.report', icon: Bug, enabled: projectLinksAvailable, run: () => useUiStore.getState().setDialog('report-problem') },
    { id: 'help.releases', group: 'help', labelKey: 'projectLinks.releases', icon: Download, enabled: projectLinksAvailable, run: () => void openProjectLink('releases') },
    // The journey: the window tour on demand, and the way back from a ComfyUI error (components/journey).
    { id: 'help.tour', group: 'help', labelKey: 'journey.tour.start', icon: Compass, enabled: always, run: () => useJourneyStore.getState().startTour() },
    { id: 'help.comfyError', group: 'help', labelKey: 'journey.run.errorButton', icon: Stethoscope, enabled: always, run: () => useJourneyStore.getState().open('error') },
    { id: 'help.runInComfy', group: 'help', labelKey: 'journey.run.title', icon: Play, enabled: always, run: () => useJourneyStore.getState().open('run') },
    { id: 'help.shortcuts', group: 'help', labelKey: 'menu.shortcuts', icon: Keyboard, shortcut: 'F1', enabled: always, run: () => useUiStore.getState().setDialog('shortcuts') },
    { id: 'help.about', group: 'help', labelKey: 'menu.about', icon: Info, enabled: always, run: () => useUiStore.getState().setDialog('about') },
  ];
  return commands;
}

/** A command state source that fires when an attribute of <html> changes (data-motion, lang). */
function domSource(attribute: string) {
  return (listener: () => void) => {
    const observer = new MutationObserver(listener);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [attribute] });
    return () => observer.disconnect();
  };
}

/** A command state source for window resizes (View ▸ Show both depends on the width). */
function resizeSource(listener: () => void) {
  window.addEventListener('resize', listener);
  return () => window.removeEventListener('resize', listener);
}

/** The uninstall of the current installation, so a second call returns it instead of registering twice. */
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
    addCommandStateSource(useUndoStore.subscribe),
    installUndoHistory(),
    // The unsaved mark and the File commands read the project file of the graph on screen from main.
    installProjectFileWatch(),
    installReplayGate(),
    installViewMemory(),
    installCatalogWatch(),
    // Not a command, but installed once with them: the "ports unknown" toast when a node is added.
    installPortsNotice(),
    addCommandStateSource(domSource('data-motion')),
    addCommandStateSource(domSource('lang')),
    addCommandStateSource(resizeSource),
    addCommandStateSource(subscribeClipboard),
    registerCommands(buildAppCommands()),
    registerCommands(buildDiagnosticsCommands()),
    registerCommands(buildEditingCommands()),
    registerCommands(buildLessonFileCommands()),
  ];
  installed = () => {
    for (const off of offs) off();
    installed = null;
  };
  return installed;
}
