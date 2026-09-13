/* scriptMe AE v0.1.7 — native ScriptUI / ExtendScript (ES3)
   Install in Scripts/ScriptUI Panels. See README.md. */
(function (host) {
    var KEY = "DFP_scriptMe_AE", GLOBAL = "__DFP_scriptMeAE_v1";
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
    var title = win.add("statictext", undefined, "scriptMe AE   |   0.1.7");
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
    list.helpTip = "Double-click a folder to expand/collapse, or select it and use the button below. Double-click a script to run it.";
    list.alignment = ["fill", "fill"]; list.preferredSize = [440, 260];
    var pathText = win.add("edittext", undefined, "", {readonly: true});
    pathText.helpTip = "Full path of the selected script";
    var actions = win.add("group");
    var run = actions.add("button", undefined, "Run Script"); run.enabled = false;
    var browse = actions.add("button", undefined, "Run Other...");
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
        run.text = isFolder ? (row.isOpen ? "Collapse Folder" : "Expand Folder") : "Run Script";
        run.enabled = (!!entry || !!isFolder) && !state.busy && !state.disposed;
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
        state.busy = true; run.enabled = false; browse.enabled = false;
        var oldFolder = Folder.current, error = null;
        try {
            Folder.current = file.parent;
            // evalFile reads the current file on every launch; do not cache code or wrap
            // arbitrary scripts in an undo group (they may own their undo lifecycle).
            $.evalFile(file);
        } catch (e) { error = e; }
        finally {
            Folder.current = oldFolder; state.busy = false; browse.enabled = true; selectionChanged();
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
        if (list.selection && list.selection.folderKey) { toggleFolder(); return; }
        if (entry) { execute(entry.file); }
    };
    list.onDoubleClick = run.onClick;
    browse.onClick = function () {
        var f = File.openDialog("Choose an After Effects script (.jsx or .jsxbin)");
        if (f) { execute(f); }
    };
    state.dispose = function () {
        state.disposed = true;
        if (state.task !== null) { try { app.cancelTask(state.task); } catch (e) {} state.task = null; }
        run.enabled = false; browse.enabled = false; setStatus("Inactive instance; use the most recently opened panel.");
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
