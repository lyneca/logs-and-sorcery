let exceptions = [];
function parseText(text) {
  let exception;
  let prev = "";
  for (let line of text.split("\n")) {
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
    match(
      line,
      /^(Exception in (ThunderScript )?Update Loop: |.+ )?((System|UnityEngine)\.)?(?<type>(\w+\.)*\w*Exception)(\s*: (?<error>.+?))?( assembly:.+)?$/,
      (groups) => {
        if (exception != null) {
          exceptions.push(exception);
          exception = null;
        }

        exception = new Exception(groups.type, groups.error);
        exception.prevLine = prev;
      }
    )
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
    prevLine = line;
  }
  if (exception != null) {
    exceptions.push(exception);
    exception = null;
  }
}

const textArea = document.getElementById("exception");
const modDetails = document.getElementById("mod-details");

textArea.oninput = e => {
  exceptions = [];
  game = null;
  game = new Game();
  game.begin();
  parseText(textArea.value);
  modDetails.innerHTML = "";
  text = "<div>";
  for (let exception of exceptions) {
    exception.complete();
    text += exception.render();
  }
  text += "</div>";
  modDetails.innerHTML = text;
};
