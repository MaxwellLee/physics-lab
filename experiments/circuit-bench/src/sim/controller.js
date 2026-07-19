// 仿真控制层：维护台面状态，编排求解，向 UI/渲染层广播变更。
// 不直接操作 DOM（view 引用由 app 注入）。

import { solveBench } from '../physics/circuit.js';
import { DEFS, defaultParams } from '../physics/components.js';
import { findPreset, instantiatePreset, WIRE_SPECIMENS } from '../../data.js';

export class Controller {
  constructor() {
    this.bench = { components: [], wires: [] };
    this.results = null;
    this.listeners = new Set();
    this.selected = null; // { kind: 'comp' | 'wire', id }
    this.presetId = null;
    this._id = 0;
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, payload) { for (const fn of this.listeners) fn(type, this, payload); }
  makeId(prefix) { return `${prefix}${++this._id}-${Date.now().toString(36)}`; }

  getComp(id) { return this.bench.components.find(c => c.id === id) ?? null; }
  getWire(id) { return this.bench.wires.find(w => w.id === id) ?? null; }

  addComponent(type, x, y) {
    if (!DEFS[type]) return null;
    const comp = {
      id: this.makeId('c'), type, x: Math.round(x), y: Math.round(y),
      params: defaultParams(type)
    };
    if (type === 'wire-board') {
      const spec = WIRE_SPECIMENS.find(s => s.id === comp.params.specimen) ?? WIRE_SPECIMENS[1];
      comp.resistance = spec.R;
    }
    this.bench.components.push(comp);
    this.presetId = null;
    this.emit('topology');
    this.solve();
    return comp;
  }

  removeComponent(id) {
    this.bench.components = this.bench.components.filter(c => c.id !== id);
    this.bench.wires = this.bench.wires.filter(w => w.a.comp !== id && w.b.comp !== id);
    if (this.selected?.kind === 'comp' && this.selected.id === id) this.selected = null;
    this.emit('topology');
    this.solve();
  }

  // aRef/bRef: { comp, term }
  addWire(aRef, bRef) {
    if (!aRef || !bRef) return null;
    if (aRef.comp === bRef.comp && aRef.term === bRef.term) return null;
    const exists = this.bench.wires.some(w =>
      (w.a.comp === aRef.comp && w.a.term === aRef.term && w.b.comp === bRef.comp && w.b.term === bRef.term) ||
      (w.a.comp === bRef.comp && w.a.term === bRef.term && w.b.comp === aRef.comp && w.b.term === aRef.term));
    if (exists) return null;
    const a = this.getComp(aRef.comp), b = this.getComp(bRef.comp);
    if (!a || !b) return null;
    if (!DEFS[a.type].terminals.includes(aRef.term) || !DEFS[b.type].terminals.includes(bRef.term)) return null;
    const wire = { id: this.makeId('w'), a: { ...aRef }, b: { ...bRef } };
    this.bench.wires.push(wire);
    this.presetId = null;
    this.emit('topology');
    this.solve();
    return wire;
  }

  removeWire(id) {
    this.bench.wires = this.bench.wires.filter(w => w.id !== id);
    if (this.selected?.kind === 'wire' && this.selected.id === id) this.selected = null;
    this.emit('topology');
    this.solve();
  }

  setParam(id, key, value, { redraw = true } = {}) {
    const comp = this.getComp(id);
    if (!comp) return;
    const cfg = DEFS[comp.type].params[key];
    if (!cfg) return;
    if (cfg.options) {
      if (!cfg.options.some(o => o === value || String(o) === String(value))) return;
      value = cfg.options.find(o => String(o) === String(value));
    } else if (cfg.type === 'bool') {
      value = !!value;
    } else {
      value = Number(value);
      if (!Number.isFinite(value)) return;
      value = Math.min(cfg.max, Math.max(cfg.min, value));
      if (cfg.step >= 1) value = Math.round(value);
    }
    comp.params[key] = value;
    if (comp.type === 'wire-board') {
      const spec = WIRE_SPECIMENS.find(s => s.id === comp.params.specimen) ?? WIRE_SPECIMENS[1];
      comp.resistance = spec.R;
    }
    this.emit(redraw ? 'param-structure' : 'param', { id });
    this.solve();
  }

  toggleSwitch(id) {
    const comp = this.getComp(id);
    if (!comp) return;
    if (comp.type === 'switch') this.setParam(id, 'closed', !comp.params.closed, { redraw: false });
    else if (comp.type === 'spdt-switch') this.setParam(id, 'position', comp.params.position === 'x' ? 'y' : 'x', { redraw: false });
  }

  replaceFuse(id) {
    const comp = this.getComp(id);
    if (!comp || comp.type !== 'fuse') return;
    comp.blown = false;
    this.emit('param-structure', { id });
    this.solve();
  }

  moveComponent(id, x, y) {
    const comp = this.getComp(id);
    if (!comp) return;
    comp.x = Math.round(x); comp.y = Math.round(y);
  }

  solve() {
    this.results = solveBench(this.bench);
    // 熔断状态写回台面（持久化，供 UI 与后续求解使用）
    if (this.results.ok && this.results.blown) {
      const blownSet = new Set(this.results.blown);
      for (const c of this.bench.components) {
        if (c.type === 'fuse') c.blown = blownSet.has(c.id);
      }
    }
    this.emit('solved');
    return this.results;
  }

  select(kind, id) {
    this.selected = kind && id ? { kind, id } : null;
    this.emit('select');
  }

  loadPreset(id) {
    const preset = findPreset(id);
    if (!preset) return false;
    const { components, wires } = instantiatePreset(preset, (p, i) => `${p}${i}-${Date.now().toString(36)}`);
    this.bench = { components, wires };
    this.selected = null;
    this.presetId = id;
    this.emit('preset');
    this.solve();
    return true;
  }

  clear() {
    this.bench = { components: [], wires: [] };
    this.selected = null;
    this.presetId = null;
    this.emit('preset');
    this.solve();
  }

  // 可记录 (U,I) 数据的对象：所有二端元件与电源
  measurableComponents() {
    return this.bench.components.filter(c => {
      const def = DEFS[c.type];
      return def && (def.terminals.length === 2 || def.kind === 'source' || c.type === 'rheostat');
    });
  }
}
