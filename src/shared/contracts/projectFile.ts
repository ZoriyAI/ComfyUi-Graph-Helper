/** The project file of the graph on screen, as the app bar and the File commands read it (main/projectFiles.ts). */
export interface ProjectFileState {
  /** The graph this is about: a new one after Open, Open workflow and New project; the restored one on undo. */
  graphKey: string;
  /** The project file it was last opened from or saved to; null when it has none. */
  filePath: string | null;
  fileName: string | null;
  /** The graph is not in that file as it stands (or has no file and is not empty). */
  dirty: boolean;
  empty: boolean;
  /** The project title, for default file names. */
  title: string;
}
