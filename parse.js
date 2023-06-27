// https://coolors.co/333344-45cb85-ff4f79-1e91d6-f4ac45

const containers = {
  mods: document.querySelector("#mod-list"),
};

const LOG_REGEX =
  /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2}).(?<microsecond>\d+) (?<level>[A-Z]+) .+?: /;

const IGNORED_ARGS = [
  "Newtonsoft.",
  "ThunderRoad.",
  "Generic.",
  "UnityEngine.",
  "System.",
  "Collections.",
  "ResourceManagement.",
  "AsyncOperations.",
];

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
    cols: ["mod", "json", "possible_dll_name"],
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
fileClickInput.addEventListener("change", (e) => {
  loadFile(e.target.files[0]);
});

function loadFile(file) {
  const reader = new FileReader();
  reader.readAsText(file);
  document.querySelector(".help").style.opacity = 0;
  setTimeout(() => {
    document.querySelector(".help").style.maxHeight = 0;
    document.querySelector("main").style.maxWidth = "100vw";
  }, 200);
  reader.onload = () => {
    let lines = reader.result
      .replace(/\r\n/g, "\n")
      .split(/\n/)
      .map((line) =>
        line.replace(
          /^\d+-\d+ \d+:\d+:\d+.\d+\s+\d+\s+\d+ [A-Z] Unity\s+: /g,
          ""
        )
      );
    parse(lines);
    game.sort();
    game.render();
  };
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
  let callback = game.selectors[id];
  document
    .querySelectorAll("#mod-list > .mod")
    .forEach((elem) => elem.classList.remove("selected"));
  document.querySelector("#" + id).classList.add("selected");
  document.querySelector("#mod-details").innerHTML = callback.call(game);
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

function screenshot(event, element) {
  event.preventDefault();
  event.stopPropagation();
  if (element.querySelector(".event-hidden")) {
    expandException(element);
  }
  html2canvas(element).then((canvas) => {
    canvas.toBlob(function (blob) {
      saveAs(blob, "exception.png");
    });
  });
}

function code(string) {
  if (string.startsWith("<code>")) return string;
  return `<code>${string}</code>`;
}

function icon(name, tooltip, color) {
  return `<i class="pad icofont-${name}"${
    color ? ` style="color: ${color}` : ""
  }">${tooltip ? `<p>${tooltip}</p>` : ""}</i>`;
}

function hr() {
  return '<div class="hsep"></div>';
}

function div(string, className) {
  return `<div${className ? ' class="' + className + '"' : ""}>${string}</div>`;
}

function span(string, className) {
  return `<span${
    className ? ' class="' + className + '"' : ""
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

class Game {
  constructor() {
    this.mods = [];
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
    let found = this.mods.filter((mod) => mod.namespaces.has(namespace));
    if (found.length > 0) return found[0];
    return null;
  }

  findModByAssembly(assembly) {
    let found = this.mods.filter((mod) =>
      mod.assemblies.filter((eachAssembly) => eachAssembly.dll == assembly)
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
    // console.log(`Searching for ${id} or ${address}...`)
    if (address.startsWith("Bas.")) return null;
    if (address.split(".").length >= 3) {
      let [author, mod, ...data] = address.split(".");
      if (id.split(".").length > 1) {
        id = id.split(".")[id.split(".").length - 1];
      }
      // console.log(`Searching mods for ${author} and ${mod} - '"${mod}"|'"${author}"`)
      let results = this.modFinder.search(`'"${mod}"|'"${author}"`);
      results.forEach((result) => {});
      // console.log(results)
      if (results.length > 0 && results[0].score < 0.2) {
        // console.log(`found mod ${results[0].item.folder} score ${results[0].score} via mod name ${mod}`)
        return results[0].item;
      }

      // console.log(`Searching mod data for ${author}, ${mod} and ${id}`)
      results = this.dataFinder.search(`'"${mod}" '"${author}" '"${id}"`);
      if (results.length > 0 && results[0].score < 0.2) {
        // console.log(`found mod ${results[0].item.folder} score ${results[0].score} via result ${id}`)
        return this.findModByFolder(results[0].item.folder);
      }
    }
    if (id.split(".").length > 1) {
      id = id.split(".")[id.split(".").length - 1];
    }
    let data = this.dataFinder.search(id);
    if (data.length > 0) {
      // console.log(`found mod ${data[0].item.folder} score ${data[0].score} via data ${id}`)
      return this.findModByFolder(data[0].item.folder);
    }
  }

  begin() {
    if (this.system.platform === null) {
      this.system.platform =
        icon("warning", undefined, "color-warning") + "Unknown - Pirated?";
      this.addSuggestion("pirated");
    }
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

  finish() {
    this.exceptions.forEach((exception) => exception.complete());
    this.mods.forEach((mod) => mod.complete());
    this.collapseTimeline();
    this.collapseOrphanExceptions();
    this.missingData.forEach((data) => {
      // console.log(`Searching for ${data.id}`)
      game.findModByData(data.id, data.address)?.missingData.push({
        address: data.address,
        id: data.id,
        type: data.type,
      });
    });
  }

  sort() {
    this.mods.sort((mod) => mod.name).reverse();
    this.mods.sort((a, b) => a.sortKey() - b.sortKey()).reverse();
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

  addEvent(text, description, props, color) {
    let event = new TimelineEvent(text, description, props, color);
    this.lastEvent = event;
    this.timeline.push(event);
  }

  addIncompatibleMod(mod, version, minVersion) {
    this.incompatibleMods.push({ mod, version, min_version: minVersion });
  }

  render() {
    containers.mods.innerHTML = [
      this.selector("System Info", this.renderGameInfo),
      this.selector(
        "Suggestions",
        this.renderSuggestions,
        [...Object.keys(this.suggestions)].length
      ),
      this.selector("Timeline", this.renderTimeline, this.timeline.length),
      this.incompatibleMods.length > 0
        ? this.selector(
            "Incompatible Mods",
            this.renderIncompatibleMods,
            this.incompatibleMods.length
          )
        : null,
      this.orphanExceptions.length > 0
        ? this.selector(
            "Orphan Exceptions",
            this.renderOrphanExceptions,
            this.orphanExceptions.count
          )
        : null,
      hr(),
      ...this.mods.map((mod) => mod.renderList()),
    ]
      .filter((elem) => elem != null)
      .join("");
    clickButton("selector-system-info");
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
    return `<div class="mod" onclick="clickButton('selector-${slug}')" id="selector-${slug}">
        <div class="mod-headers">
            <div class="selector-title">${name}</div>
            <div class="mod-errors">${
              count > 0 ? `<span class="mod-error-count">${count}</span>` : ""
            }</div>
        </div>
        </div>`;
  }

  collapseTimeline() {
    const collapsed = [];
    let lastEvent = null;
    let lastEventHash = "";
    this.timeline.forEach((event) => {
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
    });
    this.timeline = collapsed;
  }

  collapseOrphanExceptions() {
    let collapsed = {};
    let keys = []
    this.orphanExceptions.forEach((exception) => {
      const hash = JSON.stringify(exception).hashCode();
      if (collapsed[hash]) {
        collapsed[hash].count++;
      } else {
        collapsed[hash] = { exception: exception, count: 1 };
        keys.push(hash);
      }
    });
    this.orphanCollapsed = keys.map(key => collapsed[key]);
  }
}

let game = new Game();

class Mod {
  constructor(folder, name) {
    this.name = name;
    this.folder = folder;
    this.assemblies = [];
    this.namespaces = new Set();
    this.catalogs = [];
    this.loadErrors = [];
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
    let count = this.loadErrors.length + this.missingData.length;
    return count > 0 ? `<span class="mod-error-count">${count}</span>` : "";
  }

  exceptionCount() {
    let count = this.exceptions.length;
    return count > 0 ? `<span class="mod-exception-count">${count}</span>` : "";
  }

  sortKey() {
    return (
      this.loadErrors.length + this.missingData.length + this.exceptions.length
    );
  }

  renderList() {
    let slug = slugify(this.folder);
    game.selectors[`mod-${slug}`] = () => this.renderDetails();
    return `<div class="mod" onclick="clickButton('mod-${slug}')" id="mod-${slug}">
        <div class="mod-headers">
            <div class="mod-title">${this.name}</div>
            <div class="mod-errors">
                ${this.loadErrorCount()}
                ${this.exceptionCount()}
            </div>
        </div>
        </div>`;
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
    return [table, loadErrors, missingData, exceptions]
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
    this.tags = new Set();
    this.mods = new Set();
    this.count = 1;
  }

  containsPath(path) {
    for (let i = 0; i < this.lines.length; i++) {
      if (this.lines[i].location.match(path)) return true;
    }
    return false;
  }

  complete() {
    let foundMods = new Set();
    if (this.mods.size == 0) {
      game.orphanExceptions.push(this);
    }
    this.mods.forEach((mod) => {
      let found =
        game.findModByNamespace(mod) ??
        game.fuzzyFindMod(mod) ??
        game.findModByAssembly(mod);
      console.log(found);
      if (found) {
        foundMods.add(found.name);
        game.mods
          .find((mod) => mod.folder == found.folder)
          .exceptions.push(this);
        this.tags.add("modded");
      } else {
        game.orphanExceptions.push(this);
      }
    });

    this.mods = foundMods;

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
                    <i class="tag icofont-camera screenshot" alt="Screenshot exception" onclick="screenshot(event, this.parentElement.parentElement)"></i>
                    </span>
                    <div class="event-title">${
                      count > 1
                        ? `<span class="fade count normal">${count}x</span>`
                        : ""
                    }${this.type}</div>
                    ${
                      [...this.mods].length > 0
                        ? `<span class="exception-title fade">${[
                            ...this.mods,
                          ].map((mod) => div(mod, "exception-mod"))}</span>`
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
            .map((portion) => portion.replace(/\+|\\/, "."))
            .filter((portion) => IGNORED_ARGS.indexOf(portion) == -1)
            .map((portion) => `<span class="arg dim">${portion}</span>`);
          portions.push(
            `<span class="arg">${this.replaceArgTypes(
              argPortions[argPortions.length - 1]
            )}</span>`
          );
          return (
            portions.join("") +
            (part.split(" ").length > 1
              ? ` <span>${part.split(" ")[1]}</span>`
              : "")
          );
        } else {
          return `<span class="arg">${this.replaceArgTypes(
            argPortions[0]
          )}</span>${
            part.split(" ").length > 1
              ? ` <span>${part.split(" ")[1]}</span>`
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
        .map((part) => `<span class="block">${part}</span>`)
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

function parse(lines) {
  let state = "default";
  game = new Game();
  let exception = null;
  let prev = "";
  let metadata = {};

  lines.forEach((line) => {
    line = line.replace("/", "\\");

    match(line, LOG_REGEX, (groups) => {
      console.log("Boop");
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
      /^(Exception in Update Loop: )?(System\.)?(?<type>(\w+\.)*\w*Exception)(: (?<error>.+?))?( assembly:.+)?$/,
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

        // Initial identification of mods
        match(
          line,
          /\[ModManager\] Added valid mod folder: (?<folder>.+)\. Mod: (?<name>.+)/,
          (groups) => {
            game.mods.push(new Mod(groups.folder, groups.name));
          }
        );
        match(
          line,
          /Loaded mod catalog (?<name>.+) by (?<author>.+)/,
          (groups) => {
            game.findModByName(groups.name).author = groups.author;
          }
        );

        // Match mod assembly
        match(
          line,
          /\[ModManager\]\[Assembly\] - Loading assembly: (?<path>([^\\]+\\)+)(?<dll>.+\.dll)/,
          (groups) => {
            let folder = groups.path.split("\\")[0];
            game.findModByFolder(folder)?.assemblies.push({
              path: groups.path.replace(/\\$/, "").replace(/\\/, "/"),
              dll: groups.dll,
            });
          }
        );

        // Match mod debug symbols
        match(
          line,
          /\[ModManager\]\[Assembly\] - Assembly has debug symbols: (?<path>([^\\]+\\)+)(?<dll>.+\.pdb)/,
          (groups) => {
            let folder = groups.path.split("\\")[0];
            game.findModByFolder(folder)?.tags.add("pdb");
          }
        );

        // Match mod catalog json file
        match(
          line,
          /Load mod Addressable Assets catalog: .+StreamingAssets\\Mods\\(?<path>([^\\]+\\)+)(?<catalog>catalog_.+\.json)/,
          (groups) => {
            let folder = groups.path.split("\\")[0];
            game.findModByFolder(folder)?.catalogs.push({
              path: groups.path.replace(/\\$/, "").replace(/\\/, "/"),
              catalog: groups.catalog,
            });
          }
        );

        // Match default data being overridden
        match(
          line,
          /\[(?<folder>.+)\] - Overriding default data: \[(?<type>.+)\]\[(?<class>.+)\]\[(?<id>.+)\] with: .+StreamingAssets\\Mods\\(?<path>([^\\]+\\)+)(?<file>.+\.json)/,
          (groups) => {
            game.findModByFolder(groups.folder)?.overrides.push({
              type: groups.type,
              class: groups.class,
              id: groups.id,
              path: groups.path.replace(/\\$/, "").replace(/\\/, "/"),
              file: groups.file,
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
              path: groups.path.replace(/\\/, "/"),
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
            game.missingData.push({
              address: groups.address,
              id: groups.id,
              type: groups.type,
            });
          }
        );

        // Match JSON files that cannot be read due to missing assemblies.
        match(
          prev,
          /LoadJson : Cannot read json file .+StreamingAssets\\Mods\\(?<path>([^\\]+\\)+)(?<json>.+\.json) ?\((?<error>.+)\)/,
          (groups) => {
            match(
              line,
              /Could not load assembly '(?<assembly>.+)'\./,
              (subGroup) => {
                game.addSuggestion("check-dll", {
                  mod: game.findModByFolder(groups.path.split(/\\/)[0]).name,
                  json: code(groups.json),
                  possible_dll_name: code(subGroup.assembly + ".dll"),
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

        // Match level load events
        match(
          line,
          /Load level (?<level>.+) using mode (?<mode>.+)/,
          (groups) => {
            game.addEvent(`Loading level ${groups.level}`, undefined, {
              level: groups.level,
              mode: groups.mode,
            });
          }
        );
        match(
          line,
          /Total time to load (?<level>.+): (?<time>.+) sec/,
          (groups) => {
            game.addEvent(`Loaded level ${groups.level}`, undefined, {
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
            "You may either have too many other programs open, or you might not have enough RAM on your PC. It's recommended to have at least 16GB total RAM for Blade and Sorcery.",
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
                /^(ThunderRoad|Unity|DelegateList|RainyReignGames|ONSPAudioSource|SteamVR|OVR|OculusVR|System|\(wrapper|Valve|delegate|MonoBehaviourCallbackHooks|Newtonsoft|TMPro|UsingTheirs)/
              )
            ) {
              let match = groups.location.match(/^(?<namespace>(\w|\+)+)\./);
              if (match != null) exception.mods.add(match.groups.namespace);
              exception.tags.add("modded");
            }
          }
        );
        break;
    }
    prev = line;
  });

  if (!game.begun) game.begin();
  game.finish();
  console.log(game);
}

function matchSystemInfo(line) {
  line = line.replace(/\//g, "\\");
  match(line, /Mono path\[0\] = '(?<path>.+)'$/, (groups) => {
    game.system.game_directory = groups.path.replace("\\", "/");
  });
  match(line, /Mono path\[0\] = '.+(Oculus)?\\Software.+/i, () => {
    game.system.platform = "Oculus";
  });
  match(line, /Mono path\[0\] = '.+steamapps\\common.+/i, () => {
    game.system.platform = "Steam";
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
