(() => {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };
  const txt = (parent, x, y, text, cls, anchor) => {
    const t = el("text", { x, y, class: cls, "text-anchor": anchor || "middle", "dominant-baseline": "middle" }, parent);
    t.textContent = text;
    return t;
  };
  const fmt = (v) => String(Math.round(v * 1000) / 1000).replace(".", ",").replace("-", "−");
  const head = (parent, x, y, dx, dy, cls, len = 12) => {
    const a = Math.atan2(dy, dx);
    const p = [[x, y],
      [x - len * Math.cos(a - Math.PI / 7), y - len * Math.sin(a - Math.PI / 7)],
      [x - len * Math.cos(a + Math.PI / 7), y - len * Math.sin(a + Math.PI / 7)]];
    el("polygon", { points: p.map(q => q.join(",")).join(" "), class: cls }, parent);
  };

  function renderVec(node, config) {
    try {
      const {
        title = "",
        x = { min: -1, max: 1 },
        y = { min: -1, max: 1 },
        u = 48,
        axes = false,
        nums = false,
        xlabel = "x",
        ylabel = "y",
        vecs = [],
        segs = [],
        guides = [],
        pts = [],
        arcs = [],
        texts = []
      } = config;

      const L = 34, R = 34, T = 30, B = 34;
      const W = (x.max - x.min) * u;
      const H = (y.max - y.min) * u;
      const sx = X => L + (X - x.min) * u;
      const sy = Y => T + (y.max - Y) * u;

      const svg = el("svg", {
        viewBox: `0 0 ${L + W + R} ${T + H + B}`,
        width: L + W + R,
        role: "img",
        "aria-label": title,
        preserveAspectRatio: "xMidYMid meet"
      }, node);
      el("title", {}, svg).textContent = title;

      const gridGroup = el("g", { class: "g-grid" }, svg);
      for (let X = Math.ceil(x.min); X <= x.max; X++) {
        el("line", { x1: sx(X), y1: sy(y.max), x2: sx(X), y2: sy(y.min) }, gridGroup);
      }
      for (let Y = Math.ceil(y.min); Y <= y.max; Y++) {
        el("line", { x1: sx(x.min), y1: sy(Y), x2: sx(x.max), y2: sy(Y) }, gridGroup);
      }

      if (axes) {
        const axisGroup = el("g", { class: "g-axis" }, svg);

        if (y.min <= 0 && 0 <= y.max) {
          const x1 = sx(x.min);
          const x2 = sx(x.max) + 18;
          const y0 = sy(0);
          el("line", { x1, y1: y0, x2, y2: y0 }, axisGroup);
          head(axisGroup, x2, y0, 1, 0, "f-ink", 10);
          txt(axisGroup, x2, y0 - 14, xlabel, "g-text g-name", "end");
        }

        if (x.min <= 0 && 0 <= x.max) {
          const y1 = sy(y.min);
          const y2 = sy(y.max) - 18;
          const x0 = sx(0);
          el("line", { x1: x0, y1: y1, x2: x0, y2: y2 }, axisGroup);
          head(axisGroup, x0, y2, 0, -1, "f-ink", 10);
          txt(axisGroup, x0 + 12, y2 + 4, ylabel, "g-text g-name", "start");
        }

        if (x.min <= 0 && 0 <= x.max && y.min <= 0 && 0 <= y.max) {
          txt(axisGroup, sx(0) - 10, sy(0) + 14, "0", "g-text", "end");
        }

        if (nums) {
          for (let X = Math.ceil(x.min); X <= x.max; X++) {
            if (X === 0 || (X < 0 && X === Math.ceil(x.min))) continue;
            const x0 = sx(X);
            el("line", { x1: x0, y1: sy(0) - 4, x2: x0, y2: sy(0) + 4 }, axisGroup);
            txt(axisGroup, x0, sy(0) + 19, fmt(X), "g-text g-num");
          }
          for (let Y = Math.ceil(y.min); Y <= y.max; Y++) {
            if (Y === 0 || (Y < 0 && Y === Math.ceil(y.min))) continue;
            const y0 = sy(Y);
            el("line", { x1: sx(0) - 4, y1: y0, x2: sx(0) + 4, y2: y0 }, axisGroup);
            txt(axisGroup, sx(0) - 11, y0, fmt(Y), "g-text g-num", "end");
          }
        }
      }

      for (const g of guides) {
        const { from, to } = g;
        el("line", {
          x1: sx(from[0]),
          y1: sy(from[1]),
          x2: sx(to[0]),
          y2: sy(to[1]),
          class: "g-guide"
        }, svg);
      }

      for (const s of segs) {
        const { from, to, c = "ink", label, dx = 0, dy = 0 } = s;
        const x1 = sx(from[0]);
        const y1 = sy(from[1]);
        const x2 = sx(to[0]);
        const y2 = sy(to[1]);
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;

        el("line", {
          x1, y1, x2, y2,
          class: `s-${c} seg`,
          "stroke-width": 7,
          "stroke-linecap": "butt",
          "stroke-opacity": 0.45
        }, svg);

        const dxSeg = x2 - x1;
        const dySeg = y2 - y1;
        const len = Math.hypot(dxSeg, dySeg);
        const ux = dxSeg / len;
        const uy = dySeg / len;

        el("line", {
          x1: x1 + uy * 6,
          y1: y1 - ux * 6,
          x2: x1 - uy * 6,
          y2: y1 + ux * 6,
          class: `s-${c}`,
          "stroke-width": 2
        }, svg);

        el("line", {
          x1: x2 + uy * 6,
          y1: y2 - ux * 6,
          x2: x2 - uy * 6,
          y2: y2 + ux * 6,
          class: `s-${c}`,
          "stroke-width": 2
        }, svg);

        if (label) {
          txt(svg, mx + dx, my + dy, label, `g-text f-${c} g-lbl`);
        }
      }

      for (const a of arcs) {
        const { at, from, to, r, c = "ink", label } = a;
        const cx = sx(at[0]);
        const cy = sy(at[1]);

        const startAngle = from * Math.PI / 180;
        const endAngle = to * Math.PI / 180;

        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy - r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy - r * Math.sin(endAngle);

        const largeArcFlag = Math.abs(to - from) > 180 ? 1 : 0;

        const path = el("path", {
          d: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 0 ${x2} ${y2}`,
          class: `s-${c}`,
          fill: "none",
          "stroke-width": 1.5
        }, svg);

        if (label) {
          const midAngle = (from + to) / 2 * Math.PI / 180;
          const lx = cx + (r + 18) * Math.cos(midAngle);
          const ly = cy - (r + 18) * Math.sin(midAngle);
          txt(svg, lx, ly, label, `g-text f-${c}`);
        }
      }

      for (const v of vecs) {
        const { from, to, c = "ink", label, v: showVec = true, side = 1, dx = 0, dy = 0, dash = false } = v;
        const x1 = sx(from[0]);
        const y1 = sy(from[1]);
        const x2 = sx(to[0]);
        const y2 = sy(to[1]);

        const len = Math.hypot(x2 - x1, y2 - y1);
        const ux = (x2 - x1) / len;
        const uy = (y2 - y1) / len;

        el("line", {
          x1,
          y1,
          x2: x2 - ux * 11,
          y2: y2 - uy * 11,
          class: `s-${c}`,
          "stroke-width": 3.2,
          "stroke-linecap": "round",
          ...(dash ? { "stroke-dasharray": "8 6" } : {})
        }, svg);

        head(svg, x2, y2, ux, uy, `f-${c}`, 14);

        el("circle", {
          cx: x1,
          cy: y1,
          r: 3.5,
          class: `f-${c}`
        }, svg);

        if (label) {
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const nx = uy;
          const ny = -ux;
          const lx = mx + nx * 21 * side;
          const ly = my + ny * 21 * side;

          const t = txt(svg, lx + dx, ly + dy, label, `g-text f-${c} g-lbl`);

          if (showVec) {
            const b = t.getBBox();
            if (b.width > 0) {
              // черта только над буквой (не над индексом ₁₂) и ближе к строчной букве, как у i.vec в тексте
              const w1 = t.getSubStringLength(0, 1);
              const low = /[a-zа-яё]/.test(label[0]) && !/[bdfhklt]/.test(label[0]);
              const by = b.y + (low ? 0.2 * b.height : 0) - 1;
              el("line", {
                x1: b.x + 1,
                y1: by,
                x2: b.x + w1 - 1,
                y2: by,
                class: `s-${c}`,
                "stroke-width": 1.4
              }, svg);
            }
          }
          if (v.pre) {
            const b = t.getBBox();
            txt(svg, b.x - 4, ly + dy, v.pre, `g-text f-${c} g-lbl`, "end");
          }
        }
      }

      for (const p of pts) {
        const { at, c = "ink", label, dx = 0, dy = 0 } = p;
        const x = sx(at[0]);
        const y = sy(at[1]);

        el("circle", {
          cx: x,
          cy: y,
          r: 4.5,
          class: `f-${c} dot-ring`
        }, svg);

        if (label) {
          txt(svg, x + dx, y + dy, label, "g-text g-lbl");
        }
      }

      for (const t of texts) {
        const { at, t: text, c = "ink" } = t;
        txt(svg, sx(at[0]), sy(at[1]), text, `g-text f-${c}`);
      }
    } catch (e) {
      node.textContent = "Рисунок не загрузился";
      console.error(e);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const nodes = document.querySelectorAll(".vec[data-vec]");
    for (const node of nodes) {
      try {
        const config = JSON.parse(node.dataset.vec);
        renderVec(node, config);
      } catch (e) {
        node.textContent = "Рисунок не загрузился";
        console.error(e);
      }
    }
  });
})();
