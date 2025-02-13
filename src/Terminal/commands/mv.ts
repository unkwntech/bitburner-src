import { Terminal } from "../../Terminal";
import { BaseServer } from "../../Server/BaseServer";
import { isScriptFilename } from "../../Script/isScriptFilename";
import { TextFile } from "../../TextFile";
import { Script } from "../../Script/Script";
import { getDestinationFilepath, areFilesEqual } from "../DirectoryHelpers";

export function mv(args: (string | number | boolean)[], server: BaseServer): void {
  if (args.length !== 2) {
    Terminal.error(`Incorrect number of arguments. Usage: mv [src] [dest]`);
    return;
  }

  try {
    const source = args[0] + "";
    const t_dest = args[1] + "";

    if (!isScriptFilename(source) && !source.endsWith(".txt")) {
      Terminal.error(`'mv' can only be used on scripts and text files (.txt)`);
      return;
    }

    const srcFile = Terminal.getFile(source);
    if (srcFile == null) return Terminal.error(`Source file ${source} does not exist`);

    const sourcePath = Terminal.getFilepath(source);
    if (!sourcePath) return Terminal.error(`Invalid source filename: ${source}`);

    // Get the destination based on the source file and the current directory
    const dest = getDestinationFilepath(t_dest, source, Terminal.cwd());
    if (dest === null) return Terminal.error("error parsing dst file");

    const destFile = Terminal.getFile(dest);
    const destPath = Terminal.getFilepath(dest);
    if (!destPath) return Terminal.error(`Invalid destination filename: ${destPath}`);
    if (areFilesEqual(sourcePath, destPath)) return Terminal.error(`Source and destination files are the same file`);

    // 'mv' command only works on scripts and txt files.
    // Also, you can't convert between different file types
    if (isScriptFilename(source)) {
      const script = srcFile as Script;
      if (!isScriptFilename(destPath)) return Terminal.error(`Source and destination files must have the same type`);

      // Command doesn't work if script is running
      if (server.isRunning(sourcePath)) return Terminal.error(`Cannot use 'mv' on a script that is running`);

      if (destFile != null) {
        // Already exists, will be overwritten, so we'll delete it

        // Command doesn't work if script is running
        if (server.isRunning(destPath)) {
          Terminal.error(`Cannot use 'mv' on a script that is running`);
          return;
        }

        const status = server.removeFile(destPath);
        if (!status.res) {
          Terminal.error(`Something went wrong...please contact game dev (probably a bug)`);
          return;
        } else {
          Terminal.print("Warning: The destination file was overwritten");
        }
      }

      script.filename = destPath;
    } else if (srcFile instanceof TextFile) {
      const textFile = srcFile;
      if (!dest.endsWith(".txt")) {
        Terminal.error(`Source and destination files must have the same type`);
        return;
      }

      if (destFile != null) {
        // Already exists, will be overwritten, so we'll delete it
        const status = server.removeFile(destPath);
        if (!status.res) {
          Terminal.error(`Something went wrong...please contact game dev (probably a bug)`);
          return;
        } else {
          Terminal.print("Warning: The destination file was overwritten");
        }
      }

      textFile.fn = destPath;
    }
  } catch (e) {
    Terminal.error(e + "");
  }
}
