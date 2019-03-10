import * as cp from "child_process";
import * as cmdExists from "command-exists";
import * as fs from "fs";
import * as vscode from "vscode";
import { RunConfig } from "../RunConfig";
import PhpUnitDriverInterface from "./PhpUnitDriverInterface";

export default class Phar implements PhpUnitDriverInterface {
  public name: string = "Phar";
  public phpPathCache: string;
  public phpUnitPharPathCache: string;
  public hasPharExtensionCache: boolean;

  public async run(args: string[]): Promise<RunConfig> {
    const execPath = await this.phpPath();
    args = [await this.phpUnitPath()].concat(args);

    const command = `${execPath} ${args.join(" ")}`;

    return {
      command: command
    };
  }

  public async isInstalled(): Promise<boolean> {
    return (
      (await this.phpPath()) != null &&
      (await this.hasPharExtension()) &&
      (await this.phpUnitPath()) != null
    );
  }

  public async hasPharExtension(): Promise<boolean> {
    if (this.hasPharExtensionCache) {
      return this.hasPharExtensionCache;
    }

    return (this.hasPharExtensionCache = await new Promise<boolean>(
      async (resolve, reject) => {
        cp.exec(
          `${await this.phpPath()} -r "echo extension_loaded('phar');"`,
          (err, stdout, stderr) => {
            resolve(stdout === "1");
          }
        );
      }
    ));
  }

  public async phpPath(): Promise<string> {
    if (this.phpPathCache) {
      return this.phpPathCache;
    }

    const config = vscode.workspace.getConfiguration("phpunit");
    try {
      this.phpPathCache = await cmdExists(config.get<string>("php"));
    } catch (e) {
      try {
        this.phpPathCache = await cmdExists("php");
      } catch (e) {}
    }
    return this.phpPathCache;
  }

  public async phpUnitPath(): Promise<string> {
    if (this.phpUnitPharPathCache) {
      return this.phpUnitPharPathCache;
    }

    const findInWorkspace = async (): Promise<string> => {
      const uris = await vscode.workspace.findFiles(
        "**/phpunit*.phar",
        "**/node_modules/**",
        1
      );
      this.phpUnitPharPathCache =
        uris && uris.length > 0 ? uris[0].fsPath : null;

      return this.phpUnitPharPathCache;
    };

    const config = vscode.workspace.getConfiguration("phpunit");
    const phpUnitPath = config.get<string>("phpunit");
    if (phpUnitPath && phpUnitPath.endsWith(".phar")) {
      return new Promise<string>((resolve, reject) => {
        fs.exists(phpUnitPath, exists => {
          if (exists) {
            this.phpUnitPharPathCache = phpUnitPath;
            resolve(this.phpUnitPharPathCache);
          } else {
            reject();
          }
        });
      }).catch(findInWorkspace);
    }

    return await findInWorkspace();
  }
}
