/** Classroom resources are plain, editable content, separate from lessons about building node graphs. */
import { z } from 'zod';

export const MATERIAL_KINDS = ['cards', 'worksheet', 'quiz', 'explanation', 'storyboard', 'variants'] as const;
export type MaterialKind = typeof MATERIAL_KINDS[number];
export const MATERIAL_FILE_LIMIT = 256 * 1024;
const text = (max: number) => z.string().max(max);
export const classroomMaterialSchema = z.object({
  format: z.literal('nodewise-classroom'), version: z.literal(1),
  kind: z.enum(MATERIAL_KINDS), language: z.enum(['en', 'ru']),
  title: text(180), age: text(120), objective: text(1200),
  blocks: z.array(z.object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), heading: text(200),
    text: text(4000), answer: text(2000), teacherNotes: text(2000),
  }).strict()).min(1).max(24),
  sources: text(4000),
}).strict();
export type ClassroomMaterial = z.infer<typeof classroomMaterialSchema>;

export function readClassroomMaterial(value: unknown): ClassroomMaterial {
  const parsed = classroomMaterialSchema.parse(value);
  if (new Set(parsed.blocks.map(block => block.id)).size !== parsed.blocks.length) throw new Error('Duplicate block identifiers.');
  if (new TextEncoder().encode(JSON.stringify(parsed)).length > MATERIAL_FILE_LIMIT) throw new Error('Material file is too large.');
  return parsed;
}

type Words = { title: string; outcome: string; headings: string[]; prompts: string[] };
/** One registry is shared by the wizard, the manual scaffold and the assistant's request. */
export const MATERIAL_TEMPLATES: Record<MaterialKind, Record<'en' | 'ru', Words>> = {
  cards: {
    en: { title: 'Topic cards', outcome: 'Short cards for reading, discussion or a matching activity.', headings: ['Card 1', 'Card 2', 'Card 3'], prompts: ['Write the word and one clear task.', 'Write the next word and its task.', 'Add a card for independent practice.'] },
    ru: { title: 'Карточки по теме', outcome: 'Короткие карточки для чтения, обсуждения или игры на соответствия.', headings: ['Карточка 1', 'Карточка 2', 'Карточка 3'], prompts: ['Напишите слово и одно понятное задание.', 'Напишите следующее слово и задание.', 'Добавьте карточку для самостоятельной работы.'] },
  },
  worksheet: {
    en: { title: 'Worksheet', outcome: 'An instruction, tasks and room for pupils to respond.', headings: ['Instruction', 'Try together', 'Try on your own'], prompts: ['Explain what to do in one or two sentences.', 'Add a worked example or a supported task.', 'Write a task and leave room for an answer.'] },
    ru: { title: 'Рабочий лист', outcome: 'Инструкция, задания и место для самостоятельного ответа.', headings: ['Инструкция', 'Пробуем вместе', 'Пробуем самостоятельно'], prompts: ['Объясните действие одним или двумя предложениями.', 'Добавьте разобранный пример или задание с опорой.', 'Напишите задание и оставьте место для ответа.'] },
  },
  quiz: {
    en: { title: 'Quick understanding check', outcome: 'A few questions, with answers kept in the teacher copy.', headings: ['Question 1', 'Question 2', 'Question 3'], prompts: ['Ask about the main idea.', 'Ask for an example.', 'Ask pupils to explain their reasoning.'] },
    ru: { title: 'Проверка понимания', outcome: 'Несколько вопросов; ответы останутся в копии учителя.', headings: ['Вопрос 1', 'Вопрос 2', 'Вопрос 3'], prompts: ['Спросите о главной идее.', 'Попросите привести пример.', 'Попросите объяснить ход рассуждений.'] },
  },
  explanation: {
    en: { title: 'Explain a topic', outcome: 'An idea, a familiar example and a short practice task.', headings: ['The idea', 'An example', 'Your turn'], prompts: ['Explain the idea using familiar words.', 'Give a concrete example.', 'Add a small task that checks the same idea.'] },
    ru: { title: 'Объяснить тему', outcome: 'Главная мысль, знакомый пример и короткая практика.', headings: ['Главная мысль', 'Пример', 'Теперь попробуйте'], prompts: ['Объясните идею знакомыми словами.', 'Приведите конкретный пример.', 'Добавьте небольшое задание на ту же идею.'] },
  },
  storyboard: {
    en: { title: 'Story sequence', outcome: 'Editable captions and a plan for illustrations; images are created separately.', headings: ['Beginning', 'What happens next', 'Ending'], prompts: ['Describe the first event and its caption.', 'Describe the next event and its connection to the first.', 'Describe the outcome and a discussion question.'] },
    ru: { title: 'История по кадрам', outcome: 'Подписи и план иллюстраций для правки; изображения создаются отдельно.', headings: ['Начало', 'Что произошло дальше', 'Завершение'], prompts: ['Опишите первое событие и подпись к нему.', 'Опишите следующее событие и связь с первым.', 'Опишите результат и вопрос для обсуждения.'] },
  },
  variants: {
    en: { title: 'Different levels of support', outcome: 'Three tasks with one goal: supported, independent and an extra challenge.', headings: ['With support', 'Independently', 'An extra challenge'], prompts: ['Add a hint or worked example.', 'Keep the same learning goal with less support.', 'Offer a further question using the same idea.'] },
    ru: { title: 'Разные уровни поддержки', outcome: 'Три задания с одной целью: с опорой, самостоятельно и дополнительное.', headings: ['С опорой', 'Самостоятельно', 'Дополнительная задача'], prompts: ['Добавьте подсказку или разобранный пример.', 'Сохраните учебную цель, уменьшив помощь.', 'Предложите дополнительный вопрос на ту же идею.'] },
  },
};

export function materialScaffold(kind: MaterialKind, language: 'en' | 'ru', topic: string, age: string, objective: string): ClassroomMaterial {
  const words = MATERIAL_TEMPLATES[kind][language];
  return readClassroomMaterial({ format: 'nodewise-classroom', version: 1, kind, language,
    title: topic.trim() || words.title, age, objective, sources: '',
    blocks: words.headings.map((heading, index) => ({ id: `block-${index + 1}`, heading, text: '', answer: '', teacherNotes: '' })),
  });
}

/** The assistant receives form values as quoted data; generating a resource does not request graph changes. */
export function classroomRequest(material: ClassroomMaterial, source: string): string {
  const intro = material.language === 'ru'
    ? 'Подготовь материал к школьному занятию с помощью draftClassroomMaterial. Заполни содержимое блоков по теме, возрасту и цели ниже. Ответы и заметки учителя запиши только в answer и teacherNotes. Сохрани язык. Не изменяй граф. Не придумывай источники или соответствие программе. Если исходных данных недостаточно, явно укажи, что нужно проверить. Для раскадровки подготовь подписи, а не заявляй, что изображения созданы.'
    : 'Prepare a classroom resource using draftClassroomMaterial. Fill its blocks for the topic, age and objective below. Put answers and teacher-only notes only in answer and teacherNotes. Preserve the language. Do not change the graph. Do not invent sources or curriculum alignment. Flag missing facts for teacher review. For a storyboard write captions rather than claiming images have been generated.';
  return `${intro}\n${JSON.stringify({ material, sourceText: source.slice(0,8000) })}`;
}

/** Present a wizard request as the teacher's task, keeping protocol details out of the conversation. */
export function classroomRequestSummary(message: string): string | null {
  const split = message.indexOf('\n');
  if (split < 0 || !message.slice(0, split).includes('draftClassroomMaterial')) return null;
  try {
    const data = z.object({ material: classroomMaterialSchema, sourceText: z.string().max(8000) }).strict().parse(JSON.parse(message.slice(split + 1)));
    const material = readClassroomMaterial(data.material);
    if (classroomRequest(material, data.sourceText) !== message) return null;
    const ru = material.language === 'ru';
    return [
      `${ru ? 'Подготовить материал к уроку' : 'Prepare classroom material'}: ${material.title}`,
      MATERIAL_TEMPLATES[material.kind][material.language].title,
      material.age,
      material.objective,
      data.sourceText ? `${ru ? 'Исходный текст' : 'Source text'}: ${data.sourceText}` : '',
    ].filter(Boolean).join('\n');
  } catch { return null; }
}

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
/** Student HTML is built from an allowlist, not by hiding the teacher fields with CSS. No scripts or network. */
export function materialHtml(input: ClassroomMaterial, audience: 'pupil' | 'teacher'): string {
  const material = readClassroomMaterial(input); const ru = material.language === 'ru';
  const paragraphs = (value: string) => `<p>${escape(value).replace(/\n/g, '<br>')}</p>`;
  const teacher = audience === 'teacher';
  return `<!doctype html><html lang="${material.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${escape(material.title)}</title><style>
@page{size:A4;margin:16mm}*{box-sizing:border-box}body{max-width:190mm;margin:24px auto;padding:16px;font-family:system-ui,sans-serif;font-size:18px;line-height:1.55;color:#111;background:white}h1{font-size:28px}h2{font-size:21px;margin:0 0 8px}p{white-space:normal;overflow-wrap:anywhere}section{border:1px solid #555;padding:16px;margin:14px 0;break-inside:avoid}aside{border-top:1px dashed #777;margin-top:16px}header{margin-bottom:20px}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.cards section{margin:0}.answer-space{min-height:60px;border-bottom:1px dotted #777}footer{margin-top:20px;font-size:14px}@media(max-width:600px){.cards{grid-template-columns:1fr}}@media print{body{margin:0;padding:0;max-width:none}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}a{color:inherit}}</style></head><body><header><h1>${escape(material.title)}</h1>${paragraphs(material.age)}${paragraphs(material.objective)}${teacher ? paragraphs(ru ? 'Копия учителя · проверьте материал перед занятием' : 'Teacher copy · review before use') : ''}</header><main class="${material.kind === 'cards' ? 'cards' : 'sections'}">${material.blocks.map(block => `<section><h2>${escape(block.heading)}</h2>${paragraphs(block.text)}${['worksheet','quiz'].includes(material.kind) ? '<div class="answer-space"></div>' : ''}${teacher && (block.answer || block.teacherNotes) ? `<aside>${block.answer ? `<strong>${ru ? 'Ответ' : 'Answer'}</strong>${paragraphs(block.answer)}` : ''}${block.teacherNotes ? `<strong>${ru ? 'Заметки учителя' : 'Teacher notes'}</strong>${paragraphs(block.teacherNotes)}` : ''}</aside>` : ''}</section>`).join('')}</main>${material.sources ? `<footer>${paragraphs(material.sources)}</footer>` : ''}</body></html>`;
}
