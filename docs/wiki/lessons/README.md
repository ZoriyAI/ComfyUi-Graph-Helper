[Русский](README.ru.md)
[Home](../Home.md) › Lessons

# Lessons

The built-in lessons of Learn mode, one page each, and the path through them.

## What Learn mode is
In Learn mode you build real graphs by hand on the canvas while the app leads you step by step: what to do, why, where it is on the canvas. It sees from the canvas when a step is done. No assistant model is needed. Lessons use only the nodes your ComfyUI has, and they never download model files: you bring those to ComfyUI yourself. How it all works: [How lessons work](How-Lessons-Work.md).

## The learning path
<!-- diagram: four rows of boxes joined by arrows. Pictures: image → prompt → refine. Video: video-text → prompt-video → video-image → lora → video-fast → two-models. WanVideoWrapper pack: wrapper → wrapper-image → wrapper-vace; wrapper-animate, wrapper-unianimate; wrapper-talk → wrapper-duo; wrapper-fantasy; wrapper-ovi; wrapper-recam. Adults (separate group): adult-image, adult -->

**Pictures, the foundation.** Start here.
- [A first picture from text](Image.md): Lesson "image". Seven nodes from prompt to saved picture.
- [The description: how a model reads it](Prompt.md): Lesson "prompt". Tags or sentences, weights, the negative prompt, cfg, seed.
- [Refining with a second model](Refine.md): Lesson "refine". A second model redraws the picture with partial denoise.

**Video on built-in nodes (Wan 2.2).**
- [Video from text](Video-Text.md): Lesson "video-text". The two-pass Wan 2.2 graph.
- [A description for video](Prompt-Video.md): Lesson "prompt-video". Action, camera, one move per clip.
- [Video from a picture](Video-Image.md): Lesson "video-image". A picture becomes the first frame.
- [LoRA: add a style or a subject](LoRA.md): Lesson "lora". A LoRA in both model paths, trigger words.
- [Fast video in four steps](Video-Fast.md): Lesson "video-fast". Speed-up LoRAs, 4 steps, cfg 1.
- [Two models in one graph](Two-Models.md): Lesson "two-models". A picture model draws the first frame.

**Video on the WanVideoWrapper pack.** Needs the pack installed in ComfyUI.
- [Video on WanVideoWrapper](Wrapper.md): Lesson "wrapper". The same clip on the pack's nodes.
- [Video from a picture on WanVideoWrapper](Wrapper-Image.md): Lesson "wrapper-image".
- [VACE: motion from another video](Wrapper-VACE.md): Lesson "wrapper-vace".
- [Animation by pose: Wan Animate](Wrapper-Animate.md): Lesson "wrapper-animate". Consent required.
- [Animation by pose: UniAnimate](Wrapper-UniAnimate.md): Lesson "wrapper-unianimate". Consent required.
- [A talking video: InfiniteTalk](Wrapper-Talk.md): Lesson "wrapper-talk". Consent required.
- [Two people talking: InfiniteTalk](Wrapper-Duo.md): Lesson "wrapper-duo". Consent required.
- [A talking portrait: FantasyTalking](Wrapper-Fantasy.md): Lesson "wrapper-fantasy". Consent required.
- [A video with sound: Ovi](Wrapper-Ovi.md): Lesson "wrapper-ovi". Picture and sound in one run.
- [Another camera: ReCamMaster](Wrapper-ReCam.md): Lesson "wrapper-recam".

**For adults.** A separate group; technique and limits only. See [Content rules](../trust/Content-Rules.md).
- [Pictures for adults: what changes](Adult-Image.md): Lesson "adult-image".
- [Video for adults: what changes](Adult.md): Lesson "adult".

**About the lessons**
- [How lessons work](How-Lessons-Work.md): Choosing, following, Show me where, Do this for me.

The app lists the lessons in its own order (pictures, built-in video, the pack, two models, adults); the path above groups the same lessons by topic. For the ideas behind each step, read [ComfyUI concepts](../concepts/README.md), starting with [Start here](../concepts/Start-Here.md).

## See also
- [Home](../Home.md)
- [Learn mode](../assistant/Learn.md)
- [The lessons panel](../interface/Lessons-Panel.md)
