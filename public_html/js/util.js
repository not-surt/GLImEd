/*
 This program is free software. It comes without any warranty, to
 the extent permitted by applicable law. You can redistribute it
 and/or modify it under the terms of the Do What The Fuck You Want
 To Public License, Version 2, as published by Sam Hocevar. See
 http://www.wtfpl.net/ for more details.
 */



"use strict";



class Util {
    static step(value, size) {
        return Math.round(value / size) * size;
    }

    static snap(offset, step, target, relativeTo) {
        let shift = (typeof relativeTo !== "undefined" ? relativeTo : offset);
        return step !== 0 ? Util.step(target - shift, step) + shift : target;
    }

    static snap2D(pos, grid) {
        return [
            Util.snap(0, grid[0], pos[0]),
            Util.snap(0, grid[1], pos[1])
        ];
    }
    
    static elementText(element) {
        let text = "";
        for (let node = element.firstChild; node; node = node.nextSibling) {
            if (node.nodeType === node.TEXT_NODE) {
                text += node.textContent;
            }
        }
        return text;
    }
    
    static asycCall(funcArg, thisArg, ...otherArgs) {
        requestAnimationFrame(funcArg.bind(thisArg, ...otherArgs));
    }

    static inverseObject(object) {
        let newObject = {};
        for (let property in object) {
            newObject[object[property]] = property;
        }
        return newObject;
    }

    static randomDisk() {
        let sqrtRadius = Math.sqrt(Math.random());
        let theta = Math.random() * 2.0 * Math.PI;
        return [sqrtRadius * Math.cos(theta), sqrtRadius * Math.sin(theta)];
    }
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



class Grid {
    constructor() {
        this.offset = [0.0, 0.0];
        this.size = [16.0, 16.0];
    }

    snap(pos) {

    }
}
