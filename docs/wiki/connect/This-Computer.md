[Русский](This-Computer.ru.md)
[Home](../Home.md) › [Connecting](README.md)

# ComfyUI on this computer

The usual case: ComfyUI and NodeWise Studio on the same computer.

<!-- verify: checked against test servers that speak ComfyUI's routes; not yet run against a real ComfyUI install. -->

## Steps

1. Start ComfyUI and wait until its page opens in the browser.
2. In NodeWise: Settings ▸ Connection ▸ **Find on this computer**. The app asks this computer at ports 8188 (ComfyUI
   started from its folder) and 8000 (the ComfyUI desktop app), fills the address in and says, for example,
   "ComfyUI answers on this computer: http://127.0.0.1:8188." If nothing answers: "No ComfyUI answers on this
   computer at ports 8188 and 8000. Start ComfyUI, or enter its address."
3. Or type the address yourself, the one in your browser's address bar when ComfyUI is open. An address on this
   computer typed without `http://` is completed.
4. **Check ComfyUI**: "ComfyUI 0.45.0 answers at this address. Save the settings, and the app reads it." (your version
   may differ).
5. **Save settings**, then **Read now** here, or step 1 **Read ComfyUI** on the empty canvas.

The sync indicator ends at **Up to date**, and its popover says "Read from ComfyUI at 127.0.0.1:8188." with the limits
of this way.

## A different port

If you started ComfyUI with `--port`, use that port: `http://127.0.0.1:<port>`. Find on this computer looks only at
8188 and 8000.

## See also

- [Connecting](README.md)
- [Connecting to ComfyUI](Connecting.md)
- [What each way shows](What-Each-Way-Shows.md)
- [Connection problems](Connection-Problems.md)
