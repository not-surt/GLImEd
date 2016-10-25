/*
This program is free software. It comes without any warranty, to
the extent permitted by applicable law. You can redistribute it
and/or modify it under the terms of the Do What The Fuck You Want
To Public License, Version 2, as published by Sam Hocevar. See
http://www.wtfpl.net/ for more details.
*/



/* global mat2d, Element, vec2, mat3, Float32Array, Uint16Array, Uint8Array, Int32Array, ChunkedImage, URL, GL, Util */

"use strict";



class App {
    constructor(container) {
        this.SCALE = 1;

        this.POS_ATTRIB = 0;
        this.INSTANCE_OFFSET_ATTRIB = 1;

        this.container = container;
        this.gui = null;
        this.canvas = null;
        this.gl = null;

        this.input = null;
        this.camera = null;
        this.chunkCache = null;
        this.image = null;
        this.programs = null;
        this.workBuffer = null;

        this.filename = null;
        this.mousePos = null;
        this.stroke = null;
        this.strokeOffset = 0;

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
        this.updateRequester.request();
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
                gl.bindTexture(gl.TEXTURE_2D, chunk.image.textureId);
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
                    this.updateRequester.request();
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
            gl.bindFramebuffer(gl.FRAMEBUFFER, chunk.image.framebufferId);
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

        this.updateRequester.request();
    }

    initialize(gui, gl, programs) {
        this._colour = new Colour();
        this._colourHSL = tinycolor(this._colour.toObject()).toHsl();

        this.brush = new Brush(this);

        this.gui = gui;
        this.canvas = this.gui.canvas;
        this.gl = gl;
        this.programs = programs;
        
        this.resizeRequester = new Requester((width, height) => {
            this.resize(width, height);
        });
        this.updateRequester = new Requester(() => {
            this.draw();
            this.gui.update(this);
        });

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
        this.workBuffer = new GLImage(gl, this.chunkCache.chunkSize, this.chunkCache.chunkSize);

        // Build chunk projection matrix
        let chunkScale = 2 / this.image.chunkSize;
        mat2d.set(this.chunkProjectionMatrix, chunkScale, 0.0, 0.0, chunkScale, -1.0, -1.0);

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

        this.updateRequester.request();
    }

    draw() {
        let gl = this.gl;

        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.SCISSOR_TEST);
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
            gl.bindTexture(gl.TEXTURE_2D, chunk.image.textureId);
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
    }

    copyImage(src, srcPos, srcSize, dest, destPos, destSize) {
        let gl = this.gl;

        let destImagePos = [Math.round(destPos[0] * dest.width), Math.round(destPos[1] * dest.height)];
        let destImageSize = [Math.round((destPos[0] + destSize[0]) * dest.width - destImagePos[0]), Math.round((destPos[1] + destSize[1]) * dest.height - destImagePos[0])];
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, dest.framebufferId);
        gl.viewport(0, 0, dest.width, dest.height);
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(destImagePos[0], destImagePos[1], destImageSize[0], destImageSize[1]);

        let program = this.programs["copy"];
        gl.useProgram(program.id);
        gl.activeTexture(gl.TEXTURE0 + 0);
        gl.bindTexture(gl.TEXTURE_2D, src.textureId);
        gl.uniform1i(program.uniforms["src"], 0);

        gl.bindVertexArray(this.clipQuadVAO);
        gl.drawElements(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_BYTE, 0);
        gl.bindVertexArray(null);

        gl.disable(gl.SCISSOR_TEST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    jitter(pos, jitter, out) {
        let v = vec2.fromValues(jitter[0], jitter[0]);
        vec2.mul(v, v, Util.randomDisk());
        vec2.add(out, pos, v);
    }

    strokeStart(pos) {
        this.stroke = [];
        this.strokeOffset = 0;
        this.jitter(pos, vec2.fromValues(this.gui.strokeJitter.value, this.gui.strokeJitter.value), pos);
        this.stroke.push(pos);
    }

    strokeAdd(pos) {
        this.jitter(pos, vec2.fromValues(this.gui.strokeJitter.value, this.gui.strokeJitter.value), pos);
        this.stroke.push(pos);
        //this.paintStrokeSegment(this.stroke[this.stroke.length - 2], this.stroke[this.stroke.length - 1]);
        if (this.stroke.length >= 3) {
            if (vec2.length(this.stroke[this.stroke.length - 3], this.stroke[this.stroke.length - 1]) < 3.0) {
                this.stroke.splice(this.stroke.length - 2, 1);
                return;
            }
        }
        if (this.stroke.length >= 3) this.paintStrokeSegment(this.stroke[this.stroke.length - 3], this.stroke[this.stroke.length - 2]);
    }

    strokeFinish() {
        if (this.stroke.length === 1) this.paintStrokeSegment(this.stroke[0], this.stroke[0]);
        else this.paintStrokeSegment(this.stroke[this.stroke.length - 2], this.stroke[this.stroke.length - 1]);
        this.stroke = null;
    }

    strokeSegmentDabs(start, end, spacing, offset, output) {
        let delta = [end[0] - start[0], end[1] - start[1]];
        let length = Math.hypot(delta[0], delta[1]);
        let step = [delta[0] / length, delta[1] / length];
        let pos, i;
        for (pos = offset, i = 0; pos < length; pos += spacing, ++i) {
            //output.set([start[0] + pos * step[0], start[1] + pos * step[1]], i * 2);
            output.push(...[start[0] + pos * step[0], start[1] + pos * step[1]]);
        }
        return [pos - length, i];
    }

    paintStrokeSegment(start, end) {
        let gl = this.gl;
        
        //let dabs = new Float32Array(1024);
        let dabs = [];
        let count;
        if (vec2.equals(start, end)) {
            dabs.push(...end);
            //dabs.set(end);
            count = 1;
        }
        else {
            let spacing = this.gui.proportionalSpacing.checked
                ? this.strokeSpacing * Math.sqrt(this.brush.width * this.brush.height)
                : this.strokeSpacing;
            [this.strokeOffset, count] = this.strokeSegmentDabs(start, end, spacing, this.strokeOffset, dabs);
        }
        
        /*var dabBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, dabBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, dabs, gl.STATIC_DRAW);
        
        gl.bindVertexArray(this.clipQuadVAO);
        let offsets = Float32Array.of(
            -16.0, -16.0,
            0.0, 0.0,
            16.0, 16.0
        );
        var offsetBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, offsetBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, offsets, gl.STATIC_DRAW);
        // Bind the instance position data
        gl.bindBuffer(gl.ARRAY_BUFFER, offsetBuffer);
        gl.enableVertexAttribArray(this.INSTANCE_OFFSET_ATTRIB);
        gl.vertexAttribPointer(this.INSTANCE_OFFSET_ATTRIB, 2, gl.FLOAT, false, 2 * 4, 0);
        gl.vertexAttribDivisor(this.INSTANCE_OFFSET_ATTRIB, 1); // This makes it instanced!
        gl.bindVertexArray(null);*/

        gl.enable(gl.BLEND);
        //gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.blendFunc(gl.ONE, gl.ZERO);
        gl.disable(gl.BLEND);

        let programName = "brush" + this.brush.type + this.brush.falloff + this.blendMode + (this.gui.preserveAlpha.checked ? "PreserveAlpha" : "");
        let program = this.programs[programName];

        gl.useProgram(program.id);
        gl.uniform4fv(program.uniforms["colour"], this.colour.toFloats());
        gl.uniform1f(program.uniforms["bias"], this.brush.bias);
        gl.uniform1f(program.uniforms["gain"], this.brush.gain);
        gl.uniform1f(program.uniforms["blendStrength"], this.blendStrength);

        mat3.fromMat2d(this.glMatrix, this.chunkProjectionMatrix);
        gl.uniformMatrix3fv(program.uniforms["projection"], false, this.glMatrix);
            
        for (let i = 0; i < count; ++i) {
            let pos = dabs.slice(i * 2, i * 2 + 2);
            this.jitter(pos, vec2.fromValues(this.gui.brushJitter.value, this.gui.brushJitter.value), pos);
            
            let brushMatrix = mat2d.create();
            mat2d.translate(brushMatrix, brushMatrix, pos);
            mat2d.rotate(brushMatrix, brushMatrix, 2 * Math.PI * this.brush.angle);
            mat2d.scale(brushMatrix, brushMatrix, [this.brush.halfWidth, this.brush.halfHeight]);
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

            for (let y = bounds.y; y < bounds.y + bounds.height; ++y) {
                for (let x = bounds.x; x < bounds.x + bounds.width; ++x) {
                    let chunkAddress = [x, y];
                    let key = ChunkedImage.toKey(chunkAddress);
                    if (this.image.has(key) || this.image.addChunk(chunkAddress)) {
                        let chunk = this.image.get(key);

                        this.copyImage(chunk.image, [0.0, 0.0], [1.0, 1.0], this.workBuffer, [0.0, 0.0], [1.0, 1.0]);

                        chunk.bind(gl);

                        gl.useProgram(program.id);
                        gl.uniform2f(program.uniforms["chunkOffset"], chunkAddress[0] * this.image.chunkSize, chunkAddress[1] * this.image.chunkSize);
                        gl.activeTexture(gl.TEXTURE0 + 0);
                        gl.bindTexture(gl.TEXTURE_2D, this.workBuffer.textureId);
                        gl.uniform1i(program.uniforms["dest"], 0);

                        if (this.brush.type === "Pixel") {
                            gl.bindVertexArray(this.pointVAO);
                            gl.drawElements(gl.points, 1, gl.UNSIGNED_BYTE, 0);
                        }
                        else if (this.brush.type === "PixelLine") {
                        }
                        else {
                            gl.bindVertexArray(this.clipQuadVAO);
                            //gl.drawElementsInstanced(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_BYTE, 0, 3);

                            gl.drawElements(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_BYTE, 0);
                        }
                        gl.bindVertexArray(null);

                        chunk.unbind(gl);
                    }
                }
            }
        }
        
        this.updateRequester.request();
    }

    pick(pos) {
        this.colour = this.image.getPixel(pos);
        this._colourHSL = tinycolor(this.colour).toHsl();
    }

    pan(delta) {
        this.camera.move(delta);
        this.updateRequester.request();
    }

    zoom(steps, pos) {
        this.camera.zoomAt(Math.pow(2, -steps[1]), pos);
        this.updateRequester.request();
    }
}
