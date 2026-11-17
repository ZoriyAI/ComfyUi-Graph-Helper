[Русский](Settings-Services.ru.md)
[Home](../Home.md) › [Settings](Settings.md)

# Settings: Services

Open **Settings → Services** to start, stop, restart and monitor supported Linux services on the computer running NodeWise. The computer name is shown at the top. A paired phone controls that same computer.

The app automatically finds installed and loaded systemd services named for ComfyUI, ComfyUI MCP, Ollama, llama-server, llama-cpp and LM Studio. Each row shows the exact service name, whether it belongs to your account or the system, process state and RAM reported by systemd. Several Ollama services appear separately. Memory not reported by the system is shown as unknown; this is not a VRAM measurement.

**Start** launches the service. **Stop** and **Restart** first explain that current work in other applications can be interrupted. These actions apply immediately. The app refreshes the service state and reports success only when the requested state is observed. It refreshes the list every ten seconds while this section is visible.

Linux may request administrator authorization for a system service in its own dialog on the host computer. NodeWise does not collect the password or install a permission policy. Cancelling that dialog leaves an authorization message in the app. A paired phone cannot answer the host's system authentication dialog.

A running process may still be loading its HTTP API. Use **Connection settings** to check ComfyUI/MCP, then synchronize. **Assistant and models** opens model context and load/unload controls. The sync repair dialog also links to Services.

This section does not administer another server through its chat URL, install services, modify service files, or control containers/directly launched programs. It supports the existing Linux systemd service families above. Arbitrary commands and service names are not accepted. The assistant cannot invoke these controls.

See also: [Settings: Sync](Settings-Sync.md), [Settings: Assistant](Settings-Assistant.md).
