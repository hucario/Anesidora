"use strict";
exports.__esModule = true;
// https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API#user-content-a-minimal-compiler
var ts = require("typescript");
var fs = require("fs");
var path_1 = require("path");
function compile(fileNames, options) {
    var program = ts.createProgram(fileNames, options);
    var emitResult = program.emit();
    var allDiagnostics = ts
        .getPreEmitDiagnostics(program)
        .concat(emitResult.diagnostics);
    allDiagnostics.forEach(function (diagnostic) {
        if (diagnostic.file) {
            var _a = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start), line = _a.line, character = _a.character;
            var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
            console.log(diagnostic.file.fileName + " (" + (line + 1) + "," + (character + 1) + "): " + message);
        }
        else {
            console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
        }
    });
    var exitCode = emitResult.emitSkipped ? 1 : 0;
    if (exitCode !== 0) {
        console.log("Process exiting with code '" + exitCode + "'.");
        process.exit(exitCode);
    }
}
if (process.argv[2] !== "chrome" && process.argv[2] !== "firefox") {
    console.log("Usage: node build.js <chrome|firefox> <buildName>");
}
var buildName = process.argv[3] || process.argv[2] + "_build";
if (fs.readdirSync(__dirname).includes(buildName)) {
    if (!process.argv[4] || !process.argv[4].includes("norm")) {
        fs.rmSync((0, path_1.normalize)(__dirname + '/' + buildName), {
            recursive: true
        });
        fs.mkdirSync((0, path_1.normalize)(__dirname + '/' + buildName));
    }
}
else {
    fs.mkdirSync((0, path_1.normalize)(__dirname + '/' + buildName));
}
fs.copyFileSync((0, path_1.normalize)(__dirname + ("/src/" + process.argv[2] + "/manifest.json")), (0, path_1.normalize)(__dirname + ("/" + buildName + "/manifest.json")));
var files = [];
function recursiveCopyNonTSFiles(dir, depth) {
    if (depth === void 0) { depth = 0; }
    fs.readdirSync((0, path_1.normalize)(__dirname + '/src/common' + dir), {
        withFileTypes: true
    }).forEach(function (entry) {
        if (entry.isDirectory()) {
            if (!fs.existsSync((0, path_1.normalize)(__dirname + "/" + buildName + "/" + dir + "/" + entry.name))) {
                fs.mkdirSync((0, path_1.normalize)(__dirname + "/" + buildName + "/" + dir + "/" + entry.name));
            }
            recursiveCopyNonTSFiles((0, path_1.normalize)(dir + '/' + entry.name), depth + 1);
        }
        else if (entry.isFile()) {
            if (entry.name.endsWith('.ts')) {
                files.push((0, path_1.normalize)(__dirname + "/src/common/" + dir + "/" + entry.name));
            }
            else {
                fs.copyFileSync((0, path_1.normalize)(__dirname + "/src/common/" + dir + "/" + entry.name), (0, path_1.normalize)(__dirname + "/" + buildName + "/" + dir + "/" + entry.name));
            }
        }
    });
}
console.log("Copying non-.ts files...");
recursiveCopyNonTSFiles('');
if (!process.argv[4] || !process.argv[4].includes("nocompile")) {
    console.log("Compiling .ts files...");
    compile(files, {
        sourceMap: true,
        target: ts.ScriptTarget.ESNext,
        outDir: (0, path_1.normalize)(__dirname + '/' + buildName),
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.NodeJs
    });
}
console.log("All done");
