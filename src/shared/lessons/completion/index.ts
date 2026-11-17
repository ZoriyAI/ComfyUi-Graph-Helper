/** Completes legacy lessons without changing their existing graph contracts or saved step ids. */
import type { Lesson } from '../engine';
import type { LessonLanguage, LessonWords } from '../texts';
import type { LessonCycle } from './types';
import { BASICS_CYCLES } from './basics';
import { MODEL_CHAIN_CYCLES } from './modelChains';
import { IMAGE_MODEL_CYCLES } from './imageModels';
import { EDITING_CYCLES } from './editing';

export const LESSON_CYCLES: Readonly<Record<string, LessonCycle>> = { ...BASICS_CYCLES, ...MODEL_CHAIN_CYCLES, ...IMAGE_MODEL_CYCLES, ...EDITING_CYCLES };
const REVIEWED = '2026-11-17'; // Editorial/source review, not a claim of GPU execution on every model.
const ids = { run: 'practice-run', assess: 'practice-assess', recall: 'practice-recall', transfer: 'practice-transfer' };

function choices(id: string): string[] {
  const values = ['correct', 'confusion-a', 'confusion-b'];
  const offset = [...id].reduce((n, char) => n + char.charCodeAt(0), 0) % values.length;
  return [...values.slice(offset), ...values.slice(0, offset)];
}

export function completeLesson(lesson: Lesson): Lesson {
  const cycle = LESSON_CYCLES[lesson.id];
  if (!cycle || lesson.standard === 2) return lesson;
  return {
    ...lesson, standard: 2, outcomes: cycle.run ? ['structure', 'run', 'result'] : ['structure', 'result'],
    meta: { ...lesson.meta, prerequisites: cycle.prerequisites, checkedOn: REVIEWED, versions: [
      'NodeWise lesson standard 2; editorial review 2026-11-17',
      'ComfyUI node contracts named in this lesson; availability and sockets checked against your synchronized catalog',
    ] },
    steps: [...lesson.steps,
      { id: ids.run, checklist: [{ id: 'copy' }, { id: 'action', ...(cycle.run ? { run: true } : {}) }, { id: 'record' }] },
      { id: ids.assess, rubric: [{ id: 'skill', levels: ['not-yet', 'partly', 'yes'] }, { id: 'evidence', levels: ['not-yet', 'partly', 'yes'] }] },
      { id: ids.recall, quiz: [{ id: 'decision', choices: choices(lesson.id), answer: 'correct' }] },
      { id: ids.transfer, transfer: true, checklist: [{ id: 'own-task' }, { id: 'comparison' }] },
    ],
  };
}

export function completeLessonWords(language: LessonLanguage, id: string, original: LessonWords): LessonWords {
  const cycle = LESSON_CYCLES[id];
  if (!cycle) return original;
  const words = cycle[language]; const ru = language === 'ru';
  const levels = ru ? { 'not-yet': 'Пока не получилось', partly: 'Частично — знаю, что исправить', yes: 'Получилось — могу показать' }
    : { 'not-yet': 'Not yet', partly: 'Partly — I know what to fix', yes: 'Yes — I can show it' };
  return { ...original, meta: {
    ...original.meta, skill: words.skill, requires: [words.prepare],
    mistakes: words.mistakes.map(([sign, fix]) => ({ sign, fix })),
    provenance: ru
      ? `Авторское упражнение NodeWise Studio. Основа: ${cycle.sources.join(' ; ')}. Материалы урока — по LICENSE проекта; модели, расширения и ваши исходные файлы имеют собственные лицензии. Дата относится к проверке содержания.`
      : `Original NodeWise Studio exercise. Based on: ${cycle.sources.join(' ; ')}. Lesson material follows the project LICENSE; models, extensions and your source files have their own licenses. The review date describes the content review.`,
    notChecked: ru
      ? 'Автоматически проверяются ноды, связи и указанные параметры. Запуск в ComfyUI и оценка результата подтверждаются вами. Дата проверки содержания не означает испытание вашей модели, видеокарты или версии расширения.'
      : 'Nodes, links and specified parameters are checked automatically. You confirm execution in ComfyUI and assess the result. The content-review date does not certify your model, GPU or extension version.',
  }, steps: { ...original.steps,
    [ids.run]: {
      title: ru ? (cycle.run ? 'Проверка на собственном результате' : 'Проверка на собственном примере') : (cycle.run ? 'Check your own result' : 'Check your own example'),
      body: `${words.prepare}\n\n${ru ? 'Сначала сохраните учебный граф. Галочки ниже означают ваши подтверждения, приложение не ставит их за вас.' : 'Save the lesson graph first. These checkmarks are your confirmations; the app does not fill them in for you.'}`,
      items: {
        copy: { label: ru ? 'Сохранил учебный граф отдельным файлом.' : 'Saved the lesson graph as a separate file.' },
        action: { label: ru ? (cycle.run ? 'Экспортировал workflow, открыл в ComfyUI и получил результат без ошибки.' : 'Разобрал свой пример по шагам урока и записал вывод.') : (cycle.run ? 'Exported the workflow, opened it in ComfyUI and obtained a result without an error.' : 'Inspected my example using the lesson steps and recorded a conclusion.') },
        record: { label: words.evidence },
      },
    },
    [ids.assess]: {
      title: ru ? 'Что получилось и что улучшить' : 'What worked and what to improve',
      body: ru ? 'Оцените свой результат, а не только наличие нод. «Пока не получилось» тоже полезный ответ: ниже появится следующий шаг. Эта оценка записывается отдельно от проверки структуры графа.' : 'Assess your result, not just whether the nodes exist. “Not yet” is useful: the next step is shown below. This assessment is recorded separately from graph structure checks.',
      criteria: { skill: { title: words.assess[0], levels, tryNext: words.mistakes[0][1] }, evidence: { title: words.assess[1], levels, tryNext: words.mistakes[1][1] } },
    },
    [ids.recall]: {
      title: ru ? 'Проверим понимание' : 'Check your understanding',
      body: ru ? 'Выберите решение. После ответа появится объяснение; ошибку можно использовать как подсказку для следующей попытки.' : 'Choose a solution. The explanation appears after your answer and can guide the next attempt.',
      questions: { decision: { text: words.question, choices: { correct: words.choices[0], 'confusion-a': words.choices[1], 'confusion-b': words.choices[2] }, explain: words.explain } },
    },
    [ids.transfer]: {
      title: ru ? 'Теперь самостоятельно' : 'Now try it yourself',
      body: `${words.practice}\n\n${ru ? 'Работайте с копией workflow в ComfyUI, чтобы сохранить учебный граф и исходные настройки. Вернитесь сюда и отметьте только то, что действительно сделали. Готовое решение на этом шаге не подставляется.' : 'Work on a copy of the workflow in ComfyUI to preserve the lesson graph and its original settings. Return here and mark only what you actually completed. This step does not insert a ready-made solution.'}`,
      items: { 'own-task': { label: ru ? 'Выполнил новую задачу без готового решения.' : 'Completed the new task without a ready-made solution.' }, comparison: { label: words.evidence, how: words.assess.join(' ') } },
    },
  } };
}
