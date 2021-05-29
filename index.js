const fileInput = document.querySelector("#file-input");
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

class GameInfo {
    version = "";
    build = "";
    platform = "Unknown (pirated)?";
    hmd = "";
    hmdModel = "";
    mods = [];
    events = [];
    loadErrors = {};
}

function checkLine(string, regex, callback) {
    let match = string.match(regex);
    if (match) {
        callback(match.groups);
    }
}

let gameInfo = new GameInfo();

class LoadError {
    constructor(file, error) {
        this.file = file;
        this.error = error;
    }
}

class GlobalEvent {
    constructor(text) {
        this.text = text;
    }

    render() {
        return `<div class="global event">${this.text}</div>`
    }
}

class LogException {
    constructor(type, error, lines) {
        this.type = type;
        this.error = error;
        this.lines = lines;
    }

    render() {
        return `<div class="exception event">${this.type}</div>`
    }
}

class ExceptionLine {
    constructor(location, address, filename, line) {
        this.location = location;
        this.address = address;
        this.filename = filename;
        this.line = line;
    }
}

class Block {
    constructor(string) {
        let isException = false;
        let exceptionType = "";
        let exceptionError = "";
        let exceptionLines = [];
        for (let line of string.split("\r\n")) {
            checkLine(line, /Mono path\[0\] = '.+Oculus\/Software.+/, () => {
                gameInfo.platform = "Oculus";
            });
            checkLine(line, /Mono path\[0\] = '.+steamapps\/common.+/, () => {
                gameInfo.platform = "Steam";
            });
            checkLine(line, /\(Filename: (?<filename>.+)? Line: (?<line>\d+)?\)/, groups => {
                this.filename = groups.filename;
                this.line = groups.line;
            });
            checkLine(line, /Game version: (?<version>.+) \[(?<build>.+)\]/, groups => {
                gameInfo.version = groups.version;
                gameInfo.build = groups.build;
            });
            checkLine(line, /Device model : (?<model>.+)/, groups => {
                gameInfo.hmdModel = groups.model;
                if (groups.model == "Miramar")
                    gameInfo.hmdModel += " (Quest 2)";
            });
            checkLine(line, /LoadedDeviceName : (?<device>.+)/, groups => {
                gameInfo.hmd = groups.device;
            });
            checkLine(line, /JSON loader - Found custom file: (?<modFolder>.+?)\\/, groups => {
                gameInfo.mods.push(groups.modFolder);
                gameInfo.mods = [...new Set(gameInfo.mods)];
            });
            checkLine(line, /(?<exceptionType>\w*Exception): (?<error>.+)/, groups => {
                isException = true;
                exceptionType = groups.exceptionType;
                exceptionError = groups.error;
            });
            checkLine(line, /  at (?<location>.+?) \[(?<address>0x[a-zA-Z0-9]+)\] in (?<filename>.+):(?<line>\d+)/, groups => {
                if (isException) {
                    exceptionLines.push(
                        new ExceptionLine(
                            groups.location,
                            groups.address,
                            groups.filename,
                            groups.line));
                }
            });
            checkLine(line, /loadMods : Cannot read file (?<file>(?<modFolder>.+?)\\.+) \((?<error>.+)\)/, groups => {
                if (!gameInfo.loadErrors[groups.modFolder]) {
                    gameInfo.loadErrors[groups.modFolder] = [];
                }
                gameInfo.loadErrors[groups.modFolder].push(new LoadError(groups.file, groups.error));
            });
            checkLine(line, /Content catalog loaded/, () => {
                gameInfo.events.push(new GlobalEvent("Catalog Loaded"));
            });
            checkLine(line, /Master level loaded/, () => {
                gameInfo.events.push(new GlobalEvent("Master level loaded"));
            });
            checkLine(line, /Player take possession of/, () => {
                gameInfo.events.push(new GlobalEvent("Player possessed creature"));
            });
            checkLine(line, /Load level (?<level>\w+)/, (groups) => {
                gameInfo.events.push(new GlobalEvent(`Loaded level ${groups.level}`));
            });
        }
        if (isException)
            gameInfo.events.push(new LogException(exceptionType, exceptionError, exceptionLines));
    }
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
    console.log(gameInfo);
    display();
}

const infoSpans = {
    version: document.querySelector(".game-info#version"),
    build: document.querySelector(".game-info#build"),
    platform: document.querySelector(".game-info#platform"),
    hmd: document.querySelector(".game-info#hmd"),
    hmdModel: document.querySelector(".game-info#model")
}

function display() {
    document.getElementById("output").classList.remove("hidden");
    displayInfo();
    displayMods();
    displayLoadErrors();
    displayExceptions();
    displayEvents();
}

function displayInfo() {
    for (key of Object.keys(infoSpans)) {
        infoSpans[key].innerHTML = gameInfo[key];
        infoSpans[key].style.display = "inline-block";
    }
}

function displayMods() {
    document.querySelector('#mods').innerHTML = gameInfo.mods.map(
        mod => `<span class="mod">${mod}</span>`
    ).join('');
}

function displayLoadErrors() {
    document.querySelector('#load-errors').innerHTML = Object.keys(gameInfo.loadErrors).map(
        key => `<div class="load-error-category">
        <h3 class="load-error-name" onclick="expandLoadErrorCategory(this)"><span class="load-error-count">${gameInfo.loadErrors[key].length}</span>${key}</h3>
            <div class="load-error-list">
                ${gameInfo.loadErrors[key].map(error => `<div class="load-error" onclick="expandLoadError(this)">
                    <span class="load-error-file">${error.file.replace(/\\/g, " > ")}</span>
                    <span class="load-error-error">${error.error}</span></div>`).join("")}
            </div>
        </div>`
    ).join('');
}

function displayExceptions() { }
function displayEvents() {
    document.querySelector('#events').innerHTML = gameInfo.events
        .map(event => event.render())
        .join('');
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

/*

const exceptionsByTypeCtx = document.getElementById('exception-types').getContext('2d');
const exceptionsByType = new Chart(exceptionsByTypeCtx, {
    type: 'doughnut',
    data: {
        labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
        datasets: [{
            label: '# of Votes',
            data: [12, 19, 3, 5, 2, 3],
            backgroundColor: [
                'rgba(255, 99, 132, 0.2)',
                'rgba(54, 162, 235, 0.2)',
                'rgba(255, 206, 86, 0.2)',
                'rgba(75, 192, 192, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(255, 159, 64, 0.2)'
            ],
            borderColor: [
                'rgba(255, 99, 132, 1)',
                'rgba(54, 162, 235, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 159, 64, 1)'
            ],
            borderWidth: 1
        }]
    },
    options: {
        scales: {
            y: {
                beginAtZero: true
            }
        }
    }
});

const exceptionsByModsCtx = document.getElementById('exception-mods').getContext('2d');
const exceptionsByMods = new Chart(exceptionsByModsCtx, {
    type: 'doughnut',
    data: {
        labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
        datasets: [{
            label: '# of Votes',
            data: [12, 19, 3, 5, 2, 3],
            backgroundColor: [
                'rgba(255, 99, 132, 0.2)',
                'rgba(54, 162, 235, 0.2)',
                'rgba(255, 206, 86, 0.2)',
                'rgba(75, 192, 192, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(255, 159, 64, 0.2)'
            ],
            borderColor: [
                'rgba(255, 99, 132, 1)',
                'rgba(54, 162, 235, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 159, 64, 1)'
            ],
            borderWidth: 1
        }]
    },
    options: {
        scales: {
            y: {
                beginAtZero: true
            }
        }
    }
});
*/
