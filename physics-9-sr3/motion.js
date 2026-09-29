(function () {
    "use strict";

    // --- Helpers ---

    const NS = "http://www.w3.org/2000/svg";

    function el(tag, attrs, parent) {
        const e = document.createElementNS(NS, tag);
        if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
        if (parent) parent.appendChild(e);
        return e;
    }

    // Format number: 1 decimal, comma separator, unicode minus, -0.0 -> 0.0
    function fmt(v) {
        const val = Math.round(v * 10) / 10;
        if (Math.abs(val) < 0.05) return "0,0";
        const s = val.toFixed(1).replace('.', ',');
        return s.replace('-', '−');
    }

    // Format tick: integer if possible, else fmt
    function fmtTick(v) {
        if (Math.abs(v - Math.round(v)) < 1e-9) return Math.round(v).toString().replace("-", "−");
        return fmt(v);
    }

    // Physics Model
    function model(p, t) {
        const ax = p.a;
        const vx = p.v0 + p.a * t;
        const x = p.x0 + p.v0 * t + 0.5 * p.a * t * t;
        const sx = x - p.x0;
        
        let l = Math.abs(sx);
        if (p.a !== 0) {
            const tr = -p.v0 / p.a;
            if (tr > 0 && tr < t) {
                const xTr = p.x0 + p.v0 * tr + 0.5 * p.a * tr * tr;
                l = Math.abs(xTr - p.x0) + Math.abs(x - xTr);
            }
        }
        return { ax, vx, x, sx, l };
    }

    // Nice Range Calculation
    function niceRange(min, max) {
        if (max < min) [min, max] = [max, min];
        if (min > 0) min = 0;
        if (max < 0) max = 0;
        
        const range = max - min;
        if (range < 1e-9) {
            // Constant function or zero range
            const val = min;
            return { min: Math.min(val - 1, -1), max: Math.max(val + 1, 1), step: 1 };
        }

        const rawStep = range / 5;
        const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
        let step;
        if (rawStep / mag <= 1) step = mag;
        else if (rawStep / mag <= 2) step = 2 * mag;
        else if (rawStep / mag <= 5) step = 5 * mag;
        else step = 10 * mag;

        return {
            min: Math.floor(min / step) * step,
            max: Math.ceil(max / step) * step,
            step
        };
    }

    // --- Widget Logic ---

    function initWidget(container, jsonStr) {
        try {
            const raw = JSON.parse(jsonStr);
            
            // Defaults
            const cfg = Object.assign({
                title: "Motion Model",
                x0: 0, v0: 0, a: 1,
                T: 6, t0: 0, speed: 1,
                panels: ["track", "v"],
                area: false, split: false,
                sliders: [],
                ranges: { x0: [-10, 10, 1], v0: [-6, 6, 1], a: [-2, 2, 0.5] },
                readout: ["t", "vx", "x"],
                controls: true
            }, raw);

            // State
            let state = {
                t: cfg.t0,
                playing: false,
                lastTime: null,
                params: { x0: cfg.x0, v0: cfg.v0, a: cfg.a }
            };

            // DOM Elements
            const svg = el("svg", { 
                class: "motion-svg", 
                viewBox: `0 0 600 ${computeHeight(cfg.panels)}`,
                role: "img",
                "aria-label": cfg.title
            }, container);
            el("title", {}, svg).textContent = cfg.title;

            // Side column: buttons, sliders, readout (right of the figure on wide screens)
            const side = document.createElement("div");
            side.className = "motion-side";
            container.appendChild(side);

            const controlsDiv = document.createElement("div");
            if (cfg.controls) {
                controlsDiv.className = "motion-controls";
                
                // Play Button
                const btnPlay = document.createElement("button");
                btnPlay.type = "button";
                btnPlay.className = "motion-btn motion-play";
                btnPlay.textContent = "▶ Пуск";
                btnPlay.onclick = () => {
                    if (state.t >= cfg.T) {
                        state.t = 0;
                        updateParams(); // Reset visuals to t=0
                    }
                    state.playing = !state.playing;
                    btnPlay.textContent = state.playing ? "❚❚ Пауза" : "▶ Пуск";
                    if (state.playing) {
                        state.lastTime = performance.now();
                        requestAnimationFrame(loop);
                    }
                };
                controlsDiv.appendChild(btnPlay);

                // Reset Button
                const btnReset = document.createElement("button");
                btnReset.type = "button";
                btnReset.className = "motion-btn motion-reset";
                btnReset.textContent = "⟲ Сначала";
                btnReset.onclick = () => {
                    state.playing = false;
                    btnPlay.textContent = "▶ Пуск";
                    state.t = 0;
                    updateParams();
                };
                controlsDiv.appendChild(btnReset);

                // Time Slider
                const labelTime = document.createElement("label");
                labelTime.className = "motion-slider motion-time";
                const spanTime = document.createElement("span");
                spanTime.textContent = `t = ${fmt(state.t)} с`;
                const inputTime = document.createElement("input");
                inputTime.type = "range";
                inputTime.min = 0;
                inputTime.max = cfg.T;
                inputTime.step = 0.05;
                inputTime.value = state.t;
                
                inputTime.oninput = () => {
                    state.playing = false;
                    btnPlay.textContent = "▶ Пуск";
                    state.t = parseFloat(inputTime.value);
                    updateParams();
                };

                labelTime.appendChild(spanTime);
                labelTime.appendChild(inputTime);
                controlsDiv.appendChild(labelTime);
            }
            side.appendChild(controlsDiv);

            // Parameter Sliders
            const sliderEls = {};
            cfg.sliders.forEach(key => {
                const r = cfg.ranges[key] || [0, 10, 1];
                const label = document.createElement("label");
                label.className = "motion-slider";
                
                let unit = "";
                if (key === "x0") unit = " м";
                if (key === "v0") unit = " м/с";
                if (key === "a") unit = " м/с²";

                const span = document.createElement("span");
                const input = document.createElement("input");
                input.type = "range";
                input.min = r[0];
                input.max = r[1];
                input.step = r[2];
                input.value = state.params[key];

                const names = { x0: "x₀", v0: "v₀ₓ", a: "aₓ" };
                const setText = (val) => { span.textContent = `${names[key]} = ${fmt(val)}${unit}`; };
                input.oninput = () => {
                    const val = parseFloat(input.value);
                    state.params[key] = val;
                    setText(val);
                    if (state.t > cfg.T) state.t = cfg.T;
                    updateParams();
                };
                setText(state.params[key]); // init text only: readout is created below

                label.appendChild(span);
                label.appendChild(input);
                side.appendChild(label);
                sliderEls[key] = { span, input };
            });

            // Readout
            const pReadout = document.createElement("p");
            if (cfg.readout.length > 0) {
                pReadout.className = "motion-readout";
                side.appendChild(pReadout);
            }

            // --- Drawing Logic ---

            function computeHeight(panels) {
                let h = 30; // top margin (room for the first axis name)
                panels.forEach(p => {
                    if (p === 'track') h += 96;
                    else h += 150;
                    h += 40; // gap (axis name of the next panel)
                });
                return h - 40 + 34; // last gap replaced by bottom margin (time labels)
            }

            function updateParams() {
                const p = state.params;
                const t = state.t;
                
                // Update Time Slider UI if exists
                if (cfg.controls) {
                    const inputs = controlsDiv.querySelectorAll("input");
                    if (inputs.length > 0) inputs[0].value = t;
                    const spans = controlsDiv.querySelectorAll("span");
                    if (spans.length > 0) spans[0].textContent = `t = ${fmt(t)} с`;
                }

                // Update Readout
                if (cfg.readout.length > 0) {
                    const res = model(p, t);
                    const parts = [];
                    cfg.readout.forEach(k => {
                        let label = "";
                        let val = 0;
                        switch(k) {
                            case "t": label = `t = ${fmt(t)} с`; break;
                            case "ax": label = `aₓ = ${fmt(res.ax)} м/с²`; break;
                            case "vx": label = `vₓ = ${fmt(res.vx)} м/с`; break;
                            case "x": label = `x = ${fmt(res.x)} м`; break;
                            case "sx": label = `sₓ = ${fmt(res.sx)} м`; break;
                            case "l": label = `путь l = ${fmt(res.l)} м`; break;
                        }
                        if (label) parts.push(label);
                    });
                    pReadout.textContent = parts.join(" · ");
                }

                drawSVG(p, t);
            }

            function drawSVG(p, t) {
                // Clear SVG
                while (svg.firstChild) svg.removeChild(svg.firstChild);
                
                // Recompute Scales
                const samples = [];
                for (let i = 0; i <= 200; i++) {
                    const ti = (i / 200) * cfg.T;
                    samples.push(model(p, ti));
                }

                // X range (for track and x-panel)
                const xs = samples.map(s => s.x);
                const fx = cfg.fixed || {}; // fixed axes keep slopes comparable while sliders move
                const rX = fx.x ? niceRange(fx.x[0], fx.x[1]) : niceRange(Math.min(...xs), Math.max(...xs));
                
                // V range
                const vs = samples.map(s => s.vx);
                const rV = fx.v ? niceRange(fx.v[0], fx.v[1]) : niceRange(Math.min(...vs), Math.max(...vs));

                // A range
                const as = samples.map(s => s.ax);
                const rA = fx.a ? niceRange(fx.a[0], fx.a[1]) : niceRange(Math.min(...as), Math.max(...as));

                let currentY = 30; // Top margin

                cfg.panels.forEach(panelType => {
                    if (panelType === "track") drawTrack(currentY, p, t, rX);
                    else drawGraph(currentY, panelType, p, t, rX, rV, rA);
                    
                    currentY += (panelType === "track" ? 96 : 150) + 40;
                });
            }

            function drawTrack(yBase, p, t, range) {
                const PAD = 60; // inner margin of the track: room for arrows and labels at the ends
                const L = 70, R = 30, W = 500;
                const h = 96;
                
                // Axis Line
                el("line", { x1: L, y1: yBase + 62, x2: L + W, y2: yBase + 62, class: "g-axis" }, svg);
                // Arrowhead
                el("polygon", { points: `${L+W},${yBase+62} ${L+W-8},${yBase+58} ${L+W-8},${yBase+66}`, class: "f-ink" }, svg);
                // Label
                el("text", { x: L + W, y: yBase + 92, class: "g-text", "text-anchor": "end" }, svg).textContent = "x, м";

                // Ticks
                for (let v = range.min; v <= range.max + 1e-9; v += range.step) {
                    const x = L + PAD + ((v - range.min) / (range.max - range.min)) * (W - 2 * PAD);
                    if (x >= L && x <= L + W) {
                        el("line", { x1: x, y1: yBase + 62, x2: x, y2: yBase + 68, class: "g-axis" }, svg);
                        // the rightmost place is taken by the axis name "x, м"
                        if (x <= L + W - 40) el("text", { x: x, y: yBase + 84, class: "g-text", "text-anchor": "middle" }, svg).textContent = fmtTick(v);
                    }
                }

                // Trail (whole seconds)
                for (let k = 0; k <= Math.floor(t); k++) {
                    const resK = model(p, k);
                    const xk = L + PAD + ((resK.x - range.min) / (range.max - range.min)) * (W - 2 * PAD);
                    el("circle", { cx: xk, cy: yBase + 62, r: 3.5, class: "f-muted" }, svg);
                }

                // Body
                const res = model(p, t);
                const xBody = L + PAD + ((res.x - range.min) / (range.max - range.min)) * (W - 2 * PAD);
                el("circle", { cx: xBody, cy: yBase + 62, r: 9, class: "f-green dot-ring" }, svg);

                // Velocity Arrow
                // vx is linear in t: its largest modulus on [0,T] is at an end
                const maxV = Math.max(Math.abs(p.v0), Math.abs(p.v0 + p.a * cfg.T), 1e-9);
                const kv = 60 / maxV; // <= PAD, so the arrow never leaves the picture
                const vLen = res.vx * kv;
                
                if (Math.abs(vLen) >= 2) {
                    el("line", { x1: xBody, y1: yBase + 42, x2: xBody + vLen, y2: yBase + 42, class: "s-blue", "stroke-width": 3 }, svg);
                    // Arrowhead logic for velocity
                    const dir = Math.sign(vLen);
                    el("polygon", { 
                        points: `${xBody+vLen},${yBase+42} ${xBody+vLen-5*dir},${yBase+38} ${xBody+vLen-5*dir},${yBase+46}`, 
                        class: "f-blue" 
                    }, svg);
                    el("text", { x: xBody + vLen + 10 * dir, y: yBase + 48, class: "g-text f-blue", style: "font-style:italic; font-weight:bold;" }, svg).textContent = "v";
                }

                // Acceleration Arrow
                if (Math.abs(p.a) > 1e-9) {
                    const ka = 45 / Math.max(Math.abs(p.a), ...((cfg.ranges && cfg.ranges.a) || [2]).map(Math.abs)); // arrow length ~ |a|
                    const aLen = p.a * ka;
                    el("line", { x1: xBody, y1: yBase + 14, x2: xBody + aLen, y2: yBase + 14, class: "s-red", "stroke-width": 3 }, svg);
                    const dir = Math.sign(aLen);
                    el("polygon", { 
                        points: `${xBody+aLen},${yBase+14} ${xBody+aLen-5*dir},${yBase+10} ${xBody+aLen-5*dir},${yBase+18}`, 
                        class: "f-red" 
                    }, svg);
                    el("text", { x: xBody + aLen + 10 * dir, y: yBase + 14, class: "g-text f-red", style: "font-style:italic; font-weight:bold;" }, svg).textContent = "a";
                }
            }

            function drawGraph(yBase, type, p, t, rX, rV, rA) {
                const L = 70, R = 30, W = 500;
                const h = 150;
                
                let range, colorClass, fillColor;
                if (type === "a") { range = rA; colorClass = "s-red"; fillColor = "f-red"; }
                else if (type === "v") { range = rV; colorClass = "s-blue"; fillColor = "f-blue"; }
                else { range = rX; colorClass = "s-green"; fillColor = "f-green"; }

                // Mappers
                const sx = (ti) => L + (ti / cfg.T) * W;
                const sy = (val) => yBase + h - ((val - range.min) / (range.max - range.min)) * h;

                // Grid & Axes
                el("line", { x1: L, y1: sy(0), x2: L + W, y2: sy(0), class: "g-axis" }, svg); // Time axis (val=0)
                el("line", { x1: L, y1: yBase, x2: L, y2: yBase + h, class: "g-axis" }, svg); // Vertical axis

                // Grid lines (drawn under the axes: insert before them)
                const firstAxis = svg.lastChild.previousSibling;
                const gridLine = (a) => svg.insertBefore(el("line", Object.assign({ class: "g-grid" }, a)), firstAxis);
                for (let v = range.min; v <= range.max + 1e-9; v += range.step) {
                    if (Math.abs(v) > 1e-9) gridLine({ x1: L, y1: sy(v), x2: L + W, y2: sy(v) });
                }
                for (let ti = cfg.T <= 10 ? 1 : 2; ti <= cfg.T + 1e-9; ti += cfg.T <= 10 ? 1 : 2) {
                    gridLine({ x1: sx(ti), y1: yBase, x2: sx(ti), y2: yBase + h });
                }

                // Value Labels
                for (let v = range.min; v <= range.max + 1e-9; v += range.step) {
                    el("text", { x: L - 12, y: sy(v) + 5, class: "g-text", "text-anchor": "end" }, svg).textContent = fmtTick(v);
                }

                // Axis Names
                let axisName = "";
                if (type === "a") axisName = "aₓ, м/с²";
                else if (type === "v") axisName = "vₓ, м/с";
                else axisName = "x, м";
                
                // axis name sits in the gap above the panel, not over the curve
                el("text", { x: L + 6, y: yBase - 7, class: "g-text", "text-anchor": "start" }, svg).textContent = axisName;

                // Check if this is the last non-track panel for time labels
                const isLastGraph = cfg.panels.filter(p => p !== 'track').pop() === type;
                
                if (isLastGraph) {
                    // "t, с" takes the place of the last tick label, under the axis (above it the curve may end)
                    el("text", { x: L + W, y: yBase + h + 26, class: "g-text", "text-anchor": "end" }, svg).textContent = "t, с";
                    
                    // Time Ticks
                    const tickStep = cfg.T <= 10 ? 1 : 2;
                    for (let ti = 0; ti <= cfg.T; ti += tickStep) {
                        el("line", { x1: sx(ti), y1: sy(0), x2: sx(ti), y2: sy(0) + 6, class: "g-axis" }, svg);
                        if (sx(ti) <= L + W - 40) el("text", { x: sx(ti), y: yBase + h + 26, class: "g-text", "text-anchor": "middle" }, svg).textContent = ti;
                    }
                }

                // Whole Curve (Dashed)
                let pathData = "";
                for (let i = 0; i <= 200; i++) {
                    const ti = (i / 200) * cfg.T;
                    let val = 0;
                    if (type === "a") val = p.a;
                    else if (type === "v") val = p.v0 + p.a * ti;
                    else val = p.x0 + p.v0 * ti + 0.5 * p.a * ti * ti;
                    
                    const px = sx(ti);
                    const py = sy(val);
                    pathData += (i === 0 ? "M" : "L") + `${px},${py} `;
                }
                el("path", { d: pathData, class: "s-muted", fill: "none", "stroke-width": 1.5, "stroke-dasharray": "4 4" }, svg);

                // Area (if applicable)
                if (cfg.area && type === "v") {
                    drawAreaV(yBase, p, t, sx, sy, range);
                } else if (cfg.area && type === "a") {
                    drawAreaA(yBase, p, t, sx, sy, range);
                }

                // Traversed Curve (Solid)
                let pathDataT = "";
                const steps = Math.ceil(t / cfg.T * 200);
                for (let i = 0; i <= steps; i++) {
                    const ti = (i / 200) * cfg.T;
                    if (ti > t) break;
                    let val = 0;
                    if (type === "a") val = p.a;
                    else if (type === "v") val = p.v0 + p.a * ti;
                    else val = p.x0 + p.v0 * ti + 0.5 * p.a * ti * ti;
                    
                    const px = sx(ti);
                    const py = sy(val);
                    pathDataT += (i === 0 ? "M" : "L") + `${px},${py} `;
                }
                el("path", { d: pathDataT, class: colorClass, fill: "none", "stroke-width": 3.5, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);

                // Cursor & Dot
                const res = model(p, t);
                let curVal = 0;
                if (type === "a") curVal = p.a;
                else if (type === "v") curVal = res.vx;
                else curVal = res.x;

                el("line", { x1: sx(t), y1: yBase, x2: sx(t), y2: yBase + h, class: "g-guide" }, svg);
                el("circle", { cx: sx(t), cy: sy(curVal), r: 6, class: `${fillColor} dot-ring` }, svg);
            }

            function drawAreaV(yBase, p, t, sx, sy, range) {
                if (cfg.split && p.v0 >= 0 && p.a >= 0) {
                    // Rectangle + Triangle
                    const xT = sx(t);
                    const y0 = sy(0);
                    const yV0 = sy(p.v0);
                    const yVT = sy(p.v0 + p.a * t);

                    // Rect: (0,0) to (t, v0) -> in SVG coords: (L, y0) to (xT, yV0)
                    const x0s = sx(0);
                    el("rect", { x: x0s, y: Math.min(y0, yV0), width: xT - x0s, height: Math.abs(y0 - yV0), class: "fa-rect" }, svg);

                    // Triangle: (0,v0), (t,v0), (t,v(t))
                    el("polygon", { points: `${x0s},${yV0} ${xT},${yV0} ${xT},${yVT}`, class: "fa-pos" }, svg);

                    // Labels
                    if (t >= 1.5) {
                        const rectH = Math.abs(y0 - yV0);
                        if (rectH >= 24) {
                            el("text", { x: (x0s + xT) / 2, y: (y0+yV0)/2 + 5, class: "g-text", "text-anchor": "middle" }, svg).textContent = "v₀ₓ·t";
                        }
                        const triH = Math.abs(yV0 - yVT);
                        if (triH >= 40) { // label sits low-right inside the triangle, clear of the hypotenuse
                            el("text", { x: sx(t * 0.75), y: sy(p.v0 + p.a * t * 0.25) + 5, class: "g-text", "text-anchor": "middle" }, svg).textContent = "aₓt²/2";
                        }
                    }
                } else {
                    // Area under linear vx(t) on [0,t]; split at the root: above axis fa-pos, below fa-neg
                    const part = (t1, t2) => {
                        const v1 = p.v0 + p.a * t1, v2 = p.v0 + p.a * t2;
                        el("polygon", { points: `${sx(t1)},${sy(0)} ${sx(t1)},${sy(v1)} ${sx(t2)},${sy(v2)} ${sx(t2)},${sy(0)}`,
                                        class: (v1 + v2) / 2 >= 0 ? "fa-pos" : "fa-neg" }, svg);
                    };
                    if (t > 0) {
                        const tr = p.a !== 0 ? -p.v0 / p.a : -1;
                        if (tr > 0 && tr < t) { part(0, tr); part(tr, t); } else part(0, t);
                    }
                }
            }

            function drawAreaA(yBase, p, t, sx, sy, range) {
                const xT = sx(t);
                const y0 = sy(0);
                const yA = sy(p.a);
                el("rect", { x: sx(0), y: Math.min(y0, yA), width: xT - sx(0), height: Math.abs(y0 - yA), class: p.a >= 0 ? "fa-pos" : "fa-neg" }, svg);
            }

            // --- Animation Loop ---

            function loop(timestamp) {
                if (!state.playing) return;
                
                const dt = (timestamp - state.lastTime) / 1000;
                state.lastTime = timestamp;
                
                state.t += dt * cfg.speed;
                
                if (state.t >= cfg.T) {
                    state.t = cfg.T;
                    state.playing = false;
                    const btnPlay = controlsDiv.querySelector(".motion-play");
                    if (btnPlay) btnPlay.textContent = "▶ Пуск";
                }
                
                updateParams();
                
                if (state.playing) {
                    requestAnimationFrame(loop);
                }
            }

            // Initial Draw
            updateParams();

        } catch (e) {
            container.textContent = "Модель не загрузилась";
            console.error(e);
        }
    }

    // --- Init ---

    document.addEventListener("DOMContentLoaded", () => {
        const widgets = document.querySelectorAll("div.motion");
        widgets.forEach(div => {
            if (div.hasAttribute("data-motion")) {
                initWidget(div, div.getAttribute("data-motion"));
            }
        });
    });

})();
