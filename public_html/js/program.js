/*
This program is free software. It comes without any warranty, to
the extent permitted by applicable law. You can redistribute it
and/or modify it under the terms of the Do What The Fuck You Want
To Public License, Version 2, as published by Sam Hocevar. See
http://www.wtfpl.net/ for more details.
*/



"use strict";



class ShaderProgramManager {
    constructor(gl, programInfo = null, sources = {}, includes = {}) {
        if (programInfo) ShaderProgramManager.addPrograms(gl, programInfo, this, sources, includes);
    }

    static variantList(variations) {
        let variants = [];
        let positions = new Array(variations.length).fill(0);
        while (positions[0] < variations[0].length) {
            let variant = [];
            for (let i = 0; i < positions.length; ++i) {
                variant.push(variations[i][positions[i]]);
            }
            variants.push(variant);
            ++positions[variations.length - 1];
            for (let i = positions.length - 1; i > 0 && positions[i] >= variations[i].length; --i) {
                positions[i] = 0;
                ++positions[i - 1];
            }
        }
        return variants;
    }

    static preprocessSrc(src, includes = {}) {
        const matchComment = /\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm;
        const matchInclude = /#include +\"(.*?)\"/gm;
        // Strip comments
        src = src.replace(matchComment, "");
        // Expand includes
        src = src.replace(matchInclude, (match, p1) => {
            if (typeof includes[p1] === "undefined") {
                console.log("Header not found: " + p1);
                return "";
            }
            else return includes[p1];
        });
        return src;
    }

    static compileShader(gl, src, type) {
        let shaderObject = gl.createShader(type);
        gl.shaderSource(shaderObject, src);
        gl.compileShader(shaderObject);
        if (!gl.getShaderParameter(shaderObject, gl.COMPILE_STATUS)) {
            console.log(gl.getShaderInfoLog(shaderObject));
            gl.deleteShader(shaderObject);
            return null;
        }
        else return shaderObject;
    }

    static buildProgram(gl, shaderObjects) {
        let programObject = gl.createProgram();
        for (let i = 0; i < shaderObjects.length; ++i) {
            gl.attachShader(programObject, shaderObjects[i]);
        }
        gl.linkProgram(programObject);
        if (!gl.getProgramParameter(programObject, gl.LINK_STATUS)) {
            console.log(gl.getProgramInfoLog(programObject));
            return null;
        }
        else return programObject;
    }

    static addPrograms(gl, programInfo, programManager, sources, includes) {
        class ShaderVariant {
            constructor(shaderName, defines) {
                this.shaderName = shaderName;
                this.defines = defines;
                this.shaderObject = null;
            }
        }

        // Get shader variants
        let shaderVariants = {};
        let programShaderVariants = {};
        for (let programName in programInfo) {
            programShaderVariants[programName] = [];
            let info = programInfo[programName];
            for (let i = 0; i < info.shaders.length; ++i) {
                let shaderName;
                let variants;
                if (Array.isArray(info.shaders[i])) {
                    shaderName = info.shaders[i][0];
                    variants = this.variantList(info.shaders[i][1]);
                }
                else {
                    shaderName = info.shaders[i];
                    variants = [[""]];
                }
                programShaderVariants[programName][i] = [];
                if (typeof shaderVariants[shaderName] === "undefined") shaderVariants[shaderName] = {};
                for (let j = 0; j < variants.length; ++j) {
                    let defines = variants[j];
                    let variantSubString = defines.join("");
                    let shaderVariant;
                    if (typeof shaderVariants[shaderName][variantSubString] === "undefined") {
                        shaderVariant = new ShaderVariant(shaderName, defines);
                        shaderVariants[shaderName][variantSubString] = shaderVariant;
                    }
                    else shaderVariant = shaderVariants[shaderName][variantSubString];
                    programShaderVariants[programName][i].push(shaderVariant);
                }
            }
        }

        // Check sources
        for (let shaderName in shaderVariants) {
            if (typeof sources[shaderName] === "undefined") console.log("Shader source not found: " + shaderName);
        }

        // Preprocess sources
        for (let shaderName in shaderVariants) {
            sources[shaderName][0] = this.preprocessSrc(sources[shaderName][0], includes);
        }

        // Compile shader variants
        for (let shaderName in shaderVariants) {
            let variants = shaderVariants[shaderName];
            for (let variantSubString in variants) {
                let id = shaderName + variantSubString;
                let [src, type] = sources[shaderName];
                let definesSrc = "";
                let defines = variants[variantSubString].defines;
                for (let i = 0; i < defines.length; ++i) {
                    if (defines[i] !== "") definesSrc += "#define " + defines[i] + "\n";
                }
                let shaderObject = this.compileShader(gl, definesSrc + src, type);
                if (shaderObject) shaderVariants[shaderName][variantSubString].shaderObject = shaderObject;
            }
        }

        // Build program variants
        let programShaders = {};
        for (let programName in programInfo) {
            let info = programInfo[programName];
            let variants = this.variantList(programShaderVariants[programName]);
            for (let i = 0; i < variants.length; ++i) {
                let defines = [];
                let shaderObjects = [];
                for (let j = 0; j < variants[i].length; ++j) {
                    defines = defines.concat(variants[i][j].defines);
                    shaderObjects.push(variants[i][j].shaderObject);
                }
                let programVariantName = programName;
                let defineAdded = {};
                for (let j = 0; j < defines.length; ++j) {
                    if (typeof defineAdded[defines[j]] === "undefined") {
                        defineAdded[defines[j]] = true;
                        programVariantName += defines[j];
                    }
                }
                programShaders[programVariantName] = shaderObjects;
                let programObject = this.buildProgram(gl, shaderObjects);
                if (programObject) {
                    let program = {};
                    program.id = programObject;
                    // Bind uniforms
                    program.uniforms = {};
                    for (let j = 0; j < info.uniforms.length; ++j) {
                        let uniformName = info.uniforms[j];
                        program.uniforms[uniformName] = gl.getUniformLocation(program.id, uniformName);
                    }
                    // Bind attribs
                    program.attribs = {};
                    for (let j = 0; j < info.attribs.length; ++j) {
                        let attribName = info.attribs[j];
                        program.attribs[attribName] = gl.getAttribLocation(program.id, attribName);
                    }
                    programManager[programVariantName] = program;
                }
            }
        }

        // Cleanup shaders
        for (let programName in programShaders) {
            let program = programManager[programName];
            let shaders = programShaders[programName];
            gl.useProgram(program.id);
            for (let i = 0; i < shaders.length; ++i)
                gl.detachShader(program.id, shaders[i]);
            gl.useProgram(null);
        }
        for (let shaderName in shaderVariants)
            for (let variantSubString in shaderVariants[shaderName])
                gl.deleteShader(shaderVariants[shaderName][variantSubString].shaderObject);
    }
}
