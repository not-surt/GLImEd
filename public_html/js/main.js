/*
This program is free software. It comes without any warranty, to
the extent permitted by applicable law. You can redistribute it
and/or modify it under the terms of the Do What The Fuck You Want
To Public License, Version 2, as published by Sam Hocevar. See
http://www.wtfpl.net/ for more details.
*/



"use strict";



(() => {
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
    
    function loadHTML(url, callback) {
        let iframe = document.createElement("iframe");
        iframe.src = url;
        iframe.style.display = "none";
        document.body.appendChild(iframe);
        iframe.addEventListener("load", () => {
            if (callback) callback(iframe.contentDocument);
            iframe.parentNode.removeChild(iframe);
        });
    }

    function loadCSS(url, callback) {
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

    function loadScript(url, callback) {
        let script = document.createElement("script");
        script.src = url;
        document.head.appendChild(script);
        script.addEventListener("load", () => {
            if (callback) callback(script);
            //script.parentNode.removeChild(script);
        });
    }

    let guiHTML = null;
    let shaderHTML = null;
    
    function start() {
        let app = new App(document.getElementById("App"));
        let resize = () => { app.resizeRequester.request(window.innerWidth, window.innerHeight); };
        window.addEventListener("pageshow", resize);
        window.addEventListener("resize", resize);
        app.guiHTML = guiHTML;
        app.shaderHTML = shaderHTML;
        app.initialize();
        app.canvas.focus();
        resize();
    }
    
    function preload() {
        let preloads = [
            [loadCSS, "css/gui.css"],
            [loadHTML, "html/gui.html", (result) => { guiHTML = result.body; }],
            [loadHTML, "html/shaders.html", (result) => { shaderHTML = result.head; }]
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
            preloads.push([loadScript, script]);
        }
        let preloadsRemaining = preloads.length;
        let nextFunc = start;
        for (let [loadFunc, url, preloadChainFunc] of preloads) {
            let capturedChainFunc = preloadChainFunc;
            loadFunc(url, (result) => {
                if (capturedChainFunc) capturedChainFunc(result);
                if (--preloadsRemaining === 0) requestAnimationFrame(nextFunc);
            });
        }        
    }
    
    preload();
})();