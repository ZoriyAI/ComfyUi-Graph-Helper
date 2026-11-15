[Русский](Reference-Images.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Reference images: IP-Adapter, Redux, editing models

Using a picture as an example of a style, a subject or a face, rather than as a starting point.

## In plain words
In [image to image](Image-To-Image.md) the picture is the start that gets redrawn. With a **reference image** the picture is a *hint*: "a character who looks like this", "in this style", "this product on a new background". The model encodes the reference and lets it steer the result, while the composition can be entirely new.

## The ways to do it
| Way | Families | How it enters the graph |
|---|---|---|
| **IP-Adapter** | SD 1.5, SDXL (and others through packs) | A pack (for example ComfyUI_IPAdapter_plus) with an IP-Adapter model and a CLIP Vision encoder; applied to the `MODEL` with a weight |
| **Flux Redux** | Flux.1 dev | Built-in: Load CLIP Vision, CLIP Vision Encode, Load Style Model, Apply Style Model on the conditioning |
| **Editing models** | Qwen-Image-Edit, FLUX.1 Kontext, Flux.2 | The reference goes into the conditioning (for example ReferenceLatent or TextEncodeQwenImageEdit) and an instruction says what to change |
| **CLIP Vision for video** | Wan 2.1 image to video, Wan Animate, talking portraits | Load CLIP Vision (`clip_vision_h`) and an encode node give the model the look of the start picture |
| **VACE reference** | Wan with VACE | `ref_images` input keeps a look through the clip |

## Values and what they change
- The weight or strength of the reference: too high copies the reference; too low ignores it. Start near the template's value.
- A clean reference (one subject, plain background) works best.
- The prompt still matters: say what should change.

## Typical mistakes
- A CLIP Vision model or IP-Adapter for another family.
- Using a real person's face without consent: see [Content rules](../trust/Content-Rules.md).
- Expecting an editing model to work in an ordinary text to image graph: use its template.

## How the app helps
The built-in knowledge describes Load CLIP Vision and CLIP Vision Encode, and its entry "Identity: adapter, LoRA or swap: which to choose" compares the ways to keep a face. The lessons: [A reference picture with IP-Adapter](../lessons/IP-Adapter.md), [A reference picture for style (Flux Redux)](../lessons/Style-Reference.md), [Editing a picture by words](../lessons/Edit-By-Words.md), [The same character in a new picture: FLUX.1 Kontext](../lessons/Character-Kontext.md), [One character in many pictures](../lessons/Character-Series.md), [The same face from one photo: IP-Adapter FaceID](../lessons/Face-From-Photo.md), [Put a face onto a picture: ReActor](../lessons/Face-Swap.md), and for video [A reference for the whole clip: Wan VACE](../lessons/Anchor-Reference.md). The lessons that use a real person's face ask for that person's consent.

## See also
- [Image to image](Image-To-Image.md)
- [ControlNet and preprocessors](ControlNet.md)
- [Qwen-Image](Family-Qwen-Image.md)
- [Flux.2](Family-Flux2.md)
