/**
 * The id of the app's single project. The app keeps one project per profile; every graph, revision, proposal and
 * chat message belongs to it. Main's IPC handlers and many renderer parts pass it where the storage asks for a
 * project id.
 */
/** The one project created with the database. Not an environment setting. */
export const DESKTOP_PROJECT_ID = 'desktop';
