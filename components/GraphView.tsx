"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Note, Notebook, extractLinks } from "@/lib/notes";

type Props = {
  notes: Note[];
  notebooks: Notebook[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onClose: () => void;
};

type SimNode = {
  id: string;
  title: string;
  nbId: string;
  deg: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

const PALETTE = [
  "#34607e",
  "#c9913a",
  "#3f7d6e",
  "#9a5b8c",
  "#b5573f",
  "#5a6b8c",
];

export default function GraphView({
  notes,
  notebooks,
  activeId,
  onOpen,
  onClose,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  const colorOf = useMemo(() => {
    const map = new Map<string, string>();
    notebooks.forEach((nb, i) => map.set(nb.id, PALETTE[i % PALETTE.length]));
    return (id: string) => map.get(id) ?? PALETTE[0];
  }, [notebooks]);

  // build graph: nodes for titled notes, edges from wiki-links
  const { nodes, edges } = useMemo(() => {
    const titled = notes.filter((n) => n.title.trim());
    const byTitle = new Map<string, string>();
    titled.forEach((n) => {
      const key = n.title.trim().toLowerCase();
      if (!byTitle.has(key)) byTitle.set(key, n.id);
    });
    const edges: { s: string; t: string }[] = [];
    const seen = new Set<string>();
    titled.forEach((n) => {
      for (const link of extractLinks(n.body)) {
        const tid = byTitle.get(link.toLowerCase());
        if (tid && tid !== n.id) {
          const key = n.id + ">" + tid;
          if (!seen.has(key)) {
            seen.add(key);
            edges.push({ s: n.id, t: tid });
          }
        }
      }
    });
    const deg = new Map<string, number>();
    edges.forEach((e) => {
      deg.set(e.s, (deg.get(e.s) ?? 0) + 1);
      deg.set(e.t, (deg.get(e.t) ?? 0) + 1);
    });
    const nodes: SimNode[] = titled.map((n) => ({
      id: n.id,
      title: n.title.trim(),
      nbId: n.notebookId,
      deg: deg.get(n.id) ?? 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    }));
    return { nodes, edges };
  }, [notes]);

  const sim = useRef<{ nodes: SimNode[]; alpha: number }>({
    nodes: [],
    alpha: 1,
  });
  const dragId = useRef<string | null>(null);
  const moved = useRef(false);

  // measure container
  useEffect(() => {
    const measure = () => {
      const el = wrapRef.current;
      if (el) setSize({ w: el.clientWidth, h: el.clientHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // (re)seed positions when the node set or size changes
  useEffect(() => {
    const { w, h } = size;
    const cx = w / 2,
      cy = h / 2;
    const R = Math.min(w, h) / 2.6;
    const prev = new Map(sim.current.nodes.map((n) => [n.id, n]));
    sim.current.nodes = nodes.map((n, i) => {
      const old = prev.get(n.id);
      if (old) return { ...n, x: old.x, y: old.y, vx: 0, vy: 0 };
      const a = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      return {
        ...n,
        x: cx + Math.cos(a) * R + (Math.random() - 0.5) * 40,
        y: cy + Math.sin(a) * R + (Math.random() - 0.5) * 40,
      };
    });
    sim.current.alpha = 1;
  }, [nodes, size]);

  const radiusOf = (deg: number) => 7 + Math.min(deg, 8) * 2.2;

  // physics loop
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const s = sim.current;
      const list = s.nodes;
      const { w, h } = size;
      const cx = w / 2,
        cy = h / 2;
      const alpha = s.alpha;

      // repulsion (O(n^2), fine for personal note counts)
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i],
            b = list[j];
          const dx = a.x - b.x,
            dy = a.y - b.y;
          const d2 = dx * dx + dy * dy || 0.01;
          const d = Math.sqrt(d2);
          const f = (4200 / d2) * alpha;
          const fx = (dx / d) * f,
            fy = (dy / d) * f;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }
      // springs along edges
      const byId = new Map(list.map((n) => [n.id, n]));
      for (const e of edges) {
        const a = byId.get(e.s),
          b = byId.get(e.t);
        if (!a || !b) continue;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (d - 96) * 0.012 * alpha;
        const fx = (dx / d) * f,
          fy = (dy / d) * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
      // centering + integrate
      for (const n of list) {
        if (n.id === dragId.current) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx += (cx - n.x) * 0.004 * alpha;
        n.vy += (cy - n.y) * 0.004 * alpha;
        n.vx *= 0.86;
        n.vy *= 0.86;
        n.x += n.vx;
        n.y += n.vy;
        const r = radiusOf(n.deg) + 6;
        n.x = Math.max(r, Math.min(w - r, n.x));
        n.y = Math.max(r, Math.min(h - r, n.y));
      }
      s.alpha = Math.max(0.04, alpha * 0.992);
      rerender();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [edges, size]);

  // pointer -> svg coords
  function toSvg(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = svg.createSVGPoint();
    p.x = clientX;
    p.y = clientY;
    const r = p.matrixTransform(ctm.inverse());
    return { x: r.x, y: r.y };
  }

  function onNodeDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragId.current = id;
    moved.current = false;
    sim.current.alpha = Math.max(sim.current.alpha, 0.4);
  }
  function onMove(e: React.PointerEvent) {
    if (!dragId.current) return;
    moved.current = true;
    const { x, y } = toSvg(e.clientX, e.clientY);
    const n = sim.current.nodes.find((m) => m.id === dragId.current);
    if (n) {
      n.x = x;
      n.y = y;
      n.vx = 0;
      n.vy = 0;
    }
  }
  function onUp(id: string) {
    if (dragId.current === id && !moved.current) onOpen(id);
    dragId.current = null;
  }

  const list = sim.current.nodes;
  const byId = new Map(list.map((n) => [n.id, n]));

  return (
    <div className="map" role="dialog" aria-modal="true" aria-label="Note map">
      <div className="map__bar">
        <div className="map__title">
          <span className="map__kicker">The map</span>
          <h2>
            {nodes.length} pages · {edges.length} links
          </h2>
        </div>
        <div className="map__legend">
          {notebooks.map((nb) => (
            <span key={nb.id} className="map__leg">
              <i style={{ background: colorOf(nb.id) }} /> {nb.name}
            </span>
          ))}
          <button
            className="map__close"
            onClick={onClose}
            aria-label="Close map"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="map__canvas" ref={wrapRef}>
        {nodes.length === 0 ? (
          <div className="map__empty">
            <p>
              No titled pages yet. Give a few notes titles and link them with{" "}
              <code>[[ ]]</code> to see the web take shape.
            </p>
          </div>
        ) : (
          <svg
            ref={svgRef}
            width={size.w}
            height={size.h}
            viewBox={`0 0 ${size.w} ${size.h}`}
            onPointerMove={onMove}
            onPointerUp={() => (dragId.current = null)}
          >
            <g className="map__edges">
              {edges.map((e, i) => {
                const a = byId.get(e.s),
                  b = byId.get(e.t);
                if (!a || !b) return null;
                return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
              })}
            </g>
            <g className="map__nodes">
              {list.map((n) => {
                const r = radiusOf(n.deg);
                const isActive = n.id === activeId;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x},${n.y})`}
                    className={`map__node${isActive ? " is-active" : ""}`}
                    onPointerDown={(e) => onNodeDown(e, n.id)}
                    onPointerUp={() => onUp(n.id)}
                  >
                    <circle
                      r={r}
                      fill={colorOf(n.nbId)}
                      stroke={isActive ? "#20242a" : "#faf7ef"}
                      strokeWidth={isActive ? 2.5 : 1.5}
                    />
                    <text x={r + 5} y={4}>
                      {n.title}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>

      <p className="map__hint">Drag to rearrange · click a page to open it</p>
    </div>
  );
}
