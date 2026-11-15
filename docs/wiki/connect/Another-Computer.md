[Русский](Another-Computer.ru.md)
[Home](../Home.md) › [Connecting](README.md)

# ComfyUI on another computer

ComfyUI runs on another computer in your network (a desktop with the graphics card, a home server), NodeWise Studio on
this one.

<!-- verify: checked against test servers that speak ComfyUI's routes; not yet run against a real ComfyUI install. -->

## On the computer with ComfyUI

ComfyUI answers only on its own computer unless it is started with `--listen`, for example:

```bash
python main.py --listen 0.0.0.0
```

Then every computer on the network can reach it, and ComfyUI has no password of its own: anyone on the network can
use it. Do this only on a network you trust.

## In NodeWise Studio

1. Settings ▸ Connection ▸ **ComfyUI address**: `http://<address of that computer>:8188`, for example
   `http://192.168.1.50:8188`. For another computer the `http://` (or `https://`) must be written.
2. **Check ComfyUI**, then **Save settings** and **Read now**.

Plain `http` is allowed: the app sends no password or key to ComfyUI. The hint under the field says so; where the
network is not yours, put ComfyUI behind `https`.

## When it does not answer

- "ComfyUI does not answer at …": ComfyUI is not running there, the port is different, it was started without
  `--listen`, or a firewall blocks the port.
- "No computer named … was found": write the address in numbers.
- An address that sends the app to a sign-in page (a proxy with a password) is refused: "The address sends the app to
  another page…".

All messages: [Connection problems](Connection-Problems.md).

## See also

- [Connecting](README.md)
- [ComfyUI on this computer](This-Computer.md)
- [What each way shows](What-Each-Way-Shows.md)
