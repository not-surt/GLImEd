/*
This program is free software. It comes without any warranty, to
the extent permitted by applicable law. You can redistribute it
and/or modify it under the terms of the Do What The Fuck You Want
To Public License, Version 2, as published by Sam Hocevar. See
http://www.wtfpl.net/ for more details.
*/



/* global vec2 */

"use strict";



class Input {
    constructor(app) {
        this.MouseButtons = {
            LEFT: 0,
            MIDDLE: 1,
            RIGHT: 2
        };
        this.Keys = {
            SPACE: " "
        };
        this.app = app;
        this.keydownCount = 0;
        this.mouseButtons = new Map();
        this.lastMousePos;
        this.inDrag = false;
        this.onCanvas = false;

        this.keyListener = this.keyHandler.bind(this);
        this.app.canvas.addEventListener("keydown", this.keyListener);
        this.touchListener = this.touchHandler.bind(this);
        this.app.canvas.addEventListener("touchstart", this.touchListener);
        this.mouseListener = this.mouseHandler.bind(this);
        this.app.canvas.addEventListener("mousedown", this.mouseListener);
        this.app.canvas.addEventListener("mouseenter", this.mouseListener);
        this.app.canvas.addEventListener("wheel", this.mouseListener);
        this.app.canvas.addEventListener("contextmenu", (event) => {
            event.stopPropagation();
            event.preventDefault();
        });
        this.clearInputListener = this._clearInputHandlers.bind(this);
        this.app.canvas.addEventListener("focusout", this.clearInputListener);
        document.addEventListener("visibilitychange", this.clearInputListener);
        document.addEventListener("contextmenu", this.clearInputListener);
    }

    keyHandler(event) {
        if (event.key === this.Keys.SPACE) {
            if (event.type === "keydown" && !event.repeat) {
                this.app.canvas.dispatchEvent(new MouseEvent("mousedown", {"button": this.MouseButtons.MIDDLE}));
            }
            else if (event.type === "keyup") {
                document.dispatchEvent(new MouseEvent("mouseup", {"button": this.MouseButtons.MIDDLE}));
            }
            event.stopPropagation();
            event.preventDefault();
        }

        // Manage document key listening
        if (event.type === "keydown" && !event.repeat && this.keydownCount++ === 0) {
            document.addEventListener("keyup", this.keyListener);
        }
        else if (event.type === "keyup" && --this.keydownCount === 0) {
            document.removeEventListener("keyup", this.keyListener);
        }
    }

    touchHandler(event) {
        event.preventDefault();
        if (event.type === "touchstart") {
            this.app.canvas.addEventListener("touchend", this.touchListener);
            this.app.canvas.addEventListener("touchcancel", this.touchListener);
            this.app.canvas.addEventListener("touchmove", this.touchListener);
            this.app.canvas.dispatchEvent(new MouseEvent("mousedown", {"button": this.MouseButtons.LEFT}));
        }
        else if (event.type === "touchend" || event.type === "touchcancel") {
            document.dispatchEvent(new MouseEvent("mouseup", {"button": this.MouseButtons.LEFT}));
            this.app.canvas.removeEventListener("touchmove", this.touchListener);
            this.app.canvas.removeEventListener("touchcancel", this.touchListener);
            this.app.canvas.removeEventListener("touchend", this.touchListener);
        }
        else if (event.type === "touchmove") {
            pr("touchmove");
            this.app.canvas.dispatchEvent(new MouseEvent("mousemove", { "clientX": event.clientX, "clientY": event.clientY, "movementX": event.movementX, "movementY": event.movementY }));
        }
    }
    
    addMouseButton(button) {
        let count = (this.mouseButtons.has(button) ? this.mouseButtons.get(button) : 0);
        if (count === 0) {
            document.addEventListener("mousemove", this.mouseListener);
            document.addEventListener("mouseup", this.mouseListener);
        }
        this.mouseButtons.set(button, count + 1);
    }
    
    removeMouseButton(button) {
        let count = this.mouseButtons.get(button) - 1;
        this.mouseButtons.set(button, count);
        if (count === 0)
            this.mouseButtons.delete(button);

        if (this.mouseButtons.size === 0) {
            document.removeEventListener("mouseup", this.mouseListener);
            document.removeEventListener("mousemove", this.mouseListener);
        }
    }

    mouseHandler(event) {
        let pos = [event.clientX, event.clientY];

        let worldPos = vec2.fromValues(event.clientX, event.clientY);
        vec2.transformMat2d(worldPos, worldPos, this.app.mouseMatrix);
        vec2.transformMat2d(worldPos, worldPos, this.app.camera.inverseMatrix);
        //pr("world: " + worldPos[0] + ", " + worldPos[1] + "   pan: " + this.camera.pan[0] + ", " + this.camera.pan[1]);
        
        if (event.type === "wheel") {
            let steps = [Math.sign(event.deltaX), Math.sign(event.deltaY)];
            this.app.zoom(steps);
            this.app.requestRedraw();
            this.app.requestGuiUpdate();
        }
        else if (this.mouseButtons.has(this.MouseButtons.MIDDLE) || (this.mouseButtons.has(this.MouseButtons.LEFT) && event.getModifierState("Control"))) {
            if (event.type === "mousemove") {
                let delta = vec2.fromValues(event.movementX, event.movementY);
                vec2.transformMat2(delta, delta, this.app.mouseMatrix);
                vec2.transformMat2(delta, delta, this.app.camera.inverseMatrix);
                this.app.pan(delta);
            }
        }
        else if (event.type === "mouseup" || event.type === "mousemove") {
            let lastWorldPos = vec2.fromValues(this.lastMousePos[0], this.lastMousePos[1]);
            vec2.transformMat2d(lastWorldPos, lastWorldPos, this.app.mouseMatrix);
            vec2.transformMat2d(lastWorldPos, lastWorldPos, this.app.camera.inverseMatrix);
            if (this.mouseButtons.has(this.MouseButtons.RIGHT)) {
                this.app.pick(worldPos);
            }
            if (this.mouseButtons.has(this.MouseButtons.LEFT)) {
                this.app.paintStroke(lastWorldPos, worldPos);
                if (event.type === "mouseup") this.app.offset = 0;
            }
        }

        if (event.type === "mouseenter") {
            this.app.canvas.addEventListener("mousemove", this.mouseListener);
            this.app.canvas.addEventListener("mouseleave", this.mouseListener);
        }
        else if (event.type === "mouseleave") {
            this.app.canvas.removeEventListener("mouseleave", this.mouseListener);
            this.app.canvas.removeEventListener("mousemove", this.mouseListener);
            this.app.mousePos = null;
            this.app.requestRedraw();
            this.app.requestGuiUpdate();
        }
        else if (event.type === "mousemove" && event.target === this.app.canvas) {
            this.app.mousePos = worldPos;
            this.app.requestRedraw();
            this.app.requestGuiUpdate();
            if (event.button === this.MouseButtons.LEFT && this.mouseButtons.has(event.button))
                this.app.strokeAdd(worldPos);
        }
        else if (event.type === "mousedown") {
            if (event.button === this.MouseButtons.MIDDLE && !this.mouseButtons.has(event.button))
                this.app.canvas.requestPointerLock();
            if (event.button === this.MouseButtons.LEFT && !this.mouseButtons.has(event.button))
                this.app.strokeStart(worldPos);
            this.addMouseButton(event.button);
        }
        else if (event.type === "mouseup") {
            this.removeMouseButton(event.button);

            if (event.button === this.MouseButtons.MIDDLE && !this.mouseButtons.has(event.button))
                document.exitPointerLock();
            if (event.button === this.MouseButtons.LEFT && !this.mouseButtons.has(event.button))
                this.app.strokeFinish();
        }

        this.lastMousePos = pos;

        event.stopPropagation();
        if (document.activeElement === this.app.canvas)
            event.preventDefault();
    }

    _clearInputHandlers() {
        if (document.pointerLockElement === this.app.canvas)
            document.exitPointerLock();

        document.removeEventListener("mouseup", this.mouseListener);
        document.removeEventListener("mousemove", this.mouseListener);
        this.mouseButtons.clear();

        document.removeEventListener("keyup", this.keyListener);
        this.keydownCount = 0;
    }
}
