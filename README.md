# scriptMe AE

By Drew Findley, DF Productions, LLC

Build: v0.1.10 — September 13, 2026
README updated: September 14, 2026

scriptMe AE is a dockable panel that keeps your After Effects scripts close at hand. Choose a persistent script library, then browse and run scripts directly from the panel instead of searching through Finder or File Explorer each time. Add new scripts to your library and use Refresh or Auto to make them available without relaunching After Effects.

It also keeps project-specific scripts with the project they were created for. Store them in the `_scriptMeAE Files` folder beside your saved After Effects project, and the panel loads that project's scripts when you open or switch projects. Your shared library remains available across projects.

## Current download: v0.1.10

[Download ZIP (JSX + installation README)](https://github.com/drewDFP74/scriptMeAE/raw/refs/heads/main/scriptMeAE_v0.1.10.zip)

[What changed](CHANGELOG.md)

## Install or update
1. Download and extract the ZIP. Open the scriptMeAE_v0.1.10 folder; it contains scriptMe_AE.jsx and README.txt.
2. Close After Effects. Keep a backup of your previous launcher outside the Scripts/ScriptUI Panels folder.
3. Copy scriptMe_AE.jsx into your After Effects installation's Scripts/ScriptUI Panels folder. Your computer may request administrator permission.
4. Restart After Effects and open scriptMe_AE from the Window menu. Dock it where you prefer.
5. Choose your script library. For project scripts, save the AE project and use Open Project Scripts to create/open _scriptMeAE Files beside it.

Double-click folders to expand and scripts to run. Refresh or Auto discovers new scripts without restarting AE. Replacing the launcher itself requires restarting AE. Enable Allow Scripts To Write Files And Access Network in AE's Scripting & Expressions preferences when needed for folder creation or your scripts.

## Validation
The developer's user reported v0.1.10 works as expected and confirmed the update-check flow in AE. Automated tests use a simulated host; they do not establish complete compatibility with every AE/macOS/Windows version.

This repository presents the current usable download. Development candidates are not advertised as updates until accepted after relevant AE testing. Installation is manual; no automatic replacement is provided.
