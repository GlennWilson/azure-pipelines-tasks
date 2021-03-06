"use strict";

import * as tl from "vsts-task-lib/task";
import * as Q from "q";
import ContainerConnection from "./containerconnection";
import * as pipelineUtils from "./pipelineutils";

export function build(connection: ContainerConnection, dockerFile: string, context: string, commandArguments: string, labelArguments: string[], tagArguments: string[], onCommandOut: (output) => any): any {
    var command = connection.createCommand();

    command.arg("build");
    command.arg(["-f", dockerFile]);

    if (labelArguments) {
        labelArguments.forEach(label => {
            command.arg(["--label", label]);
        });
    }

    command.line(commandArguments);

    if (tagArguments) {
        tagArguments.forEach(tagArgument => {
            command.arg(["-t", tagArgument]);
        });
    }

    command.arg(context);

    // setup variable to store the command output
    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    return connection.execCommand(command).then(() => {
        // Return the std output of the command by calling the delegate
        onCommandOut(output);
    });
}

export function command(connection: ContainerConnection, dockerCommand: string, commandArguments: string, onCommandOut: (output) => any): any {
    let command = connection.createCommand();
    command.arg(dockerCommand);
    command.line(commandArguments);

    // setup variable to store the command output
    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    return connection.execCommand(command).then(() => {
        // Return the std output of the command by calling the delegate
        onCommandOut(output);
    });
}

export function push(connection: ContainerConnection, image: string, commandArguments: string, onCommandOut: (image, output) => any): any {
    var command = connection.createCommand();
    command.arg("push");
    command.arg(image);
    command.line(commandArguments);

    // setup variable to store the command output
    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    return connection.execCommand(command).then(() => {
        // Return the std output of the command by calling the delegate
        onCommandOut(image, output + "\n");
    });
}

export async function getLayers(connection: ContainerConnection, imageId: string): Promise<any> {
    var layers = [];
    var history = await getHistory(connection, imageId);
    var lines = history.split(/[\r?\n]/);

    lines.forEach(line => {
        line = line.trim();
        if (line.length != 0) {
            layers.push(parseHistory(line));
        }
    });

    return layers.reverse();
}

function parseHistory(input: string) {
    const NOP = '#(nop)';
    var directive = 'UNSPECIFIED';
    var argument = '';
    var index = input.indexOf(NOP);
    if (index != -1) {
        argument = input.substr(index + 6).trim();
        directive = argument.substr(0, argument.indexOf(' '));
        argument = argument.substr(argument.indexOf(' ') + 1).trim();
    }
    else {
        directive = 'RUN';
        argument = input;
    }

    return { "directive": directive, "arguments": argument };
}

async function getHistory(connection: ContainerConnection, image: string): Promise<string> {
    var command = connection.createCommand();
    command.arg("history");
    command.arg(["--format", "{{.CreatedBy}}"]);
    command.arg("--no-trunc");
    command.arg(image);

    const defer = Q.defer();
    // setup variable to store the command output
    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    try {
        connection.execCommand(command).then(() => {
            defer.resolve();
        });
    }
    catch (e) {
        defer.reject(e);
        console.log(e);
    }

    await defer.promise;
    return output;
}