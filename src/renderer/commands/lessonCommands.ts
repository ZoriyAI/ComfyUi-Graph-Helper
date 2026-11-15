/**
 * The File menu commands of lessons as files: "Import lessons…" (a lesson file into My lessons) and "Make a
 * lesson from this graph" (the lesson editor with the canvas as the goal).
 *
 * Who uses it: the command registry (appCommands.ts registers them next to the other commands) and the menu bar.
 * Why commands: the menu bar, the command search and shortcuts all reach a feature through the registry.
 */

import { FileUp, GraduationCap } from 'lucide-react';
import type { Command } from './registry';
import { importLessonsFromDialog } from '../components/lessons/lessonFiles';
import { makeLessonFromGraph } from '../components/lessons/lessonAuthoring';
import { openLessons } from './actions';

export function buildLessonFileCommands(): Command[] {
  return [
    { id: 'file.importLessons', group: 'file', labelKey: 'lessonFiles.menuImport', hintKey: 'lessonFiles.menuImportHint', icon: FileUp, enabled: () => true, run: () => importLessonsFromDialog() },
    {
      id: 'file.lessonFromGraph', group: 'file', labelKey: 'lessonFiles.menuFromGraph', hintKey: 'lessonFiles.menuFromGraphHint', icon: GraduationCap, enabled: () => true,
      run: async () => {
        // The Lessons panel shows first; the editor opens in it once the graph is read.
        openLessons();
        await makeLessonFromGraph();
      },
    },
  ];
}
