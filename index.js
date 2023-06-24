const WARN = "#b96800";
const fileInput = document.querySelector("#file-input");
const fileClickInput = document.getElementById("file-click-input");
fileInput.addEventListener("dragenter", (_) => {
    fileInput.classList.add("dragging");
});
fileInput.addEventListener("dragleave", (_) => {
    fileInput.classList.remove("dragging");
});
fileInput.addEventListener("dragover", e => {
    e.preventDefault();
    e.stopPropagation();
});
fileInput.addEventListener("drop", e => {
    e.preventDefault();
    e.stopPropagation();
    loadFile(e.dataTransfer.files[0])
});

fileInput.addEventListener("click", e => {
    fileClickInput.click();
});
fileClickInput.addEventListener("change", e => {
    loadFile(e.target.files[0])
});

function escapeHTML(str){
    var p = document.createElement("p");
    p.appendChild(document.createTextNode(str));
    return p.innerHTML;
}

String.prototype.hashCode = function() {
  var hash = 0, i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

class GameInfo {
    version = "";
    build = "";
    platform = "Unknown (pirated?)";
    hmd = "Unknown";
    hmdModel = "Unknown";
    renderer = "Unknown";
    vram = "Unknown";
    driver = "Unknown";
    gameDir = ""
    mods = [];
    events = [];
    loadErrors = {};
    loadedDLLs = [];
    incompatibleMods = {};
    missingAddresses = []
    missingCatalogData = [];
    summaries = new Set();
    brokenMods = new Set();
}

let tags = {
    unmodded: { icon: "info-circle", text: "This exception traceback does not mention any modded code.<br><br>It may be a base-game issue, but more likely it's the game reacting poorly to something a mod has done." },
    modded: { icon: "plugin", text: "This exception likely comes from modded code." },
    harmony: { icon: "screw-driver", text: "This exception likely comes from code injected using Harmony." },
}

let summaries = {
    pirated: {
        cause: () => "You are running a pirated version of the game, and shouldn't expect mods to work.",
        solution: () => "Buy the game through Steam or Oculus.",
        color: "#883333"
    },
    incompatibleMods: {
        cause: () => "One or more of your mods is not compatible with your game version.",
        solution: () => "Head to the 'Incompatible Mods' section below to see which mods aren't up to date."
    },
    brokenMods: {
        cause: () => `The following mods encountered errors: <ul>${Array.from(gameInfo.brokenMods).map(mod => `<li>${mod}</li>`).join('')}</ul>`,
        solution: () => `<span>There are more details in the exception logs below; look for the <i class="icofont-plugin"></i> icon and contact the developer of the mod.<span><br>`
    }
}

function checkLine(string, regex, callback) {
    let match = string.match(regex);
    if (match) {
        callback(match.groups);
    }
}

let gameInfo = new GameInfo();

class MissingAddressError {
    constructor(id, type, requester, requesterType) {
        this.id = id;
        this.type = type;
        this.requester = requester;
        this.requesterType = requesterType;
    }
}

class MissingDataError {
    constructor(id, type) {
        this.id = id;
        this.type = type;
    }
}

class IncompatibleMod {
    constructor(mod, version, minVersion) {
        this.mod = mod;
        this.version = version;
        this.minVersion = minVersion;
    }
}

class LoadError {
    constructor(file, error) {
        this.file = file;
        this.error = error;
    }
}

class LoadedDLL {
    constructor(modFolder, dllName) {
        this.modFolder = modFolder;
        this.dllName = dllName;
    }
}

class GlobalEvent {
    constructor(text, description, color) {
        this.color = color ?? "#338833";
        this.text = text;
        this.description = description;
        this.eventType = "global";
    }

    render() {
        return `<div class="global event" style="background-color: ${this.color}">
                    <div class="event-title">${this.text}</div>
                    ${(this.description === undefined) ? '' : `<div class="event-details">${this.description}</div>`}
                </div>`
    }
}

class LogException {
    constructor(type, error, lines, tags, mods) {
        this.type = type;
        this.error = error;
        this.lines = lines;
        this.count = 0;
        this.eventType = "exception";
        this.tags = tags;
        this.mods = mods;
        this.extras = {
            'modded': `<br><span style="margin-bottom: 5px;">Possible causes:</span><br>${Array.from(this.mods).map(mod => ` - <span class="hover-mod-name">${mod}</span>`).join('<br>')}`
        }
    }

    render() {
        return `<div class="exception event" onclick="expandException(this)">
                    ${(this.count > 1) ? `<span class="dim count">${this.count}x</span>` : ""}
                    <span class="tags">
                    ${Array.from(this.tags).map(tag => `<i class="tag icofont-${tags[tag].icon}"><p>${tags[tag].text}${this.extras[tag] ? this.extras[tag] : ''}</p></i>`).join('')}
                    </span>
                    <div class="event-title">${this.type}</div>
                    ${(this.error) ? `<span class="exception-title">${this.error}</span>` : ''}
                    ${(this.lines.length > 0)
                        ? `<div class="event-details event-hidden">
                           <div class="exception-lines">${this.lines.map(line => line.render()).join("")}</div>
                           </div>`
                        : ''}
                </div>`
    }
}

class ExceptionLine {
    constructor(location, address, filename, line) {
        this.location = location;
        this.address = address;
        this.filename = filename;
        this.line = line;
        if (filename?.match(/<(.+)>/)) {
            this.filename = filename.match(/<(?<address>.+)>/).groups.address;
            this.line = -1;
        }
    }

    getPath() {
        const funcSig = this.location.match(/(?<func>.+?) ?\((?<args>.+)?\)/);
        if (funcSig) {
            const funcPart = [...funcSig.groups.func.matchAll(/<?(\w+)>?(?:[^. ()]+)?/g)].map(x => x[1] == 'ctor' ? '<span class="italic">constructor</span>' : `<span>${x[1]}</span>`).join(`<span class="dim"> > </span>`);
            let argsPart = [];
            if (funcSig.groups.args)
                argsPart = [...funcSig.groups.args.matchAll(/(?:([^`, ]+)[^, ]*( ([^`, ]+)[^ ,]*)?)/g)].map(x => x[1] + (x[2] ? x[2] : ''));
            let argsString = "";
            argsPart = argsPart.map(part => {
                let argPortions = [...part.split(' ')[0].matchAll(/(\w+(\.|\+|\\)?)/g)].map(x => x[1]);
                if (argPortions.length > 1) {
                    let portions = argPortions.slice(0, argPortions.length - 1).map(portion => `<span class="arg dim">${portion.replace(/\+|\\/, '.')}</span>`);
                    portions.push(`<span class="arg">${argPortions[argPortions.length - 1]}</span>`);
                    return portions.join('') + (part.split(' ').length > 1 ? ` <span>${part.split(' ')[1]}</span>` : '');
                } else {
                    return `<span class="arg">${argPortions[0]}</span>${part.split(' ').length > 1 ? ` <span>${part.split(' ')[1]}</span>` : ''}`
                }
            });
            argsPart = argsPart.map(x => x.replace(/(\.\w+)/g, `<span class="arg">$1</span>`));
            argsString = argsPart
                .map(part => `${part}`)
                .join(`<span class="dim">,</span>|`)
                .split('|')
                .map(part => `<span class="block">${part}</span>`)
                .join(' ');
            return `${funcPart} <span>(</span>${argsString}<span>)</span>`;
        }
        return this.location;
    }

    render() {
        return `<span class="dim">at </span><div class="exception-line">
                    <div class="exception-line-location" title="${this.address}">${this.getPath()}</div>
                    ${(this.filename != undefined && this.line >= 0)
                        ? (`<span><span class="prefix dim">=></span>
                            <span><span class="dim code">line</span> <span class="exception-line-line">${this.line}</span> <span class="dim code">of</span> </span><span class="exception-line-filename">${this.filename}</span>
                            </span>`)
                        : ""}
                </div>`
    }
}

class Block {
    constructor(string) {
        let isStackTrace = false;
        let isException = false;
        let exceptionType = "";
        let exceptionError = "";
        let exceptionLines = [];
        let exceptionIsModded = false;
        let exceptionTags = new Set();
        let modsMentioned = new Set();
        let isExceptionLine = false;
        let hasSeenExceptionLine = false;
        let bundleLoadErrors = {}
        for (let line of string.split("\r\n")) {
            line = line.replace(/\//g, '\\');
            isExceptionLine = false;
            checkLine(line, /Mono path\[0\] = '(?<path>.+)'$/, groups => {
                gameInfo.gameDir = groups.path;
            });
            checkLine(line, /Mono path\[0\] = '.+(Oculus)?\\Software.+/i, () => {
                gameInfo.platform = "Oculus";
            });
            checkLine(line, /Mono path\[0\] = '.+steamapps\\common.+/i, () => {
                gameInfo.platform = "Steam";
            });
            checkLine(line, /\(Filename: (?<filename>.+)? Line: (?<line>\d+)?\)/, groups => {
                this.filename = groups.filename;
                this.line = groups.line;
            });
            checkLine(line, /Game version: (?<version>.+)/, groups => {
                gameInfo.version = groups.version;
            });
            checkLine(line, /Initialize engine version: (?<version>.+)/, groups => {
                gameInfo.build = groups.version;
            });
            checkLine(line, /Loading plugin assembly .+BladeAndSorcery_Data\\StreamingAssets\\Mods\\(?<dirName>[^/\\]+)\\(.+\\)*(?<dllName>[^/\\]+).dll/, groups => {
                gameInfo.loadedDLLs.push(new LoadedDLL(groups.dirName, groups.dllName));
            });
            checkLine(line, /Device model : (?<model>.+)/, groups => {
                gameInfo.hmdModel = groups.model;
                if (groups.model == "Miramar")
                    gameInfo.hmdModel += " (Quest 2)";
            });
            checkLine(line, /HeadDevice: (?<model>.+)/, groups => {
                gameInfo.hmdModel = groups.model;
                if (groups.model == "Miramar")
                    gameInfo.hmdModel += " (Quest 2)";
            });
            checkLine(line, /LoadedDeviceName : (?<device>.+)/, groups => {
                gameInfo.hmd = groups.device;
            });
            checkLine(line, /Loader: (?<device>.+) \|/, groups => {
                gameInfo.hmd = groups.device;
            });
            checkLine(line, / +Renderer: +(?<gpu>.+)( \(ID=.+\))/, groups => {
                gameInfo.renderer = groups.gpu;
            });
            checkLine(line, / +VRAM: +(?<vram>\d+ MB)/, groups => {
                gameInfo.vram = groups.vram;
            });
            checkLine(line, / +Driver: +(?<driver>.+)/, groups => {
                gameInfo.driver = groups.driver;
            });
            checkLine(line, /JSON loader - Loading custom file: (?<modFolder>.+?)\\/, groups => {
                gameInfo.mods.push(groups.modFolder);
                gameInfo.mods = [...new Set(gameInfo.mods)];
            });
            checkLine(line, /Crash!!!/, () => {
                gameInfo.events.push(new GlobalEvent("Hard crash!", "Check the log for stack traces.<br>This is likely an underlying problem with your PC, or GPU drivers.", WARN))
            });
            checkLine(line, /^(?<exceptionType>\w*Exception)(: (?<error>.+))?$/, groups => {
                isException = true;
                exceptionType = groups.exceptionType;
                exceptionError = groups.error;
                exceptionTags = new Set();
                modsMentioned = new Set();
                exceptionLines = [];
                exceptionIsModded = false;
                isExceptionLine = true;
                hasSeenExceptionLine = false;
            });
            checkLine(line, /Number of parameters specified does not match the expected number./, () => {
                isException = true;
                exceptionType = "Incorrect Parameter Count";
                exceptionError = "Number of parameters specified does not match the expected number.";
                exceptionTags = new Set();
                modsMentioned = new Set();
                exceptionLines = [];
                exceptionIsModded = false;
                isExceptionLine = true;
                hasSeenExceptionLine = false;
            });
            checkLine(line, /Unable to open archive file: (?<file>.+StreamingAssets\\Mods\\(?<mod>.+)(\\.+)?\\(?<bundle>.+).bundle)/, groups => {
                if (!gameInfo.loadErrors[groups.mod]) {
                    gameInfo.loadErrors[groups.mod] = [];
                }
                gameInfo.loadErrors[groups.mod].push(new LoadError(groups.bundle + '.bundle', `Unable to open archive file: <pre class="directory">${groups.file}</pre><br>This is a mod installation issue, so try re-installing. It can also happen if you use Vortex and forget to enable and deploy your mods.`));
            });
            checkLine(line, /^  at (\(wrapper (managed-to-native|dynamic-method)\) )?(?<location>.+\(.*\)) ?(\[(?<address>0x[a-zA-Z0-9]+)\] in (?<filename>.+):(?<line>\d+))?/, groups => {
                if (isException) {
                    exceptionLines.push(
                        new ExceptionLine(
                            groups.location,
                            groups.address,
                            groups.filename,
                            groups.line));
                    if (groups.location.match(/__instance|Prefix|Postfix/))
                        exceptionTags.add("harmony");
                    if (!groups.location.match(/^(ThunderRoad|Unity|DelegateList|ONSPAudioSource|SteamVR|OVR|OculusVR|System|\(wrapper|Valve|delegate|MonoBehaviourCallbackHooks)/)) {
                        let match = groups.location.match(/^(?<namespace>(\w|\+)+)\./)
                        if (match != null)
                            modsMentioned.add(match.groups.namespace);
                        else
                            console.log(groups.location);
                        exceptionIsModded = true;
                    }
                    isExceptionLine = true;
                    hasSeenExceptionLine = true;
                }
            });
            checkLine(line, /Mod (?<mod>.+) for \((?<version>.+)\) is not compatible with current min mod version (?<minVersion>.+)/, groups => {
                gameInfo.incompatibleMods[groups.mod] = new IncompatibleMod(groups.mod, groups.version, groups.minVersion);
                gameInfo.summaries.add("incompatibleMods");
            });
            checkLine(line, /LoadJson : Cannot read file (?<file>(?<modFolder>.+?)\\.+) \((?<error>.+)\)/, groups => {
                if (!gameInfo.loadErrors[groups.modFolder]) {
                    gameInfo.loadErrors[groups.modFolder] = [];
                }
                gameInfo.loadErrors[groups.modFolder].push(new LoadError(groups.file, groups.error));
            });
            checkLine(line, /Address \[(?<id>.+?)\] not found for object \[(?<object>.+?)( \((?<type>.+)\))?\]/, groups => {
                gameInfo.missingAddresses.push(new MissingAddressError(groups.id, "", groups.object, groups.type ?? ""));
            });
            checkLine(line, /Data \[(?<id>.+?) \| -?\d+\] of type \[(?<dataType>.+?)\] cannot be found in catalog/, groups => {
                if (groups.id != "null")
                    gameInfo.missingCatalogData.push(new MissingDataError(groups.id, groups.dataType));
            });
            checkLine(line, /Content catalog loaded/, () => {
                gameInfo.events.push(new GlobalEvent("Catalog Loaded"));
            });
            checkLine(line, /Master level loaded/, () => {
                gameInfo.events.push(new GlobalEvent("Master level loaded"));
            });
            checkLine(line, /Game loaded/, () => {
                gameInfo.events.push(new GlobalEvent("Game loaded"));
            });
            checkLine(line, /Player take possession of/, () => {
                gameInfo.events.push(new GlobalEvent("Player possessed creature"));
            });
            checkLine(line, /Load level (?<level>\w+)/, (groups) => {
                gameInfo.events.push(new GlobalEvent(`Loaded level ${groups.level}`));
            });
            checkLine(line, /Game is quitting/, () => {
                gameInfo.events.push(new GlobalEvent('Game is quitting'));
            });
            checkLine(line, /The AssetBundle 'StreamingAssets\\Mods\\(?<modFolder>[^\\]+)\\(?<bundleName>.+).bundle' (?<reason>.+)/, groups => {
                if (!gameInfo.loadErrors[groups.modFolder]) {
                    gameInfo.loadErrors[groups.modFolder] = [];
                }
                gameInfo.loadErrors[groups.modFolder].push(new LoadError(groups.bundleName + '.bundle', "Bundle " + groups.reason));
            });
            checkLine(line, /CRC Mismatch. Provided .+, calculated .+ from data. Will not load AssetBundle '(?<bundleName>.+).bundle'/, groups => {
                bundleLoadErrors[groups.bundleName] = "CRC mismatch in Asset Bundle. This is a problem with your installation, delete and fully re-install the mod.";
            });
            checkLine(line, /Invalid path in AssetBundleProvider: '(.+\\StreamingAssets\\Mods\\(?<modFolder>[^\\]+)\\(?<bundleName>.+))\.bundle'\.$/, groups => {
                if (!gameInfo.loadErrors[groups.modFolder]) {
                    gameInfo.loadErrors[groups.modFolder] = [];
                }
                if (gameInfo.loadErrors[groups.modFolder].find(elem => elem.file) == undefined)
                    gameInfo.loadErrors[groups.modFolder].push(new LoadError(groups.bundleName + '.bundle', bundleLoadErrors[groups.bundleName] ?? "Could not load asset bundle."));
            });
            checkLine(line, /Unable to find asset at ress?ource location \[(?<location>.+)\] of type \[(?<dataType>.+)\] for object \[(?<requester>.+) \((?<requesterType>.+)\)\]/, groups => {
                gameInfo.missingAddresses.push(new MissingAddressError(groups.location, groups.dataType, groups.requester, groups.requesterType))
            });
            if (isException && !isExceptionLine && hasSeenExceptionLine) {
                exceptionTags.add(exceptionIsModded ? "modded" : "unmodded");
                Array.from(modsMentioned).forEach(mod => gameInfo.brokenMods.add(mod));
                if (exceptionIsModded)
                    gameInfo.summaries.add("brokenMods");
                gameInfo.events.push(new LogException(exceptionType, exceptionError, exceptionLines, exceptionTags, modsMentioned));
                isException = false;
            }
            checkLine(line, /========== OUTPUTTING STACK TRACE ==================/, () => {
                isStackTrace = true;
            });
        }
        if (isException) {
            exceptionTags.add(exceptionIsModded ? "modded" : "unmodded");
            Array.from(modsMentioned).forEach(mod => gameInfo.brokenMods.add(mod));
            if (exceptionIsModded)
                gameInfo.summaries.add("brokenMods");
            gameInfo.events.push(new LogException(exceptionType, exceptionError, exceptionLines, exceptionTags, modsMentioned));
        }
    }
}

function checkExceptionDupes() {
    const collapsedEvents = [];
    let lastEvent = null;
    let lastEventHash = "";
    gameInfo.events.forEach(event => {
        if (event.eventType == "exception") {
            const json = JSON.stringify(event);
            if (json != lastEventHash) {
                lastEventHash = json;
                lastEvent = event;
                lastEvent.count = 0;
                collapsedEvents.push(event);
            } else {
                lastEvent.count++;
            }
        } else {
            collapsedEvents.push(event);
            lastEventHash = "";
        }
    });
    gameInfo.events = collapsedEvents;
}

function loadFile(file) {
    const reader = new FileReader();
    gameInfo = new GameInfo();
    reader.readAsText(file);
    reader.onload = () => analyseFile(reader.result);
}

function analyseFile(log) {
    const blocks = [];
    for (const block of log.split("\r\n\r\n")) {
        blocks.push(new Block(block));
    }
    checkExceptionDupes();
    display();
}

const infoSpans = {
    version: document.querySelector(".game-info#version"),
    build: document.querySelector(".game-info#build"),
    platform: document.querySelector(".game-info#platform"),
    hmd: document.querySelector(".game-info#hmd"),
    hmdModel: document.querySelector(".game-info#model"),
    renderer: document.querySelector(".game-info#renderer"),
    vram: document.querySelector(".game-info#vram"),
    driver: document.querySelector(".game-info#driver"),
}

function display() {
    document.getElementById("output").classList.remove("hidden");
    displayInfo();
    displayMods();
    displayOldMods();
    displayLoadErrors();
    displayMissingCatalogData();
    displayMissingAddresses();
    displayExceptions();
    displayEvents();
    displaySummary();
}

function displayInfo() {
    for (key of Object.keys(infoSpans)) {
        infoSpans[key].innerHTML = gameInfo[key];
        infoSpans[key].style.display = "inline-block";
    }
    document.querySelector('#directory').innerHTML = gameInfo.gameDir;
}

function displayMods() {
    if (gameInfo.mods.length == 0) {
        document.querySelector('#mods').innerHTML = `<div class="dim italic">No mods installed.</div>`;
        return;
    }
    document.querySelector('#mods').innerHTML = gameInfo.mods.map(
        mod => `<span class="mod">${mod}</span>`
    ).join('');
}

function displayOldMods() {
    if (Object.values(gameInfo.incompatibleMods).length == 0) {
        document.querySelector('#incompatible-mods').innerHTML = `<div class="dim italic">No incompatible mods.</div>`;
        return;
    }
    document.querySelector('#incompatible-mods').innerHTML = Object.values(gameInfo.incompatibleMods).map(
        data => `<div class="incompatible-mod missing-data-item">${data.mod}<span class="dim normal line-left">mod v${data.version}, needs v${data.minVersion}</span></div>`
    ).join('');
}

function displayLoadErrors() {
    if (Object.keys(gameInfo.loadErrors).length == 0) {
        document.querySelector('#load-errors').innerHTML = `<div class="dim italic">No mod load errors.</div>`;
        return;
    }
    document.querySelector('#load-errors').innerHTML = Object.keys(gameInfo.loadErrors).map(
        key => `<div class="load-error-category">
        <h3 class="load-error-name" onclick="expandLoadErrorCategory(this)"><span class="load-error-count">${gameInfo.loadErrors[key].length}</span>${key}</h3>
            <div class="load-error-list">
                ${gameInfo.loadErrors[key].map(error => `<div class="load-error" onclick="expandLoadError(this)">
                    <span class="load-error-file">${error.file.replace(/\\/g, `<span class="dim"> > </span>`)}</span>
                    <span class="load-error-error">${error.error}</span></div>`).join("")}
            </div>
        </div>`
    ).join('');
}

function displayMissingAddresses() {
    document.querySelector('#missing-addresses').innerHTML = "<tr><th>Address / Location</th><th>Type</th><th>Requester</th><th>Requester Type</th></tr>" + 
        gameInfo.missingAddresses.map(
            data => `<tr class="missing-address-row"><td class="code">${data.id}</td><td class="dim code">${data.type}</td><td class="dim code">${data.requester}</td><td class="dim code">${data.requesterType}</td></tr>`
        ).join('');
}

function displayMissingCatalogData() {
    document.querySelector('#missing-data').innerHTML = "<tr><th>Catalog ID</th><th>Type</th></tr>" + 
        gameInfo.missingCatalogData.map(
            data => `<tr><td class="code">${data.id}</td><td class="code dim">${data.type}</td></tr>`
        ).join('');
}

function displayExceptions() { }
function displayEvents() {
    document.querySelector('#events').innerHTML = gameInfo.events
        .map(event => event.render())
        .join('');
}

function displaySummary() {
    if (gameInfo.platform == "Unknown (pirated?)") gameInfo.summaries.add("pirated");
    if (gameInfo.summaries.size == 0) {
        document.querySelector('#summary').innerHTML = `<div class="dim italic">No summaries available.</div>`
        return;
    }
    document.querySelector('#summary').innerHTML = Array
        .from(gameInfo.summaries)
        .map(tag =>
        `<div class="summary-item" style="background-color: ${summaries[tag].color ?? "#4a4a5a"}">
            <i class="icofont-exclamation-circle summary-icon"></i>
            <div class="cause">${summaries[tag].cause()}</div>
            <div class="solution"><span class="dim">Solution:</span><span>${summaries[tag].solution()}</span></div>
        </div>`)
        .join('');
}

function expandException(elem) {
    let error = elem.querySelector(".event-details");
    if (error == null)
        return;
    if (!error.classList.contains("event-hidden")) {
        error.classList.add("event-hidden");
    } else {
        error.classList.remove("event-hidden");
    }
}

function expandLoadErrorCategory(elem) {
    let error = elem.parentElement.querySelector(".load-error-list");
    if (!error.classList.contains("category-expanded")) {
        error.classList.add("category-expanded");
    } else {
        error.classList.remove("category-expanded");
    }
}

function expandLoadError(elem) {
    let error = elem.querySelector(".load-error-error");
    if (!error.classList.contains("expanded")) {
        error.classList.add("expanded");
    } else {
        error.classList.remove("expanded");
    }
}
