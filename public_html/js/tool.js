/*
This program is free software. It comes without any warranty, to
the extent permitted by applicable law. You can redistribute it
and/or modify it under the terms of the Do What The Fuck You Want
To Public License, Version 2, as published by Sam Hocevar. See
http://www.wtfpl.net/ for more details.
*/



class Brush {
    constructor(app) {
        this.Type = {
            PIXEL: 0,
            ELLIPSE: 1,
            RECTANGLE: 2
        };
        this.TypeInverse = inverseObject(this.Type);
        this.TypeString = {
            ELLIPSE: "Ellipse",
            RECTANGLE: "Rectangle"
        };

        this.app = app;
        this._program = null;
        this._type = this.Type.ELLIPSE;
        this.width = 16;
        this.height = 16;
        this.angle = 0.0;
        this.bias = 0.5;
        this.gain = 0.5;
    }

    set type(type) {
        this._type = type;
        if (type !== this.Type.PIXEL) {
            let gl = this.app.gl;

            let program = this.app.programs["brush" + this.TypeString[this.TypeInverse[this._type]]];

            gl.useProgram(program.id);
//            gl.uniform4fv(program.uniforms["colour"], colour.toFloats());
            gl.uniform1f(program.uniforms["bias"], this.bias);
            gl.uniform1f(program.uniforms["gain"], this.gain);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.app.clipTriStripQuadElement);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.app.clipVertBuffer);
            gl.vertexAttribPointer(program.attribs["pos"], 2, gl.FLOAT, false, 0, 0);

            this._program = program;
        }
    }
    get type() {
        return this._type;
    }
}



class Context {
    constructor() {
        this.strokeSpacing = 0.5;
        this.brush.width = 16;
        this.brush.height = 16;
        this.brushRatio = 1.0;
        this.brushAngle = 0.0;
        this.brush.bias = 0.5;
        this.brush.gain = 0.5;
    }
}
