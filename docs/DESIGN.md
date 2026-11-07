# Visual system

Dark graphite is the default. Colors come from `src/renderer/theme.css` custom properties, including the React Flow 12.12.1 variables (`--xy-background-color`, controls, minimap, edges) documented in the package stylesheet. No second component library.

Port colors are only for data types this app already stores on ports (`IMAGE`, `LATENT`, `MODEL`, `CONDITIONING`, `VAE`, `CLIP`). Anything else is neutral and labeled `unknown`. The type name is always printed next to the swatch. Node categories are not colored: there is no discovered catalog to take them from.

Sample nodes carry a local `demo` flag and a visible DEMO chip. That flag is not ComfyUI metadata. The header TEST fixture is a scripted chat transport, separate from any live server.

Import and export stay visible and disabled, with a title that says they are not implemented. OpenAI keys are typed into a password field and passed only to the main process for the current window.
