"use strict";
var dom = require("../lib/dom");
var oop = require("../lib/oop");
var EventEmitter = require("../lib/event_emitter").EventEmitter;

class Decorator {
    constructor(parent, renderer) {
        this.parentEl = parent;
        this.canvas = dom.createElement("canvas");
        this.renderer = renderer;
        this.pixelRatio = 1;
        this.maxHeight = renderer.layerConfig.maxHeight;
        this.lineHeight = renderer.layerConfig.lineHeight;
        this.minDecorationHeight = (2 * this.pixelRatio) | 0;
        this.halfMinDecorationHeight = (this.minDecorationHeight / 2) | 0;
        this.canvas.style.top = 0 + "px";
        this.canvas.style.right = 0 + "px";
        this.canvas.style.zIndex = 7 + "px";
        this.canvas.style.position = "absolute";
        this.colors = {};
        this.colors.dark = {
            "error": "rgba(255, 18, 18, 1)",
            "warning": "rgba(18, 136, 18, 1)",
            "info": "rgba(18, 18, 136, 1)"
        };

        this.colors.light = {
            "error": "rgb(255,51,51)",
            "warning": "rgb(32,133,72)",
            "info": "rgb(35,68,138)"
        };

        this.setDimensions();

        parent.element.appendChild(this.canvas);
    }

    $updateDecorators(config) {
        var colors = (this.renderer.theme.isDark === true) ? this.colors.dark : this.colors.light;
        this.setDimensions(config);

        var ctx = this.canvas.getContext("2d");

        function compare(a, b) {
            if (a.priority < b.priority) return -1;
            if (a.priority > b.priority) return 1;
            return 0;
        }

        var annotations = this.renderer.session.$annotations;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (annotations) {
            var priorities = {
                "info": 1,
                "warning": 2,
                "error": 3
            };
            annotations.forEach(function (item) {
                item.priority = priorities[item.type] || null;
            });
            annotations = annotations.sort(compare);

            for (let i = 0; i < annotations.length; i++) {
                let row = annotations[i].row;
                let compensateFold = this.compensateFoldRows(row);
                let currentY = Math.round((row - compensateFold) * this.lineHeight * this.heightRatio);
                let y1 = Math.round(((row - compensateFold) * this.lineHeight * this.heightRatio));
                let y2 = Math.round((((row - compensateFold) * this.lineHeight + this.lineHeight) * this.heightRatio));
                const height = y2 - y1;
                if (height < this.minDecorationHeight) {
                    let yCenter = ((y1 + y2) / 2) | 0;
                    if (yCenter < this.halfMinDecorationHeight) {
                        yCenter = this.halfMinDecorationHeight;
                    }
                    else if (yCenter + this.halfMinDecorationHeight > this.canvasHeight) {
                        yCenter = this.canvasHeight - this.halfMinDecorationHeight;
                    }
                    y1 = Math.round(yCenter - this.halfMinDecorationHeight);
                    y2 = Math.round(yCenter + this.halfMinDecorationHeight);
                }

                ctx.fillStyle = colors[annotations[i].type] || null;
                ctx.fillRect(0, currentY, this.canvasWidth, y2 - y1);
            }
        }
        var cursor = this.renderer.session.selection.getCursor();
        if (cursor) {
            let compensateFold = this.compensateFoldRows(cursor.row);
            let currentY = Math.round((cursor.row - compensateFold) * this.lineHeight * this.heightRatio);
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fillRect(0, currentY, this.canvasWidth, 2);
        }

    }

    compensateFoldRows(row) {
        let foldData = this.renderer.session.$foldData;
        let compensateFold = 0;
        if (foldData && foldData.length > 0) {
            for (let j = 0; j < foldData.length; j++) {
                if (row > foldData[j].start.row && row < foldData[j].end.row) {
                    compensateFold += row - foldData[j].start.row;
                }
                else if (row >= foldData[j].end.row) {
                    compensateFold += foldData[j].end.row - foldData[j].start.row;
                }
            }
        }
        return compensateFold;
    }

    compensateLineWidgets(row) {
        const widgetManager = this.renderer.session.widgetManager;
        if (widgetManager) {
            let delta = 0;
            widgetManager.lineWidgets.forEach((el, index) => {
                if (row > index) {
                    delta += el.rowCount || 0;
                }
            });
            return delta - 1;
        }
        return 0;
    }

    setDimensions(config) {
        if (config) {
            this.maxHeight = config.maxHeight;
            this.lineHeight = config.lineHeight;
            this.canvasHeight = config.height;

            if (this.maxHeight < this.canvasHeight) {
                this.heightRatio = 1;
            }
            else {
                this.heightRatio = this.canvasHeight / this.maxHeight;
            }
        }
        else {
            this.canvasHeight = this.parentEl.parent.scrollHeight || this.canvasHeight;
            this.canvasWidth = this.parentEl.width || this.canvasWidth;
            this.heightRatio = this.canvasHeight / this.maxHeight;

            this.canvas.width = this.canvasWidth;
            this.canvas.height = this.canvasHeight;
        }
    }
}

oop.implement(Decorator.prototype, EventEmitter);

exports.Decorator = Decorator;
