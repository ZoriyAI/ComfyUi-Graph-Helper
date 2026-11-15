/**
 * The words of the lessons on picture techniques (image-techniques.ts), English; texts.en.ts spreads them into the
 * lesson words. Each step: what to do and why.
 * `{role}` is replaced by the name of the node as this ComfyUI's library shows it; field names and values stand in
 * backticks. The Russian file says the same, with the same numbers and the same words in backticks.
 */
import type { LessonWords } from '../texts';
// The consent rule of the face lessons, in their very words: the ipadapter lesson says it first too.
import { FACE_RULE } from './sound-3d-faces.texts.en';


const SAVE = 'Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.';

/** When the file a step asks for is not in the list. The app downloads nothing: the person does, in ComfyUI. */
const noFile = (template: string) => `If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, ${template}: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.`;

/** Said wherever a lesson needs a node pack. */
const PACK = 'A node pack runs other people\'s code on your computer. Install it yourself through ComfyUI\'s manager, from its official page, and only if you trust its authors. The app installs nothing.';

const PICTURE_GRAPH = {
  title: 'A picture graph is needed',
  body: 'This lesson goes on from the graph of "A first picture from text". The canvas must have {checkpoint}, the two texts {positive} and {negative}, {sampler}, {decode} and {save} with the links between them.\n\nIf they are not there, do that lesson first.',
};

const INPAINT_GRAPH = {
  title: 'The inpainting graph is needed',
  body: 'This lesson goes on from the graph of "Inpainting: redraw part of a picture". The canvas must have {checkpoint}, the texts {positive} and {negative}, {picture}, {inpaint} and {sampler} as that lesson leaves them.\n\nIf they are not there, do that lesson first.',
};

/** The English words of the picture technique lessons, by lesson id. */
export const IMAGE_TECHNIQUES_EN: Record<string, LessonWords> = {
  img2img: {
    title: 'A picture from a picture',
    result: 'A picture you already have becomes a new one: the same composition, drawn again by the model as the prompt says.',
    steps: {
      intro: {
        title: 'What image-to-image is',
        body: 'Image-to-image starts not from empty noise but from your picture. The picture is turned into the compressed form the model works in, the latent; some noise is added to it, and the sampler removes that noise by your prompt.\n\nHow much noise is added is set by `denoise`. At 1 nothing of your picture is left. At 0.3 only fine detail changes. In between, the composition stays and the rest is drawn again.\n\nThe lesson adds three nodes to the graph of "A first picture from text".',
      },
      graph: PICTURE_GRAPH,
      picture: {
        title: 'Load your picture',
        body: 'Add a {picture} node and choose the picture in its `image` field. ComfyUI takes pictures from its `input` folder; the button on the node uploads one there.\n\nThe composition, the colours and the light of the result come from this picture.',
      },
      size: {
        title: 'Bring the picture to a size the model knows',
        body: 'Add a {scale} node and connect the `IMAGE` output of {picture} to its `image` input. Set `megapixels` to 1.\n\nA model draws best at the size it was trained at. One megapixel is about 1024 × 1024, right for SDXL and newer models. For an SD 1.5 model set 0.25, that is 512 × 512. A photo from a phone is many times larger, and the model would repeat parts of it.',
      },
      encode: {
        title: 'Turn the picture into a latent',
        body: 'Add a {encode} node. Connect the output of {scale} to its `pixels` input and the `VAE` output of {checkpoint} to its `vae` input.\n\nThe sampler works not with pixels but with their compressed form. This node compresses the picture with the VAE of the same model that will draw.',
      },
      latent: {
        title: 'Give the sampler your picture',
        body: 'Connect the output of {encode} to the `latent_image` input of {sampler}. The link from the empty latent is replaced: an input takes one link.\n\nThe empty latent is not needed any more. Leave it or delete it: ComfyUI does not run a node whose output goes nowhere.',
      },
      denoise: {
        title: 'Set how much to draw again',
        body: 'Set `denoise` of {sampler} to 0.6.\n\nAt 0.6 the composition and the large shapes stay, while textures, faces and the style follow the prompt. Lower it to 0.4 when the result must stay close to the original. Raise it to 0.8 when only the layout matters.\n\nDescribe what should be in the picture, not what to change: the model does not compare, it draws.',
      },
      compare: {
        title: 'Compare variants fairly',
        body: 'To see what one setting does, change only that setting. Under `seed` of {sampler} set "control after generate" to `fixed`: the noise then stays the same from run to run, and only what you changed makes the difference. With `randomize` every run starts from new noise, and you compare luck, not settings.\n\nSeveral variants in one run: in a graph from text, `batch_size` of the empty latent; here, a Repeat Latent Batch node between {encode} and {sampler}. Each picture of a batch gets its own noise from the same `seed`.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nWhat to try: \`denoise\` 0.4 and 0.8 on the same \`seed\`; a drawing or a sketch as the picture, with a prompt of a photo.\n\nSave Image writes the whole graph, prompts included, into the PNG it saves: the picture dragged into ComfyUI opens the graph again. Before you share a picture whose graph must stay private, convert it to another format or start ComfyUI with the \`--disable-metadata\` option, which writes no graph into the files.`,
      },
    },
  },
  inpaint: {
    title: 'Inpainting: redraw part of a picture',
    result: 'You paint a mask over part of a picture, and the model draws only that part again, by a new prompt.',
    steps: {
      intro: {
        title: 'What inpainting is',
        body: 'Inpainting draws again the part of a picture under a mask and leaves the rest as it was. The mask is painted by hand in ComfyUI or made by a node that finds an object; that is the lesson "A mask by words".\n\nThis lesson goes on from "A picture from a picture" and puts the inpainting node where the plain encoding was.',
      },
      graph: {
        title: 'The graph of a picture from a picture is needed',
        body: 'The canvas must have {checkpoint}, the texts {positive} and {negative}, {sampler}, {decode}, {save} and {picture}, as "A picture from a picture" leaves them.\n\nIf they are not there, do that lesson first.',
      },
      mask: {
        title: 'Paint the mask in ComfyUI',
        body: 'The mask is painted in ComfyUI, not in this app. Open the graph there, right-click the Load Image node and choose "Open in MaskEditor". Paint over what must change, a little wider than the object, and press "Save".\n\nComfyUI keeps the picture with its mask in the `input` folder, and the `MASK` output of the node carries the mask. A picture with a transparent area works the same: the transparent part is the mask.\n\nThis app does not show the mask. The graph is the same either way.',
      },
      model: {
        title: 'Which model draws a part best',
        body: 'Any model can draw under a mask, but the border often shows. Models trained for inpainting see the picture around the mask and blend better: for SD 1.5 the checkpoints with "inpainting" in the name, for Flux the Flux.1 Fill model (it has separate loaders: open the official "Flux.1 Fill Dev" template in ComfyUI to see its graph).\n\nAn inpainting checkpoint goes into the same {checkpoint} node as an ordinary one.',
      },
      condition: {
        title: 'Add the inpainting node',
        body: 'Add an {inpaint} node and connect to it:\n- to `positive` and `negative`, the two texts;\n- to `vae`, the `VAE` output of {checkpoint};\n- to `pixels`, the picture, through the scaling node when the picture goes through it;\n- to `mask`, the `MASK` output of {picture}.\n\nThe node encodes the picture, marks the masked part in the latent and tells an inpainting model what lies around it. Leave `noise_mask` on: then only the masked part is drawn again.',
      },
      wire: {
        title: 'Feed the sampler from it',
        body: 'Connect the three outputs of {inpaint} to {sampler}: `positive` to `positive`, `negative` to `negative`, `latent` to `latent_image`.\n\nThe encoding node of the previous lesson is not needed any more: its link to the sampler is replaced.',
      },
      denoise: {
        title: 'Set the strength',
        body: 'Set `denoise` of {sampler} to 1 for an inpainting model. For an ordinary model take 0.6 to 0.8: the colours of the old content then show through and help it fit.\n\nIf the masked part comes out the same as before, raise `denoise`. If it comes out foreign to the picture, lower it or take an inpainting model.',
      },
      prompt: {
        title: 'Describe what should be there',
        body: 'Describe the whole picture with the new content, not an order to replace something. For a hat on a man: "a man in a red wool hat on a city street". The model sees the rest of the picture and fits the new part to it.\n\nThe prompt can be short: the picture around says the rest.',
      },
      edges: {
        title: 'When the border shows',
        body: 'What helps:\n- paint the mask wider than the object; a Grow Mask node widens it by a few pixels;\n- a Differential Diffusion node between the model and the sampler softens the edge of the mask, as ComfyUI\'s Flux Fill template does;\n- for a small part of a large picture, the ComfyUI-Inpaint-CropAndStitch pack cuts out the area around the mask, draws it at the size the model likes and puts it back.\n\n' + PACK,
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nWhat to try: the same mask with three different \`seed\` values; a mask painted tight and a mask painted wide.`,
      },
    },
  },
  outpaint: {
    title: 'Outpainting: a picture beyond its edges',
    result: 'A picture gets a new strip on one side, and the model draws what lies beyond the frame.',
    steps: {
      intro: {
        title: 'What outpainting is',
        body: 'Outpainting is inpainting of a new strip. The picture gets an empty frame, the frame becomes the mask, and the model fills it so that it goes on from the picture.\n\nThe lesson goes on from "Inpainting: redraw part of a picture".',
      },
      graph: INPAINT_GRAPH,
      pad: {
        title: 'Add a frame',
        body: 'Add a {pad} node and give it the picture at its `image` input, through the scaling node when there is one. Its `IMAGE` output goes into `pixels` of {inpaint}, its `MASK` output into `mask`: the mask painted by hand is replaced by the frame. Set `right` to 256.\n\n`left`, `top`, `right` and `bottom` say how many pixels to add on each side. `feathering` makes the border soft so the seam does not show. Add a little at a time: 256 pixels on one side is easier for a model than 1024 on every side.',
      },
      denoise: {
        title: 'Draw the frame fully',
        body: 'Set `denoise` of {sampler} to 1.\n\nThe frame is empty grey, and there is nothing in it to keep. At a lower value the grey shows through.',
      },
      prompt: {
        title: 'Describe the whole wider scene',
        body: 'Describe the picture as it should look with the new part: "a lighthouse on a cliff, the sea stretching away to the right, evening light".\n\nA model trained for inpainting fills a frame better. For a much wider picture, add one side at a time and take each result as the next picture.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nWhat to try: \`feathering\` 10 and 60; the same frame on the left side.`,
      },
    },
  },
  'mask-text': {
    title: 'A mask by words',
    result: 'ComfyUI finds an object by its name and gives its mask to the inpainting node, with no painting by hand.',
    roles: { checkpoint: 'inpainting model', segModel: 'SAM3 finder', segText: 'what to find' },
    steps: {
      intro: {
        title: 'What SAM3 does',
        body: 'SAM3 is a model that finds in a picture what a word names and outlines it exactly. Write "hat", and it gives the mask of the hat. That mask goes where the mask painted by hand went.\n\nIts nodes are part of new versions of ComfyUI. The lesson goes on from "Inpainting: redraw part of a picture".',
      },
      graph: INPAINT_GRAPH,
      model: {
        title: 'Load the finder',
        body: `Add one more {segModel} node and choose the file of the finder in its \`ckpt_name\` field, for example sam3.1_multiplex_fp16. One file holds the finder and its text reader, which is why it goes into the ordinary checkpoint loader.\n\nIt does not draw: the model that draws stays in {checkpoint}.\n\n${noFile('the official template "Image Segment (SAM3)"')}`,
      },
      detect: {
        title: 'Say what to find',
        body: 'Add {segText} and {detect}.\n- The `CLIP` output of {segModel} goes into the `clip` input of {segText}. Write in its `text` field what to find, a word or two in English: hat, red car.\n- {detect} gets `model` from {segModel}, `image` from {picture}, through the scaling node as the inpainting node gets it, and `conditioning` from {segText}.\n\nThe finder must see the picture at the same size as the inpainting node, or the mask will not fit.',
      },
      threshold: {
        title: 'Set how sure it must be',
        body: 'Leave `threshold` of {detect} at 0.5.\n\nLower, and the finder takes more for the object, including what only looks like it. Higher, and it may find nothing. If the mask is empty, lower it to 0.3.',
      },
      use: {
        title: 'Give the mask to the inpainting node',
        body: 'Connect the `masks` output of {detect} to the `mask` input of {inpaint}. The link from the mask painted by hand is replaced.\n\nThe mask of a found object is tight. Pass it through a Grow Mask node that adds 8 to 16 pixels, so the model has room to blend the edge.',
      },
      click: {
        title: 'By a click instead of a word',
        body: 'The finder also takes points: `positive_coords` says where the object is, `negative_coords` where it is not. Points come as text with coordinates; a node where you click them on the picture comes with a pack, for example the Points Editor of ComfyUI-KJNodes.\n\nThe ComfyUI-Florence2 and ComfyUI-segment-anything-2 packs do the same with older models: Florence2 finds a box by words, SAM2 outlines what is in it. ' + PACK + '\n\nTo see the mask before drawing, connect `masks` to a Preview Mask node.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nWhat to try: \`individual_masks\` on, when the word finds several objects and you need one of them.`,
      },
    },
  },
  'remove-background': {
    title: 'Removing a background',
    result: 'A picture whose background is made transparent, saved as PNG.',
    steps: {
      intro: {
        title: 'How a background is removed',
        body: 'A background removal model looks at a picture and says which pixels belong to the subject. ComfyUI turns that into transparency: what is not the subject disappears.\n\nThe nodes for this are part of new versions of ComfyUI. The lesson builds the graph from an empty canvas: "File ▸ New project".',
      },
      picture: {
        title: 'Load the picture',
        body: 'Add a {picture} node and choose the picture in its `image` field.\n\nA clear subject against a background works best: a person, a product, an animal.',
      },
      model: {
        title: 'Load the model',
        body: `Add a {bgModel} node and choose the model in its \`bg_removal_name\` field, for example BiRefNet. ComfyUI looks for these files in the \`models/background_removal\` folder.\n\n${noFile('the official template "Remove Background (BiRefNet)"')}`,
      },
      remove: {
        title: 'Find the subject',
        body: 'Add a {remove} node. The output of {bgModel} goes into its `bg_removal_model` input, the picture into `image`.\n\nIts `mask` output is the subject: white where it is, black where the background is.',
      },
      invert: {
        title: 'Turn the mask inside out',
        body: 'Add an {invert} node and connect the `mask` output of {remove} to its `mask` input.\n\nThe next node reads a mask as "what to hide". The subject must stay, so the mask is turned inside out first, as ComfyUI\'s own template does.',
      },
      join: {
        title: 'Make the background transparent',
        body: 'Add a {join} node. The picture goes into its `image` input, the output of {invert} into `alpha`.\n\nThe node adds the mask to the picture as transparency.',
      },
      save: {
        title: 'Save it',
        body: 'Add a {save} node and connect the output of {join} to its `images` input.\n\nIt writes PNG, and PNG keeps transparency. JPEG has none: the transparent part would turn into a colour.',
      },
      other: {
        title: 'Other ways',
        body: '- To put the subject on another background, take an Image Composite Masked node: the new background, the subject and the mask go into it.\n- The ComfyUI-RMBG pack holds many removal models, also for hair and clothes. ' + PACK + '\n- To take not the whole subject but one named object, see "A mask by words".',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nWhat to try: a picture with hair or fur against a busy background, the hardest case for any model.`,
      },
    },
  },
  upscale: {
    title: 'Upscaling with a model',
    result: 'The finished picture is enlarged by a model that draws sharp detail instead of stretching the pixels.',
    roles: { save: 'saver of the picture', big: 'saver of the large picture' },
    steps: {
      intro: {
        title: 'What an upscale model is',
        body: 'An upscale model is a small network trained to enlarge pictures: it draws edges and textures where simple stretching gives blur. It does not know your prompt and adds nothing new: it makes what is there larger.\n\nThe lesson adds three nodes to the graph of "A first picture from text".',
      },
      graph: PICTURE_GRAPH,
      loader: {
        title: 'Load the upscale model',
        body: 'Add a {upLoader} node and choose the model in its `model_name` field. ComfyUI looks for these files in `models/upscale_models`.\n\nThe number in the name says how many times it enlarges: 4x is four times, 2x is twice. Some models are trained for photos, others for drawings.\n\nFiles in old formats (.pth, .pt) can run code when they are loaded: take them only from the model\'s official page or a collection you trust, such as OpenModelDB.',
      },
      upscale: {
        title: 'Enlarge the picture',
        body: 'Add a {upscale} node. The output of {upLoader} goes into its `upscale_model` input, the `IMAGE` output of {decode} into `image`.',
      },
      save: {
        title: 'Save the large picture',
        body: 'Add one more {big} node and connect the output of {upscale} to its `images` input.\n\nThe graph now saves the picture twice, as drawn and enlarged. Compare them at full size.',
      },
      models: {
        title: 'What an upscale model can and cannot do',
        body: '- A 4x model turns a 1024 picture into 4096 pixels a side, sixteen times the pixels: that takes memory and time. Take a 2x model, or make the result smaller afterwards.\n- It does not fix a wrong hand or a blurred face: it enlarges the mistake. A second pass does that, the next lesson.\n- Different models suit different pictures: compare two on the same picture.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nNext, "A second pass after upscaling (hires fix)" adds detail to the large picture.`,
      },
    },
  },
  'hires-fix': {
    title: 'A second pass after upscaling (hires fix)',
    result: 'The enlarged picture is drawn once more by the model: sharp detail at a size the model cannot draw in one go.',
    roles: { sampler: 'first pass', samplerB: 'second pass', decode: 'decoder of the first pass', decodeB: 'decoder of the second pass', save: 'saver of the first pass', saveB: 'saver of the second pass' },
    steps: {
      intro: {
        title: 'Why two passes',
        body: 'A model draws well only near the size it was trained at. A larger picture is made in two passes: draw at the usual size, enlarge, then let the model draw the large picture again with part of the noise. The composition comes from the first pass, the detail from the second.\n\nThis is called "hires fix". The lesson goes on from "Upscaling with a model".',
      },
      graph: {
        title: 'The upscaling graph is needed',
        body: 'The canvas must have the picture graph, {checkpoint}, {positive}, {negative}, {sampler}, {decode}, {save}, and after {decode} the nodes {upLoader} and {upscale}.\n\nIf they are not there, do "Upscaling with a model" first.',
      },
      shrink: {
        title: 'Bring it to the size you want',
        body: 'Add a {shrink} node and connect the output of {upscale} to its `image` input. Set `width` and `height` to twice the size of the first picture: 2048 for a 1024 picture of SDXL, 1024 for a 512 picture of SD 1.5. A 0 in one of them keeps the proportions.\n\nA 4x model gives four times the size. For the second pass twice is enough, and every extra pixel costs memory.',
      },
      encode: {
        title: 'Turn it into a latent',
        body: 'Add a {encodeB} node: the output of {shrink} into its `pixels` input, the `VAE` output of {checkpoint} into `vae`.',
      },
      second: {
        title: 'The second sampler',
        body: 'Add a second {samplerB} node and connect to it:\n- to `model`, the `MODEL` output of {checkpoint}, through the LoRA loaders when there are any;\n- to `positive` and `negative`, the same two texts;\n- to `latent_image`, the output of {encodeB}.\n\nThe same model and the same prompt draw their own picture again, now large.',
      },
      denoise: {
        title: 'Set how much to draw again',
        body: 'Set `denoise` of {samplerB} to 0.5.\n\nAt 0.5 the composition stays and every detail is drawn again at the large size. At 0.3 the change is slight. Above 0.6 the model starts to draw new objects, and at a size it was not trained at it repeats them: two heads, extra windows.',
      },
      out: {
        title: 'Save the result',
        body: 'Add {decodeB} and {saveB}: the output of {samplerB} into `samples`, the `VAE` of {checkpoint} into `vae`, the picture into `images`.\n\nThe savers of the earlier passes can become Preview Image nodes, so that only the final picture is written to disk.',
      },
      latent: {
        title: 'The other way: in the latent',
        body: 'ComfyUI has a second form of hires fix, without an upscale model: an Upscale Latent node between the first sampler and the second, and the second sampler at `denoise` 0.5. It is faster, but an enlarged latent is blurred, and the second pass must fill that in, so `denoise` cannot go much lower. ComfyUI\'s templates show both ways.',
      },
      tiles: {
        title: 'Very large pictures',
        body: 'When the second pass runs out of memory:\n- VAE Decode (Tiled) and VAE Encode (Tiled) turn the picture into a latent and back piece by piece;\n- the ComfyUI_UltimateSDUpscale pack draws a large picture again in tiles, each at the size the model likes;\n- the Impact Pack does the same with its own tile nodes.\n\n' + PACK,
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nWhat to try: \`denoise\` 0.35 and 0.55 on the same \`seed\`.`,
      },
    },
  },
  controlnet: {
    title: 'ControlNet: drawing along the edges of a picture',
    result: 'The model draws a new picture that keeps the outlines of a sample picture.',
    steps: {
      intro: {
        title: 'What ControlNet does',
        body: 'A prompt says what to draw, not where. ControlNet adds a second kind of instruction, a control picture: edges, depth, the pose of a person. The model keeps to it while drawing what the prompt says.\n\nThe control picture is made from an ordinary one. In this lesson ComfyUI\'s own edge finder makes it. The lesson adds four nodes to the graph of "A first picture from text".',
      },
      graph: PICTURE_GRAPH,
      loader: {
        title: 'Load a ControlNet',
        body: `Add a {cnLoader} node and choose a ControlNet for edges in its \`control_net_name\` field: "canny" stands in its name. ComfyUI looks for them in \`models/controlnet\`.\n\nA ControlNet is trained for one model family and one kind of control picture. An SD 1.5 ControlNet does not work with SDXL, and one for depth does not read edges.\n\n${noFile('a ControlNet template of ComfyUI')}`,
      },
      control: {
        title: 'Load the sample picture',
        body: 'Add a {control} node and choose in its `image` field the picture whose outlines you want to keep.\n\nThis picture is only a plan: its colours and content do not go into the result.',
      },
      edges: {
        title: 'Find the edges',
        body: 'Add a {canny} node and connect the output of {control} to its `image` input.\n\nIt draws white lines where the picture has edges. `low_threshold` and `high_threshold` say how strong an edge must be: lower values give more lines, small details too. Connect it to a Preview Image node to see what the ControlNet will get.',
      },
      apply: {
        title: 'Apply the ControlNet',
        body: 'Add an {apply} node and connect to it:\n- to `positive` and `negative`, the two texts;\n- to `control_net`, the output of {cnLoader};\n- to `image`, the output of {canny}.\n\nThe node adds the edges to both prompts, and the model gets them together with the words.',
      },
      wire: {
        title: 'Give the sampler the new prompts',
        body: 'Connect the `positive` output of {apply} to the `positive` input of {sampler}, and `negative` to `negative`. The direct links from the texts are replaced.',
      },
      strength: {
        title: 'Set the strength',
        body: 'Leave `strength` of {apply} at 1 for the first run.\n\nAt 1 the model keeps strictly to the edges. When the result looks traced and stiff, lower it to 0.6: the outlines stay, and the model draws more freely inside them.',
      },
      timing: {
        title: 'When it acts: start and end',
        body: '`start_percent` and `end_percent` say in which part of the steps the ControlNet acts, from 0 to 1. The first steps set the composition, the last ones the detail.\n- `end_percent` 0.8: the outlines are fixed early, and the last steps draw the detail freely;\n- `start_percent` 0.2: the model lays the picture out itself and only then follows the edges.',
      },
      family: {
        title: 'Other kinds of control',
        body: 'Each ControlNet reads its own kind of picture: canny and lineart read lines, depth reads a depth map, openpose reads the skeleton of a person, scribble reads a rough drawing. ComfyUI itself only finds edges; the other control pictures are made by the comfyui_controlnet_aux pack, see "ControlNet from a depth map".\n\nSeveral ControlNets can act at once: chain two {apply} nodes, the outputs of the first into the inputs of the second. A "union" ControlNet reads several kinds in one file.\n\nFor Flux, SD3.5 and Qwen-Image ComfyUI has templates with ControlNets made for them.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nWhat to try: the same edges with two different prompts; \`strength\` 0.4.`,
      },
    },
  },
  'controlnet-depth': {
    title: 'ControlNet from a depth map',
    result: 'The comfyui_controlnet_aux pack turns a picture into a depth map, and the model draws a new scene in the same space.',
    steps: {
      intro: {
        title: 'What a depth map gives',
        body: `A depth map is a grey picture: near is light, far is dark. With it the model keeps the space of a scene, the walls and the distances, without copying its lines.\n\nComfyUI has no depth finder of its own: it comes with the comfyui_controlnet_aux pack. ${PACK}\n\nThe lesson goes on from "ControlNet: drawing along the edges of a picture".`,
      },
      graph: {
        title: 'The ControlNet graph is needed',
        body: 'The canvas must have {checkpoint}, {cnLoader}, {control}, {apply} and {sampler} as the ControlNet lesson leaves them.\n\nIf they are not there, do that lesson first.',
      },
      depth: {
        title: 'Make the depth map',
        body: 'Add a {depth} node and connect the output of {control} to its `image` input. Set `resolution` to 1024.\n\n`resolution` is the size at which the depth is worked out: the closer to the size of the picture, the finer the detail. The node fetches its own model the first time the graph runs in ComfyUI.',
      },
      wire: {
        title: 'Give the depth map to the ControlNet',
        body: 'Connect the output of {depth} to the `image` input of {apply}. The edges are replaced.\n\nThe edge node can stay or go: its output leads nowhere now.',
      },
      model: {
        title: 'Choose a depth ControlNet',
        body: 'Choose in `control_net_name` of {cnLoader} a ControlNet for depth: "depth" stands in its name. An edge ControlNet reads a depth map wrongly and gives a mess.\n\nConnect the depth map to a Preview Image node to see it before drawing.',
      },
      others: {
        title: 'The other nodes of the pack',
        body: 'The pack has a node for each kind of ControlNet: lineart, OpenPose and DWPose for the pose of a person, normal maps, segmentation. Its "AIO Aux Preprocessor" node holds them all behind one list.\n\nThe ComfyUI-Advanced-ControlNet pack adds finer control of strength over the steps, for those who need it.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nWhat to try: a photo of a room and a prompt of a room in another style.`,
      },
    },
  },
  'lora-image': {
    title: 'LoRA for pictures',
    result: 'Two LoRAs in a chain change the style and the subject of a picture model, each with its own strength.',
    roles: { lora1: 'first LoRA', lora2: 'second LoRA' },
    steps: {
      intro: {
        title: 'What a LoRA is',
        body: 'A LoRA is a small file trained on top of a model: a style, a character, a kind of object. It does not replace the model, it bends it, and several can be chained.\n\nFor pictures the LoRA loader changes two parts: the model that draws and the text reader. That is why it has two strengths. The lesson adds two loaders to the graph of "A first picture from text".',
      },
      graph: PICTURE_GRAPH,
      first: {
        title: 'Put the first LoRA in',
        body: 'Add a {lora1} node. Connect the `MODEL` and `CLIP` outputs of {checkpoint} to its `model` and `clip` inputs. Its `MODEL` output then goes into `model` of {sampler}, its `CLIP` output into `clip` of both texts. Choose the file in `lora_name`; ComfyUI looks for them in `models/loras`.\n\nEverything that used the model now uses the model with the LoRA.',
      },
      strengths: {
        title: 'Set the strengths',
        body: 'Set `strength_model` of {lora1} to 0.8. Leave `strength_clip` at 1.\n\n`strength_model` says how much the LoRA changes the drawing, `strength_clip` how much it changes the reading of the words. Above 1 a LoRA usually breaks the picture: burnt colours, doubled shapes. Its author often names the best value on its page.',
      },
      second: {
        title: 'Chain a second LoRA',
        body: 'Add a second {lora2} node after {lora1}: the `MODEL` and `CLIP` outputs of {lora1} into its inputs, its outputs to where the outputs of {lora1} went. Choose another file in `lora_name` and set `strength_model` to 0.6.\n\nThe effects of two LoRAs add up. Give each a little less than it would get alone; when they fight, lower the one that matters less.',
      },
      trigger: {
        title: 'Write their words',
        body: 'Add the trigger words of both LoRAs to `text` of {positive}.\n\nMany LoRAs act only on their words. The app compares the prompt with the words written in the files themselves and in the notes of ComfyUI-Lora-Manager when it is installed. A file without words asks for none, and the step counts on its own.',
      },
      family: {
        title: 'Which LoRA fits',
        body: 'A LoRA works only with the family it was trained for: an SD 1.5 LoRA on SDXL does nothing or spoils the picture. Pony and Illustrious grew from SDXL but have LoRAs of their own; on each other they act weaker or strangely.\n\nFlux, Qwen-Image and Z-Image have no text reader inside the checkpoint: their LoRAs go into LoraLoaderModelOnly, which has only `strength_model`. The family of a file is shown by its card in the "Models" tab.',
      },
      result: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nWhat to try: the same \`seed\` with each LoRA alone and with both; \`strength_clip\` 0, to see what the words of a LoRA do.`,
      },
    },
  },
  'lora-character': {
    title: 'LoRA for a character: face, body, clothes, pose',
    result: 'Three LoRAs on one picture, each tuned on its own, the face kept while a body or clothing LoRA works.',
    roles: { lora1: 'first LoRA', lora2: 'second LoRA', lora3: 'third LoRA' },
    steps: {
      intro: {
        title: 'What this lesson is about',
        body: 'A character is often built from several LoRAs: one for the person, one for the build of the body, one for the clothes, one for the style. Each pulls the picture its own way, and together they fight. This lesson shows how to tell them apart, how to see what each one does and how to keep the face.\n\nYou bring your own LoRA files and write your own words. A LoRA of a real person may be used only with that person\'s consent: only someone who agrees may be drawn this way. Get that consent first. The characters are adults.\n\nThe lesson goes on from "LoRA for pictures" and adds a third loader.',
      },
      graph: {
        title: 'The graph with two LoRAs is needed',
        body: 'The canvas must have the picture graph with {lora1} and {lora2} in a chain after {checkpoint}, as "LoRA for pictures" leaves it.\n\nIf they are not there, do that lesson first.',
      },
      kinds: {
        title: 'The kinds of LoRA',
        body: '- A character LoRA: one person or figure, the face first of all.\n- A body LoRA: the build, the proportions, the anatomy.\n- A clothing LoRA: one outfit or a kind of clothes.\n- A pose LoRA: a way to stand, sit or move.\n- A style LoRA: a manner of drawing, a kind of light, a film look.\n- A detail LoRA: more or less fine detail, sharper skin and cloth.\n- A speed-up LoRA: the same picture in fewer steps; it comes with its own number of steps and its own `cfg`.\n\nA pose LoRA gives a pose loosely. A pose that must be exact comes from ControlNet; that is the step about the pose further on.',
      },
      tell: {
        title: 'How to tell which kind a file is',
        body: 'The name of a file is not enough. Look in three places:\n- the card of the file in the "Models" tab: the base model, the trigger words and the notes its author wrote into the file;\n- the page the file came from: what it was trained on, the strength its author advises, the pictures made with it;\n- ComfyUI-Lora-Manager, when it is installed: it keeps the page, the pictures and the words of each LoRA, and this app reads them from there.\n\nA LoRA whose author names no kind and no words is tried alone first, at a medium strength, and looked at.',
      },
      third: {
        title: 'Add a third LoRA',
        body: 'Add a third {lora3} after {lora2}: the `MODEL` and `CLIP` outputs of {lora2} into its inputs, its outputs to where the outputs of {lora2} went, the sampler and the two texts. Choose in `lora_name` the body or clothing LoRA.\n\nThe character LoRA stays in {lora1}, the style or the second one in {lora2}.',
      },
      strength: {
        title: 'Start the new LoRA low',
        body: 'Set `strength_model` of {lora3} to 0.5.\n\nThe changes of all the LoRAs add up. A third one at full strength on top of two others usually breaks the picture. Raise it by 0.1 at a time while its part shows and the rest holds.\n\n`strength_clip` says how much the LoRA changes the reading of the words. Lower it when the words of one LoRA begin to pull the others: at 0 its words mean what they mean to the model without it.',
      },
      trigger: {
        title: 'Write the words of all three',
        body: 'Add the trigger words of each LoRA to `text` of {positive}.\n\nA LoRA without its words often does little. Words of a LoRA that is not in the graph do nothing, or they push the model somewhere odd: keep in the prompt only the words of the LoRAs that are there.',
      },
      compare: {
        title: 'See what each LoRA does',
        body: 'Under `seed` of {sampler} set "control after generate" to `fixed`. Then make four runs with the same `seed`:\n- all three LoRAs;\n- without {lora1}: set its `strength_model` and `strength_clip` to 0;\n- without {lora2}, the same way;\n- without {lora3}.\n\nSet each back after its run. Put the four pictures side by side: what is gone without a LoRA is what that LoRA does. In ComfyUI a node can also be switched off for a run with Bypass (Ctrl+B).',
      },
      order: {
        title: 'In which order to tune them',
        body: 'Tune one LoRA at a time, the others at 0:\n- the character first, until the face is right;\n- then the body or the clothes, at the lowest strength where they show;\n- then the style, last and often lowest.\n\nThe place of a loader in the chain changes almost nothing: the changes of the LoRAs add up in any order. What decides is the strength of each.',
      },
      face: {
        title: 'Why a body LoRA changes the face, and how to keep it',
        body: 'A body or clothing LoRA was trained on pictures of people, with their faces. It learnt the faces too, and it pulls every face towards them.\n\nWhat holds the face:\n- a lower `strength_model` of the body or clothing LoRA;\n- `strength_clip` of that LoRA lower than its `strength_model`, so its words pull less;\n- the character LoRA a little stronger than the rest;\n- a pass over the face afterwards with the character LoRA in the model: see "Fixing faces and hands with a detailer".',
      },
      pose: {
        title: 'Body and pose together',
        body: 'A body LoRA gives the build, not an exact pose. For both, let each come from its own place:\n- the pose from a control picture, an OpenPose skeleton or a depth map of a person standing as you want, through ControlNet: see "ControlNet from a depth map";\n- the build from the body LoRA, at a strength where it does not fight the control.\n\nWhen the two fight, lower the strength of the ControlNet first and of the LoRA after. Hands and anatomy that come out wrong are fixed afterwards: a detailer with a hand detector, or inpainting of the hand.',
      },
      family: {
        title: 'A LoRA for another model',
        body: 'A LoRA is made for one family. On another one it does nothing, or it breaks the picture with noise and odd colours: an SD 1.5 LoRA on SDXL, an SDXL LoRA on Flux. Pony and Illustrious grew from SDXL; their LoRAs load on each other but act weaker or strangely.\n\nThe card of a file in the "Models" tab says its family.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nWhat to try: the four runs of the comparison; then the body LoRA at 0.3 and at 0.7 with the same \`seed\`, looking only at the face.`,
      },
    },
  },
  'edit-words': {
    title: 'Editing a picture by words',
    result: 'A model made for editing changes a picture as an instruction says: "make the sofa green", "remove the cup".',
    steps: {
      intro: {
        title: 'What an editing model does',
        body: 'An editing model gets a picture and an instruction and changes only what the instruction is about. Unlike inpainting there is no mask: the model understands itself what to change.\n\nThis lesson builds Qwen-Image-Edit 2511 the way ComfyUI\'s official template does, from an empty canvas: "File ▸ New project". The model is large: the bf16 file is about 40 GB, the fp8 one about 20 GB.',
      },
      models: {
        title: 'Load the three parts',
        body: `Add {model}, {clip} and {vae}.\n- In \`unet_name\` of {model}: the qwen_image_edit_2511 file, from \`models/diffusion_models\`.\n- In \`clip_name\` of {clip}: qwen_2.5_vl_7b, from \`models/text_encoders\`. Set \`type\` to \`qwen_image\`.\n- In \`vae_name\` of {vae}: qwen_image_vae.\n\nThe text reader of this model is itself a model that sees pictures: that is how it understands an instruction about a picture.\n\n${noFile('the official template of Qwen-Image-Edit')}`,
      },
      shift: {
        title: 'Set the noise shift',
        body: 'Add a {shift} node and pass the model through it: the output of {model} into its `model` input. Set `shift` to 3.1, as the template does.\n\nThe number changes how much noise is left at each step; this family is set up with this node.',
      },
      picture: {
        title: 'Load the picture to edit',
        body: 'Add {picture} and {scale}. Choose the picture in `image` of {picture} and connect its output to `image` of {scale}.\n\n{scale} brings the picture to about one megapixel with sides the model takes. A picture of another size would be cut or distorted.',
      },
      instruction: {
        title: 'Write the instruction',
        body: 'Add a {positive} node and connect to it: `clip` from {clip}, `vae` from {vae}, `image1` from {scale}. Write the instruction in its `prompt` field, in English or Chinese: "Change the color of the sofa to dark green."\n\nThe node shows the picture to the text reader and to the model together with the words.',
      },
      negative: {
        title: 'The second text',
        body: 'Add a second {negative} node with the same three links and leave its `prompt` empty.\n\nThe sampler wants two prompts. An empty one with the same picture means "nothing in particular", as in the template.',
      },
      encode: {
        title: 'The starting latent',
        body: 'Add an {encode} node: the output of {scale} into `pixels`, the output of {vae} into `vae`.\n\nThe sampler starts from your picture, so the result keeps its size.',
      },
      sampler: {
        title: 'The sampler',
        body: 'Add a {sampler} node and connect: `model` from {shift}, `positive` from {positive}, `negative` from {negative}, `latent_image` from {encode}. Set `steps` to 40 and `cfg` to 4, and leave `denoise` at 1.\n\nThe picture is kept through the texts, which carry it; that is why `denoise` stays 1.',
      },
      out: {
        title: 'Decode and save',
        body: 'Add {decode} and {save}: the output of {sampler} into `samples`, the output of {vae} into `vae`, the picture into `images`.',
      },
      words: {
        title: 'How to write instructions',
        body: '- One change at a time: "replace the cup with a vase of tulips". Several changes at once often lose some.\n- Name what must stay: "keep the face and the pose unchanged".\n- Words on a sign go in quotes: change the sign to "OPEN".\n- `image2` and `image3` take more pictures: "put the jacket from image 2 on the man in image 1".',
      },
      fast: {
        title: 'Faster: four steps',
        body: 'The Lightning LoRA of this model, Qwen-Image-Edit-2511-Lightning-4steps, cuts the work to 4 steps. Put it into a LoraLoaderModelOnly node between {model} and {shift}, then set `steps` to 4 and `cfg` to 1. The template has both ways behind one switch.',
      },
      families: {
        title: 'Other editing models',
        body: 'ComfyUI\'s templates show several families:\n- Flux.1 Kontext dev: the picture goes in as a reference latent;\n- Flux.2 Klein: small and fast, edits by one or several pictures;\n- Qwen Image 2.1: the newest of the Qwen family, with a text node of its own.\nEach has its own nodes; open its template in ComfyUI to see the graph.\n\nThe templates also have paid API nodes for editing. They cost money and send your picture and your words to a cloud service.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nWhat to try: the same instruction with two \`seed\` values; an instruction that names what must stay.`,
      },
    },
  },
  'style-reference': {
    title: 'A reference picture for style (Flux Redux)',
    result: 'A Flux.1 picture takes its look from a sample picture: colours, materials, mood.',
    steps: {
      intro: {
        title: 'What Redux does',
        body: 'Words describe a style poorly. Redux lets you show it: a vision model looks at a sample picture, and a small style model turns what it saw into an addition to the prompt.\n\nThe graph is ComfyUI\'s Flux.1 dev graph with the part of the official "Flux Redux" template that does this. It is built from an empty canvas: "File ▸ New project". Flux.1 dev needs a strong graphics card; its fp8 files need less memory.',
      },
      models: {
        title: 'Load Flux.1',
        body: `Add {model}, {clip} and {vae}.\n- \`unet_name\` of {model}: flux1-dev, from \`models/diffusion_models\`.\n- {clip} reads the prompt with two files: \`clip_name1\` clip_l, \`clip_name2\` t5xxl. Set \`type\` to \`flux\`.\n- \`vae_name\` of {vae}: ae.\n\n${noFile('the official template "Flux Redux"')}`,
      },
      prompt: {
        title: 'Write the prompt',
        body: 'Add {positive} and {zero}. The output of {clip} goes into `clip` of {positive}, the output of {positive} into `conditioning` of {zero}. Write in `text` what the picture shows: the subject, the place.\n\nFlux does not use a prompt of what is unwanted. {zero} gives the sampler an empty one, as ComfyUI\'s Flux template does.',
      },
      reference: {
        title: 'Show the sample',
        body: 'Add {ref}, {visionLoader} and {vision}.\n- In {ref} choose the sample picture.\n- In `clip_name` of {visionLoader}: sigclip_vision_patch14_384, from `models/clip_vision`.\n- {vision} gets `clip_vision` from {visionLoader} and `image` from {ref}.\n\nThe vision model turns the picture into numbers that say what is in it and how it looks.',
      },
      style: {
        title: 'Apply the style model',
        body: 'Add {styleLoader} and {style}.\n- In `style_model_name` of {styleLoader}: flux1-redux-dev, from `models/style_models`.\n- {style} gets `conditioning` from {positive}, `style_model` from {styleLoader}, `clip_vision_output` from {vision}.\n\nThe output of {style} is your prompt with the sample added to it.',
      },
      sampler: {
        title: 'The empty latent and the sampler',
        body: 'Add {latent} and {sampler}. Connect: `model` from {model}, `positive` from {style}, `negative` from {zero}, `latent_image` from {latent}. Set `cfg` to 1.\n\nFlux.1 dev is distilled: it follows the prompt without the usual guidance, and a higher `cfg` burns the picture. An empty latent of 1024 × 1024 suits it.',
      },
      out: {
        title: 'Decode and save',
        body: 'Add {decode} and {save}: the output of {sampler} into `samples`, the output of {vae} into `vae`, the picture into `images`.',
      },
      strength: {
        title: 'When the sample wins over the words',
        body: 'At `strength` 1 of {style} Redux often copies the sample and forgets the prompt. Lower it to 0.5 and the words get their say again.\n\nTwo samples: chain two {style} nodes, the output of the first into `conditioning` of the second, each with its own picture, as the template does.\n\nFor SD 1.5 and SDXL the same idea is IP-Adapter, see "A reference picture with IP-Adapter".',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nWhat to try: one prompt with two very different samples.`,
      },
    },
  },
  ipadapter: {
    title: 'A reference picture with IP-Adapter',
    result: 'An SD 1.5 or SDXL model takes the style of a sample picture through the ComfyUI_IPAdapter_plus pack.',
    steps: {
      intro: {
        title: 'What IP-Adapter does',
        body: `${FACE_RULE}\n\nIP-Adapter is "a LoRA from one picture": it shows the model a sample, and the model draws in its manner. It works with SD 1.5 and SDXL models.\n\nThe nodes come with the ComfyUI_IPAdapter_plus pack. ${PACK} Its author keeps it in maintenance mode: it works, but new models are not added.\n\nThe lesson adds three nodes to the graph of "A first picture from text".`,
      },
      graph: PICTURE_GRAPH,
      files: {
        title: 'The files the pack needs',
        body: 'The unified loader of the pack finds its files by name, so they must be named exactly as the pack\'s page says:\n- the IP-Adapter models in `models/ipadapter`, for example ip-adapter-plus_sdxl_vit-h;\n- the vision model in `models/clip_vision`, named as the pack\'s page says.\n\nFiles in old formats (.bin, .pth) can run code when they are loaded: take them only from the official pages the pack names.',
      },
      loader: {
        title: 'The unified loader',
        body: 'Add an {ipLoader} node and connect the `MODEL` output of {checkpoint} to its `model` input. Set `preset` to `PLUS (high strength)`.\n\nThe preset says which IP-Adapter to take; the loader finds it and the vision model by their names.',
      },
      reference: {
        title: 'Load the sample',
        body: 'Add a {ref} node and choose the sample picture in its `image` field: the style you want, not the subject.',
      },
      apply: {
        title: 'Apply it to the model',
        body: 'Add an {ip} node and connect: `model` and `ipadapter` from the outputs of {ipLoader} with the same names, `image` from {ref}. Its `MODEL` output goes into `model` of {sampler}, in place of the direct link.\n\nIP-Adapter changes the model itself, not the prompt; that is why it stands on the way of the model.',
      },
      weight: {
        title: 'Set the weight and the kind',
        body: 'Set `weight` of {ip} to 0.8 and `weight_type` to `style transfer`.\n\n`style transfer` takes the look of the sample and leaves its content; `standard` takes both. At `weight` 1 and above the sample presses on the picture; at 0.5 it only tints it.',
      },
      tune: {
        title: 'Fine tuning',
        body: '- `start_at` and `end_at` say in which part of the steps it acts, as with ControlNet.\n- The pack\'s "IPAdapter Style & Composition" node takes one picture for the style and another for the composition.\n- `style transfer` is precise with SDXL and rougher with SD 1.5.\n- The pack\'s FaceID nodes carry a face. The rule at the start of this lesson holds for them: get that consent first.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nWhat to try: one sample at \`weight\` 0.5 and at 1.`,
      },
    },
  },
  detailer: {
    title: 'Fixing faces and hands with a detailer',
    result: 'The Impact Pack finds the faces in a finished picture and draws each one again at a larger size, so small faces come out sharp.',
    roles: { save: 'saver of the picture', fixed: 'saver of the fixed picture' },
    steps: {
      intro: {
        title: 'What a detailer does',
        body: `In a full-length picture a face is small, and the model has too few pixels to draw it well. A detailer finds each face, cuts it out, enlarges it, draws it again with the same model and prompt at part of the noise, and puts it back.\n\nIt draws again the face that is there. It does not put another person's face in its place, and this lesson is not about that.\n\nThe nodes come with ComfyUI-Impact-Pack and ComfyUI-Impact-Subpack. ${PACK}\n\nThe lesson adds three nodes to the graph of "A first picture from text".`,
      },
      graph: PICTURE_GRAPH,
      detector: {
        title: 'Load a face detector',
        body: 'Add a {detector} node and choose `bbox/face_yolov8m.pt` in its `model_name` field. ComfyUI keeps the detectors in `models/ultralytics/bbox`.\n\nA ".pt" file can run code when it is loaded: take it only from the page the pack names.',
      },
      detailer: {
        title: 'Add the detailer',
        body: 'Add a {detailer} node and connect to it:\n- `image`: the output of {decode};\n- `model`, `clip` and `vae`: the outputs of {checkpoint}, through the LoRA loaders when there are any;\n- `positive` and `negative`: the two texts;\n- `bbox_detector`: the `BBOX_DETECTOR` output of {detector}.\n\nThe detailer has a sampler inside: it draws with the same model and words as the picture.',
      },
      settings: {
        title: 'Set how much to draw again',
        body: 'Leave `denoise` of {detailer} at 0.5.\n\nAt 0.5 the face keeps its features and gets sharp eyes and skin. Above 0.6 it may turn into another face. `guide_size` is the size a face is enlarged to before drawing: 512 for SD 1.5, 1024 for SDXL.',
      },
      save: {
        title: 'Save the fixed picture',
        body: 'Add a {fixed} node and connect the `image` output of {detailer} to its `images` input. Compare it with the picture before.',
      },
      hands: {
        title: 'Hands, and finer masks',
        body: '- For hands choose `bbox/hand_yolov8s.pt` in {detector}, or put a second detailer after the first: one for faces, one for hands.\n- A SAMLoader node at `sam_model_opt` makes the mask follow the outline of the face instead of a box: fewer seams.\n- Hands with wrong fingers are often beyond a detailer: draw them again with inpainting or ControlNet.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nWhat to try: a picture of several people far away; the detailer should fix every face.`,
      },
    },
  },
};
