[Русский](Audio.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Audio

Sound in ComfyUI: loading and saving it, music from text, and video models that make their own sound.

## In plain words
ComfyUI handles sound the way it handles pictures: an `AUDIO` value travels along links, audio models work on an audio latent, and an audio VAE turns it into a waveform. Sound appears in three kinds of graphs:
- **Sound as an input**: a voice recording drives a talking portrait.
- **Sound from text**: music or effects generated from a prompt.
- **Sound with video**: models that draw the clip and its sound together.

## Where you meet it in a graph
- **Load Audio** reads a file from `input`; **Save Audio** writes to `output`; **Preview Audio** plays it on the node.
- **Get Video Components** gives a video's `audio`; **Create Video** takes `audio` and puts it into the clip.
- **Music and effects from text**: ACE-Step (songs with lyrics) and Stable Audio Open (short sounds and loops) have built-in templates; they use an empty audio latent (for example EmptyLatentAudio or an ACE-Step latent node), a sampler, and VAE Decode Audio.
- **Video with sound**: LTX-2 (built-in templates) and Ovi (WanVideoWrapper) generate speech and sound with the frames.
- **Speech to text, voice cloning, text to speech**: through node packs; follow the pack's README, and the consent rule for voices.

## Values and what they change
Length is set in seconds on the empty audio latent; longer sound costs more time. Music models read genre, instruments, mood and tempo from the prompt, and lyrics from a separate field.

## Typical mistakes
- A clip saved without sound: `audio` not connected to Create Video.
- A frame rate on the video that does not match the speech: lips drift.
- Cloning a real person's voice without consent: see [Content rules](../trust/Content-Rules.md).

## How the app helps
The lessons of the group **Sound and speech** build sound graphs: [Music from text: ACE-Step 1.5](../lessons/Audio-Music.md), [A sound from text: Stable Audio](../lessons/Audio-Sound.md), [Speech from text: Chatterbox](../lessons/Audio-Speech.md), [Sound for a silent video: MMAudio](../lessons/Audio-Foley.md) and [Speech to text: Whisper](../lessons/Audio-Transcribe.md). The talking-portrait lessons, the Ovi lesson and [Video with sound: LTX-2.5](../lessons/Video-LTX.md) put sound into clips. On a node's card in the library, hold the pointer over the type mark of an `AUDIO` or `VIDEO` port to read the built-in note on that type.

## See also
- [Talking portraits](Talking-Portraits.md)
- [Video generation](Video-Models.md)
- [LTX-2](Family-LTX2.md)
- [Lesson: A video with sound: Ovi](../lessons/Wrapper-Ovi.md)
