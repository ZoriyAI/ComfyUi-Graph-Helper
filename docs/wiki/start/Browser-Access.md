[Русский](Browser-Access.ru.md)
[Home](../Home.md) › [Start](README.md)

# Browser access over Wi-Fi

Keep the app running on the computer. A phone, tablet or another computer can use the same project in a browser; no phone app is needed.

1. On the computer, open **Settings → Browser access**.
2. Turn on **Allow access from a browser**. Choose the computer's address on your local network and a port from 1024 to 65535. The address `127.0.0.1` works only on the computer itself.
3. Save settings, then reopen this section. **Available** and the address mean the listener started. A busy port is reported here; choose another and save.
4. Join the same reachable Wi-Fi network on the phone. Open the displayed address or scan its QR code.
5. On the computer select **Connect a device**, then enter the six-digit code on the phone. It works for five minutes and one connection.

The graph and saved conversation belong to the computer's current project. Changes appear on both devices. A stale edit receives a conflict instead of overwriting a newer change. The phone's panel layout stays local to that browser. On narrow screens use **Canvas**, **Library**, **Assistant** and **Properties** to switch panels; lessons are inside the assistant's **Learn** view. Touch gestures move and zoom the graph.

Opening a file selects it on the phone. Saving a project or exporting a workflow downloads a file on the phone. Browser uploads are limited to 11 MiB; open larger files on the computer. Native computer folders, stored keys and the browser listener's settings are managed on the computer. Provider credentials stay in the desktop process.

Use a trusted Wi-Fi network: HTTP does not encrypt traffic. Pairing grants control of this project, including use of the configured assistant. Sessions expire after eight hours and are forgotten when access is turned off or the app exits. **Disconnect** revokes a device immediately. Reloading or reconnecting reads the current project; it does not repeat earlier commands.

If a phone cannot connect, check that the app is running, both devices can reach each other, the chosen interface still has that address, and the port is allowed by the computer's firewall. Some guest Wi-Fi networks isolate devices. The app does not change the router or firewall. After the network address changes, choose its new address and save again. This feature does not configure access from the internet.
