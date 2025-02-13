import { Terminal } from "../../Terminal";
import { BaseServer } from "../../Server/BaseServer";
import { findRunningScriptByPid } from "../../Script/ScriptHelpers";
import { isScriptFilename, validScriptExtensions } from "../../Script/isScriptFilename";
import { compareArrays } from "../../utils/helpers/compareArrays";
import { LogBoxEvents } from "../../ui/React/LogBoxManager";

export function tail(commandArray: (string | number | boolean)[], server: BaseServer): void {
  try {
    if (commandArray.length < 1) {
      Terminal.error("Incorrect number of arguments. Usage: tail [script] [arg1] [arg2]...");
    } else if (typeof commandArray[0] === "string") {
      const scriptName = Terminal.getFilepath(commandArray[0]);
      if (!scriptName) return Terminal.error(`Invalid filename: ${commandArray[0]}`);
      if (!isScriptFilename(scriptName)) {
        Terminal.error(`tail can only be called on ${validScriptExtensions.join(", ")} files, or by PID`);
        return;
      }

      // Get script arguments
      const args = [];
      for (let i = 1; i < commandArray.length; ++i) {
        args.push(commandArray[i]);
      }

      // go over all the running scripts. If there's a perfect
      // match, use it!
      for (let i = 0; i < server.runningScripts.length; ++i) {
        if (server.runningScripts[i].filename === scriptName && compareArrays(server.runningScripts[i].args, args)) {
          LogBoxEvents.emit(server.runningScripts[i]);
          return;
        }
      }

      // Find all scripts that are potential candidates.
      const candidates = [];
      for (let i = 0; i < server.runningScripts.length; ++i) {
        // only scripts that have more arguments (equal arguments is already caught)
        if (server.runningScripts[i].args.length < args.length) continue;
        // make a smaller copy of the args.
        const args2 = server.runningScripts[i].args.slice(0, args.length);
        if (server.runningScripts[i].filename === scriptName && compareArrays(args2, args)) {
          candidates.push(server.runningScripts[i]);
        }
      }

      // If there's only 1 possible choice, use that.
      if (candidates.length === 1) {
        LogBoxEvents.emit(candidates[0]);
        return;
      }

      // otherwise lists all possible conflicting choices.
      if (candidates.length > 1) {
        Terminal.error("Found several potential candidates:");
        for (const candidate of candidates) Terminal.error(`${candidate.filename} ${candidate.args.join(" ")}`);
        Terminal.error("Script arguments need to be specified.");
        return;
      }

      // if there's no candidate then we just don't know.
      Terminal.error(`No script named ${scriptName} is running on the server`);
    } else if (typeof commandArray[0] === "number") {
      const runningScript = findRunningScriptByPid(commandArray[0], server);
      if (runningScript == null) {
        Terminal.error(`No script with PID ${commandArray[0]} is running on the server`);
        return;
      }
      LogBoxEvents.emit(runningScript);
    }
  } catch (e) {
    Terminal.error(e + "");
  }
}
