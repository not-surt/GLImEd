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
    constructor(app) {
        this.app = app;
    }
}



class ColourEditor {
    constructor() {
    }
}



class Gui {
    setField(id, value) {
        this[id].value = value;
        this[id].dispatchEvent(new Event("change"));
    }
    
    connectFieldObject(id, inputFunc, obj = null, objProp = null) {
        let spinbox = this[id];
        let slider = this[id + "Slider"];
        let prop;
        if (obj) {
            prop = objProp ? objProp : id;
            slider.value = spinbox.value = obj[prop];
        }
        spinbox.addEventListener("change", (event) => {
            if (inputFunc) inputFunc(event);
            if (obj) obj[prop] = parseFloat(spinbox.value);
        });
    }
    
    constructor(subtree, container) {
        container.appendChild(subtree);

        // Root element
        this.root = document.getElementById("app");

        let elements;

        // Build extra controls
        elements = this.root.getElementsByClassName("withSlider");
        for (let element of elements) {
            let slider = document.createElement("input");
            slider.id = element.id + "Slider";
            slider.type = "range";
            slider.min = element.min;
            slider.max = element.max;
            slider.step = element.step;
            slider.value = element.value;
            this[slider.id] = element.parentNode.insertBefore(slider, element);
            
            let capturedElement = element;
            
            element.change = (value) => {
                capturedElement.value = value;
                capturedElement.dispatchEvent(new Event("change"));
            };
            
            element.updateSlider = () => {
                slider.min = capturedElement.min;
                slider.max = capturedElement.max;
                slider.step = capturedElement.step;
                slider.value = capturedElement.value;
            };
            
            element.addEventListener("change", (event) => {
                slider.value = capturedElement.value;
            });
            slider.value = element.value;
            slider.addEventListener("input", (event) => {
                capturedElement.change(slider.value);
            });
        }

        // Assign from ids
        elements = this.root.querySelectorAll("[id]");
        for (let element of elements) {
            this[element.id] = element;
        }

        // Tool panel
        this.tools.style.position = "fixed";
        this.tools.style.top = 0;
        this.tools.style.bottom = 0;
        this.tools.style.left = 0;

        this.chunks.style.width = "12ch";

        this.dimensions.style.width = "16ch";

        this.extents.style.width = "24ch";

        // Layers panel
        //this.layers.style.position = "fixed";
        //this.layers.style.top = 0;
        //this.layers.style.right = 0;

        //this.layer.style.width = "100%";
        //this.layer.size = 8;

        // Fork me
        this.forkMe.style.position = "fixed";
        this.forkMe.style.bottom = 0;
        this.forkMe.style.right = 0;

        // HUD
        this.hud.style.position = "fixed";
        this.hud.style.top = 0;
        this.hud.style.right = 0;

        this.pixel.style.width = "12ch";

        this.chunk.style.width = "12ch";

        this.mouseColour.style.width = "18ch";

        this.pan.style.width = "18ch";

        this.zoom.style.width = "12ch";
    }

    initialize(app) {
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

        this.connectFieldObject("spacing", null, app, "strokeSpacing");
        this.proportionalSpacing.addEventListener("change", (event) => {
            if (this.proportionalSpacing.checked) {
                app.strokeSpacing = app.strokeSpacing / Math.sqrt(app.brush.width * app.brush.height);
                this.spacing.min = this.spacingSlider.min = 0.1;
                this.spacing.max = this.spacingSlider.max = 4;
                this.spacing.step = this.spacingSlider.step = 0.1;
            }
            else {
                app.strokeSpacing = app.strokeSpacing * Math.sqrt(app.brush.width * app.brush.height);
                this.spacing.min = this.spacingSlider.min = 1;
                this.spacing.max = this.spacingSlider.max = 1024;
                this.spacing.step = this.spacingSlider.step = 1;
            }
            this.spacing.value = app.strokeSpacing;
            this.spacing.dispatchEvent(new Event("change"));
        });

        this.type.addEventListener("change", (event) => {
            app.brush.type = this.type.value;
        });
        this.falloff.addEventListener("change", (event) => {
            app.brush.falloff = this.falloff.value;
        });

        this.connectFieldObject("width", (event) => {
            if (this.fixedRatio.checked) {
                app.brush.height = this.width.value / app.brushRatio;
                this.height.value = this.heightSlider.value = app.brush.height;
            }
            else {
                app.brushRatio = this.width.value / this.height.value;
            }
            this.fixedRatioOutput.value = app.brushRatio.toFixed(3);
        }, app.brush);
        this.connectFieldObject("height", (event) => {
            if (this.fixedRatio.checked) {
                app.brush.width = this.height.value * app.brushRatio;
                this.width.value = this.widthSlider.value = app.brush.width;
            }
            else {
                app.brushRatio = this.width.value / this.height.value;
            }
            this.fixedRatioOutput.value = app.brushRatio.toFixed(3);
        }, app.brush);

        this.connectFieldObject("angle", null, app.brush);

        this.connectFieldObject("bias", null, app.brush);
        this.connectFieldObject("gain", null, app.brush);

        this.mode.addEventListener("change", (event) => {
            app.blendMode = this.mode.value;
        });
        this.connectFieldObject("strength", null, app, "blendStrength");

        this.colour.addEventListener("change", (event) => {
            let newColour = Colour.fromString(this.colour.value);
            newColour.a = app.colour.a;
            app.colour = newColour;
        });

        this.connectFieldObject("bits", (event) => {
            this.levels.value = Math.pow(2, this.bits.value);
            this.levels.dispatchEvent(new Event("change"));
        });
        this.connectFieldObject("levels", (event) => {
            this.bits.value = Math.ceil(Math.log2(this.levels.value));
            this.bitsSlider.value = this.bits.value;
            app.colour = app.colour;
            app._colourHSL = tinycolor(app._colour.toObject()).toHsl();
        });

        this.connectFieldObject("red", (event) => {
            let newColour = Colour.clone(app.colour);
            newColour.r = this.red.value;
            app.colour = newColour;
            app._colourHSL = tinycolor(app._colour.toObject()).toHsl();
        });
        this.connectFieldObject("green", (event) => {
            let newColour = Colour.clone(app.colour);
            newColour.g = this.green.value;
            app.colour = newColour;
            app._colourHSL = tinycolor(app._colour.toObject()).toHsl();
        });
        this.connectFieldObject("blue", (event) => {
            let newColour = Colour.clone(app.colour);
            newColour.b = this.blue.value;
            app.colour = newColour;
            app._colourHSL = tinycolor(app._colour.toObject()).toHsl();
        });

        this.connectFieldObject("alpha", (event) => {
            let newColour = Colour.clone(app.colour);
            newColour.a = this.alpha.value;
            app.colour = newColour;
            app._colourHSL.a = newColour.a / 255;
        });

        this.connectFieldObject("hue", (event) => {
            app._colourHSL.h = this.hue.value;
            let rgba = tinycolor(app._colourHSL).toRgb();
            app.colour = new Colour(rgba.r, rgba.g, rgba.b, rgba.a * 255);
        });
        this.connectFieldObject("saturation", (event) => {
            app._colourHSL.s = this.saturation.value;
            let rgba = tinycolor(app._colourHSL).toRgb();
            app.colour = new Colour(rgba.r, rgba.g, rgba.b, rgba.a * 255);
        });
        this.connectFieldObject("lightness", (event) => {
            app._colourHSL.l = this.lightness.value;
            let rgba = tinycolor(app._colourHSL).toRgb();
            app.colour = new Colour(rgba.r, rgba.g, rgba.b, rgba.a * 255);
        });
        
        this.setField("proportionalSpacing", true);
        this.setField("spacing", app.strokeSpacing);
        this.setField("type", app.brush.type);
        this.setField("fixedRatio", true);
        this.setField("width", app.brush.width);
        this.setField("height", app.brush.height);
        this.setField("angle", app.brush.angle);
        this.setField("falloff", app.brush.falloff);
        this.setField("bias", app.brush.bias);
        this.setField("gain", app.brush.gain);
        this.setField("mode", app.blendMode);
        this.setField("strength", app.blendStrength);
        this.setField("colour", app.colour);
        this.setField("bits", 8);
        this.setField("levels", 256);
        this.setField("red", app.colour.r);
        this.setField("green", app.colour.g);
        this.setField("blue", app.colour.b);
        this.setField("alpha", app.colour.a);
        this.setField("hue", app.colour.h);
        this.setField("saturation", app.colour.s);
        this.setField("lightness", app.colour.l);
    }

    update(app) {
        if (app.mousePos) {
            let [chunk, ] = app.image.address(app.mousePos);
            this.pixel.innerHTML = Math.floor(app.mousePos[0]) + "," + Math.floor(app.mousePos[1]);
            this.chunk.innerHTML = chunk[0] + "," + chunk[1];
            let colour = app.image.getPixel(app.mousePos);
            colour.unpremultiply();
            this.mouseColour.innerHTML = colour.r + "," + colour.g + "," + colour.b + " (" + colour.a + ")";
            //this.mouseColour.style.backgroundColor = colour.toString();
            this.mouseColour.style.backgroundColor = tinycolor(colour.toObject()).toRgbString();
            //this.mouseColour.style.color = (colour.r + colour.g + colour.b) / 3 > 127 ? new Colour(0, 0, 0) : new Colour(255, 255, 255);
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
