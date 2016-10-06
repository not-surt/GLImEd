/*
This program is free software. It comes without any warranty, to
the extent permitted by applicable law. You can redistribute it
and/or modify it under the terms of the Do What The Fuck You Want
To Public License, Version 2, as published by Sam Hocevar. See
http://www.wtfpl.net/ for more details.
*/



/* global Float32Array, Uint8Array */

"use strict";
class Colour extends Uint8Array {
    constructor(r = 0, g = 0, b = 0, a = 255) {
        super(4);
        this[0] = r;
        this[1] = g;
        this[2] = b;
        this[3] = a;
    }

    copy(other) {
        this[0] = other[0];
        this[1] = other[1];
        this[2] = other[2];
        this[3] = other[3];
    }
    static clone(other) {
        let colour = new Colour();
        colour.copy(other);
        return colour;
    }

    get r() {
        return this[0];
    }
    set r(value) {
        this[0] = value;
    }
    get g() {
        return this[1];
    }
    set g(value) {
        this[1] = value;
    }
    get b() {
        return this[2];
    }
    set b(value) {
        this[2] = value;
    }
    get a() {
        return this[3];
    }
    set a(value) {
        this[3] = value;
    }

    premultiply() {
        let alpha = this[3] / 255;
        this[0] *= alpha;
        this[1] *= alpha;
        this[2] *= alpha;
    }
    unpremultiply() {
        let alpha = this[3] / 255;
        this[0] /= alpha;
        this[1] /= alpha;
        this[2] /= alpha;
    }

    constrainLevels(levels) {
        function level(value, step) {
            return Math.round(value / step) * step;
        }
        let step = 255 / (levels - 1);
        this[0] = level(this[0], step);
        this[1] = level(this[1], step);
        this[2] = level(this[2], step);
        this[3] = level(this[3], step);
    }

    toObject() {
        return { r: this[0], g: this[1], b: this[2], a: this[3] / 255 };
    }
    static fromObject(obj) {
        return new Colour(obj.r, obj.g, obj.b, obj.a * 255);
    }

    toFloats() {
        return Float32Array.from(this.slice(0, 4), x => x / 255);
    }
    static fromFloats(array) {
        let colour = new Colour();
        colour.set(Uint8Array.from(array.slice(0, 4), x => x * 255));
        return colour;
    }

    static _paddedHex(byte) {
        return ("0" + byte.toString(16)).slice(-2);
    }
    toString() {
        return "#" + Colour._paddedHex(this[0]) + Colour._paddedHex(this[1]) + Colour._paddedHex(this[2]);
    }
    static fromString(str) {
        return new Colour(parseInt(str.slice(1, 3), 16), parseInt(str.slice(3, 5), 16), parseInt(str.slice(5, 7), 16), 255);
    }
}



class GLTexture {
    constructor(gl, width, height, data = null) {
        this.gl = gl;

        this.width = width;
        this.height = height;

        // Build texture
        this.textureId = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.textureId);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    setPixel(pos, colour) {
        let gl = this.gl;

        gl.bindTexture(gl.TEXTURE_2D, this.textureId);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, pos[0], pos[1], 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, colour);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
}



class GLImage extends GLTexture {
    constructor(gl, width, height, data = null) {
        super(gl, width, height, data);

        // Build framebuffer
        this.framebufferId = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebufferId);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textureId, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    clear() {
        let gl = this.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebufferId);
        gl.viewport(0, 0, this.width, this.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    getPixel(pos) {
        let gl = this.gl;

        let colour = new Colour();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebufferId);
        gl.readPixels(pos[0], pos[1], 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, colour);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return colour;
    }
}



class Palette extends GLImage {
    constructor(gl, colours = []) {
        super(gl, 256, 1);
        let size = Math.max(colours.length, 256);

    }

    getIndex(index) {
        return this.getPixel([index, 0]);
    }
    setIndex(index, colour) {
        this.setPixel([index, 0], colour);
    }
}



class SubImage {
    constructor(image, pos, size) {
        this._image = image;
        this._pos = pos.slice(0, 2);
        this._size = size.slice(0, 2);
    }

    get image() { return this._image; }
    get pos() { return this._pos; }
    get size() { return this._size; }

    bind(gl) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._image.framebufferId);
        gl.viewport(pos[0], pos[1], size[0], size[1]);
        //gl.enable(gl.SCISSOR_TEST);
        //gl.scissors(pos[0], pos[1], size[0], size[1]);
    }
    unbind(gl) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.disable(gl.SCISSOR_TEST);
    }
}



class SimpleImage extends GLImage {
    constructor(gl, width, height) {
        super(gl, width, height);
    }
}



class ChunkCache {
    constructor(gl, chunkCount = 4096, chunkSize = 64) {
        this.available = [];
        this.occupied = new Set();
        this.chunkSize = chunkSize;
        this.maxTexSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        this.texChunksSize = Math.floor(this.maxTexSize / this.chunkSize);
        this.texSize = this.texChunksSize * this.chunkSize;
        this.maxTextures = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
        //console.log(this.maxTextures + " " + this.maxTexSize + " " + this.texSize);
        
        //this.pageChunkSize = pageChunkSize;
        //this.pages = [];
        //let pageSize = pageChunkSize * pageChunkSize;

        for (let i = 0; i < chunkCount; ++i) {
            this.available[i] = new SubImage(new GLImage(gl, chunkSize, chunkSize), [0, 0], [this.chunkSize, this.chunkSize]);
        }
        
        this.image = new GLImage(gl, this.texSize, this.texSize);
        for (let y = 0; y < this.texChunksSize; ++y) {
            for (let x = 0; x < this.texChunksSize; ++x) {
                //this.available.push(new SubImage(this.image, [x * this.chunkSize, y * this.chunkSize], [this.chunkSize, this.chunkSize]));
            }
        }
    }
    
    addPage(gl) {
        let page = new GLImage(gl, this.texSize, this.texSize);
        this.pages.push(page);

        for (let y = 0; y < this.texChunksSize; ++y) {
            for (let x = 0; x < this.texChunksSize; ++x) {
                this.available.push(new SubImage(this.atlases[page], [x * this.chunkSize, y * this.chunkSize], [this.chunkSize, this.chunkSize]));
            }
        }
    }
    
    compact() {
        
    }

    /*subImage(index) {
        let page = Math.floor(index / (this.pageChunkSize * this.pageChunkSize));
        let offset = index - page * this.pageChunkSize * this.pageChunkSize;
        let y = Math.floor(offset / this.pageChunkSize);
        let x = offset - y * this.pageChunkSize;
        //return [this.atlases[page], [x * this.chunkSize, y * this.chunkSize], [this.chunkSize, this.chunkSize]];
        return new SubImage(this.atlases[page], [x * this.chunkSize, y * this.chunkSize], [this.chunkSize, this.chunkSize]);
    }*/

    grab() {
        let chunk = null;
        if (this.available.length >= 1) {
            chunk = this.available.pop();
            this.occupied.add(chunk);
            chunk.image.clear();
        }
        return chunk;
    }
    release(chunk) {
        if (this.occupied.has(chunk)) {
            this.occupied.delete(chunk);
            this.available.push(chunk);
        }
    }
    reset() {
        for (let chunk of this.occupied) {
            this.release(chunk);
        }
    }
}



class ChunkedImage extends Map {
    constructor(chunkCache) {
        super();
        this.chunkCache = chunkCache;
        this.extents = new Bounds();
    }

    get chunkSize() { return this.chunkCache.chunkSize; }

    static toKey(array) {
        return array[0].toString() + "&" + array[1].toString();
    }
    static fromKey(key) {
        let array = key.split("&", 2);
        array.forEach((value, index, array) => {
            array[index] = parseFloat(value);
        });
        return array;
    }

    addChunk(address) {
        let chunk = this.chunkCache.grab();
        if (chunk) {
            let key = ChunkedImage.toKey(address);
            this.set(key, chunk);
            this.extents.boundOther(new Bounds(address[0] * this.chunkCache.chunkSize, address[1] * this.chunkCache.chunkSize, this.chunkCache.chunkSize, this.chunkCache.chunkSize));
        }
        return chunk;
    }
    address(pos) {
        let chunk = [Math.floor(pos[0] / this.chunkCache.chunkSize), Math.floor(pos[1] / this.chunkCache.chunkSize)];
        let pixel = [pos[0] - chunk[0] * this.chunkCache.chunkSize, pos[1] - chunk[1] * this.chunkCache.chunkSize];
        return [chunk, pixel];
    }
    boundsToChunks(bounds) {
        let chunkBounds = new Bounds(bounds.x / this.chunkCache.chunkSize, bounds.y / this.chunkCache.chunkSize, bounds.width / this.chunkCache.chunkSize, bounds.height / this.chunkCache.chunkSize);
        chunkBounds.round();
        return chunkBounds;
    }
    chunksInBounds(bounds) {
        let chunks = [];
        let chunkBounds = this.boundsToChunks(bounds);
        for (let y = chunkBounds.y; y < chunkBounds.y + chunkBounds.height; ++y) {
            for (let x = chunkBounds.x; x < chunkBounds.x + chunkBounds.width; ++x) {
                let key = ChunkedImage.toKey([x, y]);
                if (this.has(key))
                    chunks.push([[x, y], this.get(key)]);
            }
        }
        return chunks;
    }

    getPixel(pos) {
        let [chunk, pixel] = this.address(pos);
        let key = ChunkedImage.toKey(chunk);
        if (this.has(key))
            return this.get(key).image.getPixel(pixel);
        else
            return new Colour(0, 0, 0, 0);
    }
    setPixel(pos, colour) {
        let [chunk, pixel] = this.address(pos);
        let key = ChunkedImage.toKey(chunk);
        if (this.has(key) || this.addChunk(chunk))
            this.get(key).image.setPixel(pixel, colour);
    }
}
