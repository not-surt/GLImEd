/*
This program is free software. It comes without any warranty, to
the extent permitted by applicable law. You can redistribute it
and/or modify it under the terms of the Do What The Fuck You Want
To Public License, Version 2, as published by Sam Hocevar. See
http://www.wtfpl.net/ for more details.
*/



/* global GL, Util, Element */

"use strict";



class Progress {
    constructor(stages) {
        this.element = document.createElement("div");

        this.stageLabel = document.createElement("output");
        this.element.appendChild(this.stageLabel);

        this.element.appendChild(document.createElement("br"));

        this.stageProgress = document.createElement("progress");
        //this.stageProgress.style.width = "100%";
        this.element.appendChild(this.stageProgress);

        this.element.appendChild(document.createElement("br"));

        this.stepLabel = document.createElement("output");
        this.element.appendChild(this.stepLabel);

        this.element.appendChild(document.createElement("br"));

        this.stepProgress = document.createElement("progress");
        //this.stepProgress.style.width = "100%";
        this.element.appendChild(this.stepProgress);

        this.stageProgress.max = stages;
        this.stageProgress.value = -1;
        this.stageLabel.value = "";
    }

    nextStage(label, steps) {
        this.stageProgress.value++;
        this.stageLabel.value = label + " (" + this.stageProgress.value + " of " + this.stageProgress.max + ")";
        this.stepProgress.max = steps;
        this.stepProgress.value = -1;
        this.stepLabel.value = "";
    }

    nextStep(label) {
        this.stepProgress.value++;
        this.stepLabel.value = label + " (" + this.stepProgress.value + " of " + this.stepProgress.max + ")";
    }
}



class Loader {
    constructor(container) {
        if (!Loader.pollyfilled) {
            Loader.polyfill();
            Loader.pollyfilled = true;
        }

        this.container = container;
        this.guiHTML = null;
        this.shaderHTML = null;

        this.progress = new Progress(3);
        document.body.appendChild(this.progress.element);

        let preloads = [
            [Loader.loadCSS, "css/gui.css"],
            [Loader.loadHTML, "html/gui.html", (result) => { this.guiHTML = result.body; }],
            [Loader.loadHTML, "html/shaders.html", (result) => { this.shaderHTML = result.head; }]
        ];
        let scripts = [
            "lib/gl-matrix.js",
            "lib/tinycolor.js",
            "lib/omggif.js",
            "lib/pako.js",
            "util.js",
            "image.js",
            "file.js",
            "program.js",
            "tool.js",
            "gui.js",
            "input.js",
            "gl.js",
            "app.js"
        ];
        for (let script of scripts) {
            preloads.push([Loader.loadScript, "js/" + script]);
        }
        this.progress.nextStage("Preloading", preloads.length);
        Loader.preload(preloads, this.start.bind(this), (label) => { this.progress.nextStep(label); });
    }

    static polyfill() {
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

    static preload(preloads, nextFunc, progressFunc) {
        let preloadsRemaining = preloads.length;
        for (let [loadFunc, url, preloadChainFunc] of preloads) {
            let capturedChainFunc = preloadChainFunc;
            loadFunc(url, (result) => {
                if (typeof progressFunc !== "undefined") progressFunc(url);
                if (capturedChainFunc) capturedChainFunc(result);
                if (--preloadsRemaining === 0) requestAnimationFrame(nextFunc);
            });
        }
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
        document.body.removeChild(this.progress.element);
    }

    buildPrograms(gl) {
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
        return new ShaderProgramManager(gl, Loader.programInfo, sources, includes, this.progress);
    }
}

Loader.programInfo = {
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
