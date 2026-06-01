#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const distFileMappings = new Map([ [ ".js", [ ".ts", ".mts" ] ] ]);

const isDistFolder = name => /^dist/.test(name);
const isSkippableFolder =
    name => ( /^node_modules/.test(name) || /^.git*/.test(name) || /^.idea$/.test(name) || /^client_versions$/.test(name) || /.*client\/coverage.*/.test(name) );

function isInGit(filePath) {
  try {
    // Getting the Git repo root
    const gitRoot = execSync("git rev-parse --show-toplevel").toString().trim();
    const relativePath = path.relative(gitRoot, path.resolve(filePath));

    //console.log(`Cmd to execute: git ls-files --error-unmatch "${relativePath}"`)
    // Git only knows the relative path. Base is the root of the repo.
    execSync(`git ls-files --error-unmatch "${relativePath}"`, { stdio: "ignore" });
    console.log(`isInGit called for: ${filePath} result: true`);
    return true;
  } catch(e) {
    // console.log(`File is not in git?: ${filePath}`);
      console.log(`isInGit called for: ${filePath} result: FALSE`);
    return false;
  }
}

// Check the folders recursively
function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        const fullPath = path.join(dir, f);
        const fullPathStat = fs.statSync(fullPath);
        if (fullPathStat.isDirectory()) {
            if (isSkippableFolder(f)) {
                console.log(`  ${fullPath} - SKIPPED FOLDER!`);
            } else {
                console.log(`  ${fullPath}/`);

                if (isDistFolder(f)) {
                    process.stdout.write(`🗑 Dist folder: ${fullPath} | `);
                    if (require('readline-sync').question(`Delete it? (y/n) `).toLowerCase().startsWith('y'))
                        fs.rmSync(fullPath, { recursive: true, force: true });
                } else {
                    walkDir(fullPath, callback);
                }
            }
        } else {
            callback(fullPath);
        }
    });
}

// Collect .ts and .js files
function findAndClean(dir) {
    const tsFiles = new Set();
    const jsFiles = [];

    console.log("clean-generated.sh: Clean generated folders/files");
    console.log("\r\n!!! Note: this is an experimental tool which is not completed yet. It doesn't really produce any useful output, action, cleanup !!!\r\n");
    console.log("Collect JS and TS fils in the following directories...:");
    walkDir(dir, file => {
        if (file.endsWith(".ts") && !file.endsWith(".d.ts")) {
            tsFiles.add(file.replace(/\.ts$/, ""));
        } else if (file.endsWith(".js")) {
            jsFiles.push(file);
        }
    });

    // Delete the .js files which don't have an appropriate source .ts files
    for (const jsFile of jsFiles) {
        const base = jsFile.replace(/\.js$/, "");
        if (tsFiles.has(base)) {
            if (!isInGit(jsFile))
                process.stdout.write(`🗑 Outdated: has an original and not in repo: ${jsFile} | `);
            else
                process.stdout.write(`🗑 STRANGE! Outdated? It has an 'original' .ts but it IS added to the git repo: ${jsFile} | `);
            if (require('readline-sync').question(`Delete it? (y/n) `).toLowerCase().startsWith('y'))
                fs.rmSync(jsFile, { recursive: true, force: true });
        }
    }
}

// Start from the current folder (or from other specified folder)
const targetDir = process.argv[2] || process.cwd();
console.log(`Target dir for cleaning: ${path.resolve(targetDir)}`);
findAndClean(path.resolve(targetDir));
