/* scriptMe AE v0.1.10 — native ScriptUI / ExtendScript (ES3)
   Install in Scripts/ScriptUI Panels. See README.md. */
(function (host) {
    var KEY = "DFP_scriptMe_AE", GLOBAL = "__DFP_scriptMeAE_v1";
    var VERSION = "0.1.10";
    var DOWNLOAD_URL = "https://github.com/drewDFP74/scriptMeAE/raw/refs/heads/main/scriptMeAE.zip";
    var UPDATE_URL = "https://raw.githubusercontent.com/drewDFP74/scriptMeAE/main/latest.txt";
    var self = File($.fileName).absoluteURI;
    var prior = $.global[GLOBAL];
    if (prior && prior.dispose) { prior.dispose(); }
    var state = { task: null, disposed: false, busy: false, rows: [], signature: "", project: "", warnings: [] };
    function read(key, fallback) {
        try { return app.settings.haveSetting(KEY, key) ? app.settings.getSetting(KEY, key) : fallback; }
        catch (e) { return fallback; }
    }
    function save(key, value) {
        try { app.settings.saveSetting(KEY, key, String(value)); return true; }
        catch (e) { alert("Could not save scriptMe AE preference:\n" + e.toString()); return false; }
    }
    function nameOf(file) { try { return decodeURI(file.name); } catch (e) { return file.name; } }
    function projectKey() { return app.project && app.project.file ? app.project.file.absoluteURI : ""; }
    function projectFolder() {
        return app.project && app.project.file ? Folder(app.project.file.parent.absoluteURI + "/_scriptMeAE Files") : null;
    }
    var library = read("library", "");
    var win = host instanceof Panel ? host : new Window("palette", "scriptMe AE", undefined, {resizeable: true});
    win.orientation = "column"; win.alignChildren = ["fill", "top"]; win.spacing = 7; win.margins = 10;
    win.minimumSize = [320, 350];
    var title = win.add("statictext", undefined, "scriptMe AE   |   0.1.10");
    var libraries = win.add("group");
    var choose = libraries.add("button", undefined, "Choose Library...");
    var openLibrary = libraries.add("button", undefined, "Open Library");
    var libraryText = win.add("statictext", undefined, ""); libraryText.characters = 40;
    var projects = win.add("group");
    var openProject = projects.add("button", undefined, "Open Project Scripts");
    var projectText = win.add("statictext", undefined, ""); projectText.characters = 40;
    var bar = win.add("group");
    var scope = bar.add("dropdownlist", undefined, ["All Scripts", "Library", "Project"]); scope.selection = 0;
    var refresh = bar.add("button", undefined, "Refresh");
    var auto = bar.add("checkbox", undefined, "Auto"); auto.value = read("auto", "true") === "true";
    auto.helpTip = "Detect project changes every 2 seconds; rescan folders every 5 seconds while AE is idle.";
    var filter = win.add("edittext", undefined, ""); filter.helpTip = "Search script names and relative folder paths";
    var list = win.add("listbox", undefined, [], {multiselect: false});
    var expandedFolders = {}, searchFolders = {}, searchQuery = "", changingTree = false;
    list.helpTip = "Double-click a folder to expand/collapse, or use Left/Right. Double-click a script to run it.";
    list.alignment = ["fill", "fill"]; list.preferredSize = [440, 260];
    var pathText = win.add("edittext", undefined, "", {readonly: true});
    pathText.helpTip = "Full path of the selected script";
    var actions = win.add("group");
    var run = actions.add("button", undefined, "Run Script"); run.enabled = false;
    var updates = actions.add("button", undefined, "Check for Updates");
    updates.helpTip = "Check for updates and download the ZIP with installation instructions.";
    var status = win.add("statictext", undefined, ""); status.characters = 45;
    var lastScan = 0;
    function setStatus(text) { status.text = text; status.helpTip = text; }
    function labels() {
        libraryText.text = library ? "Library: " + Folder(library).fsName : "Library: choose a folder";
        libraryText.helpTip = libraryText.text;
        var folder = projectFolder();
        projectText.text = folder ? "Project: " + folder.fsName : "Project: save your AE project first";
        projectText.helpTip = projectText.text;
        openProject.enabled = folder !== null;
        openLibrary.enabled = library !== "";
    }
    function scan(root, source, rows) {
        if (!root || !root.exists) { return; }
        var visited = {}, count = 0;
        function walk(folder, prefix, depth) {
            if (depth > 20 || count >= 5000) { state.warnings.push(source + ": scan limit reached"); return; }
            // Skip aliases/symlinks to prevent cycles and escape from the chosen root.
            if (folder.alias || visited["$" + folder.absoluteURI]) { return; }
            visited["$" + folder.absoluteURI] = true;
            var files;
            try { files = folder.getFiles(); }
            catch (e) { state.warnings.push("Cannot read " + folder.fsName); return; }
            if (folder.error) { state.warnings.push("Cannot fully read " + folder.fsName); }
            for (var i = 0; i < files.length; i++) {
                var f = files[i], n = nameOf(f);
                if (n.charAt(0) === "." || f.alias) { continue; }
                if (++count > 5000) { state.warnings.push(source + ": scan limit reached"); break; }
                if (f instanceof Folder) { walk(f, prefix + n + "/", depth + 1); }
                else if (/\.(jsx|jsxbin)$/i.test(n) && f.absoluteURI !== self) {
                    rows.push({file: f, source: source, root: root.absoluteURI, relative: prefix + n});
                }
            }
        }
        walk(root, "", 0);
    }
    function selected() { return list.selection ? list.selection.scriptEntry : null; }
    function selectionChanged() {
        var entry = selected(), row = list.selection;
        var isFolder = row && row.folderKey;
        run.text = "Run Script";
        run.enabled = !!entry && !state.busy && !state.disposed;
        pathText.text = entry ? entry.file.fsName : "";
    }
    function folderOpen(key, section) {
        var choices = searchQuery ? searchFolders : expandedFolders;
        return typeof choices[key] === "boolean" ? choices[key] : (!!searchQuery || section);
    }
    function toggleFolder(value) {
        var row = list.selection;
        if (changingTree || state.busy || state.disposed || !row || !row.folderKey) { return; }
        var choices = searchQuery ? searchFolders : expandedFolders;
        choices[row.folderKey] = typeof value === "boolean" ? value : !row.isOpen;
        draw();
    }
    list.addEventListener("keydown", function (event) {
        if (!list.selection || !list.selection.folderKey) { return; }
        if (event.keyName === "Right" || event.keyName === "Left") {
            toggleFolder(event.keyName === "Right"); event.preventDefault();
        }
    });
    function draw() {
        var old = selected(), oldKey = list.selection ? list.selection.folderKey : null;
        var query = filter.text.toLowerCase(), choice = scope.selection ? scope.selection.index : 0;
        var model = {children: [], lookup: {}}, restore = null;
        function branch(parent, text, key, section) {
            if (!parent.lookup[key]) {
                var n = {key: key, text: text, section: section, children: [], lookup: {}};
                parent.lookup[key] = n; parent.children.push(n);
            }
            return parent.lookup[key];
        }
        for (var i = 0; i < state.rows.length; i++) {
            var r = state.rows[i];
            if ((choice === 1 && r.source !== "Library") || (choice === 2 && r.source !== "Project")) { continue; }
            if (r.relative.toLowerCase().indexOf(query) < 0) { continue; }
            // Section state survives changing project files. Actual subfolders
            // remain scoped to their source directory and return with that project.
            var parent = branch(model, r.source, "$section|" + r.source, true);
            var key = "$folder|" + r.source + "|" + r.root + "|", parts = r.relative.split("/");
            for (var j = 0; j < parts.length - 1; j++) {
                key += parts[j] + "/";
                parent = branch(parent, parts[j], key, false);
            }
            var leaf = {key: "$file|" + r.source + "|" + r.file.absoluteURI, text: parts[parts.length - 1], entry: r};
            parent.children.push(leaf); parent.lookup[leaf.key] = leaf;
        }
        changingTree = true;
        try {
            if (query !== searchQuery) { searchFolders = {}; searchQuery = query; }
            // Only ordinary ListBox rows are created. No native tree nodes,
            // expanded properties or disclosure callbacks can reset our state.
            list.removeAll();
            function render(parent, depth) {
                for (var k = 0; k < parent.children.length; k++) {
                    var d = parent.children[k], indent = "";
                    for (var j = 0; j < depth; j++) { indent += "    "; }
                    var open = !d.entry && folderOpen(d.key, d.section);
                    var item = list.add("item", indent + (d.entry ? "    " : (open ? "\u25BC  " : "\u25B6  ")) + d.text);
                    if (d.entry) {
                        item.scriptEntry = d.entry;
                        if (old && old.file.absoluteURI === d.entry.file.absoluteURI && old.source === d.entry.source) { restore = item; }
                    } else {
                        item.folderKey = d.key; item.folderName = d.text; item.isOpen = open;
                        if (oldKey === d.key) { restore = item; }
                        if (open) { render(d, depth + 1); }
                    }
                }
            }
            render(model, 0);
            if (restore) { list.selection = restore; }
        } finally { changingTree = false; }
        selectionChanged();
    }
    function rescan(force) {
        if (state.busy || state.disposed) { return; }
        labels(); state.warnings = [];
        var rows = [], pf = projectFolder();
        if (library && !Folder(library).exists) { state.warnings.push("Library unavailable"); }
        scan(library ? Folder(library) : null, "Library", rows);
        scan(pf, "Project", rows);
        rows.sort(function (a, b) {
            var aa = a.relative.toLowerCase() + a.source, bb = b.relative.toLowerCase() + b.source;
            return aa < bb ? -1 : aa > bb ? 1 : 0;
        });
        var sig = projectKey() + "|" + library;
        for (var i = 0; i < rows.length; i++) { sig += "\n" + rows[i].source + rows[i].file.absoluteURI; }
        if (force || sig !== state.signature) { state.rows = rows; state.signature = sig; draw(); }
        state.project = projectKey(); lastScan = new Date().getTime();
        var msg = rows.length + " scripts";
        if (pf && !pf.exists) { msg += " | Project folder not created"; }
        if (state.warnings.length) { msg += " | " + state.warnings.join("; "); }
        setStatus(msg);
    }
    function execute(file) {
        if (state.busy || state.disposed) { return; }
        if (!file || !/\.(jsx|jsxbin)$/i.test(nameOf(file))) { alert("Choose a .jsx or .jsxbin script."); return; }
        if (!file.exists) { alert("Script is no longer available:\n" + file.fsName); rescan(true); return; }
        if (file.absoluteURI === self) { alert("This launcher cannot run itself."); return; }
        state.busy = true; run.enabled = false; updates.enabled = false;
        var oldFolder = Folder.current, error = null;
        try {
            Folder.current = file.parent;
            // evalFile reads the current file on every launch; do not cache code or wrap
            // arbitrary scripts in an undo group (they may own their undo lifecycle).
            $.evalFile(file);
        } catch (e) { error = e; }
        finally {
            Folder.current = oldFolder; state.busy = false; updates.enabled = true; selectionChanged();
        }
        rescan(false);
        if (error) {
            setStatus("Script reported an error: " + nameOf(file));
            alert("scriptMe AE could not finish:\n" + file.fsName + "\n\n" + error.toString() +
                (error.line ? "\nLine: " + error.line : "") + "\n\nThe script may have made changes before this error.");
        } else { setStatus("Returned: " + nameOf(file)); }
    }
    choose.onClick = function () {
        var f = Folder.selectDialog("Choose your persistent script library", library ? Folder(library) : undefined);
        if (f && save("library", f.absoluteURI)) { library = f.absoluteURI; rescan(true); }
    };
    function openFolder(folder) {
        try {
            if (/mac/i.test($.os)) {
                // Request Finder explicitly. Folder.execute() triggers AE's generic
                // executing-files warning even when the target is only a directory.
                // Single-quote the path so spaces, apostrophes, and shell characters
                // remain literal. Do not change AE security preferences.
                var quoted = "'" + folder.fsName.replace(/'/g, "'\\''") + "'";
                var result = system.callSystem("/usr/bin/open -a Finder " + quoted + " 2>&1");
                if (result && /\S/.test(result)) { throw new Error(result); }
            } else if (!folder.execute()) {
                throw new Error("The operating system did not accept the folder-open request.");
            }
        } catch (e) {
            alert("Could not open folder:\n" + folder.fsName + "\n\n" + e.toString());
        }
    }
    openLibrary.onClick = function () {
        var f = Folder(library);
        if (!f.exists) { alert("Library folder is unavailable:\n" + f.fsName); }
        else { openFolder(f); }
    };
    openProject.onClick = function () {
        var f = projectFolder(); if (!f) { alert("Save the AE project first."); return; }
        if (!f.exists) {
            if (!confirm("Create this project scripts folder?\n\n" + f.fsName)) { return; }
            if (!f.create()) { alert("Could not create folder. Check write permissions and AE's Allow Scripts To Write Files And Access Network setting.\n" + f.fsName); return; }
        }
        openFolder(f);
        rescan(true);
    };
    refresh.onClick = function () { rescan(true); };
    filter.onChanging = draw; scope.onChange = draw; list.onChange = selectionChanged;
    run.onClick = function () {
        // Recheck the current project at click time, even if polling has not fired.
        var entry = selected();
        if (state.project !== projectKey()) { rescan(true); setStatus("Project changed. Select a script again."); return; }
        if (entry) { execute(entry.file); }
    };
    list.onDoubleClick = function () {
        if (state.project !== projectKey()) { rescan(true); setStatus("Project changed. Select a script again."); return; }
        if (list.selection && list.selection.folderKey) { toggleFolder(); }
        else { run.onClick(); }
    };
    // Only fixed HTTPS endpoints are passed to the shell. Remote text is data,
    // never eval'd, executed, or used as a command/URL.
    function downloadPackage(version) {
        if (!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(version)) { throw new Error("Invalid download version."); }
        var packageURL = DOWNLOAD_URL.replace("scriptMeAE.zip", "scriptMeAE_v" + version + ".zip");
        var command = /mac/i.test($.os) ?
            "/usr/bin/open '" + packageURL + "' 2>&1" :
            'cmd.exe /c start "" "' + packageURL + '"';
        var result = system.callSystem(command);
        if (result && /\S/.test(result)) { throw new Error("Could not start download. Download manually: " + DOWNLOAD_URL); }
    }
    function parseUpdate(text) {
        if (!text || text.length > 16000) { throw new Error("No valid update information received."); }
        var lines = text.replace(/\r/g, "").split("\n");
        if (lines[0] !== "scriptMeAE-update-1" || !/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(lines[1] || "")) {
            throw new Error("Update information is unavailable or has an unexpected format.");
        }
        return {version: lines[1], notes: lines.slice(2).join("\n")};
    }
    function compareVersion(a, b) {
        var aa = a.split("."), bb = b.split(".");
        for (var i = 0; i < 3; i++) {
            var x = parseInt(aa[i], 10), y = parseInt(bb[i], 10);
            if (x !== y) { return x > y ? 1 : -1; }
        }
        return 0;
    }
    updates.onClick = function () {
        if (state.busy || state.disposed) { return; }
        state.busy = true; updates.enabled = false; run.enabled = false;
        setStatus("Checking for updates...");
        try {
            // callSystem is synchronous; requests have finite timeouts.
            var command = /mac/i.test($.os) ?
                "/usr/bin/curl --fail --silent --show-error --connect-timeout 5 --max-time 15 --max-filesize 16000 '" + UPDATE_URL + "' 2>&1" :
                'powershell.exe -NoLogo -NoProfile -NonInteractive -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 -Uri \''
                + UPDATE_URL + '\'; if ($r.Content.Length -gt 16000) { throw \'Response too large\' }; [Console]::Write($r.Content) } catch { [Console]::Write(\'UPDATE_ERROR\') }"';
            var info = parseUpdate(system.callSystem(command));
            var difference = compareVersion(info.version, VERSION);
            var heading = difference > 0 ? "A newer version is available." :
                difference === 0 ? "You have the latest published version." :
                "Your installed version is newer than the public download.";
            setStatus(heading);
            if (confirm(heading + "\n\nInstalled: " + VERSION + "\nPublic download: " + info.version +
                "\n\n" + info.notes + "\n\nDownload the ZIP (script + installation README)? Installation is manual.")) {
                downloadPackage(info.version);
            }
        } catch (e) {
            setStatus("Update check unavailable. Your installed launcher is unchanged.");
            alert("Could not check for updates.\n\n" + e.toString() +
                "\n\nCheck your internet connection and AE scripting permissions, or download the ZIP manually:\n" + DOWNLOAD_URL);
        } finally {
            state.busy = false; updates.enabled = !state.disposed; selectionChanged();
        }
    };
    state.dispose = function () {
        state.disposed = true;
        if (state.task !== null) { try { app.cancelTask(state.task); } catch (e) {} state.task = null; }
        run.enabled = false; updates.enabled = false; setStatus("Inactive instance; use the most recently opened panel.");
    };
    state.tick = function () {
        if (state.disposed) { return; }
        state.task = null;
        try {
            if (!state.busy && (state.project !== projectKey() ||
                (auto.value && new Date().getTime() - lastScan >= 5000))) { rescan(false); }
        } catch (e) { setStatus("Refresh error: " + e.toString() + " | Use Refresh"); }
        schedule();
    };
    function schedule() {
        if (state.disposed || state.task !== null) { return; }
        try { state.task = app.scheduleTask("$.global." + GLOBAL + ".tick()", 2000, false); }
        catch (e) { setStatus("Automatic refresh unavailable; use Refresh."); }
    }
    auto.onClick = function () { save("auto", auto.value); if (auto.value) { rescan(true); } };
    win.onClose = function () { state.dispose(); return true; };
    win.onResizing = win.onResize = function () { this.layout.resize(); };
    $.global[GLOBAL] = state;
    rescan(true); schedule();
    win.layout.layout(true); win.layout.resize();
    if (win instanceof Window) { win.center(); win.show(); }
})(this);
