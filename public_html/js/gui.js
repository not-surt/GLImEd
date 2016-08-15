/*
This program is free software. It comes without any warranty, to
the extent permitted by applicable law. You can redistribute it
and/or modify it under the terms of the Do What The Fuck You Want
To Public License, Version 2, as published by Sam Hocevar. See
http://www.wtfpl.net/ for more details.
*/



/* global Colour */

"use strict";



class BrushEditor {
    constructor() {
    }
}



class ColourEditor {
    constructor() {
    }
}



class Gui {
    constructor(app, subtree, container) {
        let connectFieldSliderSpinbox = (id, inputFunc, obj = null, objProp = null) => {
            let spinbox = this[id];
            let slider = this[id + "Slider"];
            let prop;
            if (obj) {
                prop = objProp ? objProp : id;
                slider.value = spinbox.value = obj[prop];
            }
            spinbox.addEventListener("change", (event) => {
                if (inputFunc) inputFunc(event);
                slider.value = spinbox.value;
                if (obj) obj[prop] = parseFloat(spinbox.value);
            });
            slider.value = spinbox.value;
            slider.addEventListener("input", (event) => {
                spinbox.value = slider.value;
                spinbox.dispatchEvent(new Event("change"));
            });
        };

        container.appendChild(subtree);

        // Root element
        this.root = document.getElementById("app");

        let elements;

        // Build extra controls
        elements = this.root.getElementsByClassName("withSlider");
        for (let element of elements) {
            let input = document.createElement("input");
            input.id = element.id + "Slider";
            input.type = "range";
            input.min = element.min;
            input.max = element.max;
            input.step = element.step;
            input.value = element.value;
            this[input.id] = element.parentNode.insertBefore(input, element);
        }

        // Assign from ids
        elements = this.root.querySelectorAll("[id]");
        for (let element of elements) {
            this[element.id] = element;
        }

        // Tool panel
        this.tools.style.position = "fixed";
        this.tools.style.top = 0;
        this.tools.style.left = 0;

        this.fullscreen.addEventListener("click", () => {
            if (document.fullscreenElement === this.root) document.exitFullscreen();
            else this.root.requestFullscreen();
        });

        this.newImage.addEventListener("click", (event) => {
            app.newImage();
        });

        this.loadImage.addEventListener("click", (event) => {
            app.loadImage();
        });

        this.saveImage.addEventListener("click", (event) => {
            app.saveImage();
        });

        connectFieldSliderSpinbox("spacing", null, app, "strokeSpacing");

        this.proportionalSpacing.addEventListener("change", (event) => {
            if (this.proportionalSpacing.checked) {
                app.strokeSpacing = app.strokeSpacing / Math.sqrt(brush.width * brush.height);
                this.spacing.min = 0.1;
                this.spacing.max = 4;
                this.spacing.step = 0.1;
                this.spacingSlider.min = 0.1;
                this.spacingSlider.max = 4;
                this.spacingSlider.step = 0.1;
            }
            else {
                app.strokeSpacing = app.strokeSpacing * Math.sqrt(brush.width * brush.height);
                this.spacing.min = 1;
                this.spacing.max = 1024;
                this.spacing.step = 1;
                this.spacingSlider.min = 1;
                this.spacingSlider.max = 1024;
                this.spacingSlider.step = 1;
            }
            this.spacing.value = app.strokeSpacing;
            this.spacing.dispatchEvent(new Event("change"));
        });

        let brush = app.brush;

        this.type.value = brush.type;
        this.type.addEventListener("change", (event) => {
            brush.type = parseInt(this.type.value);
        });

        connectFieldSliderSpinbox("width", (event) => {
            if (this.fixedRatio.checked) {
                brush.height = this.width.value / app.brushRatio;
                this.height.value = brush.height;
                this.heightSlider.value = brush.height;
            }
            else {
                app.brushRatio = this.width.value / this.height.value;
                this.fixedRatioOutput.value = app.brushRatio.toFixed(3);
            }
        }, brush);

        connectFieldSliderSpinbox("height", (event) => {
            if (this.fixedRatio.checked) {
                brush.width = this.height.value * app.brushRatio;
                this.width.value = brush.width;
                this.widthSlider.value = brush.width;
            }
            else {
                app.brushRatio = this.width.value / this.height.value;
                this.fixedRatioOutput.value = app.brushRatio.toFixed(3);
            }
        }, brush);

        this.fixedRatioOutput.value = app.brushRatio.toFixed(3);

        connectFieldSliderSpinbox("angle", null, brush);

        connectFieldSliderSpinbox("bias", null, brush);

        connectFieldSliderSpinbox("gain", null, brush);

        this.colour.value = app.colour;
        this.colour.addEventListener("change", (event) => {
            let newColour = Colour.fromString(this.colour.value);
            newColour.a = app.colour.a;
            app.colour = newColour;
        });

        this.levels.value = 256;
        connectFieldSliderSpinbox("levels", (event) => {
            this.bits.value = Math.ceil(Math.log2(this.levels.value));
            this.bitsSlider.value = this.bits.value;
            this.levelsSlider.value = this.levels.value;
            app.colour = app.colour;
        });

        this.bits.value = 8;
        connectFieldSliderSpinbox("bits", (event) => {
            this.levels.value = Math.pow(2, this.bits.value);
            this.levelsSlider.value = this.levels.value;
            this.bitsSlider.value = this.bits.value;
            app.colour = app.colour;
        });

        this.red.value = app.colour.r;
        connectFieldSliderSpinbox("red", (event) => {
            let newColour = Colour.clone(app.colour);
            newColour.r = this.red.value;
            app.colour = newColour;
        });

        this.green.value = app.colour.g;
        connectFieldSliderSpinbox("green", (event) => {
            let newColour = Colour.clone(app.colour);
            newColour.g = this.green.value;
            app.colour = newColour;
        });

        this.blue.value = app.colour.b;
        connectFieldSliderSpinbox("blue", (event) => {
            let newColour = Colour.clone(app.colour);
            newColour.b = this.blue.value;
            app.colour = newColour;
        });

        this.alpha.value = app.colour.a;
        connectFieldSliderSpinbox("alpha", (event) => {
            let newColour = Colour.clone(app.colour);
            newColour.a = this.alpha.value;
            app.colour = newColour;
        });

        // Layers panel
        //this.layers.style.position = "fixed";
        //this.layers.style.top = 0;
        //this.layers.style.right = 0;

        //this.layer.style.width = "100%";
        //this.layer.size = 8;

        // Info panel
        this.info.style.position = "fixed";
        this.info.style.bottom = 0;
        this.info.style.left = 0;

        this.pixel.style.width = "12ch";

        this.chunk.style.width = "12ch";

        this.pan.style.width = "12ch";

        this.zoom.style.width = "12ch";

        this.mouseColour.style.width = "16ch";

        this.chunks.style.width = "12ch";

        this.dimensions.style.width = "16ch";

        this.extents.style.width = "24ch";
    }

    update(app) {
        if (app.mousePos) {
            let [chunk, ] = app.image.address(app.mousePos);
            this.pixel.innerHTML = Math.floor(app.mousePos[0]) + "," + Math.floor(app.mousePos[1]);
            this.chunk.innerHTML = chunk[0] + "," + chunk[1];
            let colour = app.image.getPixel(app.mousePos);
            this.mouseColour.innerHTML = colour.r + "," + colour.g + "," + colour.b + " (" + colour.a + ")";
            this.mouseColour.style.backgroundColor = colour.toString();
            this.mouseColour.style.color = (colour.r + colour.g + colour.b) / 3 > 127 ? new Colour(0, 0, 0) : new Colour(255, 255, 255);
        } else {
            this.pixel.innerHTML = this.chunk.innerHTML = this.mouseColour.innerHTML = "&hellip;";
            this.mouseColour.style.backgroundColor = "";
            this.mouseColour.style.color = "";
        }
        this.pan.innerHTML = app.camera.pan[0] + "," + app.camera.pan[1];
        this.zoom.innerHTML = (app.camera.zoom < 1.0 ? "1/" + (1.0 / app.camera.zoom) : app.camera.zoom) + "x";
        this.dimensions.innerHTML = app.image.extents.width + "x" + app.image.extents.height;
        this.extents.innerHTML = app.image.extents.x + "," + app.image.extents.y + " -> " + (app.image.extents.x + app.image.extents.width) + "," + (app.image.extents.y + app.image.extents.height);
        this.chunks.innerHTML = app.chunkCache.occupied.size + " (" + app.chunkCache.available.length + ")";
        let chunkMemory = app.chunkCache.chunkSize * app.chunkCache.chunkSize * 4;
        let mebiBtye = 1024 * 1024;
        this.memory.innerHTML = (app.chunkCache.occupied.size * chunkMemory / mebiBtye).toFixed(2) + "MiB (" + (app.chunkCache.available.length * chunkMemory / mebiBtye).toFixed(2) + "MiB)";
    }
}
