/*
This program is free software. It comes without any warranty, to
the extent permitted by applicable law. You can redistribute it
and/or modify it under the terms of the Do What The Fuck You Want
To Public License, Version 2, as published by Sam Hocevar. See
http://www.wtfpl.net/ for more details.
*/



class Brush {
    constructor(app) {
        this.type = "Ellipse";
        this.falloff = "Linear";
        this.width = 16;
        this.height = 16;
        this.angle = 0.0;
        this.bias = 0.5;
        this.gain = 0.5;
    }
    
    get halfWidth() { return this.width / 2.0; }
    get halfHeight() { return this.height / 2.0; }
}



class Stroke {
    constructor() {
        
    }
}



class Context {
    constructor() {
        this.colour;
    }
}



class Tool {
    constructor(app) {
        this.brush = new Brush(app);
        this.stroke = new Stroke();
        this.context = new Context();
    }
}
