// https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API#user-content-a-minimal-compiler
import * as ts from "typescript";
import * as fs from 'fs';
import {
	normalize
} from 'path'

function compile(fileNames: string[], options: ts.CompilerOptions): void {
	let program = ts.createProgram(fileNames, options);
	let emitResult = program.emit();

	let allDiagnostics = ts
		.getPreEmitDiagnostics(program)
		.concat(emitResult.diagnostics);

	allDiagnostics.forEach(diagnostic => {
		if (diagnostic.file) {
			let { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!);
			let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
			console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
		} else {
			console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
		}
	});

	let exitCode = emitResult.emitSkipped ? 1 : 0;
	if (exitCode !== 0) {
		console.log(`Process exiting with code '${exitCode}'.`);
		process.exit(exitCode);	
	}
}

if (process.argv[2] !== "chrome" && process.argv[2] !== "firefox") {
	console.log("Usage: node build.js <chrome|firefox> <buildName>")
}

let buildName = process.argv[3] || `${process.argv[2]}_build`;


if (fs.readdirSync(__dirname).includes(buildName)) {
	if (!process.argv[4] || !process.argv[4].includes("norm")) {
		fs.rmSync(normalize(__dirname + '/' + buildName), {
			recursive: true
		});
		fs.mkdirSync(normalize(__dirname + '/' + buildName));
	}
} else {
	fs.mkdirSync(normalize(__dirname + '/' + buildName));
}


fs.copyFileSync(
	normalize(__dirname + `/src/${process.argv[2]}/manifest.json`),
	normalize(__dirname + `/${buildName}/manifest.json`)
)

let files = [];

function recursiveCopyNonTSFiles(dir: string, depth=0) {
	fs.readdirSync(normalize(__dirname + '/src/common' + dir), {
		withFileTypes: true
	}).forEach(entry => {
		if (entry.isDirectory()) {
			if (!fs.existsSync(normalize(`${__dirname}/${buildName}/${dir}/${entry.name}`))) {
				fs.mkdirSync(normalize(`${__dirname}/${buildName}/${dir}/${entry.name}`));
			}
			recursiveCopyNonTSFiles(normalize(dir + '/' + entry.name), depth+1);
		} else if (entry.isFile()) {
			if (entry.name.endsWith('.ts')) {
				files.push(normalize(`${__dirname}/src/common/${dir}/${entry.name}`))
			} else {
				fs.copyFileSync(
					normalize(`${__dirname}/src/common/${dir}/${entry.name}`),
					normalize(`${__dirname}/${buildName}/${dir}/${entry.name}`)
				)
			}
		}
	})
}
console.log("Copying non-.ts files...");
recursiveCopyNonTSFiles('');

if (!process.argv[4] || !process.argv[4].includes("nocompile")) {
	console.log("Compiling .ts files...");
	compile(files, {
		sourceMap: true,
		target: ts.ScriptTarget.ESNext,
		outDir: normalize(__dirname + '/' + buildName),
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.NodeJs
	});
}

console.log("All done");