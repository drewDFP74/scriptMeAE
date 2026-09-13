# scriptMe AE

A dockable After Effects script launcher for a persistent library and project-specific scripts.

## Current download: v0.1.8

[Download ZIP (JSX + installation README)](https://github.com/drewDFP74/scriptMeAE/raw/refs/heads/main/scriptMeAE.zip)

[What changed](CHANGELOG.md)

## Install or update
1. Download and extract the ZIP. It contains scriptMe_AE.jsx and README.txt.
2. Close After Effects. Keep a backup of your previous launcher outside the Scripts/ScriptUI Panels folder.
3. Copy scriptMe_AE.jsx into your After Effects installation's Scripts/ScriptUI Panels folder. Your computer may request administrator permission.
4. Restart After Effects and open scriptMe_AE from the Window menu. Dock it where you prefer.
5. Choose your script library. For project scripts, save the AE project and use Open Project Scripts to create/open _scriptMeAE Files beside it.

Double-click folders to expand and scripts to run. Refresh or Auto discovers new scripts without restarting AE. Replacing the launcher itself requires restarting AE. Enable Allow Scripts To Write Files And Access Network in AE's Scripting & Expressions preferences when needed for folder creation or your scripts.

## Validation
The developer's user reported v0.1.8 works as expected and confirmed the update-check flow in AE. Automated tests use a simulated host; they do not establish complete compatibility with every AE/macOS/Windows version.

This repository presents the current usable download. Development candidates are not advertised as updates until accepted after relevant AE testing. Installation is manual; no automatic replacement is provided.
