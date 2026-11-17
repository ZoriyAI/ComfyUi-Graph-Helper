import type { LessonCycle } from './types';
import { CORE_SOURCE } from './types';

/** Technical exercises remain non-graphic; the existing adult-content gate stays authoritative. */
export const ADULT_CYCLES: Readonly<Record<string, LessonCycle>> = {
  'adult-image': {
    prerequisites: ['image', 'sdxl'], run: true, sources: [CORE_SOURCE],
    en: {
      skill: 'Check an adult-only model’s technical compatibility without confusing its subject label with its architecture.',
      prepare: 'Use only fictional, clearly adult subjects and permitted files. Test the graph with an ordinary clothed portrait; the existing adult-content restrictions still apply.',
      mistakes: [
        ['A subject label is mistaken for the model family.', 'Read architecture and component requirements from the model card, separately from its content category.'],
        ['A style-specific checkpoint is paired with an unrelated VAE or LoRA.', 'Match the actual base family and author’s recipe.'],
        ['The workflow is shared without dependencies or content information.', 'Include model identities, requirements and the appropriate audience label; keep private source material out of the package.'],
      ],
      question: 'Does an adult-content label define a model’s technical architecture?',
      choices: ['No; architecture and content category are separate properties.', 'Yes; all such models have identical components.', 'Only the filename extension decides.'],
      explain: 'Compatibility follows the trained architecture and recipe, not the subject category.',
      practice: 'Build a technically compatible ordinary portrait of a fictional adult, then prepare a dependency list and audience label for the workflow.',
      assess: ['Does the graph use compatible model components?', 'Are dependencies, permitted use and intended audience clear?'],
      evidence: 'Saved component list, non-graphic test output and workflow sharing notes.',
    },
    ru: {
      skill: 'Проверить техническую совместимость модели для взрослых, не путая тематику с архитектурой.',
      prepare: 'Используйте только вымышленных явно взрослых персонажей и разрешённые файлы. Проверьте граф обычным портретом в одежде; действующие возрастные ограничения сохраняются.',
      mistakes: [
        ['Тематическая отметка принята за семейство модели.', 'Прочитайте архитектуру и требования компонентов в карточке отдельно от категории содержимого.'],
        ['Специализированный checkpoint соединён с чужим VAE или LoRA.', 'Согласуйте фактическое базовое семейство и рецепт автора.'],
        ['Граф передаётся без зависимостей и отметки содержимого.', 'Добавьте имена моделей, требования и возрастную отметку; не включайте личные исходники в пакет.'],
      ],
      question: 'Определяет ли отметка содержимого для взрослых техническую архитектуру модели?',
      choices: ['Нет: архитектура и категория содержимого являются разными свойствами.', 'Да: у всех таких моделей одинаковые компоненты.', 'Решает только расширение файла.'],
      explain: 'Совместимость определяется обученной архитектурой и рецептом, а не тематической категорией.',
      practice: 'Соберите совместимый обычный портрет вымышленного взрослого, затем подготовьте список зависимостей и отметку аудитории графа.',
      assess: ['Компоненты модели в графе совместимы?', 'Зависимости, разрешённое использование и аудитория понятны?'],
      evidence: 'Сохранил компоненты, нейтральный проверочный результат и пояснения к передаче графа.',
    },
  },
  'adult-lora': {
    prerequisites: ['adult-image', 'lora-image'], run: true, sources: [CORE_SOURCE],
    en: {
      skill: 'Evaluate an adult-only adapter’s compatibility and influence with a controlled non-graphic comparison.',
      prepare: 'Use permitted weights and clearly adult fictional subjects. Keep a neutral clothed baseline and the adapter author’s compatibility notes.',
      mistakes: [
        ['The adapter is selected only by its theme.', 'Check its actual base family and supported loader before applying it.'],
        ['Several adapters are changed together.', 'Compare one adapter at a time with the same seed and baseline.'],
        ['Trigger text or private filenames are accidentally shared.', 'Review exported workflow text and file references before distributing it.'],
      ],
      question: 'How can an adapter’s technical effect be isolated?',
      choices: ['Compare a fixed baseline with one compatible adapter at a time.', 'Change all adapters, prompts and seeds together.', 'Judge only by the adapter’s title.'],
      explain: 'Controlled comparisons separate adapter influence from unrelated setting changes.',
      practice: 'Use a permitted adapter on a neutral clothed fictional-adult portrait, compare moderate influence with the baseline, and document dependencies without private details.',
      assess: ['Can the adapter’s effect be distinguished from other changes?', 'Is the shared graph technically complete and appropriately labelled?'],
      evidence: 'Saved baseline, adapter identity, weights and a reviewed non-graphic comparison.',
    },
    ru: {
      skill: 'Оценить совместимость и влияние адаптера для взрослых на контролируемом нейтральном примере.',
      prepare: 'Используйте разрешённые веса и явно взрослых вымышленных персонажей. Сохраните нейтральный исходный портрет в одежде и указания совместимости автора.',
      mistakes: [
        ['Адаптер выбран только по теме.', 'Проверьте фактическое базовое семейство и поддерживаемый загрузчик до подключения.'],
        ['Несколько адаптеров меняются одновременно.', 'Сравните по одному с тем же seed и исходной конфигурацией.'],
        ['При передаче случайно раскрыты триггеры или личные имена файлов.', 'Просмотрите текст экспортированного графа и ссылки на файлы до распространения.'],
      ],
      question: 'Как выделить техническое влияние адаптера?',
      choices: ['Сравнить фиксированную основу с одним совместимым адаптером за раз.', 'Менять все адаптеры, промпты и seed одновременно.', 'Судить только по названию адаптера.'],
      explain: 'Контролируемое сравнение отделяет влияние адаптера от остальных изменений.',
      practice: 'Проверьте разрешённый адаптер на нейтральном портрете вымышленного взрослого в одежде. Сравните умеренное влияние с основой и опишите зависимости без личных сведений.',
      assess: ['Влияние адаптера отличимо от остальных изменений?', 'Передаваемый граф технически полон и правильно обозначен?'],
      evidence: 'Сохранил основу, имя адаптера, веса и проверенное нейтральное сравнение.',
    },
  },
  adult: {
    prerequisites: ['video-image', 'adult-image'], run: true, sources: [CORE_SOURCE],
    en: {
      skill: 'Check an adult-only video recipe’s model stages, source eligibility and sharing boundaries.',
      prepare: 'Use only clearly adult fictional subjects and permitted files. Keep the technical experiment to an ordinary clothed action and retain the app’s adult gate.',
      mistakes: [
        ['A specialised high/low pair is mixed across incompatible recipes.', 'Use the matching stage pair and schedule documented by its author.'],
        ['One adapter is copied into both stages without evidence.', 'Use stage-specific adapters unless the author explicitly documents both-stage support.'],
        ['A shareable workflow includes unintended private sources.', 'Review input references, prompts and audience information before export or distribution.'],
      ],
      question: 'When may one LoRA be used in both video stages?',
      choices: ['When its author explicitly documents compatibility with both stages.', 'Whenever its filename is short.', 'Always; stages never matter.'],
      explain: 'Stage compatibility is a property of the trained adapter and recipe, not a convenience assumption.',
      practice: 'Create a short ordinary action by a fictional adult using the permitted recipe. Check stage compatibility, temporal coherence and the export’s dependencies and audience label.',
      assess: ['Does the short technical test run with compatible stages?', 'Are source eligibility, output coherence and sharing information clear?'],
      evidence: 'Saved model/stage map, non-graphic clip, timing observations and reviewed export notes.',
    },
    ru: {
      skill: 'Проверить этапы видеорецепта для взрослых, допустимость исходников и условия передачи.',
      prepare: 'Используйте только явно взрослых вымышленных персонажей и разрешённые файлы. Технический опыт ограничьте обычным действием в одежде, сохранив возрастное ограничение приложения.',
      mistakes: [
        ['Специализированная high/low-пара смешана из разных рецептов.', 'Возьмите согласованную пару этапов и расписание, описанные автором.'],
        ['Одна LoRA без основания скопирована в оба этапа.', 'Используйте отдельные адаптеры этапов, если автор прямо не подтвердил поддержку обоих.'],
        ['Передаваемый граф содержит случайные личные исходники.', 'Проверьте ссылки на входные файлы, промпты и отметку аудитории до экспорта или распространения.'],
      ],
      question: 'Когда одну LoRA можно использовать в обоих этапах видео?',
      choices: ['Когда автор прямо указал совместимость с обоими этапами.', 'Когда у файла короткое имя.', 'Всегда: этапы не имеют значения.'],
      explain: 'Совместимость этапов определяется обучением адаптера и рецептом, а не удобством копирования.',
      practice: 'Создайте короткое обычное действие вымышленного взрослого по разрешённому рецепту. Проверьте этапы, связность движения, зависимости экспорта и отметку аудитории.',
      assess: ['Короткий технический опыт работает с согласованными этапами?', 'Допустимость исходников, связность результата и условия передачи понятны?'],
      evidence: 'Сохранил карту моделей и этапов, нейтральный ролик, наблюдения времени и проверенные пояснения экспорта.',
    },
  },
};
