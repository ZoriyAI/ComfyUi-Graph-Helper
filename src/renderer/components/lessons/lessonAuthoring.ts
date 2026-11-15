/**
 * The window's side of writing a lesson: "Make a lesson from this graph" (File menu and the "My lessons" group)
 * opens the editor with the steps derived from the canvas; "Edit" opens it with one of "My lessons"; the editor
 * tries a lesson and saves it through main.
 *
 * Who uses it: MyLessons.tsx, LessonEditor.tsx and the File menu command.
 *
 * Why the try uses the catalog when it can: a lesson tried with the classes of the person's own ComfyUI (their
 * inputs, outputs and the values a new node starts with) is tried the way the person will meet it. Before ComfyUI
 * is read, it is tried against its own promises, and main tries it the same way again before it keeps it.
 */

import { i18n } from '../../i18n';
import { showToast } from '../../ui/toastStore';
import { useGraphStore } from '../../state/graphState';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { useLessonStore } from '../../state/lessonState';
import { useMyLessonsStore } from '../../state/myLessonsState';
import { useNodeInfoStore } from '../graph/nodeInfo';
import { draftFromDoc, draftFromGraph, docFromDraft, lessonIdFrom, type ClassInfo, type LessonDraftModel } from '../../../shared/lessons/share/authoring';
import { checkLessonDoc, myLessonId, type LessonCheck, type LessonImportOutcome, type MyLesson } from '../../../shared/lessons/share/mine';
import { catalogShapes } from '../../../shared/lessons/share/tryLesson';
import type { NodeClassDetail } from '../../../shared/contracts/knowledge';
import { lessonGraphOf } from './lessonModel';

/** Catalog details by class; null for a class the catalog does not have. */
type Details = Record<string, NodeClassDetail | null>;

/** What the editor needs of a class: the library's name and the kind of each field. */
export function classInfoOf(detail: NodeClassDetail | null | undefined): ClassInfo | null {
  if (!detail) return null;
  return {
    displayName: detail.displayName || detail.classType,
    fields: Object.fromEntries(detail.inputs.filter((input) => input.widget).map((input) => [input.name, { kind: input.spec?.kind ?? 'other', multiline: input.spec?.multiline, modelDirectory: input.spec?.modelDirectory }])),
  };
}

/** The language a new lesson draft is written in: the app's language, English for anything but Russian. */
function language(): 'en' | 'ru' {
  return i18n.language === 'ru' ? 'ru' : 'en';
}

/** Opens the editor in the Lessons panel with a lesson made from the graph on the canvas. */
export async function makeLessonFromGraph(): Promise<void> {
  const graph = useGraphStore.getState();
  const request = useNodeInfoStore.getState().request;
  const classes = [...new Set(graph.nodes.map((node) => node.data?.comfyType).filter((type): type is string => typeof type === 'string'))];
  await Promise.all(classes.map((classType) => request(classType).catch(() => null)));
  const details = useNodeInfoStore.getState().details as Details;
  const model = draftFromGraph(lessonGraphOf(graph.nodes, graph.edges, details), (classType) => classInfoOf(details[classType]), language());
  if (!model) {
    showToast({ id: 'lesson-editor', tone: 'info', title: String(i18n.t('lessonFiles.editor.emptyGraph')), duration: 5000 });
    return;
  }
  useLessonStore.getState().leave();
  useLessonStore.getState().setLearning(true);
  useMyLessonsStore.getState().setEditing({ model, replaces: null });
}

/** Opens the editor with one of "My lessons". */
export function editMyLesson(lesson: MyLesson): void {
  useMyLessonsStore.getState().setEditing({ model: draftFromDoc(lesson.doc, language()), replaces: lesson.id });
}

/** The lesson the editor would save, with its id: a new one gets an id from its title that no other lesson of the person has. */
export function editorDoc(model: LessonDraftModel, replaces: string | null) {
  if (replaces) return docFromDraft(model);
  const taken = new Set(useMyLessonsStore.getState().lessons.map((lesson) => lesson.doc.id));
  const base = lessonIdFrom(model.title);
  let id = base;
  for (let index = 2; taken.has(id); index += 1) id = `${base}-${index}`;
  return docFromDraft({ ...model, id });
}

/** Tries the lesson in the editor from an empty canvas (see shared/lessons/share/tryLesson.ts). */
export function tryEditorLesson(model: LessonDraftModel, replaces: string | null): LessonCheck {
  const doc = editorDoc(model, replaces);
  const details = useNodeInfoStore.getState().details as Details;
  const read = (useKnowledgeStore.getState().sync?.counts?.detailedClasses ?? 0) > 0;
  const classes = doc.steps.flatMap((step) => (step.roles ?? []).flatMap((spec) => spec.classes));
  // With the catalog only when it knows every class the lesson names; otherwise against the lesson's own promises.
  const known = read && classes.every((classType) => details[classType]?.detailed);
  const mine = useMyLessonsStore.getState().lessons;
  return checkLessonDoc(doc, (docId) => mine.find((lesson) => lesson.doc.id === docId)?.doc ?? null, known ? catalogShapes((classType) => details[classType]) : undefined);
}

/** Saves the lesson in the editor to "My lessons"; the editor closes when main kept it. */
export async function saveEditorLesson(model: LessonDraftModel, replaces: string | null): Promise<LessonImportOutcome> {
  const bridge = window.electronAPI;
  if (!bridge?.saveMyLesson) return { ok: false, error: 'unavailable' };
  const doc = editorDoc(model, replaces);
  const outcome = await bridge.saveMyLesson(doc);
  if (outcome.ok) {
    await useMyLessonsStore.getState().refresh();
    useMyLessonsStore.getState().setEditing(null);
    // The reading of a changed lesson starts over: its steps may be others now.
    useLessonStore.getState().again(myLessonId(doc.id));
    showToast({ id: 'lesson-editor', tone: 'success', title: String(i18n.t('lessonFiles.editor.saved')), duration: 4000 });
  }
  return outcome;
}
