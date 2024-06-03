// https://coolors.co/333344-45cb85-ff4f79-1e91d6-f4ac45

const VERSION = "2.3.4";

const containers = {
  mods: document.querySelector("#mod-list"),
  details: document.querySelector("#mod-details"),
};

const PROGRESS_READ = 50;
const PROGRESS_FINISH = 30;
const PROGRESS_SORT = 10;

const LOG_REGEX =
  /^(.+?\|.+?\|)?(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2}).(?<ms>\d+) +(?<level>[A-Z]+)( .+?: )/;
const XML_REGEX = /\r?<\\*color.*?>/g;
const UNMODDED_REGEX = /^(ThunderRoad|Unity|DelegateList|RainyReignGames|ONSPAudioSource|SteamVR|OVR|OculusVR|System|StateTracker|\(wrapper|Valve|delegate|MonoBehaviourCallbackHooks|Newtonsoft|TMPro|UsingTheirs|FadeMixerGroup|Shadowood)/;

const IGNORED_ARGS = [
  "Newtonsoft.",
  "ThunderRoad.",
  "Collections.",
  "Generic.",
  "Valve.",
  "UnityEngine.",
  "Unity.",
  "System.",
  "ResourceManagement.",
  "AsyncOperations.",
  "StateTracker.",
];

const IGNORED_PREVIEW = [
  /^UnityEngine\.Rigidbody\./,
  /^ThunderRoad\.PhysicBody\./,
  /^UnityEngine\.Transform\./,
  /^UnityEngine\./,
  /^System\./,
]

const IGNORED_TIMINGS = /Rendered \d+ reflection probes/;

const TAG_ICONS = {
  dll: "plugin",
  pdb: "search-2",
  harmony: "screw-driver"
}

const COMMON_NAMESPACES = {
  TOR: "TheOuterRim",
  AMP: "MultiplayerMod"
}

const SYSTEM_INFO_KEYS = {
  deviceType: "device_type",
  graphicsDeviceName: "graphics_device_name",
  graphicsDeviceType: "graphics_device_type",
  graphicsDeviceVendor: "graphics_device_vendor",
  graphicsMemorySize: "graphics_memory_size",
  graphicsShaderLevel: "graphics_shader_level",
  operatingSystem: "operating_system",
  processorType: "processor_type",
  processorCount: "processor_count",
  processorFrequency: "processor_frequency",
  systemMemorySize: "system_memory_size",
  IsMobilePlatform: "is_mobile_platform",
  supportsMultisampleAutoResolve: "supports_multisample_auto_resolve",
  platformRequiresExplicitMsaaResolve: "platform_requires_explicit_msaa_resolve"
}

const CERTAINTY = {
  certain: "Almost certain this mod is the cause.",
  sure: "Pretty sure that this mod is the cause, but not guaranteed.",
  likely: "This mod could be cause, but it's definitely not guaranteed.",
  unsure: "This mod may or may not be the cause; this is simply the best guess available."
}

const REASONS = {
  name: "Saw mod's name in log entry.",
  folder: "Saw mod folder name in log entry.",
  catalog: "Saw mod catalog name in log entry.",
  namespace: "Matched C# namespace to a namespace associated with this mod.",
  assembly: "Matched C# namespace to mod DLL name.",
  fuzzy: "Used fuzzy text matching to guess mod. Closeness: [[score]]",
  base_game: "Appears to be unmodded entry.",
  address: "Matched mod Addressables address.",
};

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
    "One or more of your mods attempted to run code that doesn't exist in the version of the game you are running.<br>" +
    "This may be because a minor version update broke it - e.g. if the mod worked on 12.2, but you updated to 12.3.",
    cols: ["mods", "method"],
  },
  "broken-json": {
    title: "Fix syntax errors in your JSON file(s).",
    description:
    "One or more of your mods broke the game's JSON parser (likely due to a syntax error). If this is your mod, or if you've made changes to one of these JSON files, make sure they are valid.<br>" +
    `You can paste your JSON file into <a href="https://jsonlint.com/">jsonlint.com</a> to debug syntax errors.`,
    cols: ["mod", "json_file", "error"]
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
  "duplicate-bundle": {
    title: "Ensure you have not installed a mod multiple times.",
    description: "Your log file suggests that you have installed a mod more than once. "
    + "Make sure you haven't installed any extra copies, especially ones hiding inside other mod folders.",
    cols: ["mod", "duplicate_bundle_found"]
  },
  "bundle-version": {
    title: "Ensure your mods are built for the right version of Unity.",
    description: () => `It looks like the following bundles have not been built for the correct version of Unity.`
    + "<ul>"
    + `<li>If this is your mod, ensure that you are exporting your mod from the correct Unity editor version; this log was generated from version <code>${game.system.unity_version}</code>.</li>`
    + `<li>If you've attempted to update a mod by just changing the <code>manifest.json</code> file, you are out of luck and you will need to wait for the modder to update their mod.</li>`
    + "</ul>",

    cols: ["mod", "bundle"]
  }
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

const simpleHash = () => {
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

const cyrb64 = (seed = 0) => {
  let str = this;
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for(let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  // For a single 53-bit numeric return value we could return
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  // but we instead return the full 64-bit value:
  // return [h2>>>0, h1>>>0];
};

const cyrb64Hash = (str, seed = 0) => {
  const [h2, h1] = cyrb64(str, seed);
  return h2.toString(36).padStart(7, '0') + h1.toString(36).padStart(7, '0');
}

const murmurHash = function() {
  return new MurmurHash3().hash(this).result();
}

String.prototype.hashCode = murmurHash;


const fileInput = document.querySelector("#file-input");
const fileClickInput = document.getElementById("file-click-input");
const statusDiv = document.getElementById("status")
const progressBar = document.getElementById("progress-bar")

if (fileInput) {
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
    e.preventDefault();
    e.stopPropagation();
    fileClickInput.click();
  });
  fileClickInput.addEventListener("change", async (e) => {
    await loadFile(e.target.files[0]);
  });
}

var lastBreak = Date.now()
let startTime = Date.now();
let parseStart = 0;
let isClicking = false;

let takeABreak = () => new Promise((resolve) => setTimeout(resolve));

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

const SPEED = 8;
const SLICE_SIZE = Math.pow(2, (SPEED + 9));
const BATCH_SIZE = 1;

async function readFileLines(file, callback) {
  let leftover = "";
  let index = 0;
  let slices = [];
  while (index < file.size) {
    let slice = await file.slice(index, index + SLICE_SIZE).text();
    slices = slice.replace(/\r/g, "").split("\n");
    for (let i = 0; i < slices.length - 1; i++) {
      let part = slices[i];
      let line = leftover + part;
      await callback(line, index, file.size);

      leftover = "";
    }
    leftover += slices[slices.length - 1];
    index += SLICE_SIZE;
  }
}

async function sleep(duration) {
  await new Promise(resolve => setTimeout(() => resolve(), duration))
}

function hideStatus() {
  if (!statusDiv) return;
  statusDiv.style.display = "none";
}
function setStatus(text) {
  if (!statusDiv) return;
  statusDiv.style.display = "block";
  statusDiv.innerText = text + (text.endsWith('%') ? '' : "...");
}

let isSmooth = true;

function setProgress(amount, force = false) {
  if (!progressBar) return;
  if (amount == 0) progressBar.style.opacity = 1;
  if (amount == 100) progressBar.style.opacity = 0;
  if (force != isSmooth) {
    progressBar.style.transition = force ? "none" : "opacity 0.2s ease-in-out";
    isSmooth = force;
  }
  progressBar.style.maxWidth = amount + '%';
}

function cleanup() {
  containers.mods.replaceChildren();
  containers.details.replaceChildren();
}

function renderFunc(stringOrFunc) {
  if (typeof stringOrFunc == "function") {
    return stringOrFunc();
  }
  return stringOrFunc;
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
  setTimeout(() => {
    document.querySelector(".help").style.display = "none";
  });
  setProgress(0, true);
  let totalTimeStart = parseStart = Date.now();
  setStatus("Parsing log lines")
  await parse(file);
  game.system.log_file_name = file.name;
  startTime = Date.now();
  parseStart = Date.now();
  setStatus("Sorting mods")
  await game.sort();
  game.info.sort_time = (Date.now() - parseStart) / 1000;
  setStatus("Rendering page")
  setProgress(PROGRESS_READ + PROGRESS_FINISH + PROGRESS_SORT);
  parseStart = Date.now();
  await game.render();
  game.info.render_time = (Date.now() - parseStart) / 1000;
  hideStatus();
  setProgress(100);
  game.info.total_time = (Date.now() - totalTimeStart) / 1000;
  await clickButton("selector-system-info", false);
}

function getTimestamp(metadata) {
  if (metadata.year === undefined) return null;
  let {year, month, day, hour, minute, second, ms, level} = metadata;
  return code(`${year}-${month}-${day} ${hour}:${minute}${second}.${ms} ${span(level, "color-text-" + level.toLowerCase())}`, "dim")
}

function niceify(string) {
  return string
    .replace(/^lns_/g, "Logs & Sorcery: ")
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
      if (!isNaN(parseFloat(value)))
        return code(value);
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
  let error = elem.querySelector(".expand");
  if (error == null) return;
  if (!error.classList.contains("event-hidden")) {
    error.classList.add("event-hidden");
  } else {
    error.classList.remove("event-hidden");
  }
}

async function clickButton(id, doProgress = true) {
  if (isClicking) return;
  startTime = Date.now();
  containers.details.replaceChildren();
  isClicking = true;
  if (doProgress)
    setProgress(0, true)
  await takeABreak();
  document
    .querySelectorAll("#mod-list > .mod")
    .forEach((elem) => elem.classList.remove("selected"));
  document.querySelector("#" + id).classList.add("selected");
  let target = await game.selectors[id].call(game);
  if (doProgress) {
    hideStatus();
    setProgress(100)
  }
  isClicking = false;
  document.getElementById("search")?.focus();
  if (target == null) return;
  let text, callback;
  if (Array.isArray(target)) {
    [text, callback] = target;
  } else {
    text = target;
  }
  containers.details.innerHTML = text;
  if (callback)
    callback();
}

function objectToTable(obj, title, includeEmpty = true, includeZero = true, headers = undefined, sort = undefined) {
  let entries = Object.entries(obj);
  if (sort) entries.sort(sort).reverse();
  return (
    (title ? heading(title) : "") +
    '<table class="auto-table">' +
    (headers ? `<tr>${headers.map(header => `<th>${header}</th>`).join("")}</tr>` : "") +
    entries
    .map(([key, value]) => {
      if (typeof value == "function")
        value = value();
      if (value?.render !== undefined) {
        let rendered = value.render(value);
        if (Array.isArray(rendered))
          rendered = rendered.map(elem => `<td>${elem}</td>`).join("")
        else
          rendered = `<td>${rendered}</td>`;
        return `<tr><td>${niceify(key)}</td>${rendered}</tr>`
      }
      return ((includeEmpty ||
        (value && value != "null")) &&
        (includeZero || (value != 0 && value != "0")))
        ? `<tr><td>${niceify(key)}</td><td id="td-${key}">${renderValue(value)}</td></tr>`
        : ""}
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
    (note ? `<p class="dim italic">${note}</p>` : "") +
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

function heading(text, level = 2, className = undefined) {
  return `<h${level}${className ? ' class="' + className + '"' : ""}>${text}</h${level}>`;
}

function modCertainty(score) {
  if (score == 0) return "certain";
  if (score <= 0.15) return "sure";
  if (score <= 0.5) return "likely";
  return "unsure";
}

function modCertaintyIcon(score) {
  if (score == 0) return '<i class="indent icofont-ui-rating"></i>';
  if (score <= 0.15) return '<i class="indent icofont-check"></i>';
  if (score <= 0.5) return '<i class="indent icofont-question"></i>';
  return '<i class="indent icofont-ui-close"></i>';
}

function getReason(reason, score) {
  return REASONS[reason].replace("[[score]]", Math.round(score * 100) / 100) ?? "";
}

function getCertainty(score) {
  return CERTAINTY[modCertainty(score)] ?? "";
}

async function searchBar(container) {
  let search = createElement("input", "search", {
    id: "search",
    type: "text",
    placeholder: "search...",
    oninput: (evt) => updateSearch(container, evt.target.value),
  });
  return search;
}

let currentQuery = "";

async function updateSearch(container, search) {
  currentQuery = search;
  let queries = search.toLowerCase().split(" ");
  startTime = Date.now();
  setProgress(0, true);
  await takeABreak();
  const children = container.children;
  for (let i = 0; i < children.length; i++) {
    if (search != currentQuery) return;
    let child = children[i];
    if (
      search == "" ||
      queries.every((query) => child.dataset.keywords?.match(query))
    ) {
      child.classList.remove("search-hidden");
    } else {
      child.classList.add("search-hidden");
    }
    setProgress((i / children.length) * 100);
    await maybeTakeABreak();
  }
  setProgress(100);
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

function code(string, className) {
  if (string.startsWith("<code>")) return string;
  return `<code${className ? ' class="' + className + '"' : ""}>${string}</code>`;
}

function italic(string) {
  return `<span class="italic">${string}</span>`;
}

function bold(string) {
  return `<strong>${string}</strong>`;
}

function safe(unsafe) {
  return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
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
  if (classes) {
    for (let eachClass of classes.split(" ")) {
      element.classList.add(eachClass);
    }
  }
  if (args) {
    if (args.id) element.id = args.id;
    if (args.onclick) element.onclick = args.onclick;
    if (args.oninput) element.oninput = args.oninput;
    if (args.type) element.setAttribute("type", args.type);
    if (args.placeholder) element.setAttribute("placeholder", args.placeholder);
  }
  if (contents != null && contents != undefined) {
    if (Array.isArray(contents)) {
      element.replaceChildren(...contents.filter(content => content));
    } else {
      element.replaceChildren(contents);
    }
  }
  return element;
}

function newElement(content) {
  const parent = document.createElement("div");
  parent.innerHTML = content;
  return parent.firstChild;
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
  return `<div${className ? ' class="' + className + '"' : ""}>${string ?? ""}</div>`;
}

function pre(string, className) {
  return `<pre${className ? ' class="' + className + '"' : ""}>${string ?? ""}</pre>`;
}

function p(string, className) {
  return `<p${className ? ' class="' + className + '"' : ""}>${string}</p>`;
}

function span(string, className, params, style) {
  return `<span${
    className ? ' class="' + className + '"' : ""
  }${
    style ? ' style="' + style + '"' : ""
  }${
    params ? Object.entries(params).map(([key, value]) => `${key}="${value}"`).join(" ") : ""
  }>${string}</span>`;
}

function emph(string) {
  return `<em>${string}</em>`;
}

function li(string, classList) {
  return `<li${classList ? ` class="${classList}"` : ""}>${string}</li>`;
}

function ul(elements, parentClasses, childClasses) {
  return `<ul${parentClasses ? ` class="${parentClasses}"` : ""}>${elements.map(elem => li(elem, childClasses)).join("")}</ul>`;
}

function ol(elements, parentClasses, childClasses) {
  return `<ol${parentClasses ? ` class="${parentClasses}"` : ""}>${elements.map(elem => li(elem, childClasses)).join("")}</ol>`;
}

function wrapDetails(title, contents, description) {
  return `<div class="pad">
  ${heading(title)}
  ${description ? p(description) : ""}
  ${contents}
  </div>`;
}

function replaceNamespaces(namespace) {
  return COMMON_NAMESPACES[namespace] ?? namespace;
}

function foundMod(found, score, reason) {
  return {found, score, reason};
}

function copyLevelArgs(event, params) {
  event.stopPropagation();
  if (!params) return;
  let target = event.target;
  target.classList.add("active");
  setTimeout(() => {
    target.classList.remove("active");
  }, 1000);
  navigator.clipboard.writeText(
    Object.entries(params)
    .map(([key, value]) =>
      key == "InstanceGuid"
      ? null
      : key == "level" || key == "gamemode"
      ? `-${key} ${value}`
      : `-leveloption ${key}=${value}`
    )
    .filter(elem => elem)
    .join(" ")
  );
}

async function renderListOfEvents(container, list, title) {
  container.replaceChildren();
  let length = list.length;
  const heading = createElement("h2", "search-title", undefined, title);
  container.appendChild(heading);
  const parent = createElement("div");
  container.lastChild.appendChild(await searchBar(parent));
  container.appendChild(parent);
  for (let i = 0; i < length; i++) {
    const div = document.createElement("div");
    div.innerHTML = list[i].render();
    parent.appendChild(div.firstChild);
    div.remove();
    setProgress(i / length * 100)
    await maybeTakeABreak();
  }
}

class Game {
  constructor() {
    this.startMetadata = {};
    this.metadata = undefined;
    this.lastMetadata = undefined;
    this.currentCount = 0;
    this.maxCount = 0;
    this.timing = {}
    this.mods = [];
    this.areas = [];
    this.missingDamagers = {};
    this.inventories = {};
    this.lastLevel = "";
    this.baseGame = null;
    this.exceptions = [];
    this.timeline = [];
    this.missingData = [];
    this.loadErrors = [];
    this.selectors = {};
    this.system = { game_directory: null, platform: null, log_file_name: null };
    this.info = {};
    this.suggestions = {};
    this.levels = []
    this.incompatibleMods = [];
    this.begun = false;
    this.lastEvent = null;
    this.lastSeed = 0;
    this.lastException = null;
  }

  findOrCreateMod(name, folder) {
    let {found, score, reason} = this.findModByName(name) ?? this.findModByFolder(folder);
    if (found) {
      if (folder && found.name == found.folder)
        found.folder = folder;
      return {found, score, reason};
    }
    let mod = new Mod(name, folder ?? name);
    game.mods.push(mod);
    return foundMod(mod, 0, "create");
  }

  findModByName(name) {
    let found = this.mods.filter((mod) => mod.name == name);
    if (found.length > 0) return foundMod(found[0], 0, "name");
    return foundMod();
  }

  findModByCatalog(catalog) {
    let found = this.mods.filter((mod) => mod.catalogs.filter(each => each.catalog.toLowerCase() == `catalog_${catalog.toLowerCase()}.json`).length > 0);
    if (found.length > 0) return foundMod(found[0], 0, "catalog");
    return foundMod();
  }

  findModByFolder(folder) {
    let found = this.mods.filter((mod) => mod.folder == folder);
    if (found.length > 0) return foundMod(found[0], 0, "folder");
    return foundMod();
  }

  findModByNamespace(namespace) {
    let found = this.mods.filter(
      (mod) =>
      Array.from(mod.namespaces).filter(
        (each) => each.toLowerCase() == namespace.toLowerCase()
      ).length > 0
    );
    if (found.length > 0) return foundMod(found[0], 0, "namespace");
    return foundMod();
  }

  findModByAssembly(assembly) {
    let found = this.mods.filter(
      (mod) =>
      mod.assemblies.filter(
        (eachAssembly) => eachAssembly.dll.toLowerCase() == assembly.toLowerCase() + ".dll"
      ).length > 0
    );
    if (found.length > 0) return foundMod(found[0], 0, "assembly");
    return foundMod();
  }

  fuzzyFindMod(mod) {
    if (!mod) return null;
    mod = replaceNamespaces(mod.replace(/^Spell/, ""));
    if (!game.modFinder)
      this.updateModFinder();
    let search = game.modFinder.search(mod);
    if (search.length > 0) {
      return foundMod(search[0].item, search[0].score, "fuzzy");
    }
    return foundMod();
  }

  findModByData(id, address) {
    if (address.startsWith("Bas.")) return foundMod(game.baseGame, 0, "base_game");
    if (address.split(".").length >= 3) {
      let [author, mod, ...data] = address.split(".");
      if (id.split(".").length > 1) {
        id = id.split(".")[id.split(".").length - 1];
      }
      let results = this.modFinder.search(`'"${mod}"|'"${author}"`);
      if (results.length > 0 && results[0].score < 0.2) {
        return foundMod(results[0].item, results[0].score, "address");
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
    return foundMod();
  }

  updateModFinder() {
    this.modFinder = new Fuse(this.mods, {
      keys: ["assemblies", "name", "folder", "author"],
      includeScore: true,
      useExtendedSearch: true,
    });
  }

  begin() {
    if (this.begun) return;
    if (this.system.platform === "pirated") {
      this.system.platform =
        icon("warning", undefined, "color-warning") + "Pirated";

    }
    if (this.system.platform === null) {
      this.system.platform =
        icon("question", undefined, "color-warning") + "Unknown, possibly pirated";
      this.addSuggestion("pirated");
    }
    this.baseGame = new Mod("Base Game", "N/A");
    this.begun = true;
    this.updateModFinder();
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

  async incrementProgress(count = 1) {
    this.currentCount += count;
    setProgress(PROGRESS_READ + this.currentCount / this.maxCount * PROGRESS_FINISH)
    await maybeTakeABreak();
  }

  async finish() {
    this.system.installed_mods = this.mods.length;
    if (this.startMetadata) {
      let {year, month, day, hour, minute, second, ms, level} = this.startMetadata;
      this.system.start_time = new Date(year, month, day, hour, minute, second, ms).toString();
    }
    containers.mods?.replaceChildren([]);
    containers.mods?.appendChild(this.selector("System Info", this.renderGameInfo));
    this.maxCount =
      this.exceptions.length +
      this.mods.length + 1 +
      this.timeline.length +
      Object.keys(this.suggestions).length +
      this.missingData.length;
    setStatus(`Processing ${this.exceptions.length} unique exceptions`)
    for (const exception of this.exceptions) {
      exception.complete()
      await this.incrementProgress();
    }
    setStatus(`Processing base game issues`)
    await game.baseGame.complete();
    setStatus(`Processing ${this.mods.length} mods`)
    for (const mod of this.mods) {
      await mod.complete()
      await this.incrementProgress();
    }
    setStatus(`Collapsing ${[...Object.keys(this.suggestions)].length} suggestions`)
    await this.collapseSuggestions();
    if ([...Object.keys(this.suggestions)].length > 0)
      containers.mods.appendChild(
        this.selector(
          "Suggestions",
          this.renderSuggestions,
          [...Object.keys(this.suggestions)].length
        )
      );
    if (this.timeline.length > 0)
      containers.mods.appendChild(
        this.selector("Timeline", this.renderTimeline, this.timeline.length)
      );
    if (this.areas.length > 0) {
      containers.mods.appendChild(
        this.selector("Areas Traversed", this.renderAreaList, this.areas.map(list => list.length - 2).reduce(reduceNumber, 0))
      );
    }
    if (Object.keys(this.inventories).length > 0) {
      containers.mods.appendChild(
        this.selector("Inventories", this.renderInventories, Object.values(this.inventories).map(list => list.length).reduce(reduceNumber, 0))
      );
    }
    if (Object.keys(this.timing).length > 0) {
      containers.mods.appendChild(
        this.selector("Timings", this.renderTimings, Object.values(this.timing).reduce(reduceObjectList, 0))
      );
    }
    if (Object.keys(this.missingDamagers).length > 0) {
      containers.mods.appendChild(
        this.selector("Missing Damagers", this.renderMissingDamagers, Object.values(this.missingDamagers).reduce((acc, group) => acc + Array.from(group).length, 0))
      );
    }
    if (this.loadErrors.length > 0) {
      containers.mods.appendChild(
        this.selector("Unknown Load Errors", this.renderLoadErrors, this.loadErrors.length)
      );
    }

    setStatus(`Matching ${this.missingData.length} missing data entries with mods`)
    for (let data of this.missingData) {
      let {mod, score, reason} = game.findModByData(data.id, data.address) ?? []
      mod?.missingData.push({
        address: data.address,
        id: data.id,
        type: data.type,
      });
      await this.incrementProgress();
    }
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
    if (this.lastException && this.lastException.getHash() == exception.getHash()) {
      this.lastException.count++;
    } else {
      this.timeline.push(exception);
      this.exceptions.push(exception);
      this.lastException = exception;
    }
  }

  addTime(process, time, category) {
    if (process.endsWith("Game loaded")) return;
    if (process.match(IGNORED_TIMINGS)) return;
    if (category) {
      this.timing[category] ??= {};
      this.timing[category][process] ??= { time: 0, count: 0, render: obj => [obj.time / obj.count + "s", obj.count]};
      this.timing[category][process].time += time;
      this.timing[category][process].count++;
    } else {
      this.timing.General ??= {};
      this.timing.General[process] ??= { time: 0, count: 0, render: obj => [obj.time / obj.count + "s", obj.count]};
      this.timing.General[process].time += time;
      this.timing.General[process].count++;
    }
  }

  addEvent(text, description, props, color, metadata) {
    let event = new TimelineEvent(text, description, props, color, metadata ?? this.metadata);
    if (this.lastEvent && event.getHash() == this.lastEvent.getHash()) {
      this.lastEvent.count += 1;
      return;
    }
    this.lastEvent = event;
    this.lastException = null;
    this.timeline.push(event);
    return event;
  }

  addAreaTransition(exit, enter) {
    this.lastArea = enter;
    if (this.areas.length == 0) {
      if (exit == enter) this.areas.push([this.lastLevel, this.lastSeed, enter]);
      else this.areas.push([this.lastLevel, this.lastSeed, exit, enter]);
      return;
    }
    let lastAreaList = this.areas[this.areas.length - 1];
    if (lastAreaList[lastAreaList.length - 1] == exit) {
      if (exit == enter) lastAreaList.push(enter);
      else {
        lastAreaList.push(enter);
      }
    } else {
      lastAreaList = [this.lastLevel, this.lastSeed];
      if (exit == enter) lastAreaList.push(enter);
      else {
        lastAreaList.push(exit);
        lastAreaList.push(enter);
      }
      this.areas.push(lastAreaList)
    }
  }

  addInventoryItem(id, container) {
    this.inventories[container] ??= [];
    this.inventories[container].push({ type: "add", id })
  }

  removeInventoryItem(id, container) {
    this.inventories[container] ??= [];
    this.inventories[container].push({ type: "remove", id })
  }

  addMissingDamager(item, group, collider) {
    item = item.replace(/ *\(Clone\)/, "");
    game.missingDamagers[item] ??= new Set();
    game.missingDamagers[item].add(group)
  }

  addSkillList(list) {
    game.addEvent("Loaded player skills", undefined, list, "color-skills", this.lastMetadata);
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
      this.baseGame?.hasAnything() ? this.baseGame.renderList(true) : null,
      createHR(),
    ].filter((elem) => elem != null)) {
      containers.mods.appendChild(entry);
    }
    let startProgress = PROGRESS_READ + PROGRESS_FINISH + PROGRESS_SORT;
    let i = 0;

    for (let mod of this.mods) {
      containers.mods.appendChild(mod.renderList());
      await maybeTakeABreak();
      i++;
      setProgress(startProgress + (100 - startProgress) * (i / this.mods.length));
    }
  }

  async renderGameInfo() {
    return wrapDetails("System Info", objectToTable(this.system, "", false)) + hr() + wrapDetails("Log Parse Info", this.renderParseInfo());
  }

  async renderTimings() {
    return Object.entries(this.timing).map(this.renderTimeBlock).join("");
  }

  renderTimeBlock([key, value]) {
    return wrapDetails(key, objectToTable(value, "", false, true, ["Task", "Average Load Time", "Times Loaded"], (a, b) => (a[1].time / a[1].count) - (b[1].time / b[1].count)));
  }

  renderTime(title, width, color) {
    return `<span class="time-block" style="width:${width * 100}%; background-color: var(--${color})">${(width > 0.05) ? title : ""}</span>`;
  }

  renderParseInfo() {
    return (
      p(`Version ${VERSION}. Log file parsed in ${this.info.total_time}s at speed ${SPEED}.`, "suggestion-text") +
      div(
        this.renderTime(
          "Parse",
          this.info.parse_time / this.info.total_time,
          "neutral_blue"
        ) +
        this.renderTime(
          "Process",
          this.info.process_time / this.info.total_time,
          "neutral_green"
        ) +
        this.renderTime(
          "Sort",
          this.info.sort_time / this.info.total_time,
          "neutral_red"
        ) +
        this.renderTime(
          "Render",
          this.info.render_time / this.info.total_time,
          "neutral_yellow"
        ),
        "time-container pad"
      )
    );
  }

  async renderSuggestions() {
    return wrapDetails(
      "Suggestions",
      [
        ...Object.entries(this.suggestions).map(([tag, reasons]) =>
          this.renderSuggestion(SUGGESTIONS[tag], reasons)
        ),
      ].join(hr()),
    );
  }

  renderSuggestion(suggestion, reasons) {
    if (suggestion.cols) {
      return div(
        heading(renderFunc(suggestion.title), 3) +
        div(renderFunc(suggestion.description), "suggestion-text") +
        objectListToTable(reasons, suggestion.cols),
        "suggestion"
      );
    } else {
      return div(
        heading(renderFunc(suggestion.title), 3) +
        div(renderFunc(suggestion.description), "suggestion-text") +
        (reasons.length > 0 ? ul(reasons, "suggestion-reasons") : ""),
        "suggestion"
      );
    }
  }

  async renderTimeline() {
    await renderListOfEvents(containers.details, this.timeline, "Timeline");
  }

  async renderAreaList() {
    return wrapDetails("Areas Traversed", this.areas.map((list) => {
      let [title, seed, ...rest] = list;
      return div(div(`Loaded level ${code(title)}`, "area-title")
        + code(`Seed: ${seed}`)
        + div(rest.map(elem => div(code(elem), "area-entry")).join(""), "area-list"), "area-set");
    }).join(""), "A list of areas the player traversed between in this game session.");
  }

  async renderInventories() {
    return div(Object.entries(this.inventories).map(([inventory, list]) => {
      return div(div(inventory, "area-title")
        + div(list.map(elem => div(code(elem.id), `inventory-entry-${elem.type}`)).join(""), "area-list"), "area-set")
    }))
  }

  async renderMissingDamagers() {
    return wrapDetails(
      "Missing Damagers",
      objectListToTable(Object.entries(this.missingDamagers).map(([id, groups]) => {
        groups = Array.from(groups);
        return groups.map(group => { return { id: code(id), group: code(group) } })
      }).reduce((acc, x) => [...acc, ...x], [])),
      "The game attempted to damage a creature with the ColliderGroups below, but was unable to find a damager for them."
    );
  }

  async renderLoadErrors() {
    return wrapDetails(
      "Unknown Load Errors",
      objectListToTable(this.loadErrors),
      "This is a list of EffectData addresses that failed to load, for which Logs &amp; Sorcery could not guess the offending mod."
    );
  }

  async renderIncompatibleMods() {
    return wrapDetails(
      "Incompatible Mods",
      div(objectListToTable(this.incompatibleMods))
    );
  }

  selector(name, callback, countWarn, countError) {
    let slug = slugify(name);
    game.selectors[`selector-${slug}`] = async () => callback.call(this);
    return createDiv(
      "mod",
      {
        id: `selector-${slug}`,
        onclick: async () => await clickButton(`selector-${slug}`),
      },
      createDiv("mod-headers", {}, [
        createDiv("selector-title", {}, name),
        createDiv("mod-errors", {}, [
          countWarn > 0 ? createSpan("mod-error-count", {}, countWarn) : null,
          countError > 0
          ? createSpan("mod-exception-count", {}, countError)
          : null,
        ]),
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
}

let game = new Game();

class Mod {
  constructor(name, folder) {
    this.name = name;
    this.folder = folder;
    this.assemblies = [];
    this.thunderscripts = [];
    this.namespaces = new Set();
    this.catalogs = [];
    this.modOptions = 0;
    this.invalidPaths = [];
    this.loadErrors = [];
    this.missingDLLs = [];
    this.missingData = [];
    this.exceptions = [];
    this.overrides = [];
    this.json = [];
    this.tags = new Set();
    this.slug = slugify(this.folder);
  }

  addInvalidJson(path, json, error) {
    this.loadErrors.push({id: json, error: "Could not parse JSON file: <br>" + div(error, "json") })
  }

  async complete() {
    let start = Date.now();
    this.name = this.name.split(/\\/)[0].replace(/[\d-]+$/, "");
    this.invalidPaths = Array.from(new Set(this.invalidPaths)).map((item) => {
      return {
        bundle: item
      }
    });
    if (
      this.assemblies.filter((assembly) => assembly.dll == "0Harmony.dll")
      .length > 0
    )
      this.tags.add("harmony");
    this.time = Date.now() - start;
  }

  counts() {
    return Object.entries({
      load: this.loadErrors.length,
      data: this.missingData.length + this.invalidPaths.length,
      error: this.exceptionCount()
    }).map(([desc, num]) =>
      num > 0 ? `<span class="mod-error-count">${num} ${desc}</span>` : ""
    );
  }

  getButtonLink() {
    return `mod-${this.slug}`;
  }

  loadErrorCount() {
    let count = this.loadErrors.length + this.missingDLLs.length + this.missingData.length;
    return count > 0 ? createSpan("mod-error-count", {}, count) : "";
  }

  exceptionCount() {
    let count = Object.values(this.exceptions).reduce(reduceExceptions, 0);
    return count > 0 ? createSpan("mod-exception-count", {}, count) : "";
  }

  sortKey() {
    let value = this.loadErrors.length + this.missingDLLs.length + this.missingData.length + Object.values(this.exceptions).reduce(reduceExceptions, 0);
    return value;
  }

  hasAnything() {
    return this.loadErrors.length + this.missingDLLs.length + this.missingData.length + Object.values(this.exceptions).reduce(reduceExceptions, 0);
  }

  renderList(bold) {
    game.selectors[`mod-${this.slug}`] = async () => await this.renderDetails();
    return createDiv("mod", {id: `mod-${this.slug}`, onclick: async () => await clickButton(`mod-${this.slug}`)},
      createDiv("mod-headers", {}, [
        createDiv(bold ? "selector-title" : "mod-title", {}, [this.name, ...this.renderTags()]),
        createDiv("mod-errors", {}, [this.loadErrorCount(), this.exceptionCount()]),
      ])
    );
  }

  renderTags() {
    return Array.from(this.tags).map(tag => TAG_ICONS[tag] ? createIcon(TAG_ICONS[tag], 'tag-icon') : '');
  }

  findException(hash) {
    return this.exceptions.find(elem => elem.hash == hash);
  }

  addException(exception) {
    const hash = exception.getHash();
    let found = this.findException(hash);
    if (found) {
      found.count += exception.count;
    } else {
      this.exceptions.push({ exception: exception, count: exception.count, hash: hash });
    }
  }

  async renderDetails() {
    let table = this.folder != "N/A" ? objectToTable(
      {
        name: this.name,
        author: this.author,
        folder: code(this.folder),
        namespaces: Array.from(this.namespaces)
        .map((namespace) => code(namespace))
        .join(", "),
        assemblies: this.assemblies
        .map((assembly) => code(assembly.dll))
        .join(", "),
        catalogs: this.catalogs
        .map((catalog) => code(catalog.catalog))
        .join(", "),
        tags: [...this.tags].join(", "),
        thunderscripts: this.thunderscripts.map(({namespace, class_name}) => namespace + "." + class_name).join(", "),
        mod_options: this.modOptions
      },
      "Details",
      false
    ) : "";
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
    let invalidPaths = objectListToTable(
      this.invalidPaths,
      undefined,
      "Invalid Paths"
    );
    let missingData = objectListToTable(
      this.missingData,
      undefined,
      "Missing Data",
      "Note: Mod attribution is 'best guess' and may not be accurate."
    );
    const list = [table, loadErrors, missingDLLs, invalidPaths, missingData]
      .filter(elem => elem)
      .map(div);

    const parent = containers.details;
    parent.replaceChildren();
    for (let i = 0; i < list.length; i++) {
      let elem = list[i];
      if (i > 0)
        parent.appendChild(newElement(hr()));
      parent.appendChild(newElement(elem));
      await maybeTakeABreak();
    }

    if (this.exceptions.length > 0) {
      if (parent.children.length > 0)
        parent.appendChild(newElement(hr()));
      parent.appendChild(newElement(heading("Exceptions", 2, "search-title")))
      let container = newElement(div());
      parent.lastChild.appendChild(await searchBar(container));
      parent.appendChild(container);
      for (let i = 0; i < this.exceptions.length; i++) {
        const exception = this.exceptions[i];
        const text = exception.exception.render(exception.count);
        if (!text) continue;
        let elem = newElement(text);
        if (elem)
          container.appendChild(elem)
        setProgress(i / this.exceptions.length * 100);
        await maybeTakeABreak();
      }
    }
  }
}

class Exception {
  constructor(type, error) {
    this.type = type;
    this.metadata = game.metadata;
    this.area = game.lastArea;
    this.level = game.lastLevel;
    this.eventType = "exception";
    this.error = error;
    this.lines = [];
    this.extra = "";
    this.tags = new Set();
    this.mods = new Set();
    this.count = 1;
    this.modReasons = {}
    this.keywords = [];
  }

  getHash() {
    let slug = (this.type + this.eventType + this.error + this.lines.map(line => line.getHash()).join("") + this.extra).toString();
    return (this.type + this.eventType + this.error + this.lines.map(line => line.getHash()).join("") + this.extra).toString().hashCode();
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

    let foundMod = false;
    let bestMod;

    if (this.type == "RemoteProviderException") {
      // RemoteProviderException : Invalid path in AssetBundleProvider: 'D:/SteamLibrary/steamapps/common/Blade & Sorcery/BladeAndSorcery_Data/StreamingAssets\Mods/InvertedSpear/invertedspearofheavenformini_assets_all.bundle'.
      match(
        this.error,
        /(?<prefix>.+?)'.+StreamingAssets\\(?<shortFolder>Mods\\(?<folder>[^\\]+)\\(.+\\)*(?<bundle>.+\.bundle))/,
        (groups) => {
          this.error = groups.prefix + code(groups.shortFolder);
          let mod;
          match(
            groups.bundle,
            /(?<catalog>.+?)_(assets_all|unitybuiltinshaders).bundle/,
            (groups) => {
              let { found, score, reason } = game.findModByCatalog(
                groups.catalog
              );
              if (found) {
                this.modReasons[found.folder] = { reason, score };
                mod = found;
              }
            }
          );
          if (!mod) {
            let { found, score, reason } = game.findModByFolder(groups.folder);
            if (found) {
              this.modReasons[found.folder] = { reason, score };
              mod = found;
            }
          }
          if (mod) {
            bestMod = mod;
            foundMod = true;
          }
          if (match(
            this.prevLine,
            /The AssetBundle '(?<bundle>.+?)' can't be loaded because (?<reason>.+)/,
            ({ bundle, reason }) => {
              switch (reason) {
                case "another AssetBundle with the same files is already loaded.":
                  game.addSuggestion("duplicate-bundle", { mod: mod.name, duplicate_bundle_found: bundle })
                  break;
                case "it was not built with the right version or build target.":
                  game.addSuggestion("bundle-version", { mod: mod.name, bundle: bundle })
                  break;
              }
            }
          )
          )
            mod?.invalidPaths.push(groups.bundle);
        }
      );
      match(
        this.error,
        /(?<prefix>.+?)'.+(?<shortFolder>StreamingAssets\\aa\\(.+\\)*(?<bundle>.+\.bundle))/,
        (groups) => {
          this.error = groups.prefix + code(groups.shortFolder);
        }
      )
    }

    let bestScore = 100000;
    if (!foundMod) {
      this.mods.forEach((mod) => {
        if (!this.tags.has("modded") && mod == "Base Game") {
          bestMod = game.baseGame;
          this.modReasons[bestMod.folder] = { reason: "base_game", score: 0 };
          bestScore = -1;
          return;
        }
        let { found, score, reason } = game.findModByNamespace(
          replaceNamespaces(mod)
        );
        if (!found) {
          ({ found, score, reason } = game.findModByAssembly(
            replaceNamespaces(mod)
          ));
        }
        if (!found) {
          ({ found, score, reason } = game.findModByFolder(
            replaceNamespaces(mod)
          ));
        }
        if (!found) {
          ({ found, score, reason } = game.fuzzyFindMod(mod));
        }

        if (found) {
          foundMods.add(found.name);
          this.modReasons[found.folder] = { reason, score };
          this.tags.add("modded");
          if (score < bestScore) {
            bestScore = score;
            bestMod = found;
          }
        }
      });
    }

    if (bestMod && bestMod.name == game.baseGame.name)
      game.baseGame.addException(
        this,
        bestMod.name,
        this.modReasons[bestMod.folder].reason
      );
    else if (bestMod)
      game.mods
        .find((mod) => mod.folder == bestMod.folder)
        .addException(
          this,
          bestMod.name,
          this.modReasons[bestMod.folder].reason
        );

    if (bestMod)
      this.mods = [bestMod];
    else
      this.mods = [];

    if (this.mods.size == 0) {
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
        let methodMods = this.mods.map(mod => mod.name).join(", ");
        game.addSuggestion("missing-method", {mods: methodMods ? methodMods : italic("(Unknown)"), method: code(new ExceptionLine(signature).getPath())})
        this.error = "Method not found: " + span(new ExceptionLine(signature).getPath(), "code");
      });
    }
    this.keywords = this.getKeywords();
  }

  getKeywords() {
    let keywords;
    if (this.lines)
      keywords = new Set(
        this.lines.map((line) => line.getParts().func).reduce((a, b) => [...a, ...b], [])
      );
    else keywords = new Set();
    keywords.add(this.type);
    for (let tag of this.tags) {
      keywords.add(tag);
    }
    for (let mod of this.mods) {
      keywords.add(mod.name);
    }
    return Array.from(keywords).join(" ").toLowerCase();
  }

  renderPreview() {
    if (this.tags.has("modded")) {
      return (
        this.lines
        .find((line) => line.modded && line.priority)
        ?.renderPreview() ?? this.lines[0].renderPreview()
      );
    } else {
      return (
        this.lines
        .find((line) => line.priority)
        ?.renderPreview() ?? this.lines[0].renderPreview()
      );
    }
  }

  render(count) {
    count ??= this.count;
    return `<div class="exception event" onclick="expandException(this)" data-keywords="${this.keywords}">
                    <div class="event-container">
                    <span class="tags">
                    ${this.metadata ? `<div class="event-time">${getTimestamp(this.metadata)}</div>` : ""}
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
                    <div class="exception-preview">
                    <span class="exception-title fade">
                    ${
                      [...this.mods].length > 0
                        ? `${[...this.mods]
                            .map((mod) => span(mod.name + modCertaintyIcon(this.modReasons[mod.folder].score),
                              `exception-mod reason-${this.modReasons[mod.folder].reason} certainty-${modCertainty(this.modReasons[mod.folder].score)}`,
                              {
                                title: getCertainty(this.modReasons[mod.folder].score) + " " + getReason(this.modReasons[mod.folder].reason, this.modReasons[mod.folder].score),
                                onclick: `clickButton('${mod.getButtonLink()}')`
                              }))
                            .join(" ")}`
                        : ""
                    }
                    ${this.lines.length > 0 ? `${this.renderPreview()}` : ""}</span>
                    <span class="exception-level">${this.area ? `<span class="exception-area dim">${this.area}</span><span class="dim code exception-tilde"> ~ </span>` : ""}${this.level ? `<span class="exception-area-level dim">${this.level}</span>` : ""}</span></span></span>
                    </div>
                    ${
                      this.error
                        ? `<span class="exception-title">${this.error}</span>`
                        : ""
                    }
                    ${
                      this.lines.length > 0
                        ? `<div class="event-details expand event-hidden">
                           <div class="exception-lines">${this.lines
                             .map((line) => line.render())
                             .join("")}</div>
                           </div>`
                        : this.extra
                        ? `<div class="event-details expand event-hidden"><div class="exception-extra">${this.extra}</div></div>`
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
    this.modded = false;
    this.extraCount = 0;
    if (filename?.match(/<(.+)>/)) {
      this.filename = filename.match(/<(?<address>.+)>/).groups.address;
      this.line = -1;
    }

    this.priority = true;

    for (let name of IGNORED_PREVIEW) {
      if (this.location.match(name))
        this.priority = false;
    }
  }

  getHash() {
    return (this.location + this.address + this.filename + this.line + this.extraCount + this.filename).hashCode();
  }

  getNamespace() {
    const funcSig = this.location.match(/(?<func>.+?) ?\((?<args>.+)?\)/);
    return [...funcSig.groups.func.match(/(\w+(<.+?>)?)(?:[^:. ()]+)?/g)]
      .slice(0, 2)
      .join(".");
  }

  getParts() {
    const funcSig = this.location.match(/(?<func>.+?) ?\((?<args>.+)?\)/);
    if (funcSig) {
      return {
        func: [
          ...funcSig.groups.func
          .replace(/\+<(?<method>.+?)>.+?\.MoveNext/g, (_, method) => {return `.${method}.MoveNext`})
          .replace(/\+<>.+?\.<(?<method>.+?)>[^\. ]+/g, (_, method) => {return `.${method}.lambda`})
          .matchAll(/(\w+(<.+?>)?)(?:[^:. ()]+)?/g),
        ].map((x) =>
          x[1].replace(
            /<(.+)>/g,
            (_, type) =>
            `${type.split(".").pop()}`
          )
        ),
        args: funcSig.groups.args ?? ""
      };
    }
    return {};
  }

  renderFuncPath(parts, filter) {
    let i = 0;
    return parts
      .map((x) =>
        x.replace(
          /<(.+)>/,
          (_, type) =>
          ` <span class="dim">&lt;${type.split(".").pop()}&gt;</span>`
        )
      )
      .filter(filter ?? (_ => true))
      .map((x) => {
        switch (x) {
          case "ctor": return '<span class="italic">constructor</span>';
          case "MoveNext": return '<span class="fade">MoveNext</span>';
          default: return `<span class="func-part func-part-${parts.length - (i++)}">${x}</span>`;
        }
      });
  }

  getPath() {
    const {func, args} = this.getParts();
    let funcPart = this.renderFuncPath(func).join(`<span class="dim"> > </span>`);
    let argsPart = [];
    argsPart = [
      ...args.matchAll(
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

  getShortPath() {
    const {func} = this.getParts();
    let funcPart = this.renderFuncPath(func, (x) => x != "MoveNext" && x != "ctor");
    funcPart = funcPart
      .slice(funcPart.length - 2)
      .join(`<span class="dim func-part-arrow"> > </span>`);
    if (this.filename && this.line >= 0)
      funcPart += `<span class="preview-filename"><span class="dim"> ~ </span><span class="dim">${this.shortFileName()}:${this.line}</span></span>`;
    return `${funcPart}`;
  }

  replaceArgTypes(arg) {
    return ARG_REPLACEMENTS[arg.toLowerCase()] ?? arg;
  }

  shortFileName() {
    if (this.filename) {
      let match = this.filename
        .replace(/\\/g, "/")
        .match(/(?<prefix>.+\/)(?<folder>.+?)\/(?<filename>.+?\.cs)$/)
        ?.groups;
      if (match) {
        let { folder, filename } = match;
        return `${folder ? folder + "/" : ""}${filename}`;
      }
      return this.filename;
    }
    return "";
  }

  renderFilename() {
    return this.filename
      .replace(/\\/g, "/")
      .replace(
        /E:\/Dev\/BladeAndSorcery\/Library\/PackageCache\/(?<package>.+?)@(?<version>.+?)\//,
        (_, name, version) => `<span class="dim">[${name} @ ${version}]</span> `
      )
      .replace(
        "(E:/Dev|H:/Warpfrog)/(BladeAndSorcery|ThunderRoad)/",
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

  renderPreview() {
    return `<span class="dim code indent"> @ </span><span class="exception-preview-flex fade" title="${
      this.address
    }">${this.getShortPath()}</span>`;
  }
}

class TimelineEvent {
  constructor(text, description, props, color, metadata) {
    this.color = color ?? "color-success";
    this.text = text;
    this.metadata = metadata;
    this.description = description;
    this.props = props ?? {};
    this.eventType = "timeline";
    this.keywords = this.getKeywords();
    this.buttons = [];
    this.params = {};
    this.areas = [];
    this.count = 1;
  }

  getKeywords() {
    let keywords = new Set(this.text.toLowerCase().replace(/<\/?.+?>/g, "").split(" "));
    keywords.add(this.eventType);
    if (this.description) {
      for (let word of this.description.toLowerCase().split(" "))
        keywords.add(word);
    }
    return Array.from(keywords).join(" ").toLowerCase();
  }

  getHash() {
    return (this.text + this.color + this.description + JSON.stringify(this.props) + this.eventType).toString().hashCode();
  }

  render() {
    let desc = [];
    if (this.description !== undefined)
      desc.push(`<div>${this.description}</div>`);
    if (this.props !== undefined)
      if (Array.isArray(this.props)) {
        desc.push("<div class='event-tag-list'>");
        this.props.forEach(elem => {
          desc.push(span(elem, "code event-tag"))
        });
        desc.push("</div>");
      } else {
        Object.keys(this.props).forEach((key) => {
          if (this.props[key] !== undefined)
            desc.push(
              `<div class="split event-prop thin"><span class="dim">${niceify(
                key
              )}</span><span class="select align-right">${renderValue(
                this.props[key]
              )}</span></div>`
            );
        });
      }
    return `<div class="global event ${this.color ?? ""}" onclick="expandException(this)" data-keywords="${this.keywords}" data-params='${JSON.stringify(this.params)}'>
              <div class="event-container">
                    <div class="event-title">${span((this.count > 1
                      ? `<span class="fade count normal">${this.count}x</span>`
                      : "") +
                      this.text)}${this.metadata ? span(getTimestamp(this.metadata), "event-time") : ""}</div>
                    ${
                      desc.length > 0
                        ? `<div class="event-details">${desc.join("")}</div>`
                        : ""
                    }
                    ${this.buttons ? this.buttons.map(button => `<button onclick="${button.action}(event, JSON.parse(this.parentElement.parentElement.dataset.params))">${button.title}</button>`) : ""}
                    ${this.areas.length > 0 ? hr() + div("Click to show loaded areas...", "dim italic") + div(ol(this.areas, "code"), "event-details expand event-hidden exception-lines") : ""}
              </div>
            </div>`;
  }
}

function match(line, re, callback) {
  let found = line.match(re);
  if (found && callback) callback(found.groups);
  return found != null;
}

let currentLines = 0;

function setupProgressDisplay() {
  return {
    lines_analysed: () => `${currentLines}`,
    mods: () => game.mods.length,
    exceptions: () => game.exceptions.reduce(reduceExceptions, 0),
    suggestions_found: () => Object.keys(game.suggestions).length,
    levels_loaded: () => game.levels.length,
    areas_traversed: () =>
    game.areas.map((list) => list.length - 2).reduce(reduceNumber, 0),
  };
}

function reduceNumber(acc, x) { return acc + x }
function reduceObjectList(acc, x) { return acc + Object.values(x).length }
function reduceExceptions(acc, x) { return acc + x.count }

function refreshProgress(rows) {
  for (let [key, value] of Object.entries(rows))
    containers.details.querySelector(`#td-${key}`).innerHTML = value();
}

async function parse(file) {
  let state = "default";
  game = new Game();
  let exception = null;
  let prev = "";
  let nextPrev = "";
  let skills = [];

  let rows = setupProgressDisplay();
  containers.details.innerHTML = objectToTable(rows, "Progress", true);

  let i = 0;
  let lastStatus = 0;

  async function parseLine(line, index, size) {
    if (line.startsWith("[bHaptics] Initialize()")) {
      return;
    }
    line = (line
      .replace(/^\d+-\d+-\d+T\d+:\d+:\d+\.\d+(: [A-Z]+ .+? *: | \d+:\d+:\d+.\d+\s+\d+\s+\d+ [A-Z] Unity\s+: )/g, "")
      .replace(/\//g, "\\")
      .replace(XML_REGEX, ""));

    match(line, LOG_REGEX, (groups) => {
      if (game.metadata === undefined) {
        game.startMetadata = groups;
      }
      game.lastMetadata = game.metadata;
      game.metadata = groups;
      line = line.replace(LOG_REGEX, "");
    });

    match(
      line,
      /^\d+-\d+-\d+T\d+:\d+:\d+.\d+Z (?<line>.+)/,
      ({ log }) => line = log
    );

    prev = nextPrev;
    nextPrev = line;
    i++;
    currentLines = i;
    let progress = Math.round(index / size * 100);
    if (progress != lastStatus) {
      lastStatus = progress
      setStatus(`Reading file: ${progress}%`);
      refreshProgress(rows);
    }
    setProgress((index / size) * PROGRESS_READ);

    // determine state changes
    if (state == "exception") {
      if (
        match(line, /Parameter name: (?<parameter>.+)/, (groups) => {
          if (exception)
            exception.error +=
              " Parameter: " + `<code>${groups.parameter}</code>`;
        })
      ) {
      } else if (!line.match(/^(  at |Rethrow as |You probably need to assign the .+ variable of the .+ script in the inspector.)/)) {
        // if line is not an exception, save it and reset to default:
        if (exception != null) {
          game.addException(exception);
          exception = null;
        }
        state = "default";
      }
    }

    if (state == "system-info" && !match(line, /^\[.+?\]\s*:/)) state = "default";

    if (
      match(
        line,
        /^(Exception in (ThunderScript )?Update Loop: |.+ )?((System|UnityEngine)\.)?(?<type>(\w+\.)*\w*Exception)(\s*: (?<error>.+?))?( assembly:.+)?$/,
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
          exception.prevLine = prev;
        }
      )
    )
      return;

    // Match game pool generation finishing and the loading being 'complete'
    if (match(line, /.*Complete pool generation finished in: \d+\.\d+ sec/, () => {
      game.begin();
    })) return;

    switch (state) {
      case "skills":
        if (
          !match(line, /^ - (?<id>.+)/, (groups) => {
            skills.push(groups.id);
          })
        ) {
          game.addSkillList(skills);
          state = "default";
        }
        break;
      case "system-info":
        match(line, /\[(?<key>.+?)\]\s*:\s*(?<value>.+)/, (groups) => {
          if (SYSTEM_INFO_KEYS[groups.key])
            game.system[SYSTEM_INFO_KEYS[groups.key]] = groups.value;
        });
        break;
      case "default":
        if (matchSystemInfo(line)) return;

        // Match load time events for pie chart
        match(line, /(-+> ?)?(\[(?<category>\w+)\] )?(?<process>.+) in (?<time>[\d\.]+) sec/, ({category, process, time}) =>
          game.addTime(process, parseFloat(time), category)
        );

        // Match old (< U12.3) mod detection
        if (match(
          line,
          /Added valid mod folder: (?<folder>.+). Mod: (?<mod>.+)/,
          ({ folder, mod }) => {
            game.findOrCreateMod(mod, folder);
          }
        )) return;
        // Match mod assembly
        // [ModManager][Assembly] - Loading assembly: Wand/WandModule.dll

        if (match(
          line,
          /\[ModManager\]\[Assembly\]((\[(?<mod>.+?)\])| -) Loading [Aa]ssembly: ?(?<path>([^\\]+\\)+)(?<dll>.+\.dll)/,
          ({ mod, path, dll }) => {
            let folder = path.split("\\")[0];
            let {found} = game.findOrCreateMod(mod, folder);
            found?.assemblies.push({
              path: path.replace(/\\$/, "").replace(/\\/, "/"),
              dll: dll,
            });
            found?.tags.add("dll");
          }
        )) return;

        // Match mod debug symbols
        if (match(
          line,
          /\[ModManager\]\[Assembly\]\[(?<mod>.+?)\] Loading Assembly Debug Symbols: (?<path>([^\\]+\\)+)(?<dll>.+\.pdb)/,
          ({ mod, path }) => {
            let folder = path.split("\\")[0];
            game.findOrCreateMod(mod, folder).found.tags.add("pdb");
          }
        )) return;

        // Match mod catalog json file
        if (match(
          line,
          /\[ModManager\]\[Addressable\]\[(?<mod>.+?)\] - Loading Addressable Assets Catalog: .*(?<catalog>catalog_.+\.json)/,
          ({ mod, catalog }) => {
            game.findOrCreateMod(mod).found.catalogs.push({
              catalog: catalog,
            });
          }
        )) return;

        // Match default data being overridden
        if (match(
          line,
          /\[ModManager\]\[Catalog\]\[(?<mod>.+?)\] Overriding: \[(?<type>.+)\]\[(?<className>.+)\]\[(?<id>.+)\] with: (?<path>([^\\]+\\)+)(?<file>.+\.json)/,
          ({ mod, type, className, id, path, file }) => {
            let folder = path.split("\\")[0];
            game.findOrCreateMod(mod, folder).found.overrides.push({
              type: type,
              class: className,
              id: id,
              path: path.replace(/\\$/, "").replace(/\\/, "/"),
              file: file,
            });
          }
        )) return;

        // ModOption count
        if (match(
          line,
          /\[ModManager\]\[Catalog\]\[(?<mod>.+?)\] Loaded (?<count>\d+) ModOptions/,
          ({ mod, count }) => {
            game.findOrCreateMod(mod).found.modOptions = count;
          }
        )) return;

        // ModOption count
        if (
          match(
            line,
            /\[ModManager\]\[ThunderScript\]\[(?<mod>.+?)\] Loaded ThunderScript: (?<namespace>.+?)\.(?<class_name>.+?) on mod:.+/,
            ({ mod, namespace, class_name }) =>
            game
            .findOrCreateMod(mod)
            .found.thunderscripts.push({ namespace, class_name })
          )
        )
          return;

        if (match(
          line,
          /\[JSON\]\[(?<mod>.+)\] - Loaded file: (?<path>.+)\\(?<file>[^\\]+).json/,
          (groups) => {
            game.findModByFolder(groups.mod).found?.json.push({
              file: groups.file,
              path: groups.path.replace(/\\/g, "/"),
            });
          }
        )) return;

        // Match invalid game version
        if (match(
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
        )) return;

        // Match addresses not found
        if (match(
          line,
          /Address \[(?<address>.+)\] not found for \[(?<id>.+) (\((?<type>.+)\))?\]/,
          (groups) => {
            var entry = {
              address: groups.address,
              id: groups.id,
              type: groups.type,
            };
            if (
              !game.missingData.find(
                (element) => element.address == groups.address
              )
            )
              game.missingData.push(entry);
          }
        )) return;

        // Match JSON files that cannot be read due to missing assemblies.
        if (match(
          prev,
          /LoadJson : Cannot read json file .+StreamingAssets\\Mods\\(?<path>([^\\]+\\)+)(?<json>.+\.json) ?\((?<error>.+)\)/,
          ({ path, json, error }) => {
            if (!match(
              line,
              /Could not load assembly '(?<assembly>.+)'\./,
              ({ assembly }) => {
                let mod = game.findOrCreateMod(path.split(/\\/)[0]).found;
                mod.missingDLLs.push({
                  json: json,
                  possible_missing_dll_name: code(assembly + ".dll"),
                });
                game.addSuggestion("check-dll", {
                  mod: mod.name,
                  possible_missing_dll_name: code(assembly + ".dll"),
                });
              }
            )) {
              let mod = game.findOrCreateMod(path.split(/\\/)[0]).found;
              mod.addInvalidJson(path, json, error);
              game.addSuggestion("broken-json", {
                mod: mod.name,
                json_file: code(json),
                error: div(error, "json")
              });
            }
          }
        )) return;

        if (match(
          line,
          /EffectData: (?<id>.+?)'s effectModuleMesh meshAddress is null or empty. Has it not been set\?/,
          (groups) => {
            let mod = game.fuzzyFindMod(groups.id).found;
            if (mod)
              mod?.loadErrors.push({
                id: groups.id,
                error: `An ${code("EffectModuleMesh")} in this effect has an invalid or null ${code("meshAddress")}.`,
              });
            else
              game?.loadErrors.push({
                id: groups.id,
                error: `An ${code("EffectModuleMesh")} in this effect has an invalid or null ${code("meshAddress")}.`,
              });
          }
        )) return;

        if (match(
          line,
          /EffectData: (?<id>.+?)'s effectModuleParticle: (?<address>.+?) has a null effectParticlePrefab. Did it not get loaded\?/,
          (groups) => {
            let parts = groups.address.split(".");
            let mod;
            if (parts.count > 2) mod = game.fuzzyFindMod(parts[1]).found;
            if (!mod && parts.count > 1)
              mod = game.fuzzyFindMod(parts[0]).found;
            if (!mod) mod = game.fuzzyFindMod(groups.id).found;
            if (mod)
              mod.loadErrors.push({
                id: groups.id,
                error: `Could not find a prefab with an attached ${code("EffectParticle")} at address ${code(groups.address, "padded")} for an ${code("EffectModuleParticle")} in this effect.`,
              });
            else
              game.loadErrors.push({
                id: groups.id,
                error: `Could not find a prefab with an attached ${code("EffectParticle")} at address ${code(groups.address, "padded")} for an ${code("EffectModuleParticle")} in this effect.`,
              });
          }
        )) return;

        if (match(
          line,
          /EffectData: (?<id>.+?)'s effectModuleVfx does not have a valid vfxAddress or meshAddress\./,
          (groups) => {
            let mod = game.fuzzyFindMod(groups.id).found;
            if (mod)
              mod.loadErrors.push({
                id: groups.id,
                error: `An ${code("EffectModuleVfx")} in this effect has an invalid ${code("vfxAddress")} or ${code("meshAddress")}.`,
              });
            else
              game.loadErrors.push({
                id: groups.id,
                error: `An ${code("EffectModuleVfx")} in this effect has an invalid ${code("vfxAddress")} or ${code("meshAddress")}.`,
              });
          }
        )) return;

        if (match(
          line,
          /^ItemSpawner (?<spawner>.+) has a self reference loop in parent spawner chain/,
          ({spawner}) => {
            game.addEvent(
              `Found cyclic graph in an  ${code("ItemSpawner")}`,
              `The following ${code("ItemSpawner")} has a cycle in its chain of ${code("parentSpawner")} references.<br>${code(spawner)}`,
            );
          }
        )) return;

        // Match loading thunderscripts
        if (match(
          line,
          /\[ModManager\]\[ThunderScript\] - Loaded ThunderScript: (?<namespace>[^.]+)\.(?<class>.+) on mod: (?<name>.+) in assembly: (?<assembly>.+), Version=.+/,
          (groups) => {
            let mod = game.findModByName(groups.name).found;
            mod.namespaces.add(groups.namespace);
          }
        )) return;

        // Match addressable content build bugs
        if (match(
          line,
          /Cannot recognize file type for entry located at '(?<path>.+)'. Asset import failed for using an unsupported file type./,
          (groups) => {
            game.addEvent(
              "Asset import failed",
              "Cannot recognize file type for entry; asset import failed for using an unsupported file type.",
              { path: groups.path },
              "error"
            );
          }
        )) return;

        // Match gamemode load
        if (match(
          line,
          /^\[GameModeManager\] Loaded game mode: (?<mode>.+?)\s*$/,
          ({ mode }) => {
            game.addEvent(`Loaded Gamemode ${bold(mode)}`, undefined, undefined, "color-gamemode");
          }
        )) return;

        // Match gamemode unload
        if (match(
          line,
          /^\[GameModeManager\] Unloaded game mode: (?<mode>.+?)\s*$/,
          ({ mode }) => {
            game.addEvent(`Unloaded Gamemode ${bold(mode)}`, undefined, undefined, "color-gamemode");
          }
        )) return;

        // Match QA menu level load events
        if (match(
          line,
          /^Load level Id - (?<level>.+?) \| mode:(?<mode>.+?)(?<options>( \| (.+?)=(.+?))*)\s*$/,
          (groups) => {
            game.addEvent(`Level ${bold(groups.level)} loading from QA menu`, undefined, {
              level: groups.level,
              mode: groups.mode,
            });

            game.levels.push(groups.level);
            game.lastLevel = groups.level;
            game.lastArea = null;
          }
        )) return;

        // Match level load events
        if (match(
          line,
          /^Load level (?<level>.+?)( using mode (?<mode>.+))?$/,
          ({level, mode}) => {
            game.addEvent(
              `Level ${bold(level)} loading...`,
              undefined,
              {
                level: level,
                mode: mode,
              },
              "color-level"
            );

            game.lastEvent.params = { level: level, gamemode: mode }
            game.lastEvent.buttons.push({
              title: "Copy Args",
              action: "copyLevelArgs",
            });
            game.levels.push(level);
            game.lastLevel = level;
            game.lastArea = null;
          }
        )) return;

        if (match(line, /^Option: (?<name>.+): (?<value>.+)/, (groups) => {
          game.lastEvent.params[groups.name] = groups.value;
          game.lastEvent.props[groups.name] = renderValue(groups.value);
        })) return;
        if (match(line, /^Module: (?<name>.+)/, (groups) => {
          if (game.lastEvent.props.modules === undefined) {
            game.lastEvent.props.modules = code(groups.name);
          } else {
            game.lastEvent.props.modules += "<br>" + code(groups.name);
          }
        })) return;
        if (match(
          line,
          /^Dungeon generation success with (?<retries>\d+) area retry. Used seed:(?<seed>-?\d+)/,
          ({retries, seed}) => {
            game.lastSeed = seed;
            game.lastEvent.params["Seed"] = seed
            game.lastEvent.props["Seed"] = renderValue(seed);
            game.lastEvent.props["Generation Retries"] = renderValue(
              retries
            );
          }
        )) return;
        if (
          match(
            line,
            /\[Area\] Instantiating area: (?<area>.+) completed/,
            ({ area }) => {
              game.lastEvent.areas.push(area);
            }
          )
        )
          return;

        if (match(
          line,
          /Total time to load (?<level>.+): (?<time>.+) sec/,
          (groups) => {
            game.addEvent(
              `Level ${bold(groups.level)} finished loading.`,
              undefined,
              {
                level: groups.level,
                load_time: `${groups.time}s`,
              }
            );
          }
        )) return;

        if (match(line, /^\[system info\]\s*$/, _ => {
          state = "system-info";
        })) return;

        if (match(line, /Loaded player skills:/, (_) => {
          state = "skills";
          skills = [];
        })) return;

        if (match(
          line,
          /Player Enter : (?<enter>.+) And Leave : (?<exit>.+)/,
          (groups) => {
            game.addEvent(
              `Player transitioned from area ${code(
                groups.exit
              )} to area ${code(groups.enter)}`
            );
            game.addAreaTransition(groups.exit, groups.enter);
          }
        )) return;

        // Match missing damagers
        if (match(
          line,
          /Tried to damage with ColliderGroup \[(?<item>.+?) \(ThunderRoad.Item\)\\(?<group>.+?) \(ThunderRoad.ColliderGroup\)\\(?<collider>.+?) \(UnityEngine.+?Collider\)\] but no damagers were found!/,
          (groups) => {
            game.addMissingDamager(groups.item, groups.group, groups.collider);
          }
        )) return;

        // Match noodlemen
        if (match(
          line,
          /Creating cap mesh for renderer (?<renderer>.+?) that doesn't have a valid root bone index!/,
          ({renderer}) => {
            game.addEvent("Noodlemen Detected", `You probably saw some eldritch horrors, sorry about that!`, {renderer: `<code>${renderer}</code>`}, "color-error")
          }
        )) return;

        // Match screenshot taken
        if (match(
          line,
          /Saved screenshot to: (?<path>.+)\\(?<file>[^\\]+?.jpg)/,
          ({path, file}) => {
            let camera = undefined;
            match(prev, /Taking a screenshot from camera: (?<cam>.+)/, ({cam}) => camera = cam);
            game.addEvent("Screenshot taken", undefined, {path, file, camera}, "color-skills");
          }
        )) return;

        // Match game load events
        if (match(line, /Game started in (?<time>.+) sec/, (groups) => {
          game.addEvent(`Game starting`, undefined, {
            startup_time: `${groups.time}s`,
          });
        })) return;

        // Match player possession
        if (match(line, /Player take possession of : (?<creature>.+)/, (groups) => {
          game.addEvent("Player possessed Creature", undefined, {
            creature: groups.creature,
          });
        })) return;

        // Match inventory events
        if (match(
          line,
          /Item (?<id>.+) (?<action>added|removed) (to players container|from player inventory) (?<inventory>.+)/,
          (groups) => {
            let text = "";
            if (groups.action == "added") {
              text = "Added item to inventory";
              game.addInventoryItem(groups.id, groups.inventory);
            } else if (groups.action == "removed") {
              text = "Removed item from inventory";
              game.removeInventoryItem(groups.id, groups.inventory);
            }
            if (text == "") return;
            game.addEvent(
              text,
              undefined,
              {
                item: code(groups.id),
                inventory: code(groups.inventory),
              },
              "color-inventory"
            );
          }
        )) return;

        // Match pooled particles being destroyed
        if (match(line, /Effect (?<name>.+) has been destroyed but it should not!/, (groups) => {
          game.addEvent(`Pooled effect was destroyed.`, "", { id: groups.name }, "color-warning");
        })) return;

        // Match hard crash
        if (match(line, /Crash!!!/, () => {
          game.addEvent(
            "Hard crash!",
            "Check the log for stack traces.<br>This may an underlying problem with your PC, or GPU drivers.",
            undefined,
            "color-fatal"
          );
        })) return;

        // Match out of RAM
        if (match(line, /Could not allocate memory: System out of memory!/, () => {
          game.addEvent(
            "System out of memory!",
            "You may either have too many other programs open, or you might not have enough RAM on your PC. It's recommended to have at least 16GB total RAM for Blade and Sorcery. If you have enough RAM, this problem has also been solved in the past by re-installing GPU drivers.",
            undefined,
            "color-fatal"
          );
        })) return;

        if (match(
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
        )) return;
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
            let exceptionLine = new ExceptionLine(
              groups.location,
              groups.address,
              groups.filename,
              groups.line
            );
            if (groups.location.match(/__instance|Prefix|Postfix|_Patch(\d+)/))
              exception.tags.add("harmony");
            if (
              !groups.location.match(UNMODDED_REGEX)
            ) {
              let match = groups.location.match(/^(?<namespace>(\w|\+)+)\./);
              if (match != null) exception.mods.add(match.groups.namespace);
              exception.tags.add("modded");
              exceptionLine.modded = true;
            } else {
              let match = groups.location.match(/^(?<namespace>(\w|\+)+)\./);
              if (match != null) exception.mods.add("Base Game");
              exception.tags.add("unmodded");
              exceptionLine.modded = false;
            }
            exception.lines.push(exceptionLine);
          }
        );
        break;
    }
  }

  await readFileLines(file, parseLine)

  startTime = Date.now() - 5000;

  game.info.parse_time = (Date.now() - parseStart) / 1000;
  parseStart = Date.now();
  game.begin();
  await game.finish();
  game.info.process_time = (Date.now() - parseStart) / 1000;
}

function matchSystemInfo(line) {
  // Match game path; do not return
  if (match(line, /^Mono path\[0\] = '(?<path>.+)'$/, (groups) => {
    game.system.game_directory = groups.path.replace(/\\/g, "/");
  }));

  if (match(line, /^Mono path\[0\] = '.+(Oculus)?\\Software.+/i, () => {
    game.system.platform ??= "Oculus";
  })) return true;
  if (match(line, /^Mono path\[0\] = '.+\\steamapps\\common.+/i, () => {
    game.system.platform ??= "Steam";
  })) return true;
  if (match(line, /^Mono path\[0\] = '.+(Downloads|Desktop).*\\steamapps\\common.+/i, () => {
    game.system.platform = "pirated";
  })) return true;
  if (match(line, /^Successfully loaded content catalog at path (?<path>.+)'$/, (groups) => {
    game.system.game_directory = groups.path.replace(/\\/g, "/");
  })) return true;
  if (match(line, /^Successfully loaded content catalog at path .+(Oculus)?\\Software.+/i, () => {
    game.system.platform ??= "Oculus";
  })) return true;
  if (match(line, /^Successfully loaded content catalog at path .+\\steamapps\\common.+/i, () => {
    game.system.platform ??= "Steam";
  })) return true;
  if (match(line, /^Successfully loaded content catalog at path .+(Downloads|Desktop).*\\steamapps\\common.+/i, () => {
    game.system.platform = "pirated";
  })) return true;
  if (match(line, /^Game version: (?<version>.+)/, (groups) => {
    game.system.version = groups.version;
    if (game.system.version.startsWith("0.12.2"))
      game.system.platform = "pirated";
  })) return true;
  if (match(line, /^Initialize engine version: (?<version>.+) \(.+\)/, (groups) => {
    game.system.unity_version = groups.version;
  })) return true;
  if (match(line, /^Device model : (?<model>.+)/, (groups) => {
    game.system.hmd_model = groups.model;
    if (groups.model == "Miramar") game.system.hmd_model += " (Quest 2)";
  })) return true;
  if (match(line, /^HeadDevice: (?<model>.+)/, (groups) => {
    game.system.hmd_model = groups.model;
    if (groups.model == "Miramar") game.system.hmd_model += " (Quest 2)";
  })) return true;
  if (match(line, /^LoadedDeviceName : (?<device>.+)/, (groups) => {
    game.system.hmd = groups.device;
  })) return true;
  if (match(line, /^Loader: (?<device>.+) \|/, (groups) => {
    game.system.hmd = groups.device;
  })) return true;
  if (match(line, /^ +Renderer: +(?<gpu>.+)( \(ID=.+\))/, (groups) => {
    game.system.gpu = groups.gpu;
  })) return true;
  if (match(line, /^ +VRAM: +(?<vram>\d+ MB)/, (groups) => {
    game.system.gpu_vram = groups.vram;
  })) return true;
  if (match(line, /^ +Driver: +(?<driver>.+)/, (groups) => {
    game.system.gpu_driver = groups.driver;
  })) return true;
  if (match(line, /^Platform \[Android\] initialized/, () => {
    game.system.platform ??= "Nomad";
  })) return true;
  return false;
}
