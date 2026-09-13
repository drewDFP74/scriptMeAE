# scriptMe AE

A dockable After Effects script launcher for a persistent library and project-specific scripts.

## Current download: v0.1.7

[Download scriptMe_AE.jsx](https://github.com/drewDFP74/scriptMeAE/raw/refs/heads/main/scriptMe_AE.jsx)

[What changed](CHANGELOG.md)

## Install or update
1. Download the JSX file. If your browser adds .txt, remove that extra extension.
2. Close After Effects. Keep a backup of your previous launcher outside the Scripts/ScriptUI Panels folder.
3. Copy scriptMe_AE.jsx into your After Effects installation's Scripts/ScriptUI Panels folder. Your computer may request administrator permission.
4. Restart After Effects and open scriptMe_AE from the Window menu. Dock it where you prefer.
5. Choose your script library. For project scripts, save the AE project and use Open Project Scripts to create/open _scriptMeAE Files beside it.

Double-click folders to expand and scripts to run. Refresh or Auto discovers new scripts without restarting AE. Replacing the launcher itself requires restarting AE. Enable Allow Scripts To Write Files And Access Network in AE's Scripting & Expressions preferences when needed for folder creation or your scripts.

## Validation
The developer's user reported v0.1.7 works as expected and confirmed folder double-click in AE. Automated tests use a simulated host; they do not establish complete compatibility with every AE/macOS/Windows version.

This repository presents the current usable download. Development candidates are not advertised as updates until accepted after relevant AE testing. Installation is manual; no automatic replacement is provided.
