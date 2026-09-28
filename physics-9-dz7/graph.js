(() => {
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };

  const txt = (parent, x, y, text, cls = "g-text", anchor = "middle", baseline) => {
    const t = el("text", { x, y, class: cls, "text-anchor": anchor }, parent);
    if (baseline) t.setAttribute("dominant-baseline", baseline);
    t.textContent = text;
    return t;
  };

  const fmt = (v) => {
    const s = String(Math.round(v * 1000) / 1000);
    return s.replace(".", ",").replace("-", "−");
  };

  const arrowHead = (parent, x, y, dirX, dirY, cls) => {
    const len = 10;
    const w = 5;
    const angle = Math.atan2(dirY, dirX);
    const pts = [
      [x, y],
      [x - len * Math.cos(angle - Math.PI/6), y - len * Math.sin(angle - Math.PI/6)],
      [x - len * Math.cos(angle + Math.PI/6), y - len * Math.sin(angle + Math.PI/6)]
    ];
    el("polygon", { points: pts.map(p => p.join(",")).join(" "), class: cls }, parent);
  };

  const renderGraph = (node, config) => {
    try {
      if (!config.type) config.type = "vt";
      const w = config.w ?? 520;
      const h = config.h ?? 320;
      const L = 56;
      const R = 64;
      const T = 42;
      const B = 46;
      const viewBox = `0 0 ${L+w+R} ${T+h+B}`;

      const svg = el("svg", {
        viewBox,
        role: "img",
        "aria-label": config.title,
        "preserveAspectRatio": "xMidYMid meet"
      }, node);
      el("title", {}, svg).textContent = config.title;

      const sx = (x) => L + (x - config.x.min) / (config.x.max - config.x.min) * w;
      const sy = (y) => T + (config.y.max - y) / (config.y.max - config.y.min) * h;

      const axisY = config.y.min <= 0 && 0 <= config.y.max ? sy(0) : sy(config.y.min);
      const axisX = sx(config.x.min);

      // Grid
      const gridGroup = el("g", { class: "g-grid" }, svg);
      for (let k = 0; config.x.min + k * config.x.step <= config.x.max + 1e-9; k++) {
        const x = config.x.min + k * config.x.step;
        el("line", {
          x1: sx(x),
          y1: sy(config.y.min),
          x2: sx(x),
          y2: sy(config.y.max)
        }, gridGroup);
      }
      for (let k = 0; config.y.min + k * config.y.step <= config.y.max + 1e-9; k++) {
        const y = config.y.min + k * config.y.step;
        el("line", {
          x1: sx(config.x.min),
          y1: sy(y),
          x2: sx(config.x.max),
          y2: sy(y)
        }, gridGroup);
      }

      // Axes
      const axisGroup = el("g", { class: "g-axis" }, svg);
      el("line", {
        x1: axisX,
        y1: axisY,
        x2: sx(config.x.max) + 16,
        y2: axisY
      }, axisGroup);
      arrowHead(axisGroup, sx(config.x.max) + 16, axisY, 1, 0, "f-ink");

      el("line", {
        x1: axisX,
        y1: sy(config.y.min),
        x2: axisX,
        y2: sy(config.y.max) - 16
      }, axisGroup);
      arrowHead(axisGroup, axisX, sy(config.y.max) - 16, 0, -1, "f-ink");

      // Ticks and labels
      const xTicks = config.x.ticks || [];
      if (xTicks.length === 0) {
        for (let k = 0; config.x.min + k * config.x.step <= config.x.max + 1e-9; k++) {
          xTicks.push({ v: config.x.min + k * config.x.step, t: fmt(config.x.min + k * config.x.step) });
        }
      }

      const yTicks = config.y.ticks || [];
      if (yTicks.length === 0) {
        for (let k = 0; config.y.min + k * config.y.step <= config.y.max + 1e-9; k++) {
          const v = config.y.min + k * config.y.step;
          if (!(v === 0 && config.y.min <= 0 && 0 <= config.y.max)) {
            yTicks.push({ v, t: fmt(v) });
          }
        }
      }

      // X ticks
      for (const tick of xTicks) {
        el("line", {
          x1: sx(tick.v),
          y1: axisY - 4,
          x2: sx(tick.v),
          y2: axisY + 4,
          class: "g-axis"
        }, axisGroup);
        // «0» при отрицательных y: вертикальная ось идёт через середину подписи — сдвигаем влево
        const zeroLeft = tick.v === 0 && config.y.min < 0;
        txt(axisGroup, zeroLeft ? sx(0) - 6 : sx(tick.v), axisY + 24, tick.t, "g-text", zeroLeft ? "end" : "middle");
      }

      // Y ticks
      for (const tick of yTicks) {
        el("line", {
          x1: axisX - 4,
          y1: sy(tick.v),
          x2: axisX + 4,
          y2: sy(tick.v),
          class: "g-axis"
        }, axisGroup);
        txt(axisGroup, axisX - 9, sy(tick.v), tick.t, "g-text", "end", "middle");
      }

      // Axis names
      txt(axisGroup, sx(config.x.max) + 16, axisY - 10, config.x.label, "g-text", "end");
      txt(axisGroup, axisX + 10, sy(config.y.max) - 12, config.y.label, "g-text", "start");

      // Tris
      if (config.tris) {
        for (const tri of config.tris) {
          const x1 = sx(tri.x1);
          const y1 = sy(tri.y1);
          const x2 = sx(tri.x2);
          const y2 = sy(tri.y2);
          const c = tri.c;

          el("line", {
            x1: x1,
            y1: y1,
            x2: x2,
            y2: y1,
            class: "s-" + c,
            "stroke-width": 1.5,
            "stroke-dasharray": "5 4",
            fill: "none"
          }, svg);

          el("line", {
            x1: x2,
            y1: y1,
            x2: x2,
            y2: y2,
            class: "s-" + c,
            "stroke-width": 1.5,
            "stroke-dasharray": "5 4",
            fill: "none"
          }, svg);

          const dtY = y1 + 18;
          if (tri.y2 < tri.y1) {
            txt(svg, (x1 + x2) / 2, y1 - 8, tri.dt, `g-text f-${c}`, "middle");
          } else {
            txt(svg, (x1 + x2) / 2, dtY, tri.dt, `g-text f-${c}`, "middle");
          }

          const dvX = x2 + 8;
          if (x2 + 8 > L + w - 70) {
            txt(svg, x2 - 8, (y1 + y2) / 2, tri.dv, `g-text f-${c}`, "end", "middle");
          } else {
            txt(svg, dvX, (y1 + y2) / 2, tri.dv, `g-text f-${c}`, "start", "middle");
          }
        }
      }

      // Lines
      if (config.lines) {
        for (const line of config.lines) {
          const pts = line.pts.map(p => [sx(p[0]), sy(p[1])]).flat().join(" ");
          el("polyline", {
            points: pts,
            class: "s-" + line.c,
            fill: "none",
            "stroke-width": 3,
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
          }, svg);

          if (line.dash) {
            const poly = svg.lastChild;
            poly.setAttribute("stroke-dasharray", "8 6");
          }

          if (line.label) {
            const lt = txt(svg, sx(line.at[0]), sy(line.at[1]), line.label, `g-text f-${line.c}`, "middle", null);
            lt.setAttribute("font-weight", "700");
            lt.setAttribute("font-size", "15");
          }
        }
      }

      // Dots
      if (config.dots) {
        for (const dot of config.dots) {
          const x = sx(dot.x);
          const y = sy(dot.y);
          const c = dot.c;

          if (dot.guide) {
            el("line", {
              x1: x,
              y1: y,
              x2: x,
              y2: axisY,
              class: "g-guide"
            }, svg);

            el("line", {
              x1: x,
              y1: y,
              x2: axisX,
              y2: y,
              class: "g-guide"
            }, svg);
          }

          el("circle", {
            cx: x,
            cy: y,
            r: 5,
            class: `f-${c} dot-ring`
          }, svg);

          if (dot.label) {
            txt(svg, x + (dot.dx ?? 8), y + (dot.dy ?? -10), dot.label, "g-text", "start");
          }
        }
      }

    } catch (e) {
      node.textContent = "График не загрузился";
      console.error(e);
    }
  };

  const renderAxis = (node, config) => {
    try {
      const w = config.w ?? 520;
      const L = 30;
      const R = 84;
      const T = 18;
      const n = config.arrows.length;
      const H = T + 22 + n * 44 + 10 + 44;

      const viewBox = `0 0 ${L+w+R} ${H}`;
      const svg = el("svg", {
        viewBox,
        role: "img",
        "aria-label": config.title,
        "preserveAspectRatio": "xMidYMid meet"
      }, node);
      el("title", {}, svg).textContent = config.title;

      const sx = (v) => L + (v - config.min) / (config.max - config.min) * w;

      // Axis line
      const axisY = T + 22 + n * 44 + 10;
      el("line", {
        x1: sx(config.min) - 12,
        y1: axisY,
        x2: sx(config.max) + 22,
        y2: axisY,
        class: "g-axis"
      }, svg);

      arrowHead(svg, sx(config.max) + 22, axisY, 1, 0, "f-ink");

      // Ticks
      for (let k = 0; config.min + k * config.step <= config.max + 1e-9; k++) {
        const v = config.min + k * config.step;
        el("line", {
          x1: sx(v),
          y1: axisY - 5,
          x2: sx(v),
          y2: axisY + 5,
          class: "g-axis"
        }, svg);
        txt(svg, sx(v), axisY + 22, fmt(v), "g-text", "middle");
      }

      // Axis name
      txt(svg, sx(config.max) + 30, axisY, config.label, "g-text", "start", "middle");

      // Arrows
      for (let i = 0; i < n; i++) {
        const rowY = T + 22 + i * 44;
        const arrow = config.arrows[i];
        const c = arrow.c;
        const from = sx(arrow.from);
        const to = sx(arrow.to);
        const dir = Math.sign(to - from);

        // Guides
        el("line", {
          x1: from,
          y1: rowY,
          x2: from,
          y2: axisY,
          class: "g-guide"
        }, svg);

        el("line", {
          x1: to,
          y1: rowY,
          x2: to,
          y2: axisY,
          class: "g-guide"
        }, svg);

        // Main line
        const endX = to - 10 * dir;
        el("line", {
          x1: from,
          y1: rowY,
          x2: endX,
          y2: rowY,
          class: "s-" + c,
          "stroke-width": 3,
          "stroke-linecap": "round"
        }, svg);

        arrowHead(svg, to, rowY, dir, 0, "f-" + c);

        // Circle
        el("circle", {
          cx: from,
          cy: rowY,
          r: 4,
          class: "f-" + c
        }, svg);

        // Label
        txt(svg, (from + to) / 2, rowY - 10, arrow.label, `g-text f-${c}`, "middle", null);
      }

    } catch (e) {
      node.textContent = "График не загрузился";
      console.error(e);
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".graph[data-graph]").forEach(function (node) {
      try {
        const config = JSON.parse(node.getAttribute("data-graph"));
        if (config.type === "axis") {
          renderAxis(node, config);
        } else {
          renderGraph(node, config);
        }
      } catch (e) {
        node.textContent = "График не загрузился";
        console.error(e);
      }
    });
  });
})();
