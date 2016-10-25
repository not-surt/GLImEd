/*
This program is free software. It comes without any warranty, to
the extent permitted by applicable law. You can redistribute it
and/or modify it under the terms of the Do What The Fuck You Want
To Public License, Version 2, as published by Sam Hocevar. See
http://www.wtfpl.net/ for more details.
*/



"use strict";



class GL {
    static initializeContext(canvas) {
        let gl;
        let extensions;

        // Get context
        let contextParams = {alpha: false, antialias: false, depth: false, preserveDrawingBuffer: false, stencil: false};
        // Try to get WebGL 2 context
        if ((gl = canvas.getContext("webgl2", contextParams))) extensions = [];
        // Fallback to WebGL 1 context plus extensions
        else if ((gl = canvas.getContext("webgl", contextParams)))
            extensions = [
                ["ANGLE", "instanced_arrays", ["drawArraysInstanced", "drawElementsInstanced", "vertexAttribDivisor"]],
                ["OES", "vertex_array_object", ["createVertexArray", "deleteVertexArray", "isVertexArray", "bindVertexArray"]],
                ["OES", "element_index_uint"]
            ];
        else {
            console.log("Failure getting WebGL context!");
            return null;
        }

        // Attach extensions
        let missingExtensions = [];
        for (let [vendor, name, funcs] of extensions) {
            let extensionName = vendor + "_" + name;
            let extension = gl.getExtension(extensionName);
            if (!extension) missingExtensions.push(extensionName);
            else if (funcs) {
                for (let funcName of funcs) {
                    let name = funcName + vendor;
                    gl[funcName] = (...args) => { return extension[name](...args); };
                }
            }
        }
        if (missingExtensions.length > 0) {
            console.log("Failure getting required WebGL extensions! " + missingExtensions.join(", "));
            return null;
        }

        return gl;
    }
}
