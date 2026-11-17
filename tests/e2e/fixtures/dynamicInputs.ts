/** Shapes taken from ComfyUI V3 object_info declarations; no extension JS required. */
export const dynamicObjectInfo = {
  DynamicImage: { input: { required: {
    image: ['IMAGE'],
    mode: ['COMFY_DYNAMICCOMBO_V3', { options: [
      { key: 'dimensions', inputs: { required: { width: ['INT', { default: 512 }], height: ['INT', { default: 768 }] } } },
      { key: 'multiplier', inputs: { required: { multiplier: ['FLOAT', { default: 2 }] } } },
      { key: 'custom', inputs: { required: { drawing: ['PAINTER'] } } },
    ] }],
    after: ['STRING', { default: 'tail' }],
  } }, output: ['IMAGE'] },
  ImageBatchMulti: { input: { required: {
    images: ['COMFY_AUTOGROW_V3', { template: { input: { required: { image: ['IMAGE', { forceInput: true }] } }, prefix: 'image', min: 1, max: 3 } }],
  } }, output: ['IMAGE'] },
  ListConsumer: { is_input_list: true, input: { required: { images: ['IMAGE'] } }, output: ['IMAGE'], output_is_list: [true] },
  Match: { input: { required: {
    a: ['COMFY_MATCHTYPE_V3', { template: { template_id: 'T', allowed_types: 'IMAGE,MASK' } }],
    b: ['COMFY_MATCHTYPE_V3', { template: { template_id: 'T', allowed_types: 'IMAGE,MASK' } }],
  } }, output: ['COMFY_MATCHTYPE_V3'], output_matchtypes: ['T'] },
  Rows: { input: { required: {
    before: ['STRING', { default: 'head' }],
    loras: ['COMFY_DYNAMICGROUP_V3', { min: 1, max: 3, template: { required: {
      strength: ['FLOAT', { default: 1 }], enabled: ['BOOLEAN', { default: true }],
    } } }],
    after: ['STRING', { default: 'tail' }],
  } }, output: ['MODEL'] },
  ImageSource: { input: {}, output: ['IMAGE'] },
  MaskSource: { input: {}, output: ['MASK'] },
};

export const dynamicWorkflow = {
  version: 1, state: { lastNodeId: 3, lastLinkId: 2, lastGroupId: 0, lastRerouteId: 0 },
  nodes: [
    { id: 1, type: 'ImageSource', pos: [0, 20], size: [220, 100], flags: {}, order: 0, mode: 0, properties: {}, outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [1], slot_index: 0 }] },
    { id: 2, type: 'DynamicImage', pos: [340, 20], size: [330, 260], flags: {}, order: 1, mode: 0, properties: { future: 'preserve' },
      inputs: [{ name: 'image', type: 'IMAGE', link: 1, futureInput: 'keep' }, { name: 'mode.multiplier', type: 'FLOAT', link: null, widget: { name: 'mode.multiplier' } }],
      outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [2], slot_index: 0 }], widgets_values: ['multiplier', 4, 'imported tail'],
      widgets_values_named: { mode: 'multiplier', 'mode.multiplier': 4, after: 'imported tail', future_widget: { keep: true } } },
    { id: 3, type: 'ListConsumer', pos: [800, 20], size: [240, 140], flags: {}, order: 2, mode: 0, properties: {}, inputs: [{ name: 'images', type: 'IMAGE', link: 2 }],
      outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [], slot_index: 0 }] },
  ],
  links: [
    { id: 1, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0, type: 'IMAGE', futureLink: 'keep' },
    { id: 2, origin_id: 2, origin_slot: 0, target_id: 3, target_slot: 0, type: 'IMAGE' },
  ], groups: [], config: {}, extra: {},
};
