/*
This program is free software. It comes without any warranty, to
the extent permitted by applicable law. You can redistribute it
and/or modify it under the terms of the Do What The Fuck You Want
To Public License, Version 2, as published by Sam Hocevar. See
http://www.wtfpl.net/ for more details.
*/



"use strict";



class ShaderProgramManager {
    constructor(gl, programInfo, parentNode = document) {
        ShaderProgramManager.addPrograms(gl, programInfo, this, parentNode);
    }

    static addPrograms(gl, programInfo, programManager, parentNode) {
        let shaders = {};

        let scriptElements = parentNode.getElementsByTagName("script");
        let includes = {};
        let sources = {};
        for (let i = 0; i < scriptElements.length; ++i) {
            let element = scriptElements[i];
            let type = {
                "x-shader/x-vertex": gl.VERTEX_SHADER,
                "x-shader/x-fragment": gl.FRAGMENT_SHADER,
                "x-shader/x-include": "include"
            }[element.type];
            if (typeof type !== "undefined") {
                let src = "";
                for (let node = element.firstChild; node; node = node.nextSibling) {
                    if (node.nodeType === node.TEXT_NODE)
                        src += node.textContent;
                }
                if (element.type === "x-shader/x-include") {
                    includes[element.id] = src;
                }
                else {
                    sources[element.id] = [src, type];
                }
            }
        }
        let matchComment = /\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm;
        let matchInclude = /#include +\"(.*?)\"/gm;
        for (let id in sources) {
            let [src, type] = sources[id];
            src = src.replace(matchComment, "");
            src = src.replace(matchInclude, (match, p1) => {
                return includes[p1];
            });

            let shader = gl.createShader(type);
            gl.shaderSource(shader, src);
            gl.compileShader(shader);

            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.log(gl.getShaderInfoLog(shader));
                continue;
            } else {
                shaders[id] = shader;
            }
        }

        for (let programName in programInfo) {
            let info = programInfo[programName];
            let program = {};

            program.id = gl.createProgram();
            let i;
            for (i = 0; i < info.shaders.length; ++i) {
                let name = info.shaders[i];
                let shader = shaders[name];
                if (typeof shader === "undefined") {
                    continue;
                } else {
                    gl.attachShader(program.id, shaders[name]);
                }
            }
            if (i < info.shaders.length)
                continue;
            gl.linkProgram(program.id);
            if (!gl.getProgramParameter(program.id, gl.LINK_STATUS)) {
                console.log(gl.getProgramInfoLog(program.id));
                continue;
            }

            program.uniforms = {};
            for (let i = 0; i < info.uniforms.length; ++i) {
                let name = info.uniforms[i];
                program.uniforms[name] = gl.getUniformLocation(program.id, name);
            }

            program.attribs = {};
            for (let i = 0; i < info.attribs.length; ++i) {
                let name = info.attribs[i];
                program.attribs[name] = gl.getAttribLocation(program.id, name);
            }

            programManager[programName] = program;
        }
    }
}
