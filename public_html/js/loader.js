/*
This program is free software. It comes without any warranty, to
the extent permitted by applicable law. You can redistribute it
and/or modify it under the terms of the Do What The Fuck You Want
To Public License, Version 2, as published by Sam Hocevar. See
http://www.wtfpl.net/ for more details.
*/



/* global GL, Util, Element */

"use strict";


class Loader {
    constructor(container) {
        if (!Loader.pollyfilled) {
            Loader.polyfill();
            Loader.pollyfilled = true;
        }
        
        this.container = container;
        
        this.progressElement = document.createElement("progress");
        this.progressElement.max = 0;
        this.progressElement.value = 0;
        this.progressElement.style.width = "100%";
        document.body.appendChild(this.progressElement);

        this.guiHTML = null;
        this.shaderHTML = null;

        let preloads = [
            [Loader.loadCSS, "css/gui.css"],
            [Loader.loadHTML, "html/gui.html", (result) => { this.guiHTML = result.body; }],
            [Loader.loadHTML, "html/shaders.html", (result) => { this.shaderHTML = result.head; }]
        ];
        let scripts = [
            "js/lib/gl-matrix.js",
            "js/lib/tinycolor.js",
            "js/lib/omggif.js",
            "js/lib/pako.js",
            "js/util.js",
            "js/image.js",
            "js/file.js",
            "js/program.js",
            "js/tool.js",
            "js/gui.js",
            "js/input.js",
            "js/gl.js",
            "js/app.js"
        ];
        for (let script of scripts) {
            preloads.push([Loader.loadScript, script]);
        }
        this.progressElement.max += preloads.length;
        Loader.preload(preloads, this.start.bind(this), this.progress.bind(this));
    }
    
    static polyfill() {
        // Polyfills
        Element.prototype.requestFullscreen = Element.prototype.requestFullscreen || Element.prototype.webkitRequestFullscreen || Element.prototype.mozRequestFullScreen;
        document.exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
        if (typeof document.fullscreenElement === "undefined") {
            Object.defineProperty(document, "fullscreenElement", {
                get: function () {
                    return this.webkitCurrentFullScreenElement || this.mozFullScreenElement;
                },
                set: function () {}
            });
        }
        Element.prototype.requestPointerLock = Element.prototype.requestPointerLock || Element.prototype.mozRequestPointerLock;
        document.exitPointerLock = document.exitPointerLock || document.webkitExitPointerLock || document.mozExitPointerLock;
        if (typeof document.pointerLockElement === "undefined") {
            Object.defineProperty(document, "pointerLockElement", {
                get: function () {
                    return this.webkitPointerLockElement || this.mozPointerLockElement;
                },
                set: function () {}
            });
        }
    }
    
    static loadHTML(url, callback) {
        let iframe = document.createElement("iframe");
        iframe.src = url;
        iframe.style.display = "none";
        document.body.appendChild(iframe);
        iframe.addEventListener("load", () => {
            if (callback) callback(iframe.contentDocument);
            iframe.parentNode.removeChild(iframe);
        });
    }

    static loadCSS(url, callback) {
        let link = document.createElement("link");
        link.rel  = "stylesheet";
        link.type = "text/css";
        link.href = url;
        document.head.appendChild(link);
        link.addEventListener("load", () => {
            if (callback) callback(link);
            //link.parentNode.removeChild(link);
        });
    }

    static loadScript(url, callback) {
        let script = document.createElement("script");
        script.src = url;
        document.head.appendChild(script);
        script.addEventListener("load", () => {
            if (callback) callback(script);
            //script.parentNode.removeChild(script);
        });
    }
    
    static preload(preloads, nextFunc, progress) {
        let preloadsRemaining = preloads.length;
        for (let [loadFunc, url, preloadChainFunc] of preloads) {
            let capturedChainFunc = preloadChainFunc;
            loadFunc(url, (result) => {
                if (typeof progress !== "undefined") progress();
                if (capturedChainFunc) capturedChainFunc(result);
                if (--preloadsRemaining === 0) requestAnimationFrame(nextFunc);
            });
        }        
    }
    
    progress() {
        this.progressElement.value++;
    }
    
    start() {
        let gui = new Gui(this.guiHTML, this.container);
        let canvas = gui.canvas;
        let gl;
        if (!(gl = GL.initializeContext(canvas))) return;
        let programs = this.buildPrograms(gl);
        console.log("Shader program variants: " + Object.keys(programs).length);

        let app = new App(this.container);

        let resize = () => { app.resizeRequester.request(window.innerWidth, window.innerHeight); };
        window.addEventListener("pageshow", resize);
        window.addEventListener("resize", resize);
        app.initialize(gui, gl, programs);
        app.canvas.focus();
        resize();
        document.body.removeChild(this.progressElement);
    }
    
    buildPrograms(gl) {
        let programInfo = {
            "checker": {
                shaders: ["checker.vert", "checker.frag"],
                uniforms: ["projection", "checkerSize"],
                attribs: ["pos"]
            },
            "chunk": {
                shaders: ["chunk.vert", "chunk.frag"],
                uniforms: ["modelView", "projection", "texture", "chunkSize"],
                attribs: ["pos"]
            },
            "solid": {
                shaders: ["chunk.vert", "solid.frag"],
                uniforms: ["modelView", "projection", "chunkSize", "colour"],
                attribs: ["pos"]
            },
            "copy": {
                shaders: ["copy.vert", "copy.frag"],
                uniforms: ["src"],
                attribs: ["pos"]
            },
            "brush": {
                shaders: [
                    "brush.vert",
                    ["brush.frag", [
                        ["Pixel", "Ellipse", "Rectangle"],
                        ["Constant", "Linear", "Spherical", "InverseSpherical", "Cosine"],
                        ["Mix", "Erase", "Add", "Subtract", "Multiply", "Divide"],
                        ["", "PreserveAlpha"]
                    ]]
                ],
                uniforms: ["dest", "brush", "projection", "chunkSize", "chunkOffset", "colour", "bias", "gain", "blendStrength"],
                attribs: ["pos", "instanceOffset"]
            }
        };
        // Get shader sources
        let scriptElements = this.shaderHTML.getElementsByTagName("script");
        let includes = {};
        let sources = {};
        for (let i = 0; i < scriptElements.length; ++i) {
            let element = scriptElements[i];
            let shaderName = element.id;
            let type = {
                "x-shader/x-vertex": gl.VERTEX_SHADER,
                "x-shader/x-fragment": gl.FRAGMENT_SHADER,
                "x-shader/x-include": "include"
            }[element.type];
            if (typeof type !== "undefined") {
                let src = Util.elementText(element);
                if (type === "include") {
                    includes[shaderName] = src;
                }
                else {
                    sources[shaderName] = [src, type];
                }
            }
        }
        // Build shader programs
        return new ShaderProgramManager(gl, programInfo, sources, includes);
    }
}