/*
This program is free software. It comes without any warranty, to
the extent permitted by applicable law. You can redistribute it
and/or modify it under the terms of the Do What The Fuck You Want
To Public License, Version 2, as published by Sam Hocevar. See
http://www.wtfpl.net/ for more details.
*/



/* global mat2d, Element, vec2, mat3, Float32Array, Uint16Array, Uint8Array, Int32Array, ChunkedImage, URL */

"use strict";



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



// Utils
function pr() {
    console.log(Array.from(arguments).join(", "));
}

function asycCall(funcArg, thisArg, ...otherArgs) {
    requestAnimationFrame(funcArg.bind(thisArg, ...otherArgs));
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

function elementText(element) {
    let text = "";
    for (let node = element.firstChild; node; node = node.nextSibling) {
        if (node.nodeType === node.TEXT_NODE) {
            text += node.textContent;
        }
    }
    return text;
}

function inverseObject(object) {
    let newObject = {};
    for (let property in object) {
        newObject[object[property]] = property;
    }
    return newObject;
}



class Bounds {
    constructor(x = Number.MAX_VALUE, y = Number.MAX_VALUE, width = Number.MIN_VALUE, height = Number.MIN_VALUE) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    copy(other) {
        this.x = other.x;
        this.y = other.y;
        this.width = other.width;
        this.height = other.height;
    }
    static clone(other) {
        let bounds = new Bounds();
        bounds.copy(other);
        return bounds;
    }

    get area() {
        return this.width * this.height;
    }

    clear() {
        this.x = Number.MAX_VALUE;
        this.y = Number.MAX_VALUE;
        this.width = Number.MIN_VALUE;
        this.height = Number.MIN_VALUE;
    }
    isValid() {
        return !(this.x === Number.MAX_VALUE || this.y === Number.MAX_VALUE ||
                this.width < 0 || this.height < 0);
    }
    boundOther(other) {
        if (!this.isValid()) {
            this.x = other.x;
            this.y = other.y;
            this.width = other.width;
            this.height = other.height;
        } else {
            let r = Math.max(this.x + this.width, other.x + other.width);
            let b = Math.max(this.y + this.height, other.y + other.height);
            this.x = Math.min(this.x, other.x);
            this.y = Math.min(this.y, other.y);
            this.width = r - this.x;
            this.height = b - this.y;
        }
    }
    boundPoint(point) {
        this.boundOther({x: point[0], y: point[1], width: 0, height: 0});
    }
    intersectsBounds(bounds) {
        let halfWidth = this.width / 2;
        let halfHeight = this.height / 2;
        let rectHalfWidth = bounds.width / 2;
        let rectHalfHeight = bounds.height / 2;
        return !((Math.abs((this.x + halfWidth) - (bounds.x + rectHalfWidth) >= halfWidth + rectHalfWidth)) ||
                (Math.abs((this.y + halfHeight) - (bounds.y + rectHalfHeight) >= halfHeight + rectHalfHeight)));
    }
    containsPoint(point) {
        return !(point[0] < this.x || point[0] >= this.x + this.width ||
                point[1] < this.y || point[1] >= this.y + this.height);
    }
    round() {
        this.width = Math.ceil(this.x + this.width);
        this.height = Math.ceil(this.y + this.height);
        this.x = Math.floor(this.x);
        this.y = Math.floor(this.y);
        this.width -= this.x;
        this.height -= this.y;
    }
    transformMat2d(matrix) {
        let corners = [
            [this.x, this.y],
            [this.x + this.width, this.y],
            [this.x, this.y + this.height],
            [this.x + this.width, this.y + this.height]
        ];
        this.clear();
        let workVec = vec2.create();
        for (let corner of corners) {
            this.boundPoint(vec2.transformMat2d(workVec, corner, matrix));
        }
    }
    toString() {
        return "[" + this.x + ", " + this.y + ", " + this.width + ", " + this.height + "]";
    }
}



class Camera {
    constructor() {
        this._pan = vec2.fromValues(0.0, 0.0);
        this._zoom = 1.0;
        this._matrix = mat2d.create();
        this._inverseMatrix = mat2d.create();
        this._dirty = true;
    }

    set pan(value) {
        vec2.copy(this._pan, value);
        this._dirty = true;
    }
    get pan() {
        return this._pan;
    }
    move(value) {
        vec2.add(this._pan, this._pan, value);
        this._dirty = true;
    }

    set zoom(value) {
        this._zoom = value;
        this._dirty = true;
    }
    get zoom() {
        return this._zoom;
    }
    zoomAt(zoom, pos = [0, 0]) {
        this.zoom *= zoom;
    }

    get matrix() {
        if (this._dirty)
            this._update();
        return this._matrix;
    }
    get inverseMatrix() {
        if (this._dirty)
            this._update();
        return this._inverseMatrix;
    }
    _update() {
        mat2d.fromScaling(this._matrix, [this._zoom, this._zoom]);
        mat2d.translate(this._matrix, this._matrix, this._pan);
        mat2d.invert(this._inverseMatrix, this._matrix);
        this._dirty = false;
    }
}



class Painter {
    constructor(gl) {
    }

    point(pos) {

    }
    segment(initialize, end) {

    }
}



class App {
    constructor(container) {
        this.SCALE = 1;
        this.POS_ATTRIB = 0;

        this.container = container;
        this.gui = null;
        this.canvas = null;
        this.gl = null;

        this.input = null;
        this.camera = null;
        this.chunkCache = null;
        this.image = null;
        this.programs = null;

        this.filename = null;
        this.initialized = false;
        this.redrawRequest = 0;
        this.resizeRequest = false;
        this.pendingResizeRequest = null;
        this.focusRequested = false;
        this.guiUpdateRequest = 0;
        this.mousePos = null;
        this.offset = 0;

        this.projectionMatrix;
        this.inverseProjectionMatrix;
        this.glMatrix;
        this.workMatrix;
        this.mouseMatrix;
        this.clipQuadVerts;
        this.clipVertBuffer;
        this.uvQuadVerts;
        this.uvVertBuffer;
        this.triStripQuadElement;
        this.lineLoopQuadElement;
        this.pointElement;
        this._colour;
        this._colourHSL;

        this.strokeSpacing = 0.5;
        this.brush;
        this.brushRatio = 1.0;
        this.blendMode = "Mix";
        this.blendStrength = 1.0;
    }

    get colour() {
        return this._colour;
    }
    set colour(colour) {
        this._colour = colour;
        this._colour.constrainLevels(this.gui.levels.value);
        this.gui.colour.value = this._colour.toString();
        this.gui.red.value = this._colour.r;
        this.gui.redSlider.value = this._colour.r;
        this.gui.green.value = this._colour.g;
        this.gui.greenSlider.value = this._colour.g;
        this.gui.blue.value = this._colour.b;
        this.gui.blueSlider.value = this._colour.b;
        this.gui.alpha.value = this._colour.a;
        this.gui.alphaSlider.value = this._colour.a;

        this.gui.hue.value = this._colourHSL.h;
        this.gui.hueSlider.value = this._colourHSL.h;
        this.gui.saturation.value = this._colourHSL.s;
        this.gui.saturationSlider.value = this._colourHSL.s;
        this.gui.lightness.value = this._colourHSL.l;
        this.gui.lightnessSlider.value = this._colourHSL.l;
    }

    newImage() {
        this.chunkCache = new ChunkCache(this.gl);
        this.image = new ChunkedImage(this.chunkCache);
        this.camera = new Camera();
        this.requestRedraw();
        this.requestGuiUpdate();
    }

    chunkImage(image) {
        let chunkCache = new ChunkCache(this.gl);
        let chunkedImage = new ChunkedImage(chunkCache);
        let workCanvas = document.createElement("canvas");
        workCanvas.width = workCanvas.height = chunkedImage.chunkSize;
        let context = workCanvas.getContext("2d");

        let width = Math.ceil(image.width / chunkedImage.chunkSize);
        let height = Math.ceil(image.height / chunkedImage.chunkSize);
        for (let y = 0; y < height; ++y) {
            for (let x = 0; x < width; ++x) {
                context.drawImage(image, x * chunkedImage.chunkSize, y * chunkedImage.chunkSize, chunkedImage.chunkSize, chunkedImage.chunkSize, 0, 0, chunkedImage.chunkSize, chunkedImage.chunkSize);
                let chunk = chunkedImage.addChunk([x, y]);
                let gl = this.gl;
                gl.bindTexture(gl.TEXTURE_2D, chunk.textureId);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, workCanvas);
                gl.bindTexture(gl.TEXTURE_2D, null);
                context.clearRect(0, 0, chunkedImage.chunkSize, chunkedImage.chunkSize);
            }
        }
        return chunkedImage;
    }

    loadImage() {
        let input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.addEventListener("change", (event) => {
            if (event.target.files.length > 0) {
                var image = new Image();
                let url = URL.createObjectURL(event.target.files[0]);
                image.addEventListener("load", (event) => {
                    this.image = this.chunkImage(image);
                    this.chunkCache = this.image.chunkCache;
                    this.camera = new Camera();
                    this.requestRedraw();
                    this.requestGuiUpdate();
                    URL.revokeObjectURL(url);
                });
                image.src = url;
                this.filename = url;
            }
        });
        input.click();
    }

    saveImage() {
        let workCanvas = document.createElement("canvas");
        workCanvas.width = this.image.extents.width;
        workCanvas.height = this.image.extents.height;
        let context = workCanvas.getContext("2d");
        let pixelData = new Uint8Array(this.image.chunkSize * this.image.chunkSize * 4);
        for (let [key, chunk] of this.image) {
            let [x, y] = ChunkedImage.fromKey(key);
            let posX = x * this.image.chunkSize - this.image.extents.x;
            let posY = y * this.image.chunkSize - this.image.extents.y;
            let gl = this.gl;
            gl.bindFramebuffer(gl.FRAMEBUFFER, chunk.framebufferId);
            gl.readPixels(0, 0, this.image.chunkSize, this.image.chunkSize, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            let imageData = new ImageData(new Uint8ClampedArray(pixelData), this.image.chunkSize, this.image.chunkSize);
            context.putImageData(imageData, posX, posY);
        }
        workCanvas.toBlob((blob) => {
            let url = URL.createObjectURL(blob);
            var link = document.createElement("a");
            link.href = url;
            link.download = this.filename;
            link.click();
            URL.revokeObjectURL(url);
        });
    }

    requestFocus() {
        if (!this.initialized) this.focusRequested = true;
        else this.canvas.focus();
    }

    requestResize(width, height) {
        if (!this.initialized) {
            this.pendingResizeRequest = this.resize.bind(this, width, height);
        }
        else {
            if (this.resizeRequest)
                window.cancelAnimationFrame(this.resizeRequest);
            this.resizeRequest = window.requestAnimationFrame(() => {
                this.resize(width, height);
                this.resizeRequest = 0;
            });
        }
    }

    requestGuiUpdate() {
        if (this.guiUpdateRequest)
            window.cancelAnimationFrame(this.guiUpdateRequest);
        this.guiUpdateRequest = window.requestAnimationFrame(() => {
            this.gui.update(this);
            this.guiUpdateRequest = 0;
        });
    }

    resize(width, height) {
        this.container.style.width = width;
        this.container.style.height = height;
        this.canvas.width = Math.floor(width / this.SCALE);
        this.canvas.height = Math.floor(height / this.SCALE);
        this.canvas.style.width = parseInt(this.canvas.width * this.SCALE) + "px";
        this.canvas.style.height = parseInt(this.canvas.height * this.SCALE) + "px";

        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        // Build projection matrix
        width = this.canvas.width;
        height = -this.canvas.height;
        let scaleX = 2 / width;
        let scaleY = 2 / height;
        let halfWidth = width / 2;
        let halfHeight = height / 2;
        let offsetX = halfWidth - Math.floor(halfWidth);
        let offsetY = halfHeight - Math.floor(halfHeight);
        mat2d.set(this.projectionMatrix, scaleX, 0.0, 0.0, scaleY, offsetX * scaleX, offsetY * scaleY);
        mat2d.invert(this.inverseProjectionMatrix, this.projectionMatrix);

        // Build mouse matrix
        let clientRect = this.canvas.getBoundingClientRect();
        let clientRectScaleX = this.canvas.width / clientRect.width;
        let clientRectScaleY = this.canvas.height / clientRect.height;
        //mat2d.set(this.mouseMatrix, clientRectScaleX, 0.0, 0.0, clientRectScaleY, -(clientRect.width / 2) * clientRectScaleX, -(clientRect.height / 2) * clientRectScaleY);
        mat2d.set(this.mouseMatrix, clientRectScaleX, 0.0, 0.0, clientRectScaleY, -(this.canvas.width / 2), -(this.canvas.height / 2));

        this.requestRedraw();
    }

    preload() {
        let scripts = [
            "js/lib/gl-matrix.js",
            "js/lib/tinycolor.js",
            "js/lib/omggif.js",
            "js/lib/pako.js",
            "js/image.js",
            "js/file.js",
            "js/program.js",
            "js/tool.js",
            "js/gui.js",
            "js/input.js"
        ];
        let preloads = [
            [loadCSS, "css/gui.css"],
            [loadHTML, "html/gui.html", (result) => { this.guiHTML = result.body; }],
            [loadHTML, "html/shaders.html", (result) => { this.shaderHTML = result.head; }]
        ];
        for (let script of scripts) {
            preloads.push([loadScript, script]);
        }
        let preloadsRemaining = preloads.length;
        let nextFunc = this.initialize.bind(this);
        for (let [loadFunc, url, preloadChainFunc] of preloads) {
            let capturedChainFunc = preloadChainFunc;
            loadFunc(url, (result) => {
                if (capturedChainFunc) capturedChainFunc(result);
                if (--preloadsRemaining === 0) requestAnimationFrame(nextFunc);
            });
        }
    }

    initializeWebGL() {
        let extensions;

        // Get context
        let contextParams = {alpha: false, antialias: false, depth: false, preserveDrawingBuffer: false, stencil: false};
        // Try to get WebGL 2 context
        if ((this.gl = this.canvas.getContext("webgl2", contextParams))) extensions = [];
        // Fallback to WebGL 1 context plus extensions
        else if ((this.gl = this.canvas.getContext("webgl", contextParams)))
            extensions = [
                ["ANGLE_instanced_arrays", "ANGLE", ["drawArraysInstanced", "drawElementsInstanced", "vertexAttribDivisor"]],
                ["OES_vertex_array_object", "OES", ["createVertexArray", "deleteVertexArray", "isVertexArray", "bindVertexArray"]],
                ["OES_element_index_uint"]
            ];
        else {
            console.log("Failure getting WebGL context!");
            return false;
        }

        // Attach extensions
        let missingExtensions = [];
        for (let [name, suffix, funcs] of extensions) {
            let extension = this.gl.getExtension(name);
            if (!extension) missingExtensions.push(name);
            else if (funcs) {
                for (let funcName of funcs) {
                    let name = funcName + suffix;
                    this.gl[funcName] = (...args) => { return extension[name](...args); };
                }
            }
        }
        if (missingExtensions.length > 0) {
            console.log("Failure getting WebGL extensions! " + missingExtensions.join(", "));
            return false;
        }

        return true;
    }

    initialize() {
        this._colour = new Colour();
        this._colourHSL = tinycolor(this._colour.toObject()).toHsl();

        this.brush = new Brush(this);

        this.gui = new Gui(this, this.guiHTML, this.container);
        this.canvas = this.gui.canvas;

        if (!this.initializeWebGL()) return false;

        this.camera = new Camera();

        this.projectionMatrix = mat2d.create();
        this.inverseProjectionMatrix = mat2d.create();
        this.mouseMatrix = mat2d.create();
        this.chunkProjectionMatrix = mat2d.create();
        this.workMatrix = mat2d.create();
        this.glMatrix = mat3.create();

        this.input = new Input(this);
        this.chunkCache = new ChunkCache(this.gl);
        this.image = new ChunkedImage(this.chunkCache);

        // Build chunk projection matrix
        let chunkScale = 2 / this.image.chunkSize;
        mat2d.set(this.chunkProjectionMatrix, chunkScale, 0.0, 0.0, chunkScale, -1.0, -1.0);

        let gl = this.gl;

        this.clipVertBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.clipVertBuffer);
        this.clipQuadVerts = Float32Array.of(
            1.0, 1.0,
            -1.0, 1.0,
            1.0, -1.0,
            -1.0, -1.0
        );
        gl.bufferData(gl.ARRAY_BUFFER, this.clipQuadVerts, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        this.uvVertBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvVertBuffer);
        this.uvQuadVerts = Float32Array.of(
            1.0, 1.0,
            0.0, 1.0,
            1.0, 0.0,
            0.0, 0.0
        );
        gl.bufferData(gl.ARRAY_BUFFER, this.uvQuadVerts, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        this.triStripQuadElement = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.triStripQuadElement);
        this.triStripQuadIndices = Uint8Array.of(
            0, 1, 2, 3
        );
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.triStripQuadIndices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

        this.lineLoopQuadElement = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.lineLoopQuadElement);
        this.lineLoopQuadIndices = Uint8Array.of(
            0, 1, 3, 2
        );
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.lineLoopQuadIndices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        
        // Clip VAO
        this.clipQuadVAO = gl.createVertexArray();
        gl.bindVertexArray(this.clipQuadVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.clipVertBuffer);
        gl.enableVertexAttribArray(this.POS_ATTRIB);  
        gl.vertexAttribPointer(this.POS_ATTRIB, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.triStripQuadElement);
        gl.bindVertexArray(null);
        
        // Chunk VAO
        this.uvQuadVAO = gl.createVertexArray();
        gl.bindVertexArray(this.uvQuadVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvVertBuffer);
        gl.enableVertexAttribArray(this.POS_ATTRIB);  
        gl.vertexAttribPointer(this.POS_ATTRIB, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.triStripQuadElement);
        gl.bindVertexArray(null);

        // Point VAO
        this.pointVAO = gl.createVertexArray();
        gl.bindVertexArray(this.pointVAO);
        this.pointVertBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.pointVertBuffer);
        this.pointVerts = Float32Array.of(
            0.0, 0.0
        );
        gl.bufferData(gl.ARRAY_BUFFER, this.pointVerts, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(this.POS_ATTRIB);  
        gl.vertexAttribPointer(this.POS_ATTRIB, 2, gl.FLOAT, false, 0, 0);
        this.pointElement = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.pointElement);
        this.pointIndices = Uint8Array.of(
            0
        );
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.pointIndices, gl.STATIC_DRAW);
        gl.bindVertexArray(null);
        
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
                attribs: ["pos"]
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
                let src = elementText(element);
                if (type === "include") {
                    includes[shaderName] = src;
                }
                else {
                    sources[shaderName] = [src, type];
                }
            }
        }
        // Build shader programs
        this.programs = new ShaderProgramManager(this.gl, programInfo, sources, includes);
        console.log("Shader program variants: " + Object.keys(this.programs).length);

        let program;

        program = this.programs["checker"];
        gl.useProgram(program.id);
        gl.uniform1f(program.uniforms["checkerSize"], 16);

        program = this.programs["chunk"];
        gl.useProgram(program.id);
        gl.uniform1f(program.uniforms["chunkSize"], this.image.chunkSize);

        program = this.programs["solid"];
        gl.useProgram(program.id);
        gl.uniform1f(program.uniforms["chunkSize"], this.image.chunkSize);
        gl.uniform4f(program.uniforms["colour"], 1.0, 1.0, 1.0, 0.125);

        this.gui.initialize(this);

        this.initialized = true;
        if (this.pendingResizeRequest) this.pendingResizeRequest();
        if (this.focusRequested) this.requestFocus();
        this.requestRedraw();
    }

    requestRedraw() {
        if (!this.initialized) {

        }
        else {
            if (this.redrawRequest)
                window.cancelAnimationFrame(this.redrawRequest);
            this.redrawRequest = window.requestAnimationFrame(() => {
                this.draw();
                this.redrawRequest = 0;
            });
        }
    }

    draw() {
        let gl = this.gl;

        gl.disable(gl.DEPTH_TEST);
        //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.BLEND);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        //gl.clear(gl.COLOR_BUFFER_BIT);

        let program;
        program = this.programs["checker"];
        gl.useProgram(program.id);
        mat3.fromMat2d(this.glMatrix, this.inverseProjectionMatrix);
        gl.uniformMatrix3fv(program.uniforms["projection"], false, this.glMatrix);
        gl.bindVertexArray(this.clipQuadVAO);
        gl.drawElements(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_BYTE, 0);
        gl.bindVertexArray(null);

        mat3.fromMat2d(this.glMatrix, this.projectionMatrix);

        program = this.programs["chunk"];
        gl.useProgram(program.id);
        gl.uniformMatrix3fv(program.uniforms["projection"], false, this.glMatrix);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvVertBuffer);

        program = this.programs["solid"];
        gl.useProgram(program.id);
        gl.uniformMatrix3fv(program.uniforms["projection"], false, this.glMatrix);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvVertBuffer);

        gl.activeTexture(gl.TEXTURE0 + 0);

        // Find viewport worldspace bounds
        mat2d.mul(this.workMatrix, this.camera.inverseMatrix, this.inverseProjectionMatrix);
        let bounds = new Bounds();
        let workVec = vec2.create();
        for (let i = 0; i < this.clipQuadVerts.length; i += 2) {
            bounds.boundPoint(vec2.transformMat2d(workVec, this.clipQuadVerts.slice(i, i + 2), this.workMatrix));
        }

        let drawChunk = (chunk, [x, y]) => {
            // Build model matrix
            mat2d.fromTranslation(this.workMatrix, [x * this.image.chunkSize, y * this.image.chunkSize]);
            // Build model view matrix
            mat2d.mul(this.workMatrix, this.camera.matrix, this.workMatrix);
            mat3.fromMat2d(this.glMatrix, this.workMatrix);

            // Draw occupied chunk
            program = this.programs["solid"];
            gl.useProgram(program.id);
            gl.uniformMatrix3fv(program.uniforms["modelView"], false, this.glMatrix);
            
            gl.bindVertexArray(this.uvQuadVAO);
            gl.drawElements(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_BYTE, 0);
            gl.bindVertexArray(null);

            // Draw texture
            program = this.programs["chunk"];
            gl.useProgram(program.id);
            gl.uniformMatrix3fv(program.uniforms["modelView"], false, this.glMatrix);
            gl.activeTexture(gl.TEXTURE0 + 0);
            gl.bindTexture(gl.TEXTURE_2D, chunk.textureId);
            gl.uniform1i(program.uniforms["texture"], 0);
            
            gl.bindVertexArray(this.uvQuadVAO);
            gl.drawElements(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_BYTE, 0);
            gl.bindVertexArray(null);
        };

        if (bounds.area / (this.image.chunkSize * this.image.chunkSize) < this.image.size) {
            let chunks = this.image.chunksInBounds(bounds);
            for (let [pos, chunk] of chunks) {
                drawChunk(chunk, pos);
            }
        }
        else {
            for (let [key, chunk] of this.image) {
                let pos = ChunkedImage.fromKey(key);
                drawChunk(chunk, pos);
            }
        }

        // Draw Brush
        /*if (this.mousePos && this.brush.type !== this.BrushType.PIXEL) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

            let program = this.programs[this.brush.Program[this.brush.TypeInverse[this.brush.type]]];
            gl.useProgram(program.id);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.clipTriStripQuadElement);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.clipVertBuffer);
            gl.vertexAttribPointer(program.attribs["pos"], 2, gl.FLOAT, false, 0, 0);

            let brushMatrix = mat2d.create();
            mat2d.translate(brushMatrix, brushMatrix, this.mousePos);
            mat2d.rotate(brushMatrix, brushMatrix, 2 * Math.PI * this.brushAngle);
            mat2d.scale(brushMatrix, brushMatrix, [this.brush.width, this.brush.height]);
            mat3.fromMat2d(this.glMatrix, brushMatrix);
            //mat2d.mul(this.workMatrix, this.camera.matrix, this.brushMatrix);
            //mat3.fromMat2d(this.glMatrix, this.workMatrix);
            gl.uniformMatrix3fv(program.uniforms["brush"], false, this.glMatrix);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.clipTriStripQuadElement);
            gl.drawElements(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_BYTE, 0);
        }*/
    }

    copyImage(src, dest) {
        let gl = this.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, dest.framebufferId);
        gl.viewport(0, 0, dest.width, dest.height);
        //gl.clear(gl.COLOR_BUFFER_BIT);

        let program = this.programs["copy"];
        gl.useProgram(program.id);
        gl.activeTexture(gl.TEXTURE0 + 0);
        gl.bindTexture(gl.TEXTURE_2D, src.textureId);
        gl.uniform1i(program.uniforms["src"], 0);
        
        gl.bindVertexArray(this.clipQuadVAO);
        gl.drawElements(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_BYTE, 0);
        gl.bindVertexArray(null);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    strokeSegment(start, end, colour, spacing, offset) {
        let delta = [end[0] - start[0], end[1] - start[1]];
        let length = Math.hypot(delta[0], delta[1]);
        let step = [delta[0] / length, delta[1] / length];
        let pos;
        for (pos = offset; pos < length; pos += spacing) {
            this.dab([start[0] + pos * step[0], start[1] + pos * step[1]], colour);
        }
        return pos - length;
    }

    dab(pos, colour) {
        let gl = this.gl;

        gl.enable(gl.BLEND);
        //gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.blendFunc(gl.ONE, gl.ZERO);
        gl.disable(gl.BLEND);

        let programName = "brush" + this.brush.type + this.brush.falloff + this.blendMode + (this.gui.preserveAlpha.checked ? "PreserveAlpha" : "");
        let program = this.programs[programName];

        gl.useProgram(program.id);
        gl.uniform4fv(program.uniforms["colour"], colour.toFloats());
        gl.uniform1f(program.uniforms["bias"], this.brush.bias);
        gl.uniform1f(program.uniforms["gain"], this.brush.gain);
        gl.uniform1f(program.uniforms["blendStrength"], this.blendStrength);

        mat3.fromMat2d(this.glMatrix, this.chunkProjectionMatrix);
        gl.uniformMatrix3fv(program.uniforms["projection"], false, this.glMatrix);

        let brushMatrix = mat2d.create();
        mat2d.translate(brushMatrix, brushMatrix, pos);
        mat2d.rotate(brushMatrix, brushMatrix, 2 * Math.PI * this.brush.angle);
        mat2d.scale(brushMatrix, brushMatrix, [this.brush.width, this.brush.height]);
        mat3.fromMat2d(this.glMatrix, brushMatrix);
        gl.uniformMatrix3fv(program.uniforms["brush"], false, this.glMatrix);
        gl.uniform2f(program.uniforms["chunkSize"], this.image.chunkSize, this.image.chunkSize);

        let bounds = new Bounds();
        let workVec = vec2.create();
        for (let i = 0; i < this.clipQuadVerts.length; i += 2) {
            bounds.boundPoint(vec2.transformMat2d(workVec, this.clipQuadVerts.slice(i, i + 2), brushMatrix));
        }
        bounds = this.image.boundsToChunks(bounds);

//        let offsets = new Float32Array(bounds.width * bounds.height * 2);
//        let i = 0;
//        for (let y = bounds.y; y < bounds.y + bounds.height; ++y) {
//            for (let x = bounds.x; x < bounds.x + bounds.width; ++x) {
//                offsets[i + 0] = x;
//                offsets[i + 1] = y;
//                i += 2;
//            }
//        }
//        let offsetBuffer = gl.createBuffer();
//        gl.bindBuffer(gl.ARRAY_BUFFER, offsetBuffer);
//        gl.bufferData(gl.ARRAY_BUFFER, offsets, gl.STATIC_DRAW);
//        gl.vertexAttribPointer(program.attribs["chunkOffset"], 2, gl.FLOAT, false, 0, 0);
//        gl.vertexAttribDivisor(program.attribs["pos"], 0);

        let workChunk = this.image.chunkCache.grab();

        for (let y = bounds.y; y < bounds.y + bounds.height; ++y) {
            for (let x = bounds.x; x < bounds.x + bounds.width; ++x) {
                let chunkAddress = [x, y];
                let key = ChunkedImage.toKey(chunkAddress);
                if (this.image.has(key) || this.image.addChunk(chunkAddress)) {
                    let chunk = this.image.get(key);

                    this.copyImage(chunk, workChunk);

                    gl.bindFramebuffer(gl.FRAMEBUFFER, chunk.framebufferId);
                    gl.viewport(0, 0, this.image.chunkSize, this.image.chunkSize);

                    gl.useProgram(program.id);
                    gl.uniform2f(program.uniforms["chunkOffset"], chunkAddress[0] * this.image.chunkSize, chunkAddress[1] * this.image.chunkSize);
                    gl.activeTexture(gl.TEXTURE0 + 0);
                    gl.bindTexture(gl.TEXTURE_2D, workChunk.textureId);
                    gl.uniform1i(program.uniforms["dest"], 0);

                    if (this.brush.type === "Pixel") {
                        gl.bindVertexArray(this.pointVAO);
                        gl.drawElements(gl.points, 1, gl.UNSIGNED_BYTE, 0);
                    }
                    else {
                        gl.bindVertexArray(this.clipQuadVAO);
                        gl.drawElements(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_BYTE, 0);
                    }                    
                    gl.bindVertexArray(null);
                    
                    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                }
            }
        }
        this.image.chunkCache.release(workChunk);
    }

    paint(start, end) {
        let spacing = this.gui.proportionalSpacing.checked
            ? this.strokeSpacing * Math.sqrt(this.brush.width * this.brush.height)
            : this.strokeSpacing;
        this.offset = this.strokeSegment(start, end, this.colour, spacing, this.offset);
        this.requestRedraw();
        this.gui.update(this);
    }

    pick(pos) {
        this.colour = this.image.getPixel(pos);
        //this.colour.unpremultiply();
        this._colourHSL = tinycolor(this.colour).toHsl();
    }

    pan(delta) {
        this.camera.move(delta);
        this.requestRedraw();
        this.requestGuiUpdate();
    }

    zoom(steps, pos) {
        this.camera.zoomAt(Math.pow(2, -steps[1]), pos);
        this.requestRedraw();
        this.requestGuiUpdate();
    }

    run() {
        return this.preload();
    }
}
