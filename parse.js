// https://coolors.co/333344-45cb85-ff4f79-1e91d6-f4ac45

const containers = {
  mods: document.querySelector("#mod-list"),
};

const PROGRESS_READ = 50;
const PROGRESS_FINISH = 30;
const PROGRESS_SORT = 10;

const LOG_REGEX =
  /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2}).(?<microsecond>\d+) +(?<level>[A-Z]+) .+?: /;
const XML_REGEX = /<\\*color.*?>/g;

const IGNORED_ARGS = [
  "Newtonsoft.",
  "ThunderRoad.",
  "Collections.",
  "Generic.",
  "UnityEngine.",
  "System.",
  "ResourceManagement.",
  "AsyncOperations.",
  "StateTracker.",
];

const TAG_ICONS = {
  dll: "plugin",
  pdb: "search-2",
  harmony: "screw-driver"
}

const COMMON_NAMESPACES = {
  TOR: "TheOuterRim"
}

const SUGGESTIONS = {
  "delete-save": {
    title: "Delete your save file.",
    description: `Go to ${code(
      "Documents/My Games/Blade & Sorcery/Saves/Default"
    )} and delete all files present there.`,
  },
  "check-dll": {
    title: "Check your scripted mods for missing DLL files.",
    description:
      "Sometimes, antivirus software can treat DLL files (which is where mod scripting and logic lives) as suspicious files. " +
      "Double-check that your scripted mods each contain a .dll file.",
    cols: ["mod", "possible_missing_dll_name"],
  },
  "missing-method": {
    title:
      "Ensure your mods are up to date, or remove ones that aren't yet updated.",
    description:
      "One of your mods attempted to run code that doesn't exist in the version of the game you are running.<br>" +
      "This may be because a minor version update broke it - e.g. if the mod worked on 12.2, but you updated to 12.3.",
    cols: ["mods", "method"],
  },
  pirated: {
    title:
      icon("warning") +
      "Buy Blade and Sorcery legitimately on Steam or Oculus." +
      icon("warning"),
    description:
      "<strong>Do not ask for help with modding if you own an illegitimate copy of the game.</strong><br>" +
      "If you have pirated the game you should <em>not</em> expect mods to work.",
  },
  incompatible: {
    title:
      "Make sure you have installed mods that are for the correct version of the game.",
    description:
      "One or more of your mods is not for this version of the game. They have not been loaded.",
  },
};

const EXCEPTIONS = {
  NullReferenceException:
    "This exception is thrown when a property or method is accessed on a null object.",
  ArgumentOutOfRangeException:
    "This exception is thrown when an argument to a method is outside the allowed range of values.",
  DllNotFoundException:
    "This exception is thrown when a referenced DLL cannot be found.",
};

const EXCEPTION_TAGS = {
  unmodded: {
    icon: "info-circle",
    text: "This exception traceback does not mention any modded code.<br><br>It may be a base-game issue, but more likely it's the game reacting poorly to something a mod has done.",
  },
  modded: {
    icon: "plugin",
    text: "This exception likely comes from modded code.",
  },
  harmony: {
    icon: "screw-driver",
    text: "This exception likely comes from code injected using Harmony, and is NOT a base-game issue.",
    extra: () =>
      "Possible causes:<br>" +
      game.mods
        .filter((mod) => mod.tags.has("harmony"))
        .map((mod) => span(" - " + mod.name, "hover-mod-name"))
        .join("<br>"),
  },
};

const ARG_REPLACEMENTS = {
  boolean: "bool",
  single: "float",
  string: "string",
  int32: "int",
};

const capitals = ["dll", "json", "id", "gpu", "vram", "hmd"];

String.prototype.hashCode = function () {
  var hash = 0,
    i,
    chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr = this.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

const fileInput = document.querySelector("#file-input");
const fileClickInput = document.getElementById("file-click-input");
const statusDiv = document.getElementById("status")
const progressBar = document.getElementById("progress-bar")
fileInput.addEventListener("dragenter", (_) => {
  fileInput.classList.add("dragging");
});
fileInput.addEventListener("dragleave", (_) => {
  fileInput.classList.remove("dragging");
});
fileInput.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
});
fileInput.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();
  loadFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("click", (e) => {
  fileClickInput.click();
});
fileClickInput.addEventListener("change", async (e) => {
  await loadFile(e.target.files[0]);
});

var lastBreak = Date.now()

let takeABreak = () => new Promise((resolve) => setTimeout(resolve));
let startTime = Date.now();

async function maybeTakeABreak() {
  let date = Date.now();
  let delay = ((date - startTime) / 10000) * 100;
  if (date - delay > lastBreak) {
    lastBreak = Date.now();
    await takeABreak();
  }
}

async function readFileText(file) {
  return new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsText(file);
    reader.onload = () => {
      resolve(reader.result);
    }
  });
}

async function sleep(duration) {
  await new Promise(resolve => setTimeout(() => resolve(), duration))
}

function hideStatus() {
  statusDiv.style.display = "none";
}
function setStatus(text) {
  statusDiv.style.display = "block";
  statusDiv.innerText = text + (text.endsWith('%') ? '' : "...");
}

function setProgress(amount) {
  if (amount == 0) progressBar.style.opacity = 1;
  if (amount == 100) progressBar.style.opacity = 0;
  progressBar.style.maxWidth = amount + '%';
}

function cleanup() {
  containers.mods.replaceChildren([]);
  document.querySelector("#mod-details").innerHTML = "";
}

async function loadFile(file) {
  startTime = Date.now();
  cleanup();
  document.querySelector(".help").style.opacity = 0;
  setTimeout(() => {
    document.querySelector(".help").style.maxHeight = 0;
    document.querySelector(".help").style.marginBottom = 0;
    document.querySelector("main").style.maxWidth = "100vw";
    document.querySelector("h1").style.display = "none";
    document.querySelector("#file-input").style.display = "none";
  }, 200);
  setProgress(0);
  let lines = await readFileText(file);
  lines = lines.replace(/\r\n/g, "\n")
    .split(/\n/)
    .map((line) =>
      line.replace(/^\d+-\d+-\d+T\d+:\d+:\d+\.\d+: [A-Z]+ .+? *: /g, "")
        .replace(/^\d+-\d+-\d+T\d+:\d+:\d+\.\d+ \d+:\d+:\d+.\d+\s+\d+\s+\d+ [A-Z] Unity\s+: /g, "")
      // 2023-11-19T01:45:22.635 INFO UnityEngine.SetupCoroutine.InvokeMoveNext       : Load options...
    );
  setStatus("Parsing log lines")
  await parse(lines);
  setStatus("Sorting mods")
  await game.sort();
  setStatus("Rendering page")
  setProgress(PROGRESS_FINISH + PROGRESS_READ + PROGRESS_SORT);
  await game.render();
  hideStatus();
  setProgress(100);
}

function niceify(string) {
  return string
    .replace(/_/g, " ")
    .replace(/(\d+),(\d+)/g, "$1.$2")
    .split(" ")
    .map((word) =>
      capitals.includes(word.toLowerCase())
        ? word.toUpperCase()
        : word[0].toUpperCase() + word.substr(1)
    )
    .join(" ");
}

function slugify(string) {
  return string
    .replace(/[_ ]/g, "-")
    .replace(/[^\w-]/g, "")
    .toLowerCase();
}

function renderValue(value) {
  switch (typeof value) {
    case "function":
      return renderValue(value());
    case "string":
      return value.match(/^[A-Z]:[\/\\]/) ||
        (!value.match(/ /) && value.match(/\./))
        ? code(value)
        : value.replace(/(\d+),(\d+)/g, "$1.$2");
    case "object":
      if (Array.isArray(value)) {
        return value.map(renderValue).join(", ");
      }
      return code(JSON.stringify(value, undefined, " "));
  }
  return value;
}

function expandException(elem) {
  let error = elem.querySelector(".event-details");
  if (error == null) return;
  if (!error.classList.contains("event-hidden")) {
    error.classList.add("event-hidden");
  } else {
    error.classList.remove("event-hidden");
  }
}

function clickButton(id) {
  let target = game.selectors[id].call(game);
  let text, callback;
  if (Array.isArray(target)) {
    [text, callback] = target;
  } else {
    text = target;
  }
  document
    .querySelectorAll("#mod-list > .mod")
    .forEach((elem) => elem.classList.remove("selected"));
  document.querySelector("#" + id).classList.add("selected");
  document.querySelector("#mod-details").innerHTML = text;
  if (callback)
    callback();
}

function objectToTable(obj, title, includeEmpty = true) {
  return (
    (title ? heading(title) : "") +
    '<table class="auto-table">' +
    Object.entries(obj)
      .map(([key, value]) =>
        includeEmpty || (value != "" && value != null && value != undefined)
          ? `<tr><td>${niceify(key)}</td><td>${renderValue(value)}</td></tr>`
          : ""
      )
      .join("") +
    "</table>"
  );
}

function objectListToTable(list, keys, title, note) {
  if (!list || list.length == 0) return "";
  keys ??= list.length > 0 ? [...Object.keys(list[0])] : [];
  return (
    (title ? heading(title) : "") +
    (note ? `<span class="dim italic">${note}</span>` : "") +
    '<table class="auto-table">' +
    `<tr>${keys.map((key) => `<th>${niceify(key)}</th>`).join("")}</tr>` +
    list
      .map(
        (obj) =>
          `<tr>${keys
            .map((key) => `<td>${renderValue(obj[key])}</td>`)
            .join("")}</tr>`
      )
      .join("") +
    "</table>"
  );
}

function heading(text, level = 2) {
  return `<h${level}>${text}</h${level}>`;
}

function screenshot(event, element, title) {
  event.preventDefault();
  event.stopPropagation();
  if (element.querySelector(".event-hidden")) {
    expandException(element);
  }
  html2canvas(element
  //  , {
  //  ignoreElements: element => {
  //    try {
  //    element.style.transition = "";
  //    } catch {}
  //    return true;
  //  }
  //}
  ).then((canvas) => {
    canvas.toBlob(function (blob) {
      saveAs(blob, `${title}.png`);
    });
  });
}

function code(string) {
  if (string.startsWith("<code>")) return string;
  return `<code>${string}</code>`;
}

function italic(string) {
  return `<span class="italic">${string}</span>`;
}

function bold(string) {
  return `<strong>${string}</strong>`;
}

function icon(name, tooltip, color) {
  return `<i class="pad icofont-${name}"${
    color ? ` style="color: ${color}` : ""
  }">${tooltip ? `<p>${tooltip}</p>` : ""}</i>`;
}

function hr() {
  return '<div class="hsep"></div>';
}

let createHR = () => createDiv("hsep");

function createElement(tag, classes, args, contents) {
  let element = document.createElement(tag);
  for (let eachClass of classes.split(" ")) {
    element.classList.add(eachClass);
  }
  if (args) {
    if (args.id) element.id = args.id;
    if (args.onclick) element.onclick = args.onclick;
  }
  if (contents != null && contents != undefined) {
    if (Array.isArray(contents)) {
      element.replaceChildren(...contents);
    } else {
      element.replaceChildren(contents);
    }
  }
  return element;

}

function createIcon(icon, classes) {
  return createElement("i", ["icofont-" + icon, ...classes.split(" ")].join(" "))
}

function createSpan(classes, args, contents) {
  return createElement("span", classes, args, contents);
}

function createDiv(classes, args, contents){
  return createElement("div", classes, args, contents);
}

function div(string, className) {
  return `<div${className ? ' class="' + className + '"' : ""}>${string}</div>`;
}

function span(string, className, params) {
  return `<span${
    className ? ' class="' + className + '"' : ""
  }${
    params ? Object.entries(params).map(([key, value]) => `${key}="${value}"`).join(" ") : ""
  }>${string}</span>`;
}

function emph(string) {
  return `<em>${string}</em>`;
}

function li(string) {
  return `<li>${string}</li>`;
}

function ul(elements) {
  return `<ul>${elements.map(li).join("")}</ul>`;
}

function wrapDetails(title, contents) {
  return `<div class="pad">
  ${heading(title)}
  ${contents}
  </div>`;
}

function replaceNamespaces(namespace) {
  return COMMON_NAMESPACES[namespace] ?? namespace;
}

function loadTimings() {
  let labels = [];
  let data = [];

  for (const [key, value] of Object.entries(game.timing)) {
    labels.push(key);
    data.push(value);
  }

  (async function () {
    new Chart(document.getElementById('timing'), {
      type: "doughnut",
      label: "Load times",
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
          },
        ],
      },
    });
  })();
}
class Game {
  constructor() {
    this.currentCount = 0;
    this.maxCount = 0;
    this.timing = {}
    this.mods = [];
    this.baseGame = null;
    this.exceptions = [];
    this.timeline = [];
    this.orphanExceptions = [];
    this.missingData = [];
    this.selectors = {};
    this.system = { game_directory: null, platform: null };
    this.suggestions = {};
    this.incompatibleMods = [];
    this.begun = false;
    this.lastEvent = null;
  }

  findOrCreateMod(name, folder) {
    let found = this.findModByName(name) ?? this.findModByFolder(folder);
    if (found) {
      if (folder && found.name == found.folder)
        found.folder = folder;
      return found;
    }
    let mod = new Mod(name, folder ?? name);
    game.mods.push(mod);
    return mod;
  }

  findModByName(name) {
    let found = this.mods.filter((mod) => mod.name == name);
    if (found.length > 0) return found[0];
    return null;
  }

  findModByFolder(folder) {
    let found = this.mods.filter((mod) => mod.folder == folder);
    if (found.length > 0) return found[0];
    return null;
  }

  findModByNamespace(namespace) {
    let found = this.mods.filter((mod) => mod.namespaces.has(namespace) || mod.folder == namespace);
    if (found.length > 0) return found[0];
    return null;
  }

  findModByAssembly(assembly) {
    let found = this.mods.filter(
      (mod) =>
        mod.assemblies.filter(
          (eachAssembly) => eachAssembly.dll == assembly + ".dll"
        ).length > 0
    );
    if (found.length > 0) return found[0];
    return null;
  }

  fuzzyFindMod(mod) {
    let search = game.modFinder.search(mod);
    if (search.length > 0) {
      return search[0].item;
    }
    return null;
  }

  findModByData(id, address) {
    if (address.startsWith("Bas.")) return game.baseGame;
    if (address.split(".").length >= 3) {
      let [author, mod, ...data] = address.split(".");
      if (id.split(".").length > 1) {
        id = id.split(".")[id.split(".").length - 1];
      }
      let results = this.modFinder.search(`'"${mod}"|'"${author}"`);
      results.forEach((result) => {});
      if (results.length > 0 && results[0].score < 0.2) {
        return results[0].item;
      }

      results = this.dataFinder.search(`'"${mod}" '"${author}" '"${id}"`);
      if (results.length > 0 && results[0].score < 0.2) {
        return this.findModByFolder(results[0].item.folder);
      }
    }
    if (id.split(".").length > 1) {
      id = id.split(".")[id.split(".").length - 1];
    }
    let data = this.dataFinder.search(id);
    if (data.length > 0) {
      return this.findModByFolder(data[0].item.folder);
    }
  }

  begin() {
    if (this.system.platform === null) {
      this.system.platform =
        icon("warning", undefined, "color-warning") + "Unknown - Pirated?";
      this.addSuggestion("pirated");
    }
    this.baseGame = new Mod("Base Game Errors", "N/A");
    this.begun = true;
    this.modFinder = new Fuse(this.mods, {
      keys: ["assemblies", "name", "folder", "author"],
      includeScore: true,
      useExtendedSearch: true,
    });
    this.dataFinder = new Fuse(
      this.mods.flatMap((mod) =>
        mod.json.map((json) => {
          return {
            name: json.file,
            authorFolder: mod.author + "." + mod.folder,
            folder: mod.folder,
          };
        })
      ),
      {
        keys: ["authorFolder", "author", "folder", "name"],
        includeScore: true,
        useExtendedSearch: true,
      }
    );
  }

  async incrementProgress() {
    this.currentCount++;
    setProgress(PROGRESS_READ + this.currentCount / this.maxCount * PROGRESS_FINISH)
    await maybeTakeABreak();
  }

  async finish() {
    game.system.installed_mods = this.mods.length;
    containers.mods.replaceChildren([]);
    containers.mods.appendChild(this.selector("System Info", this.renderGameInfo));
    clickButton("selector-system-info");
    this.maxCount =
      this.exceptions.length +
      this.mods.length +
      this.timeline.length +
      Object.keys(this.suggestions).length +
      this.missingData.length;
    setStatus(`Processing ${this.exceptions.length} exceptions`)
    for (const exception of this.exceptions) {
      exception.complete()
      await this.incrementProgress();
    }
    this.maxCount += this.orphanExceptions.length;
    setStatus(`Processing ${this.mods.length} mods`)
    game.baseGame.complete();
    for (const mod of this.mods) {
      mod.complete()
      await this.incrementProgress();
    }
    setStatus(`Collapsing ${this.suggestions.length} suggestions`)
    await this.collapseSuggestions();
    containers.mods.appendChild(
      this.selector(
        "Suggestions",
        this.renderSuggestions,
        [...Object.keys(this.suggestions)].length
      )
    );
    setStatus(`Creating timing section`);
    containers.mods.appendChild(
      this.selector("Load Timings", this.renderTimings)
    );
    setStatus(`Collapsing ${this.timeline.length} timeline events`)
    await this.collapseTimeline();
    containers.mods.appendChild(
      this.selector("Timeline", this.renderTimeline, this.timeline.length)
    );
    if (this.orphanExceptions.length > 0) {
      setStatus(`Collapsing ${this.orphanExceptions.length} orphan exceptions`);
      await this.collapseOrphanExceptions();
      containers.mods.appendChild(
        this.selector(
          "Orphan Exceptions",
          this.renderOrphanExceptions,
          this.orphanExceptions.length
        )
      );
    }

    setStatus(`Matching ${this.missingData.length} missing data entries with mods`)
    for (let data of this.missingData) {
      game.findModByData(data.id, data.address)?.missingData.push({
        address: data.address,
        id: data.id,
        type: data.type,
      });
      await this.incrementProgress();
    }

    console.log(game.timing);
  }

  async sort() {
    this.mods
      .sort((a, b) =>
        a.name.toLowerCase() < b.name.toLowerCase()
          ? -1
          : a.name.toLowerCase() > b.name.toLowerCase()
          ? 1
          : 0
      )
      .reverse();
    await maybeTakeABreak();
    this.mods
      .sort((a, b) =>
        (a.sortKey() < b.sortKey()) ? -1 : (a.sortKey() > b.sortKey() ? 1 : 0)
      )
      .reverse();
  }

  addSuggestion(tag, reason) {
    if (this.suggestions[tag] === undefined) {
      this.suggestions[tag] = [];
    }
    if (reason) this.suggestions[tag].push(reason);
  }

  addException(exception) {
    this.timeline.push(exception);
    this.exceptions.push(exception);
  }

  addTime(process, time) {
    if (process.endsWith("Game loaded")) return;
    this.timing[process] ??= 0;
    this.timing[process] += time;
  }

  addEvent(text, description, props, color) {
    let event = new TimelineEvent(text, description, props, color);
    this.lastEvent = event;
    this.timeline.push(event);
  }

  addIncompatibleMod(mod, version, minVersion) {
    this.incompatibleMods.push({ mod, version, min_version: minVersion });
  }

  async render() {
    for (let entry of [
      this.incompatibleMods.length > 0
        ? this.selector(
            "Incompatible Mods",
            this.renderIncompatibleMods,
            this.incompatibleMods.length
          )
        : null,
      this.baseGame?.renderList(true),
      createHR(),
    ].filter((elem) => elem != null)) {
      containers.mods.appendChild(entry);
    }
    for (let mod of this.mods) {
      containers.mods.appendChild(mod.renderList());
      await maybeTakeABreak();
    }
  }

  renderGameInfo() {
    return wrapDetails("System Info", objectToTable(this.system));
  }

  renderSuggestions() {
    return wrapDetails(
      "Suggestions",
      [
        ...Object.entries(this.suggestions).map(([tag, reasons]) =>
          this.renderSuggestion(SUGGESTIONS[tag], reasons)
        ),
      ].join(hr()),
      "pad"
    );
  }

  renderSuggestion(suggestion, reasons) {
    if (suggestion.cols) {
      return div(
        heading(suggestion.title, 3) +
          div(suggestion.description, "suggestion-text") +
          objectListToTable(reasons, suggestion.cols),
        "suggestion"
      );
    } else {
      return div(
        heading(suggestion.title, 3) +
          div(suggestion.description, "suggestion-text") +
          (reasons.length > 0 ? ul(reasons, "suggestion-reasons") : ""),
        "suggestion"
      );
    }
  }

  renderTimings() {
    return [div(`<canvas id="timing"></canvas>`), loadTimings];
  }

  renderOrphanExceptions() {
    return div(
      this.orphanCollapsed
        .map((exception) => exception.exception.render(exception.count))
        .join("")
    );
  }

  renderTimeline() {
    return div(this.timeline.map((value) => value.render()).join(""));
  }

  renderIncompatibleMods() {
    return wrapDetails(
      "Incompatible Mods",
      div(objectListToTable(this.incompatibleMods))
    );
  }

  selector(name, callback, count) {
    let slug = slugify(name);
    game.selectors[`selector-${slug}`] = () => callback.call(this);
    return createDiv("mod", {id: `selector-${slug}`, onclick: () => clickButton(`selector-${slug}`)},
      createDiv("mod-headers", {}, [
        createDiv("selector-title", {}, name),
        createDiv("mod-errors", {}, count > 0 ? createSpan("mod-error-count", {}, count) : null),
      ])
    );
  }

  async collapseSuggestions() {
    for (const tag of Object.keys(this.suggestions)) {
      this.suggestions[tag] = this.suggestions[tag].sort((a, b) => JSON.stringify(a) > JSON.stringify(b) ? 1 : -1);
      let newReasonList = [];
      let lastHash = "";
      this.suggestions[tag].forEach(reason => {
        const json = JSON.stringify(reason);
        if (json != lastHash) {
          lastHash = json;
          newReasonList.push(reason);
        }
      })
      this.suggestions[tag] = newReasonList;
      await this.incrementProgress();
    }
  }

  async collapseTimeline() {
    const collapsed = [];
    let lastEvent = null;
    let lastEventHash = "";
    for (const event of this.timeline) {
      if (event.eventType == "exception") {
        const json = JSON.stringify(event);
        if (json != lastEventHash) {
          lastEventHash = json;
          lastEvent = event;
          lastEvent.count = 1;
          collapsed.push(event);
        } else {
          lastEvent.count++;
        }
      } else {
        collapsed.push(event);
        lastEventHash = "";
      }
      await this.incrementProgress();
    }
    this.timeline = collapsed;
  }

  async collapseOrphanExceptions() {
    let collapsed = {};
    let keys = []
    for (const exception of this.orphanExceptions) {
      const hash = JSON.stringify(exception).hashCode();
      if (collapsed[hash]) {
        collapsed[hash].count++;
      } else {
        collapsed[hash] = { exception: exception, count: 1 };
        keys.push(hash);
      }
      await this.incrementProgress();
    }
    this.orphanCollapsed = keys.map(key => collapsed[key]);
  }
}

let game = new Game();

class Mod {
  constructor(name, folder) {
    this.name = name;
    this.folder = folder;
    this.assemblies = [];
    this.namespaces = new Set();
    this.catalogs = [];
    this.loadErrors = [];
    this.missingDLLs = [];
    this.missingData = [];
    this.exceptions = [];
    this.collapsed = [];
    this.overrides = [];
    this.json = [];
    this.tags = new Set();
  }

  complete() {
    this.collapseExceptions();
    if (
      this.assemblies.filter((assembly) => assembly.dll == "0Harmony.dll")
        .length > 0
    )
      this.tags.add("harmony");
  }

  counts() {
    return Object.entries({
      load: this.loadErrors.length,
      data: this.missingData.length,
      error: this.exceptions.length,
    }).map(([desc, num]) =>
      num > 0 ? `<span class="mod-error-count">${num} ${desc}</span>` : ""
    );
  }

  loadErrorCount() {
    let count = this.loadErrors.length + this.missingDLLs.length + this.missingData.length;
    return count > 0 ? createSpan("mod-error-count", {}, count) : "";
  }

  exceptionCount() {
    let count = this.exceptions.length;
    return count > 0 ? createSpan("mod-exception-count", {}, count) : "";
  }

  sortKey() {
    let value = this.loadErrors.length + this.missingDLLs.length + this.missingData.length + this.exceptions.length;
    return value;
  }

  renderList(bold) {
    let slug = slugify(this.folder);
    game.selectors[`mod-${slug}`] = () => this.renderDetails();
    return createDiv("mod", {id: `mod-${slug}`, onclick: () => clickButton(`mod-${slug}`)},
      createDiv("mod-headers", {}, [
        createDiv(bold ? "selector-title" : "mod-title", {}, [this.name, ...this.renderTags()]),
        createDiv("mod-errors", {}, [this.loadErrorCount(), this.exceptionCount()]),
      ])
    );
  }

  renderTags() {
    return Array.from(this.tags).map(tag => TAG_ICONS[tag] ? createIcon(TAG_ICONS[tag], 'tag-icon') : '');
  }

  collapseExceptions() {
    let collapsed = {};
    this.exceptions.forEach((exception) => {
      const hash = JSON.stringify(exception).hashCode();
      if (collapsed[hash]) {
        collapsed[hash].count++;
      } else {
        collapsed[hash] = { exception: exception, count: 1 };
      }
    });
    this.collapsed = [...Object.values(collapsed)];
  }

  addException(exception) {
    this.exceptions.push(exception);
  }

  renderDetails() {
    let table = objectToTable(
      {
        name: this.name,
        author: this.author,
        folder: code(this.folder),
        assemblies: this.assemblies
          .map((assembly) => code(assembly.dll))
          .join(", "),
        catalogs: this.catalogs
          .map((catalog) => code(catalog.catalog))
          .join(", "),
        tags: [...this.tags].join(", "),
      },
      "Details",
      false
    );
    let missingDLLs = objectListToTable(
      this.missingDLLs,
      undefined,
      "Missing DLLs"
    );
    let loadErrors = objectListToTable(
      this.loadErrors,
      undefined,
      "Load Errors"
    );
    let missingData = objectListToTable(
      this.missingData,
      undefined,
      "Missing Data",
      "Note: Mod attribution is 'best guess' and may not be accurate."
    );
    let exceptions =
      this.collapsed.length > 0
        ? heading("Exceptions") +
          div(
            this.collapsed
              .map((exception) => exception.exception.render(exception.count))
              .join("")
          )
        : "";
    return [table, loadErrors, missingDLLs, missingData, exceptions]
      .filter((elem) => elem)
      .join(hr());
    /* 
        Name
        Folder
        Assemblies
        Catalogs
        Load Errors
        Missing Data
        Exceptions
        Overrides
        Json
        Tags
        */
  }
}

class Exception {
  constructor(type, error) {
    this.type = type;
    this.eventType = "exception";
    this.error = error;
    this.lines = [];
    this.extra = "";
    this.tags = new Set();
    this.mods = new Set();
    this.count = 1;
    this.modReasons = {}
  }

  containsPath(path) {
    for (let i = 0; i < this.lines.length; i++) {
      if (this.lines[i].location.match(path)) return true;
    }
    return false;
  }

  complete() {
    let foundMods = new Set();
    let parts = this.type.split(/\./);
    if (parts.length > 1) {
      let preType = parts
        .slice(0, -1)
        .filter((portion) => IGNORED_ARGS.indexOf(portion + ".") == -1)
        .join(".");
      this.type = preType ? (preType + "." + parts[parts.length - 1]) : parts[parts.length - 1];
    }
    this.mods.forEach((mod) => {
      let found = game.findModByNamespace(mod);
      let reason = `Found by namespace '${mod}'`;
      if (!found) {
        found = game.findModByAssembly(replaceNamespaces(mod));
        if (found) reason = `Found by assembly '${replaceNamespaces(mod)}'`;
      }
      if (!found) {
        found = game.fuzzyFindMod(mod);
        if (found) reason = "Found via fuzzy matching, may not be accurate";
      }

      if (found) {
        foundMods.add(found.name);
        this.modReasons[found.name] = reason;
        game.mods
          .find((mod) => mod.folder == found.folder)
          .addException(this, found.name, reason);
        this.tags.add("modded");
      }
    });

    this.mods = foundMods;

    if (this.mods.size == 0) {
      game.orphanExceptions.push(this);
      game.baseGame.addException(this);
    }

    if (!this.tags.has("modded") && !this.tags.has("harmony"))
      this.tags.add("unmodded");

    if (
      this.type == "NullReferenceException" &&
      this.lines.length > 1 &&
      this.containsPath(/ThunderRoad\.Mana\.AddSpell/) &&
      this.containsPath(/ThunderRoad\.Creature\.Load/)
    ) {
      game.addSuggestion(
        "delete-save",
        "Your game appears to be unable to load, due to your save file containing an unknown spell."
      );
    }

    if (this.type == "Exception" && this.error.startsWith("Dependency Exception --->")) {
      this.type = "Exception (Dependency Exception)"
      match(
        this.error,
        /Dependency Exception ---> (?<baseException>.+): (?<baseExceptionError>.+) ---> (?<exception>.+?): .+ : (?<error>.+?): '(?<file>.+)'./,
        ({ baseException, baseExceptionError, exception, error, file }) => {
          let baseType = exception.split(".").pop();
          this.type = baseType + " (Dependency Exception)"
          this.error = error;
          this.extra = div(file.replace(/\\/g, "\/").replace(/.+BladeAndSorcery_Data/, span("[game directory]", "fade")), "code");
        }
      );
    }

    if (this.type == "MissingMethodException") {
      match(this.error, /Method not found: (?<type>.+?(\<.+\>)?) (?<signature>.+)/, ({ type, signature }) => {
        let methodMods = Array.from(this.mods).join(", ");
        game.addSuggestion("missing-method", {mods: methodMods ? methodMods : italic("(Unknown)"), method: code(new ExceptionLine(signature).getPath())})
        this.error = "Method not found: " + span(new ExceptionLine(signature).getPath(), "code");
      });
    }
  }

  render(count) {
    count ??= this.count;
    return `<div class="exception event" onclick="expandException(this)">
                    <div class="event-container">
                    <span class="tags">
                    ${
                      EXCEPTIONS[this.type]
                        ? `<i class="tag icofont-question"><p>${
                            EXCEPTIONS[this.type]
                          }</p></i>`
                        : ""
                    }
                    ${Array.from(this.tags)
                      .map(
                        (tag) =>
                          `<i class="tag icofont-${
                            EXCEPTION_TAGS[tag].icon
                          }"><p>${
                            EXCEPTION_TAGS[tag].text +
                            "<br>" +
                            (EXCEPTION_TAGS[tag].extra
                              ? EXCEPTION_TAGS[tag].extra()
                              : "")
                          }</p></i>`
                      )
                      .join("")}
                    <i class="tag icofont-camera screenshot" alt="Screenshot exception" onclick="screenshot(event, this.parentElement.parentElement, '${this.type}')"></i>
                    </span>
                    <div class="event-title">${
                      count > 1
                        ? `<span class="fade count normal">${count}x</span>`
                        : ""
                    }${this.type}</div>
                    ${
                      [...this.mods].length > 0
                        ? `<div class="exception-title fade">${[...this.mods]
                            .map((mod) => span(mod, `exception-mod`, {title:  this.modReasons[mod]}))
                            .join(" ")}</div>`
                        : ""
                    }
                    ${
                      [...this.mods].length > 0 && this.error
                        ? '<span class="dim"></span>'
                        : ""
                    }
                    ${
                      this.error
                        ? `<span class="exception-title">${this.error}</span>`
                        : ""
                    }
                    ${
                      this.lines.length > 0
                        ? `<div class="event-details event-hidden">
                           <div class="exception-lines">${this.lines
                             .map((line) => line.render())
                             .join("")}</div>
                           </div>`
                        : this.extra
                        ? `<div class="event-details event-hidden"><div class="exception-extra">${this.extra}</div></div>`
                        : ""
                    }
                  </div>
                </div>`;
  }
}

class ExceptionLine {
  constructor(location, address, filename, line) {
    this.location = location;
    this.address = address;
    this.filename = filename;
    this.line = line;
    this.extraCount = 0;
    if (filename?.match(/<(.+)>/)) {
      this.filename = filename.match(/<(?<address>.+)>/).groups.address;
      this.line = -1;
    }
  }

  getNamespace() {
    const funcSig = this.location.match(/(?<func>.+?) ?\((?<args>.+)?\)/);
    return [...funcSig.groups.func.match(/(\w+(<.+?>)?)(?:[^:. ()]+)?/g)]
      .slice(0, 2)
      .join(".");
  }

  getPath() {
    const funcSig = this.location.match(/(?<func>.+?) ?\((?<args>.+)?\)/);
    if (funcSig) {
      const funcPart = [
        ...funcSig.groups.func.matchAll(/(\w+(<.+?>)?)(?:[^:. ()]+)?/g),
      ]
        .map((x) =>
          x[1].replace(
            /<(.+)>/,
            (_, type) =>
              ` <span class="dim">&lt;${type.split(".").pop()}&gt;</span>`
          )
        )
        .map((x) =>
          x == "ctor"
            ? '<span class="italic">constructor</span>'
            : `<span>${x}</span>`
        )
        .join(`<span class="dim"> > </span>`);
      let argsPart = [];
      if (funcSig.groups.args)
        argsPart = [
          ...funcSig.groups.args.matchAll(
            /(?:([^`, ]+)[^, ]*( ([^`, ]+)[^ ,]*)?)/g
          ),
        ].map((x) => x[1] + (x[2] ? x[2] : ""));
      let argsString = "";
      argsPart = argsPart.map((part) => {
        let argPortions = [
          ...part.split(" ")[0].matchAll(/(\w+(\.|\+|\\)?)/g),
        ].map((x) => x[1]);
        if (argPortions.length > 1) {
          let portions = argPortions
            .slice(0, argPortions.length - 1)
            .map((portion) => portion.replace(/\+|\\|\//g, "."))
            .filter((portion) => IGNORED_ARGS.indexOf(portion) == -1)
            .map((portion) => `<span class="arg dim">${portion}</span>`);
          portions.push(
            `<span class="arg type">${this.replaceArgTypes(
              argPortions[argPortions.length - 1]
            )}</span>`
          );
          return (
            portions.join("") +
            (part.split(" ").length > 1
              ? ` <span class="arg name">${part.split(" ")[1]}</span>`
              : "")
          );
        } else {
          return `<span class="arg type">${this.replaceArgTypes(
            argPortions[0]
          )}</span>${
            part.split(" ").length > 1
              ? ` <span class="arg name">${part.split(" ")[1]}</span>`
              : ""
          }`;
        }
      });
      argsPart = argsPart.map((x) =>
        x.replace(/(\.\w+)/g, `<span class="arg">$1</span>`)
      );
      argsString = argsPart
        .map((part) => `${part}`)
        .join(`<span class="dim">,</span>|`)
        .split("|")
        .map((part) => `<span class="no-break">${part}</span>`)
        .join(" ");
      return `${funcPart} <span>(</span>${argsString}<span>)</span>`;
    }
    return this.location;
  }

  replaceArgTypes(arg) {
    return ARG_REPLACEMENTS[arg.toLowerCase()] ?? arg;
  }

  renderFilename() {
    return this.filename
      .replace(/\\/g, "/")
      .replace(
        /E:\/Dev\/BladeAndSorcery\/Library\/PackageCache\/(?<package>.+?)@(?<version>.+?)\//,
        (_, name, version) => `<span class="dim">[${name} @ ${version}]</span> `
      )
      .replace(
        "E:/Dev/BladeAndSorcery/",
        `<span class="dim">[ThunderRoad]</span> `
      )
      .replace(
        "C:/buildslave/unity/build/",
        `<span class="dim">[Unity]</span> `
      )
      .replace(
        /[A-Z]:\/Users\/.+?\/AppData\/Local\/JetBrains\/Shared\/vAny\/DecompilerCache\/decompiler\/.+?\/.+?\/.+?\//,
        `<span class="dim">[ThunderRoad]</span> `
      )
      .replace(
        "C:/Users/atrag/source/repos/",
        `<span class="dim">[lyneca]</span> `
      );
  }

  render() {
    let path = this.getPath();
    return (
      `<span class="dim">at </span><div class="exception-line">
                    <div class="exception-line-location" title="${
                      this.address
                    }">${this.getPath()}</div>
                    ${
                      this.filename != undefined && this.line >= 0
                        ? `<span><span class="prefix dim">-></span>
                            <span><span class="dim code">line</span> <span class="exception-line-line">${
                              this.line
                            }</span> <span class="dim code">of</span> </span><span class="exception-line-filename">${this.renderFilename()}</span>
                            </span>`
                        : ""
                    }
                </div>` +
      (this.extraCount > 0
        ? `<span></span><span class="dim italic">+ ${
            this.extraCount
          } more from <span class="code normal">${this.getNamespace()}</span></span>`
        : "")
    );
  }
}

class TimelineEvent {
  constructor(text, description, props, color) {
    this.color = color ?? "color-success";
    this.text = text;
    this.description = description;
    this.props = props ?? {};
    this.eventType = "timeline";
  }

  render() {
    let desc = [];
    if (this.description !== undefined)
      desc.push(`<div>${this.description}</div>`);
    if (this.props !== undefined)
      Object.keys(this.props).forEach((key) => {
        desc.push(
          `<div class="split" style="max-width: 30%;"><span class="dim">${niceify(
            key
          )}</span><span class="select">${renderValue(
            this.props[key]
          )}</span></div>`
        );
      });
    return `<div class="global event ${this.color ?? ""}">
              <div class="event-container">
                    <div class="event-title">${this.text}</div>
                    ${
                      desc.length > 0
                        ? `<div class="event-details">${desc.join("")}</div>`
                        : ""
                    }
              </div>
            </div>`;
  }
}

function match(line, re, callback) {
  let match = line.match(re);
  if (match) callback(match.groups);
  return match != null;
}

let lineCounter = 0;
let totalLines = 0;
let currentLines = 0;

function setupProgressDisplay() {
  return {
    lines_analysed: () => `${currentLines} / ${totalLines}`,
    mods: () => game.mods.length,
    exceptions: () => game.exceptions.length,
    suggestions_found: () => Object.keys(game.suggestions).length
  };
}

function refreshProgress(rows) {
  document.querySelector("#mod-details").innerHTML = "<h2>Progress</h2>" + objectToTable(rows);
}

async function parse(lines) {
  let state = "default";
  game = new Game();
  let exception = null;
  let prev = "";
  let metadata = {};

  let rows = setupProgressDisplay();

  let count = lines.length;
  totalLines = count;
  let i = 0;
  for (let line of lines) {
    line = line.replace(/\//g, "\\");
    await maybeTakeABreak();
    line = line.replace(XML_REGEX, "");
    match(line, LOG_REGEX, (groups) => {
      metadata = groups;
      line = line.replace(LOG_REGEX, "");
    });

    // determine state changes
    if (state == "exception") {
      if (
        match(line, /Parameter name: (?<parameter>.+)/, (groups) => {
          if (exception)
            exception.error +=
              " Parameter: " + `<code>${groups.parameter}</code>`;
        })
      ) {
      } else if (!line.match(/^(  at |Rethrow as )/)) {
        // if line is not an exception, save it and reset to default:
        if (exception != null) {
          game.addException(exception);
          exception = null;
        }
        state = "default";
      }
    }

    match(
      line,
      /^(Exception in (ThunderScript )?Update Loop: )?(System\.)?(?<type>(\w+\.)*\w*Exception)(: (?<error>.+?))?( assembly:.+)?$/,
      (groups) => {
        if (state == "exception") {
          // we just had an exception, time to save it
          if (exception != null) {
            game.addException(exception);
            exception = null;
          }
        }

        state = "exception";
        exception = new Exception(groups.type, groups.error);
      }
    );

    // Match game pool generation finishing and the loading being 'complete'
    match(line, /.*Complete pool generation finished in: \d+\.\d+ sec/, () => {
      game.begin();
    });

    switch (state) {
      case "default":
        matchSystemInfo(line);

        // Match old (< U12.3) mod detection
        match(
          line,
          /Added valid mod folder: (?<folder>.+). Mod: (?<mod>.+)/,
          ({ folder, mod }) => {
            game.findOrCreateMod(mod, folder);
          }
        );
        // Match mod assembly
        // [ModManager][Assembly] - Loading assembly: Wand/WandModule.dll


        match(
          line,
          /\[ModManager\]\[Assembly\]((\[(?<mod>.+?)\])| -) Loading [Aa]ssembly: (?<path>([^\\]+\\)+)(?<dll>.+\.dll)/,
          ({ mod, path, dll }) => {
            let folder = path.split("\\")[0];
            let foundMod = game.findOrCreateMod(mod, folder);
            foundMod?.assemblies.push({
              path: path.replace(/\\$/, "").replace(/\\/, "/"),
              dll: dll,
            });
            foundMod?.tags.add("dll");
          }
        );

        // Match mod debug symbols
        match(
          line,
          /\[ModManager\]\[Assembly\]\[(?<mod>.+?)\] Loading Assembly Debug Symbols: (?<path>([^\\]+\\)+)(?<dll>.+\.pdb)/,
          ({ mod, path, dll }) => {
            let folder = path.split("\\")[0];
            game.findOrCreateMod(mod, folder)?.tags.add("pdb");
          }
        );

        // Match mod catalog json file
        match(
          line,
          /\[ModManager\]\[Addressable\]\[(?<mod>.+?)\] - Loading Addressable Assets Catalog: .*(?<catalog>catalog_.+\.json)/,
          ({ mod, catalog }) => {
            game.findOrCreateMod(mod)?.catalogs.push({
              catalog: catalog,
            });
          }
        );

        // Match default data being overridden
        match(
          line,
          /\[ModManager\]\[Catalog\]\[(?<mod>.+?)\] Overriding: \[(?<type>.+)\]\[(?<className>.+)\]\[(?<id>.+)\] with: (?<path>([^\\]+\\)+)(?<file>.+\.json)/,
          ({ mod, type, className, id, path, file }) => {
            let folder = path.split("\\")[0];
            game.findOrCreateMod(mod, folder)?.overrides.push({
              type: type,
              class: className,
              id: id,
              path: path.replace(/\\$/, "").replace(/\\/, "/"),
              file: file,
            });
          }
        );

        // Match JSON files being loaded
        match(
          line,
          /\[JSON\]\[(?<mod>.+)\] - Loaded file: (?<path>.+)\\(?<file>[^\\]+).json/,
          (groups) => {
            game.findModByFolder(groups.mod)?.json.push({
              file: groups.file,
              path: groups.path.replace(/\\/g, "/"),
            });
          }
        );

        // Match invalid game version
        match(
          line,
          /\[ModManager\] - Mod (?<mod>.+) for \((?<version>.+)\) is not compatible with current minimum mod version (?<minVersion>.+)/,
          (groups) => {
            game.addIncompatibleMod(
              groups.mod,
              groups.version,
              groups.minVersion
            );
            game.addSuggestion(
              "incompatible",
              `The mod ${code(groups.mod)} is for version ${code(
                groups.version
              )}, but the game is version ${code(groups.minVersion)}.`
            );
          }
        );

        // Match addresses not found
        match(
          line,
          /Address \[(?<address>.+)\] not found for \[(?<id>.+) (\((?<type>.+)\))?\]/,
          (groups) => {
            var entry = {
              address: groups.address,
              id: groups.id,
              type: groups.type,
            };
            if (!game.missingData.find(element => element.address == groups.address))
              game.missingData.push(entry);
          }
        );

        // Match JSON files that cannot be read due to missing assemblies.
        match(
          prev,
          /LoadJson : Cannot read json file .+StreamingAssets\\Mods\\(?<path>([^\\]+\\)+)(?<json>.+\.json) ?\((?<error>.+)\)/,
          ({ path, json }) => {
            match(
              line,
              /Could not load assembly '(?<assembly>.+)'\./,
              ({ assembly }) => {
                let mod = game.findOrCreateMod(path.split(/\\/)[0]);
                mod.missingDLLs.push({
                  json: json,
                  possible_missing_dll_name: code(assembly + ".dll"),
                });
                game.addSuggestion("check-dll", {
                  mod: mod.name,
                  possible_missing_dll_name: code(assembly + ".dll"),
                });
              }
            );
          }
        );

        match(
          line,
          /\[ModManager\]\[ThunderScript\] - Loaded ThunderScript: (?<namespace>[^.]+)\.(?<class>.+) on mod: (?<name>.+) in assembly: (?<assembly>.+), Version=.+/,
          (groups) => {
            let mod = game.findModByName(groups.name);
            mod.namespaces.add(groups.namespace);
          }
        );

        // Match load time events for pie chart
        match(
          line,
          /(?<process>.+) in (?<time>[\d\.]+) sec/,
          (groups) => game.addTime(groups.process, parseFloat(groups.time))
        )

        // Match level load events
        match(
          line,
          /Load level (?<level>.+) using mode (?<mode>.+)/,
          (groups) => {
            game.addEvent(`Level ${bold(groups.level)} loading...`, undefined, {
              level: groups.level,
              mode: groups.mode,
            });
          }
        );
        match(
          line,
          /Total time to load (?<level>.+): (?<time>.+) sec/,
          (groups) => {
            game.addEvent(`Level ${bold(groups.level)} finished loading.`, undefined, {
              level: groups.level,
              load_time: `${groups.time}s`,
            });
          }
        );

        // Match game load events
        match(line, /Game started in (?<time>.+) sec/, (groups) => {
          game.addEvent(`Game starting`, undefined, {
            startup_time: `${groups.time}s`,
          });
        });

        // Match player possession
        match(line, /Player take possession of : (?<creature>.+)/, (groups) => {
          game.addEvent("Player possessed Creature", undefined, {
            creature: groups.creature,
          });
        });

        // Match hard crash
        match(line, /Crash!!!/, () => {
          game.addEvent(
            "Hard crash!",
            "Check the log for stack traces.<br>This may an underlying problem with your PC, or GPU drivers.",
            undefined,
            "color-fatal"
          );
        });

        // Match out of RAM
        match(line, /Could not allocate memory: System out of memory!/, () => {
          game.addEvent(
            "System out of memory!",
            "You may either have too many other programs open, or you might not have enough RAM on your PC. It's recommended to have at least 16GB total RAM for Blade and Sorcery. If you have enough RAM, this problem has also been solved in the past by re-installing GPU drivers.",
            undefined,
            "color-fatal"
          );
        });

        match(
          line,
          /Trying to allocate: (?<bytes>\d+)B with \d+ alignment. MemoryLabel: (?<label>.+)/,
          (groups) => {
            if (game.lastEvent?.text == "System out of memory!") {
              game.lastEvent.props.bytes =
                groups.bytes > 1000
                  ? Math.round(groups.bytes / 1000) + " MB"
                  : groups.bytes + " bytes";
              game.lastEvent.props.label = groups.label;
            }
          }
        );

        break;
      case "exception":
        match(
          line,
          /^(  at )?(\(wrapper (managed-to-native|dynamic-method)\) )?(?<location>[\w\.:`<>+/\[\]]+? ?\(.*?\)) ?((\[(?<address>0x[a-zA-Z0-9]+)\] in |\(at )(?<filename>.+):(?<line>\d+)\)?)?/,
          (groups) => {
            if (exception.lines.length > 0) {
              let lastLine = exception.lines[exception.lines.length - 1];
              let ignoreRegex =
                /^(?<namespace>Unity|DelegateList|ONSPAudioSource|SteamVR|OVR|OculusVR|System|\(wrapper|Valve|delegate|MonoBehaviourCallbackHooks|Newtonsoft)\.(?<subName>\w+)/;
              let match = lastLine.location.match(ignoreRegex);
              if (
                match &&
                groups.location.startsWith(
                  match.groups.namespace + "." + match.groups.subName
                )
              ) {
                lastLine.extraCount++;
                return;
              }
            }
            exception.lines.push(
              new ExceptionLine(
                groups.location,
                groups.address,
                groups.filename,
                groups.line
              )
            );
            if (groups.location.match(/__instance|Prefix|Postfix|_Patch(\d+)/))
              exception.tags.add("harmony");
            if (
              !groups.location.match(
                /^(ThunderRoad|Unity|DelegateList|RainyReignGames|ONSPAudioSource|SteamVR|OVR|OculusVR|System|StateTracker|\(wrapper|Valve|delegate|MonoBehaviourCallbackHooks|Newtonsoft|TMPro|UsingTheirs)/
              )
            ) {
              let match = groups.location.match(/^(?<namespace>(\w|\+)+)\./);
              if (match != null) exception.mods.add(match.groups.namespace);
              exception.tags.add("modded");
            } else {
              let match = groups.location.match(/^(?<namespace>(\w|\+)+)\./);
              if (match != null) exception.mods.add("Base Game Errors");
              exception.tags.add("unmodded");
            }
          }
        );
        break;
    }
    prev = line;
    i++;
    currentLines = i;
    setStatus(`Reading file: ${Math.round(i / count * 100)}%`);
    setProgress(Math.round((i / count) * PROGRESS_READ))
    refreshProgress(rows);
  }

  startTime = Date.now() - 5000;

  if (!game.begun) game.begin();
  await game.finish();
}

function matchSystemInfo(line) {
  line = line.replace(/\//g, "\\");
  match(line, /Platform \[Android\] initialized/, groups => {
    game.system.platform = "Nomad";
  })
  match(line, /Mono path\[0\] = '(?<path>.+)'$/, (groups) => {
    game.system.game_directory = groups.path.replace(/\\/g, "/");
  });
  match(line, /Mono path\[0\] = '.+(Oculus)?\\Software.+/i, () => {
    game.system.platform = "Oculus";
  });
  match(line, /Mono path\[0\] = '.+\\steamapps\\common.+/i, () => {
    game.system.platform = "Steam";
  });
  match(line, /Mono path\[0\] = '.+(Downloads|Desktop).*\\steamapps\\common.+/i, () => {
    game.system.platform = null;
  });
  match(line, /Successfully loaded content catalog at path (?<path>.+)'$/, (groups) => {
    game.system.game_directory = groups.path.replace(/\\/g, "/");
  });
  match(line, /Successfully loaded content catalog at path .+(Oculus)?\\Software.+/i, () => {
    game.system.platform = "Oculus";
  });
  match(line, /Successfully loaded content catalog at path .+\\steamapps\\common.+/i, () => {
    game.system.platform = "Steam";
  });
  match(line, /Successfully loaded content catalog at path .+(Downloads|Desktop).*\\steamapps\\common.+/i, () => {
    game.system.platform = null;
  });
  match(
    line,
    /\(Filename: (?<filename>.+)? Line: (?<line>\d+)?\)/,
    (groups) => {
      this.filename = groups.filename;
      this.line = groups.line;
    }
  );
  match(line, /Game version: (?<version>.+)/, (groups) => {
    game.system.version = groups.version;
  });
  match(line, /Initialize engine version: (?<version>.+)/, (groups) => {
    game.system.build_number = groups.version;
  });
  match(line, /Device model : (?<model>.+)/, (groups) => {
    game.system.hmd_model = groups.model;
    if (groups.model == "Miramar") game.system.hmd_model += " (Quest 2)";
  });
  match(line, /HeadDevice: (?<model>.+)/, (groups) => {
    game.system.hmd_model = groups.model;
    if (groups.model == "Miramar") game.system.hmd_model += " (Quest 2)";
  });
  match(line, /LoadedDeviceName : (?<device>.+)/, (groups) => {
    game.system.hmd = groups.device;
  });
  match(line, /Loader: (?<device>.+) \|/, (groups) => {
    game.system.hmd = groups.device;
  });
  match(line, / +Renderer: +(?<gpu>.+)( \(ID=.+\))/, (groups) => {
    game.system.gpu = groups.gpu;
  });
  match(line, / +VRAM: +(?<vram>\d+ MB)/, (groups) => {
    game.system.gpu_vram = groups.vram;
  });
  match(line, / +Driver: +(?<driver>.+)/, (groups) => {
    game.system.gpu_driver = groups.driver;
  });
}
