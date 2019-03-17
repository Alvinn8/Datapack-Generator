//  -------------  //
//    Variables    //
//  -------------  //
const VERSION = "2.1.3";
const cl = console.log;
let editingFile;
let currentPath;
let autoCompleteIndex = 0;
let contextmenuOpen = {
    contextmenu : null,
    a           : null
};
const defaultStyle = {
    error : [
        ["background-color", "rgba(255, 0, 0, 0.5)"]
    ],
    comment : [
        ["color", "#808080"],
        ["font-style", "italic"]
    ],
    entity_selector : [
        ["color", "#008000"]
    ],
    entity_selector_inside : [
        ["color", "#32cd32"]
    ],
    string : [
        ["color", "#c83232"]
    ],
    entity_selector_not : [
        ["color", "#963232"]
    ],
    entity_selector_comma : [
        ["color", "#000000"]
    ],
    function : [
        ["color", "#be3c82"]
    ],
    text : [
        ["color", "#000000"]
    ],
    background : [
        ["background-color", "#ffffff"]
    ],
    path : [
        ["color", "#000000"]
    ],
    editor : [
        ["caret-color", "#000000"]
    ],
    filename : [
        ["color", "#000000"]
    ],
    nav : [
        ["background-color", "#C0C0C0"],
        ["box-shadow", "0px 5px 10px #C0C0C0"]
    ],
    nav_selected : [
        ["background-color", "#ffffff"]
    ]
};
const settings = {
    syntaxhighlight : true,
    style : defaultStyle
};
const history = [];

//  -------------  //
//     Classes     //
//  -------------  //

class FileSystem {

    constructor(name) {

        this.files = new dpFileList();
        this.name = name;

    }

    addFile(file) {

        file.fileSystem = this;
        this.files.push(file);

    }

    getFile(fullPath) {

        for (let i = 0; i < this.files.length; i++) {

            if (this.files[i].fullPath == fullPath) return this.files[i];

        }

        return null;

    }

    addFolder(path) {

        this.files.push(new dpFolder(path));

    }

    removePath(path) {

        if (path.endsWith("/")) this.removeDirectory(path);
        else this.removeFile(path);

    }

    removeFile(path) {

        for (let i = 0; i < this.files.length; i++) {

            if (this.files[i].fullPath == path) {

                deleted.addFile(this.files[i]);
                this.files.splice(i, 1); /* remove the file from the files list */
                return;

            }

        }

    }

    removeDirectory(path) {

        for (let i = this.files.length - 1; i >= 0; i--) {

            if (this.files[i].fullPath.startsWith(path)) {

                deleted.addFile(this.files[i]);

                this.files[i].path = this.files[i].path.substr(path.split("/").slice(0,-2).join("/").length + 1);

                this.files.splice(i, 1); /* remove the file from the files list */

            }

        }

    }

    getDirectory(path) {

        if (path == "/") {

            const fileList = this.files;

            fileList.path = path;
            fileList.fileSystem = this;
            return fileList;

        }

        if ((!path.endsWith("/")) && (path != "")) throw new Error("Path has to be a directory(end with /)");

        const fileList = new dpFileList();

        for (let i = 0; i < this.files.length; i++) {

            if (this.files[i].fullPath.startsWith(path)) fileList.push(this.files[i]);

        }

        fileList.path = path;
        fileList.fileSystem = this;

        return fileList;

    }

    download() {

        const zip = new JSZip();

        for (let i = 0; i < this.files.length; i++) {

            zip.file(this.files[i].fullPath, this.files[i].value);

        }

        zip.generateAsync({type:"blob"}).then(content => saveAs(content, this.name + ".zip"));

    }

}

class dpFile {

    constructor(path, name, value = "", fileSystem, type = "text", blob) {

        this.path  = path;
        this.name  = name;
        this.value = value;
        this.fileSystem = fileSystem;
        this.type = type;
        this.blob = blob;

        if ((this.path != "") && (!this.path.endsWith("/"))) this.path += "/";

        return this;

    }

    hasSubdirectories(path) {

        const relPath = this.path.substr(path.length);

        return (relPath.includes("/"))

    }

    openInEditor(saveOld = true) {

        if (saveOld && editingFile) {

            editingFile.saveFromEditor();
            editingFile = null;

        }

        history.push(new HistoryEntry(this));

        const $editor = $("#editor--input");

        $("#editor").show();
        $editor.show();
        $("#editor--display").show();
        $("#dir").hide();

        if (this.type == "text") {

            setEditorText(this.value);

            updatePath(this.fullPath, this.fileSystem, true);

            editingFile = this;

        } else if (this.type == "image") {

            editor.html("").hide();
            $("#editor--display").html("").append($("<img>").attr("src", this.value));

            updatePath(this.fullPath, this.fileSystem, true);

            editingFile = this;

        } else if (this.type == "blob") {

            $("#editor--display").text("We do not know how to open this file");
            editor.hide();

            editingFile = this;

            // TODO allow the user to choose how to display the file, read the blob as with a filereader as text or whatever

        }

    }

    saveFromEditor() {

        const editor = $("#editor--input");

        this.value = getEditorText();

    }

    getFileExtension() {

        return this.name.substr(this.name.lastIndexOf(".")+1);

    }

    get fullPath() {

        if (!this.path) return this.name; // if path is "" return just the name;

        return this.path + this.name;

    }

}

class dpFolder {

    constructor(path) {

        this.isFolder = true;
        this.path = path;

        if (!this.path.endsWith("/")) this.path += "/";

    }

    get fullPath() {

        return this.path;

    }

}

class dpFileList extends Array {

    constructor(arr) {

        super();

        if (!arr) return;

        for (var i = 0; i < arr.length; i++) {

            this.push(arr[i]);

        }

    }

    // Displays the files on the screen (#dir)
    display() {

        if (this.path == undefined) throw new Error("Can not display a dpFileList that isn't a directory");

        cl(`Displaying directory ${this.path}`);

        if (editingFile) {

            editingFile.saveFromEditor();
            editingFile = null;

        }

        history.push(new HistoryEntry(this));

        currentFs = this.fileSystem;

        const dir = $("#dir");
        const files = [];
        const addedFolders = [];

        dir.show();
        $("#editor").hide();
        dir.find(".file").remove();

        for (var i = 0; i < this.length; i++) {

            const file = this[i];
            const hasSub = file.hasSubdirectories(this.path);
            let folderName;

            let img = "img/unknown_file.png";
            //if (file.getFileExtension() == "mcfunction") img = "img/mcfunction_file.png";
            if (hasSub) {

                folderName = file.path.substr(this.path.length).split("/")[0];

                if (addedFolders.includes(folderName)) continue;

                img = "img/folder.png";
                addedFolders.push(folderName);

            }

            let toAdd = $("<button></button>").attr("class", "file").html('<img src="'+ img +'"><p></p>');
            toAdd.find("img").attr("width", 64).attr("height", 64);
            if (!hasSub) {

                toAdd.find("p").text(file.name).addClass("file--name");
                toAdd.attr("path", file.fullPath);
                toAdd.on("click", e => {

                    this.fileSystem.getFile(file.fullPath).openInEditor();

                });

            } else {

                toAdd.find("p").text(folderName).addClass("file--name");

                const folderPath = this.path + file.path.substr(this.path.length).split("/")[0] + "/";

                toAdd.attr("path", folderPath);

                toAdd.on("click", e => {

                    this.fileSystem.getDirectory(folderPath).display();

                });

            }

            files.push(toAdd);

        }

        files.sort((a, b) => {

            if (a.name < b.name) return 1;
            else if (a.name > b.name) return -1;
            else return 0;

        });

        for (let i = 0; i < files.length; i++) {

            dir.append(files[i]);

        }

        updatePath(this.path, this.fileSystem);

    }

}

class HistoryEntry {

    constructor(entry) {

        if (entry instanceof dpFile) {

            this.isFile = true;
            this.file = entry;

        } else {

            this.isFile = false;
            this.fileList = entry;

        }

    }

    open() {

        if (this.isFile) {

            this.file.openInEditor();

        } else {

            this.fileList.fileSystem.getDirectory(this.fileList.path).display();

        }

    }

}

const fs = new FileSystem("datapack");

fs.addFile(new dpFile("", "pack.mcmeta", '{\n  "pack": {\n    "pack_format": 1,\n    "description": ""\n  }\n}', fs));
fs.addFile(new dpFile("data/default/functions/", "default.mcfunction", "execute as @a[tag=!something] run function default:test", fs));

const deleted = new FileSystem("deleted");

currentFs = fs;

//  --------------------  //
//     document.ready     //
//  --------------------  //

$(document).ready(() => {
    $(window).on("beforeunload", e => {

        e.preventDefault();
        e.returnValue = "Are you sure you want to leave?";
        return "Are you sure you want to leave?";

    });
    $("#view").on("click", e => {

        let str = "Enter fullscreen";

        if (isInFullscreen()) str = "Exit fullscreen";

        $("#nav--fullscreen").text(str);

    });
    $(".nav--a:not(.nav--b)").on("click", e => {

        const elem = e.target;

        const cm = elem.parentNode.getElementsByClassName("nav--contextmenu")[0];

        if (cm) openNavContextMenu(cm);

    }).on("mouseover", e => {

        if ((contextmenuOpen.a) && (contextmenuOpen.a != e.currentTarget)) {

            closeNavContextMenu(contextmenuOpen.contextmenu, true);

            const ct = $(e.currentTarget).parent().find(".nav--contextmenu");

            ct.css("display", 'block');

            e.currentTarget.classList.add("nav__selected");
            contextmenuOpen.a = e.currentTarget;
            contextmenuOpen.contextmenu = ct[0];

        }

    });
    $("#nav--fullscreen").on("click", e => {

        if (isInFullscreen()) exitFullscreen();
        else enterFullscreen();

    });
    $("#nav--download").on("click", e=> {

        fs.download();

    });
    $("#nav--newfile").on("click", newFile);
    $("#nav--newfolder").on("click", newFolder);
    $("#nav--resetdir").on("click", e=> {

        fs.getDirectory("").display();

    });
    $("#nav--settings").on("click", openSettings);
    $("#nav--load").on("click", e => {

        openWindow($(".window#load"));

        $("#load--error").hide();

    });
    $("#nav--deleted").on("click", e => {

        deleted.getDirectory("").display();

    });
    $("#nav--find").on("click", e => {

        openFind();

    });
    $("#nav--news").on("click", e => {

        openWindow($(".window#news"));

    });
    $("#nav--project").on("click", e => {

        if (currentFs == deleted) return;

        openWindow($(".window#project"));

        $("#project--name").val(currentFs.name);

        const file = currentFs.getFile("pack.mcmeta");

        if (file) {

            let desc;

            try {

                desc = JSON.parse(file.value).pack.description;

            } catch(e) {}

            if (desc) {

                $("#project--desc--container").show();
                $("#project--desc").val(desc);

            } else {

                $("#project--desc--container").hide();

            }

        } else {

            $("#project--desc--container").hide();

        }

    });
    $("#editor--input").on("input", updateEditorDisplay)
    .on("keyup click focus", e => {

        $("#editor--autocomplete").remove();

        const selection = window.getSelection();

        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        const text = range.startContainer.textContent.substr(0, range.startOffset);

        if (text.endsWith("function ")) {

            const coords = getCaretPos();
            const $toAdd = $("<div></div>").attr("id", "editor--autocomplete");
            const OFFSET = 16;

            $toAdd.css("left", coords.x + "px").css("bottom", "calc(100% - "+ coords.y +"px)");

            $(document.body).append($toAdd);

            const namespaces = [];

            let j = 0;
            for (let i = 0; i < currentFs.files.length; i++) {

                const file = currentFs.files[i];

                if (file.path.startsWith("data/")) {

                    const namespace = file.path.split("/")[1];

                    if (namespaces.includes(namespace)) continue;

                    namespaces.push(namespace);
                    $toAdd.append($("<p></p>").text(namespace).addClass("editor--autocomplete--option").attr("index", j).on("click", e => {

                        e.preventDefault();
                        autoComplete(namespace);
                        $("#editor--autocomplete").remove();  // todo

                    }));

                    j++;

                }

            }

            $toAdd.find(".editor--autocomplete--option").eq(autoCompleteIndex).addClass("selected");

        }

    }).on("keydown", e => {

        const $autocomplete = $("#editor--autocomplete");

        if ($autocomplete.length) {

            if (e.key == "Tab") {

                e.preventDefault();

                const text = $(".editor--autocomplete--option.selected").text();

                autoComplete(text);

            } else if (e.key == "ArrowDown" || e.key == "ArrowUp") {

                e.preventDefault();

                const $option = $(".editor--autocomplete--option.selected");
                const index = parseInt($option.attr("index"));
                const newIndex = index + (e.key == "ArrowDown" ? 1 : -1);

                let $newOption = $(".editor--autocomplete--option[index="+ newIndex +"]");

                if (!$newOption.length) {

                    if (newIndex == -1) {

                        $newOption = $(".editor--autocomplete--option").last();
                        autoCompleteIndex = $(".editor--autocomplete--option").length - 1;

                    } else {

                        $newOption = $(".editor--autocomplete--option").first();
                        autoCompleteIndex = 0;

                    } 

                } else {

                    autoCompleteIndex = newIndex;

                }

                $(".editor--autocomplete--option").removeClass("selected");
                $newOption.addClass("selected");

            }

        }

    })
    .on("blur", e => {

        $("#editor--autocomplete").remove();

    });
    $(".nav--contextmenu").on("click", e => {

        closeNavContextMenu(e.currentTarget);

    });
    $("#newFile--create").on("click", e => {

        const name = $("#newFile--name").val();
        const path = $("#newFile--path").val();
        const ext  = $("#newFile--extension").val();
        const fullName = name + (ext ? "." + ext : "");
        const error = $("#newFile--error");

        if (!name) {

            error.html("Name can't be empty");
            error.css("display", "block");
            return;

        }

        const file = new dpFile(path, fullName, "", currentFs);

        currentFs.addFile(file);

        $(".window#newFile").hide();

        currentFs.getDirectory(currentPath).display();

    });
    $("#rename--go").on("click", e => {
        
        const name = $("#rename--name").val();
        const path = $("#rename--path").val();
        const ext  = $("#rename--ext").val();
        const fullName = name + (ext ? "." + ext : "");
        const error = $("#rename--error");
        const file = currentFs.getFile(path);
        
        if (!name) {

            error.html("Name can't be empty");
            error.css("display", "block");
            return;

        }

        file.name = fullName;
        currentFs.getDirectory(currentPath).display();

    });
    $("#load--go").on("click", e => {

        const fileInput = $("#load--file");

        const file = fileInput[0].files[0];
        const error = $("#load--error");

        if (!file) {

            error.text("No file selected!").css("display","block");
            return;

        }

        if (!file.name.endsWith(".zip")) {

            error.text("The file you selected isn't a zip file").css("display","block");
            return;

        }

        //if (!confirm("Are you sure?")) return;

        fileInput.val("");

        const loadProgress = $("#load--progress");
        loadProgress.show();
        loadProgress.val(0);

        fs.files = new dpFileList();
        fs.name = file.name.slice(0, -4);

        JSZip.loadAsync(file).then(zip => {

            const total = Object.keys(zip.files).length;
            loadProgress.attr("max", total);
            let loadedFiles = 0;

            function loadedFile() {

                loadedFiles++;
                loadProgress.val(loadedFiles);

                 if (loadedFiles >= total) {

                     $("#load--info").append("The file has been loaded");
                     currentFs.getDirectory("").display();

                 }

            }

            zip.forEach((path, file) => {

                let loadType;

                if (path.endsWith("/")) {

                    loadedFile();
                    return;

                }

                const _path = path.substr(0, path.lastIndexOf("/")+1);
                const name = path.substr(path.lastIndexOf("/")+1);

                if ((path.endsWith(".mcmeta"))
                 || (path.endsWith(".mcfunction"))
                 || (path.endsWith(".txt"))
                 || (path.endsWith(".json"))) {

                     loadType = "text";

                 } else if ((path.endsWith("png"))) {

                     loadType = "base64";

                 }

                 if (loadType == "text") {

                     file.async("text").then(txt => {

                         fs.addFile(new dpFile(_path, name, txt, fs));

                         loadedFile();

                     });

                 } else if (loadType == "base64") {

                     file.async("base64").then(res => {

                         fs.addFile(new dpFile(_path, name, "data:image/png;base64," + res, fs, "image"));

                         loadedFile();

                     });

                 } else {

                     file.async("blob").then(res => {

                         fs.addFile(new dpFile(_path, name, "", fs, "blob", res));

                         loadedFile();

                     });

                 }

            });

        }, error => {

            error.append("Error reading zip: "+ error.message + "<br>").css("display", "block");

        });

    });
    $(".window--top--close").on("click", e => {

        $(e.currentTarget).parent().parent().hide();

    });
    /*$("#editor--input").on("paste", e => {

        const event = e.originalEvent;

        const data = (event.clipboardData || window.clipboardData);

        const text = data.getData("text");

        if (data.getData("text/html")) {

            cl("Text isn't plain, trying to paste it plainly");

            e.preventDefault();

            autoComplete(text);

        }

    });*/
    $(".window--top").on("mousedown", e => {

        const wind = $(e.currentTarget).parent();

        const windowBox = wind[0].getBoundingClientRect();

        const start = {
            windowX : windowBox.left,
            windowY : windowBox.top,
            mouseX  : e.clientX,
            mouseY  : e.clientY
        };

        $(document).on("mousemove", e => {

            let x = start.windowX + e.clientX - start.mouseX;
            let y = start.windowY + e.clientY - start.mouseY;

            const minX = 0;
            const maxX = Math.ceil(window.innerWidth - windowBox.width);

            const minY = 30;
            const maxY = Math.ceil(window.innerHeight - windowBox.height);

            if (y < minY) y = minY;
            if (y > maxY) y = maxY;
            if (x < minX) x = minX;
            if (x > maxX) x = maxX;

            wind.css("left", x + "px");
            wind.css("top", y + "px");

            window.getSelection().removeAllRanges();

        });

    });

     // ".window--top"
    $(document).on("mouseup", e => {

        $(document).off("mousemove"); // opodo - give the event a name/id and remove it and not all.

    });
    $(".window").on("mousedown", e => {

        $(".window").css("zIndex", 10);
        $(e.currentTarget).css("zIndex", 11);

    });
    $("#settings--style--download").on("click", e => {

        const $style = $("#style");
        const text = $.trim($style.html().replace(/        /g, ""));
        const blob = new Blob([text], {"type": "text/css"});

        saveAs(blob, "style.css");

    });
    $("#settings--style--load").on("click", e => {

        $("#settings--style--load--input").click();

    });
    $("#settings--style--load--input").on("change", e => {

        const file = $("#settings--style--load--input")[0].files[0];

        const reader = new FileReader();

        reader.onloadend = () => {

            $("#style").html(reader.result);

            updateSettingsStyleEditor();

            let readingStyle;

            parseStyle(reader.result);

            updateSettingsStyleEditor();
            cl("Loaded style!");

        };

        reader.readAsText(file);

    });
    $("#find--find").on("input", e => {

        const toFind = $("#find--find").val();
        const $result = $("#find--result");

        $("#find--error").hide().html("");

        if ($("#find--all")[0].checked) {

            $result.text("Found "+ toFind +" in these files:").append("<br><br>");

            for (let i = 0; i < currentFs.files.length; i++) {

                const file = currentFs.files[i];

                if (file.value.includes(toFind) || file.name.includes(toFind)) {

                    $result.append($("<span></span>").text(file.name).addClass("find--link").on("click", e => { file.openInEditor() })).append("<br>");

                }

            }

        } else {

            $("#find--result").html("");

            if (!editingFile) {

                $("#find--error").append("You are not in a file<br>").show();
                return;

            }

            $("#find--error").append("You can't find in one file, this feature will be added soon! You can find in all files and replace in one or all files<br>").show();

        }

    });

    $("#find--replace--go").on("click", e => {

        const toFind = $("#find--find").val();
        const toFindRegExp = new RegExp(toFind, "g");
        const toReplace = $("#find--replace").val();

        $("#find--error").hide().html("");

        if ($("#find--all")[0].checked) {

            for (let i = 0; i < currentFs.files.length; i++) {

                const file = currentFs.files[i];

                if (file.value.includes(toFind)) {

                    file.value = file.value.replace(toFindRegExp, toReplace);
                    file.openInEditor(false);

                }

            }

        } else {

            if (!editingFile) {

                $("#find--error").append("You are not in a file<br>").show();
                return;

            }

            editingFile.value = editingFile.value.replace(toFindRegExp, toReplace);
            editingFile.openInEditor(false);

        }

    });
    $("#settings--style--loadurl").on("click", e => {

        const url = $("#settings--style--loadurl--url").val();

        if (!url) return;

        $.get(url, data => {

            parseStyle(data);

        }).fail((xhr, status, error) => {

            cl(xhr);
            cl(status);
            cl(error);

            $("#settings--style--loadurl--error").show().text("There was an error when loading the style: "+ error);

        });

    });
    $("#settings--style--preset").on("change", e => {

        const val = $("#settings--style--preset").val();

        if (val == "darktheme") {

            settings.style = {
                error : [
                    ["background-color", "rgba(255, 0, 0, 0.5)"]
                ],
                comment : [
                    ["color", "#afafaf"],
                    ["font-style", "italic"]
                ],
                entity_selector : [
                    ["color", "#01e801"]
                ],
                entity_selector_inside : [
                    ["color", "#00ff3b"]
                ],
                string : [
                    ["color", "#30ad48"]
                ],
                entity_selector_not : [
                    ["color", "#ff5557"]
                ],
                entity_selector_comma : [
                    ["color", "#ffffff"]
                ],
                function : [
                    ["color", "#ff57e7"]
                ],
                text : [
                    ["color", "#ffffff"]
                ],
                background : [
                    ["background-color", "#626361"]
                ],
                path : [
                    ["color", "#ffffff"]
                ],
                editor : [
                    ["caret-color", "#ffffff"]
                ],
                filename : [
                    ["color", "#ffffff"]
                ],
                nav : [
                    ["background-color", "#373737"],
                    ["box-shadow", "0px 5px 10px #373737"],
                    ["color", "white"]
                ],
                nav_selected : [
                    ["background-color", "#3988ef"]
                ]
            };

        } else if (val == "default") {

            settings.style = defaultStyle;

        }

        styleEditorUpdateAll();
        updateSettingsStyleEditor();

    });
    $("#project--name").on("input", e => {

        if (currentFs == deleted) return;

        currentFs.name = $("#project--name").val();

    });
    $("#project--pack").on("click", e => {

        currentFs.getFile("pack.mcmeta").openInEditor();

    });
    $("#project--desc").on("focus", e => {

        const $title = $("#project--desc--title");

        $title.show();

        setTimeout(() => {

            $title.css("opacity", 1);

        }, 1);

        setTimeout(() => {

            $title.css("opacity", 0);

            setTimeout(() => {

                $title.hide();

            }, 1000);

        }, 5000);

    });
    $("#settings--syntax").on("change", e => {

        settings.syntaxhighlight = $("#settings--syntax")[0].checked;
        if (editingFile) updateEditorDisplay();

    });
    $("#back").on("click", e => {

        history.back();

    });
    /* qfready qfdocument.ready qfdocumentready qfdocready qfdr */

    styleEditorUpdateAll();

    center($(".window#news").show()[0]);
    $(".window#news").css("opacity", 1);
    $(document).on("keydown", e => {

        if (e.key == "f" && (e.metaKey || e.ctrlKey)) {

            e.preventDefault();
            openFind();

        }

    });
    $("#editor").on("contextmenu", e => {

        const sel = window.getSelection();

        if (sel.anchorNode.nodeType == Node.TEXT_NODE) {

            const val = sel.anchorNode.nodeValue;

            const before = val.substring(0, sel.anchorOffset);
            const after = val.substring(sel.anchorOffset);

            if (before.match(/(function\s?)$/)) {

                if (after.includes(":") && !after.startsWith("#")) {

                    const split = after.split(":");
                    const namespace = split[0];
                    const func = split[1];

                    const fullPath = "data/"+ namespace + "/functions/"+ func +".mcfunction";

                    const file = currentFs.getFile(fullPath);

                    const contextmenu = $("#contextmenu");

                    e.preventDefault();

                    contextmenu.css("display","inline-block")
                    .css("left", e.clientX + "px")
                    .css("top", e.clientY + "px")
                    .html("");

                    if (file) {

                        contextmenu.append($("<p></p>").text("Open mcfunction file").attr("class", "contextmenu--option").on("click", e => {

                            file.openInEditor();
                            closeContextmenu();

                        }));

                    } else {

                        contextmenu.append($("<p></p>").text("Create mcfunction file").attr("class", "contextmenu--option").on("click", e => {

                            const path = "data/"+ namespace + "/functions/";
                            const name = func +".mcfunction";

                            const newFile = new dpFile(path, name, "", currentFs);

                            currentFs.addFile(newFile);

                            newFile.openInEditor();

                            closeContextmenu();

                        }));

                    }

                }

            }

        }

    });
    $(document).on("contextmenu", e => {

        function getElementByClass(array, clazz) {

            for (let i = 0; i < array.length; i++) {

                if (array[i].className == clazz) return array[i];

            }

            return null;

        }

        function getElementById(array, id) {

            for (let i = 0; i < array.length; i++) {

                if (array[i].id == id) return array[i];

            }

            return null;

        }

        function show(contextmenu) {

            e.preventDefault();

            contextmenu.css("display","inline-block")
            .css("left", e.clientX + "px")
            .css("top", e.clientY + "px")
            .html("");

        }

        const path = e.originalEvent.composedPath();
        const file = $(getElementByClass(path, "file"));
        const dir = getElementById(path, "dir");

        if (file[0]) {

            cl("Clicked on a file");

            const contextmenu = $("#contextmenu");
            const path = $(file).attr("path");

            show(contextmenu);

            contextmenu.append($("<p></p>").text("Open").attr("class", "contextmenu--option").on("click", e => {

                file.click();
                closeContextmenu();

            }));
            contextmenu.append($("<p></p>").text("Rename").attr("class", "contextmenu--option").on("click", e => {

                rename(); // Open rename window
                $("#rename--path").val(path);

                const _file = currentFs.getFile(path);
                const name = _file.name.split(".")[0];
                const ext = _file.getFileExtension();

                $("#rename--name").val(name);
                $("#rename--ext").val(ext);

                closeContextmenu();

            }));
            contextmenu.append($("<p></p>").text("Delete").attr("class", "contextmenu--option").on("click", e => {

                currentFs.removePath($(file).attr("path"));
                currentFs.getDirectory(currentPath).display();
                closeContextmenu();

            }));
            
            if ((path.endsWith(".mcfunction"))) {

                const cmEntry = $("<p></p>").text("Add to tick.json").addClass("contextmenu--option");
                const cmEntry2 = $("<p></p>").text("Add to load.json").addClass("contextmenu--option");
                const tickjson = currentFs.getFile("data/minecraft/tags/functions/tick.json");
                const loadjson = currentFs.getFile("data/minecraft/tags/functions/load.json");
                const split = path.split("/");

                if (split.length >= 3) {

                    const fileName = split.slice(3).join("/");
                    const functionPath = split[1] +":"+ fileName.substr(0, fileName.lastIndexOf("."));

                    // tick.json

                    if (tickjson && tickjson.value.includes(functionPath)) {

                        cmEntry.addClass("disabled");
                        contextmenu.append(cmEntry);

                    } else {

                        contextmenu.append(cmEntry);

                        if (!tickjson) {

                            cmEntry.on("click", e => {

                                currentFs.addFile(new dpFile("data/minecraft/tags/functions/", "tick.json", '{\n    "values":[\n        "'+ functionPath +'"\n    ]\n}', currentFs));
                        closeContextmenu();

                    });

                } else {

                    cmEntry.on("click", e => {

                        tickjson.value = tickjson.value.slice(0, -8) +',\n        "'+ functionPath +'"\n    ]\n}';
                        closeContextmenu();

                    });

                }

            }


            // load.json


            if (loadjson && loadjson.value.includes(functionPath)) {

                cmEntry2.addClass("disabled");
                contextmenu.append(cmEntry2);

            } else {

                contextmenu.append(cmEntry2);

                if (!loadjson) {

                    cmEntry2.on("click", e => {

                        currentFs.addFile(new dpFile("data/minecraft/tags/functions/", "load.json", '{\n    "values":[\n        "'+ functionPath +'"\n    ]\n}', currentFs));
                                closeContextmenu();

                            });

                        } else {

                            cmEntry2.on("click", e => {

                                loadjson.value = loadjson.value.slice(0, -8) +',\n        "'+ functionPath +'"\n    ]\n}';
                                closeContextmenu();

                            });

                        }

                    }

                }
                
            }


        } else if (dir) {

            cl("Clicked on the dir");

            const contextmenu = $("#contextmenu");

            show(contextmenu);

            contextmenu.append($("<p></p>").text("New File").attr("class", "contextmenu--option").on("click", e => {

                newFile();
                closeContextmenu();

            }));
            contextmenu.append($("<p></p>").text("New Folder").attr("class", "contextmenu--option").on("click", e => {

                newFolder();
                closeContextmenu();

            }));

        }

    });
    $("#version").text(VERSION);
    $("title").append(" " + VERSION);
    fs.getDirectory("").display();
});

$(document).on("click", event => {

    // if the event is from elem.click() then return
    if (!event.originalEvent) return;

    const path = event.originalEvent.composedPath();
              
    if (contextmenuOpen.a) {

        if (!((path.includes(contextmenuOpen.a)) || (path.includes(contextmenuOpen.contextmenu)))) {
            
            closeNavContextMenu(contextmenuOpen.contextmenu);
            
        }
                        
    }

    const contextmenu = $("#contextmenu");

    if ((contextmenu.is(":visible")) && (!path.includes(contextmenu[0]))) {

        closeContextmenu();

    }
                        
});

//  -------------  //
//    Functions    //
//  -------------  //

function isInFullscreen() {

    // https://stackoverflow.com/a/36672683

    return (document.fullscreenElement       && document.fullscreenElement       !== null)
        || (document.webkitFullscreenElement && document.webkitFullscreenElement !== null)
        || (document.mozFullScreenElement    && document.mozFullScreenElement    !== null)
        || (document.msFullscreenElement     && document.msFullscreenElement     !== null);

}
function enterFullscreen() {

    const html = $("html").get(0);

    if      (html.requestFullscreen)       html.requestFullscreen();
    else if (html.mozRequestFullScreen)    html.mozRequestFullScreen();
    else if (html.webkitRequestFullScreen) html.webkitRequestFullScreen();
    else if (html.msRequestFullscreen)     html.msRequestFullscreen();

}
function exitFullscreen() {

    // https://stackoverflow.com/a/36672683

    if      (document.exitFullscreen)       document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.mozCancelFullScreen)  document.mozCancelFullScreen();
    else if (document.msExitFullscreen)     document.msExitFullscreen()

}
function closeNavContextMenu(_contextMenu, instant) {

    const contextMenu = $(_contextMenu);

    contextMenu.css("opacity", 0);
    contextmenuOpen = {};
    if (!instant) {
        setTimeout(() => {

            contextMenu.css("display", "none").css("opacity", 1);
            contextMenu.parent().find(".nav--a").removeClass("nav__selected");

        }, 250);
    } else {

        contextMenu.css("display", "none").css("opacity", 1);
        contextMenu.parent().find(".nav--a").removeClass("nav__selected");

    }

}
function openNavContextMenu(_contextMenu) {

    const contextMenu = $(_contextMenu);
    const navA = contextMenu.parent().find(".nav--a:not(.nav--b)");

    if (contextmenuOpen.contextmenu) closeNavContextMenu(contextmenuOpen.contextmenu);

    contextmenuOpen.a = navA[0];
    contextmenuOpen.contextmenu = contextMenu[0];
    contextMenu.css("display", "block");
    navA.addClass("nav__selected");

}
function syntaxHighlight(text) {

    if (!settings.syntaxhighlight) return text;

    function syntax(syn, text, noEnd) {

        if (!noEnd) return '<syntax class="'+ syn +'">'+ text + '</syntax>';
        else        return '<syntax class="'+ syn +'">'+ text;

    }

    let resText = '<span class="editor--linenumber">1</span>';

    let comment = false;
    let string = false;
    let entitySelector = false;
    let lineNum = 2;

    for (let i = 0; i < text.length; i++) {

       if (text[i] == "\n") {
           //if (i == text.length - 1) continue;
           resText += "\n" + ((string || comment) ? "</syntax>" : "") + '<span class="editor--linenumber">'+ lineNum +'</span>';
           lineNum++;
           if (string) string = false;
           if (comment) comment = false;
       }
       else if (comment) resText += text[i];
       else if ((text[i] == '"') && !(text[i-1] == "\\")) {
            if (string) {
                string = false;
                resText += '"</syntax>';
            } else {
                string = true;
                resText += syntax("string",'"',true);
            }
        }
        else if (string) resText += text[i];
        else if ((text[i] == "/") && ((text[i-1] == "\n") || (text[i-1] == undefined))) resText += syntax("error", "/");
        else if ((text[i] == "#") && ((text[i-1] == "\n") || (text[i-1] == undefined))) {
            comment = true;
            resText += syntax("comment", "#", true);
        }
        else if ((text[i] == "@") && ((text[i+1] == "a") || (text[i+1] == "e") || (text[i+1] == "s") || (text[i+1] == "p") || (text[i+1] == "r"))) {
            if (text[i+2] == "[") {
                resText += syntax("entity_selector", text[i] + text[i+1] + text[i+2]) + syntax("entity_selector_inside", "", true);
                i += 2;
                entitySelector = true;
            } else {
                resText += syntax("entity_selector", text[i] + text[i+1]);
                i++;
            }

        }
        else if ((entitySelector) && (text[i] == "]")) {
            resText += "</syntax>" + syntax("entity_selector", "]");
            entitySelector = false;
        }
        else if ((entitySelector) && (text[i] == "!")) resText += syntax("entity_selector_not","!");
        else if ((entitySelector) && (text[i] == ",")) resText += syntax("entity_selector_comma", ",");
        else if (text.substr(i, 8) == "function") {

            resText += syntax("function", "function");
            i += 7;

            /* TODO(bug)
            let txt = "function";
            const after = text.substr(i+14).split("\n")[0].split(" ")[0];

            if (after.includes(":")) txt += " "+ after;

            resText += syntax("function", txt);
            i += txt.length - 1;
            */

        }
        else resText += text[i];

    }

    return resText;

}
function updateEditorDisplay() {

    const input = $("#editor--input");

    // replace all text nodes with divs
    input.contents().each((index, node) => {

        if (node.nodeType == Node.TEXT_NODE) {

            const toAdd = document.createElement('div');
            node.before(toAdd);
            toAdd.appendChild(node);

        }

    });

    //const val = input.html().replace(/<div>/g,"").replace(/<br>/g,"").replace(/<\/div>/g,"\n");
    const val = getEditorText();

    const syntax = syntaxHighlight(val);

    $("#editor--display").html(syntax);

}
function updatePath(path, fileSystem, isFile) {

    currentPath = path;

    if (isFile) {

        $("#nav--newfile").addClass("disabled");
        $("#nav--newfolder").addClass("disabled");

    } else {

        $("#nav--newfile").removeClass("disabled");
        $("#nav--newfolder").removeClass("disabled");

    }

    const pathDiv = $("#path");

    pathDiv.html("");

    pathDiv.append($("<span></span>").text(fileSystem.name).on("click", e => { fileSystem.getDirectory("").display() }));
    pathDiv.append(" / ");

    const split = path.split("/");

    for (let i = 0; i < split.length; i++) {

        if (i == split.length-1) {

            if (isFile) {

                const toAdd = $("<span></span>").text(split[i]).on("click", e => {

                    fileSystem.getFile(path).openInEditor();

                });

                pathDiv.append(toAdd);

                break;

            } else {

                break;

            }

        }

        const toAdd = $("<span></span>").text(split[i]).on("click", e => {

            fileSystem.getDirectory(split.slice(0, i+1).join("/") + "/").display();

        });

        pathDiv.append(toAdd);
        pathDiv.append(" / ");

    }

}

function closeContextmenu() {

    const contextmenu = $("#contextmenu");

    contextmenu.css("opacity", 0);
    setTimeout(() => {

        contextmenu.css("opacity", 1);
        contextmenu.hide();

    }, 250);

}
function newFile() {
    
    openWindow($(".window#newFile"));

    $("#newFile--name").val("");
    $("#newFile--path").val(currentPath);
    $("#newFile--error").hide();
    
}
function newFolder() {
    
    openWindow($(".window#newFolder"));

    $("#newFolder--name").val("");
    $("#newFolder--path").val(currentPath);
    $("#newFolder--error").hide();
    
}
function rename() {

    openWindow($(".window#rename"));

    $("#rename--name").val("");
    $("#rename--path").val(currentPath);
    $("#rename--error").hide();

    
    
}
function openSettings() {

    openWindow($(".window#settings"));

    $("#settings--syntax")[0].checked = settings.syntaxhighlight;

    updateSettingsStyleEditor();

}
function updateSettingsStyleEditor() {

    $(".styleEditor").each((index, ele) => {

        const elem = $(ele);
        const _style = elem.attr("for");
        const setting = settings.style[_style];

        elem.html("");

        for (const i in setting) {

            const key = $("<input>").val(setting[i][0]).addClass("window--input").attr("styletype","key").attr("index", i);
            const value = $("<input>").val(setting[i][1]).addClass("window--input").attr("styletype","value").attr("index", i);

            if (setting[i][1].startsWith("#") && setting[i][1].length == 7) value.attr("type", "color");

            elem.append(key)
            .append(value)
            .append($("<div></div>").addClass("styleEditor--remove--container")
                .append($("<span></span>").html("&times;").addClass("styleEditor--remove"))
                .on("click", e => {
                    styleEditorRemove(_style, i);
                }))
            .append("<br>");

        }

        elem.find(".window--input").on("input", e => {

            styleEditorChange(e.currentTarget);

        });

        elem.append($("<span></span>").text("+").addClass("styleEditor--add").on("click", e => { styleEditorAdd(_style); }));

    });

}
function styleEditorAdd(style) {

   settings.style[style].push(["",""]);

   updateSettingsStyleEditor();

}
function styleEditorRemove(style, i) {

    settings.style[style].pop(i);

    updateSettingsStyleEditor();

}
function styleEditorChange(elem) {

    const $elem = $(elem);
    const forstyle = $elem.parent().attr("for");
    const index = $elem.attr("index");
    const spacing = true;

    if ($elem.attr("styletype") == "key") {

        settings.style[forstyle][index][0] = $elem.val();

    } else {

        settings.style[forstyle][index][1] = $elem.val();

    }

    styleEditorUpdateAll();

}
function styleEditorUpdateAll() {

    const spacing = true;
    let text = "";

    for (const i in settings.style) {

        const style = settings.style[i];

        let query = "syntax."+ i;
        if      (i == "background")   query = "body";
        else if (i == "text")         query = "#editor--display";
        else if (i == "path")         query = "#path";
        else if (i == "editor")       query = "#editor";
        else if (i == "filename")     query = ".file--name";
        else if (i == "nav")          query = "#nav";
        else if (i == "nav_selected") query = ".nav__selected, .nav--b:not(.disabled):hover";

        text += (spacing ? "        " : "") + query + " {" + (spacing ? "\n" : "");

        for (let i = 0; i < style.length; i++) {

            text += (spacing ? "            " : "") + style[i][0] + ": " + style[i][1] + ";" + (spacing ? "\n" : "");

        }

        text += (spacing ? "        " : "") + "}" + (spacing ? "\n" : "");

    }

    $("#style").html(text);

}
function center(elem) {

    const box = elem.getBoundingClientRect();

    elem.style.left = window.innerWidth / 2 - box.width / 2 + "px";
    elem.style.top = window.innerHeight / 2 - box.height / 2 + "px";

}
function openFind() {

    openWindow($(".window#find"));

    $("#find--error").hide().html("");

    if (editingFile) $("#find--this")[0].checked = true;
    else             $("#find--all")[0].checked = true;

}
function getCaretPos() {

    /*
    const selection = window.getSelection();
    if (selection.type != "Caret") console.warn(`The current selection type is ${selection.type}, not a caret`);

    const range = selection.getRangeAt(0);

    const temp = document.createElement("span");
    range.insertNode(temp);

    const box = temp.getBoundingClientRect();

    temp.remove();

    return {
        x : box.x,
        y : box.y
    }
    */

    const selection = window.getSelection();
    const range = selection.getRangeAt(0);

    const box = range.getBoundingClientRect();

    return {
        x: box.x,
        y: box.y
    }

}
function autoComplete(text) {

    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const node = document.createTextNode(text);

    range.insertNode(node);

    range.setStartAfter(node);
    range.setEndAfter(node);

    selection.removeAllRanges();
    selection.addRange(range);

    if (selection.anchorNode.parentNode.normalize) selection.anchorNode.parentNode.normalize();
    else console.warn("Browser does not support Node.normalize()");

    updateEditorDisplay();
    $("#editor--autocomplete").remove();

}
function parseStyle(text) {

    let readingStyle;

    for (let i = 0; i < text.length; i++) {

        if (text[i] == " " || text[i] == "\n") continue;
        else if (text[i] == "}") readingStyle = null;
        else if (!readingStyle && text[i].match(/[a-zA-Z#\.]/)) {

            readingStyle = text.substr(i).split(" ")[0].split("{")[0];
            i += text.substr(i+7).indexOf("{") + 8;

            if      (readingStyle.startsWith("syntax.")) readingStyle = readingStyle.substr(7);
            else if (readingStyle == "#editor--display") readingStyle = "text";
            else if (readingStyle == "body")             readingStyle = "background";
            else if (readingStyle == "#path")            readingStyle = "path";
            else if (readingStyle == ".file--name")      readingStyle = "filename";
            else if (readingStyle == "#nav")             readingStyle = "nav";
            else if (readingStyle == ".nav__selected, .nav--b:not(.disabled):hover") readingStyle = "nav_selected";

            settings.style[readingStyle] = [];

            cl(`Reading style: "${readingStyle}"`);

        }
        else if (readingStyle) {

            const key = text.substr(i, text.substr(i).indexOf(":"));
            const value = $.trim(text.substring(text.substr(i).indexOf(":")+1+i, text.substr(i).indexOf(";")+i));

            settings.style[readingStyle].push([key, value]);

            const oldI = i;

            i += text.substr(i).indexOf(";")+1;

            if (i <= oldI) {

                $("#settings--style--loadurl--error").css("visibility", "visible").text("There was an error loading the style");
                break;

            }

        }

    }

}
function setEditorText(text) {

    const $editor = $("#editor--input");
    const lines = text.split("\n");

    $editor.html("");

    for (let i = 0; i < lines.length; i++) {

        if (lines[i]) $editor.append($("<div></div>").text(lines[i]));
        else $editor.append($("<div></div>").html("<br>"));

    }

    updateEditorDisplay();

}
function getEditorText() {

    const $editor = $("#editor--input");
    const $children = $editor.children();
    let text = "";

    $children.each(function(index, elem) {

        text += (elem.innerText != "\n" ? elem.innerText : "") + (index == $children.length - 1 ? "" : "\n");

    });

    return text;

}
function openWindow($window) {

    $window.show().css("opacity", 1);    

    center($window[0]);

}
history.back = function() {

    if (history.length < 2) return;

    history.pop();
    const a = history.pop();

    a.open();

}
