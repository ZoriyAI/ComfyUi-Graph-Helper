import type { KnowledgeSetDocs } from '../coreKnowledge';

/**
 * Official pages for the video knowledge (video.en.ts, video.ru.ts). Only pages already checked for the core
 * knowledge are named; an entry without a page keeps its family note as an inference. A family the core already
 * links (wan2.2, ltx2) keeps the core's page.
 */
export const VIDEO_KNOWLEDGE_DOCS: KnowledgeSetDocs = {
  nodes: {},
  families: {
    'wan2.2-5b': 'https://docs.comfy.org/tutorials/video/wan/wan2_2',
  },
};
