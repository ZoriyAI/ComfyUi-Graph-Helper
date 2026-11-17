# Packaged upgrade qualification: 1.2.8 to 1.3.0

Date: 17 November 2026. Candidate application source: `af35bda`. This local result precedes public release publication. The final release workflow repeats package installation and upgrade checks at its own exact source commit.

A downloaded 1.2.8 Linux x64 portable archive was checked against its released SHA256SUMS (`fcf812bcc31d6a3ae6382d902566d714f79b61e294b7624249fb774662f890c2`). Its real `install.sh` installed the app in an isolated user filesystem. The same installer from the newly built 1.3.0 archive then replaced that copy.

| Check | Observed result |
| --- | --- |
| Version before / after | NodeWise Studio 1.2.8 / 1.3.0 |
| Saved settings | Local provider, model and server address retained |
| Workflow | Named note with Unicode content retained |
| Export and import | Native workflow JSON exported, imported and retained after restart |
| Export SHA256 | `f892afa404d5d2ad309ad7a74172be1ef81d015aa174973d4951a0a2ffd77e38` |
| Real Ollama residency | qwen3:4b-instruct loaded through the packaged app on the isolated native API |
| RTX 4060 total memory | 105 MiB before load, 3916 MiB while resident, 105 MiB after exit |
| Exit | Application Quit command, exit code 0; 1220 ms |
| Ollama after exit | Empty resident-model list |
| Restart | Exported graph content still present |

The qualification used an isolated mount namespace, private profile, X11 virtual display and Chromium `--no-sandbox` inside that namespace. It did not replace the owner's installed package, change their profile or stop their shared services. Initial harness failures concerned namespace temporary-directory permissions, the older API lacking the new translation-queue method, and the expected close of the page during Quit; they were corrected before the successful cycle.

This establishes the portable install/update and packaged application behavior on this Linux host. It does not establish apt/dnf integration on all desktops, physical touch devices, Windows/macOS installation, human accessibility acceptance or arbitrary model compatibility. Those limits remain in the current release guide.
