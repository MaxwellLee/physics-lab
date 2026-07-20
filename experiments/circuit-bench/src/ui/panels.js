// UI 层：左侧元件/演示面板、右侧资料/读数/数据面板、面板折叠逻辑。

import { DEFS } from '../physics/components.js';
import { CATEGORIES, CATALOG, CONCEPTS, PRESETS, WIRE_SPECIMENS } from '../../data.js';
import { fmtA, fmtV, fmtR } from '../render/bench.js';
import { drawPlot } from '../render/plot.js';

const $ = id => document.getElementById(id);

export class Panels {
  constructor(controller, hooks) {
    this.controller = controller;
    this.hooks = hooks; // { onPlacementArmed(type|null), onLayoutChange() }
    this.placementType = null;
    this.selDetailed = false;
    this.conceptKey = null;
    this.conceptDetailed = false;
    this.dataTarget = null;
    this.records = new Map(); // targetId -> [{u, i}]
    this.buildLibrary();
    this.buildPresetList();
    this.buildConceptList();
    this.attachCollapse();
    this.attachDataControls();
    controller.subscribe((type) => this.onController(type));
    this.renderSelected();
  }

  onController(type) {
    if (type === 'solved') { this.renderMeters(); this.renderSelectedReadings(); this.renderPlot(); }
    if (type === 'select') this.renderSelected();
    if (type === 'topology' || type === 'preset') { this.renderDataTargets(); this.renderSelected(); this.renderMeters(); this.renderPresetActive(); }
  }

  // —— 左侧：元件箱 ——
  buildLibrary() {
    const list = $('component-list');
    list.replaceChildren();
    for (const cat of CATEGORIES) {
      const types = Object.keys(CATALOG).filter(t => CATALOG[t].category === cat.id);
      if (!types.length) continue;
      const group = document.createElement('div');
      group.className = 'cat-group';
      const title = document.createElement('small');
      title.textContent = cat.label;
      group.appendChild(title);
      for (const type of types) {
        const btn = document.createElement('button');
        btn.className = 'comp-item';
        btn.dataset.type = type;
        btn.innerHTML = `<i>${iconOf(type)}</i><span><b>${DEFS[type].label}</b><small>${CATALOG[type].brief.split('。')[0]}。</small></span>`;
        btn.addEventListener('click', () => {
          // 拖拽放置后的那次 click 不再触发点选
          if (this.suppressClick) { this.suppressClick = false; return; }
          this.armPlacement(type, btn);
        });
        this.attachDrag(btn, type);
        group.appendChild(btn);
      }
      list.appendChild(group);
    }
    // 导线提示项
    const group = document.createElement('div');
    group.className = 'cat-group';
    group.innerHTML = '<small>连接</small>';
    const hint = document.createElement('p');
    hint.className = 'insp-empty';
    hint.textContent = '导线：从任一接线柱拖出，或先后点击两个接线柱。';
    group.appendChild(hint);
    list.appendChild(group);

    document.querySelectorAll('[data-lib]').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('[data-lib]').forEach(b => b.classList.toggle('active', b === tab));
        $('component-list').hidden = tab.dataset.lib !== 'components';
        $('preset-list').hidden = tab.dataset.lib !== 'presets';
      });
    });
  }

  armPlacement(type, btn) {
    const was = this.placementType === type;
    this.placementType = was ? null : type;
    document.querySelectorAll('.comp-item').forEach(b => b.classList.toggle('armed', !was && b === btn));
    this.hooks.onPlacementArmed?.(this.placementType);
  }

  clearPlacement() {
    this.placementType = null;
    document.querySelectorAll('.comp-item').forEach(b => b.classList.remove('armed'));
    this.hooks.onPlacementArmed?.(null);
  }

  // 从元件箱直接拖拽到台面放置（横向拖动触发，纵向留给列表滚动）
  attachDrag(btn, type) {
    let start = null;   // { x, y }
    let ghost = null;   // 跟随指针的幽灵预览
    const cleanup = () => {
      ghost?.remove();
      ghost = null;
      start = null;
    };
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!ghost) {
        // 明确的横向拖动才进入放置拖拽（comp-item 的 touch-action: pan-y 保证纵向滚动不受影响）
        if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy)) return;
        this.clearPlacement();
        ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        ghost.innerHTML = `<i>${iconOf(type)}</i>${DEFS[type].label}`;
        document.body.appendChild(ghost);
      }
      ghost.style.left = `${e.clientX}px`;
      ghost.style.top = `${e.clientY}px`;
    });
    window.addEventListener('pointerup', (e) => {
      if (!start) return;
      const wasDragging = !!ghost;
      cleanup();
      if (!wasDragging) return;
      if (btn.contains(e.target)) {
        // 拖了一圈又回到按钮上松手：这次 click 不再触发点选
        this.suppressClick = true;
        return;
      }
      const svg = $('bench-svg');
      const r = svg.getBoundingClientRect();
      if (!svg.hidden && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        this.hooks.onDropPlace?.(type, e.clientX, e.clientY);
      }
    });
    window.addEventListener('pointercancel', () => cleanup());
  }

  // —— 左侧：演示电路 ——
  buildPresetList() {
    const list = $('preset-list');
    list.replaceChildren();
    const groups = [['good', '正确示范'], ['bad', '错误排查']];
    for (const [gid, label] of groups) {
      const head = document.createElement('div');
      head.className = 'preset-group-label';
      head.textContent = label;
      list.appendChild(head);
      PRESETS.filter(p => p.group === gid).forEach((p, i) => {
        const btn = document.createElement('button');
        btn.className = `preset-item ${gid === 'bad' ? 'bad' : ''}`;
        btn.dataset.preset = p.id;
        btn.innerHTML = `<span><b>${p.title}</b><small>${p.brief}</small></span><em>${String(i + 1).padStart(2, '0')}</em>`;
        btn.addEventListener('click', () => this.controller.loadPreset(p.id));
        list.appendChild(btn);
      });
    }
  }

  renderPresetActive() {
    document.querySelectorAll('.preset-item').forEach(b =>
      b.classList.toggle('active', b.dataset.preset === this.controller.presetId));
  }

  // —— 右侧：选中元件 ——
  renderSelected() {
    const sel = this.controller.selected;
    const comp = sel?.kind === 'comp' ? this.controller.getComp(sel.id) : null;
    $('selected-empty').hidden = !!comp;
    $('selected-body').hidden = !comp;
    if (!comp) { $('param-bar').hidden = true; return; }
    const def = DEFS[comp.type];
    const cat = CATALOG[comp.type];
    $('sel-name').textContent = def.label;
    $('sel-kind').textContent = (CATEGORIES.find(c => c.id === cat?.category)?.label ?? '') .toUpperCase();
    $('sel-code').textContent = comp.id.slice(0, 6).toUpperCase();
    $('sel-brief').textContent = cat?.brief ?? '';
    $('sel-detail').hidden = !this.selDetailed;
    $('sel-detail').innerHTML = cat?.detail ? `<section><p>${cat.detail}</p></section>` : '';
    $('sel-brief-btn').classList.toggle('active', !this.selDetailed);
    $('sel-detail-btn').classList.toggle('active', this.selDetailed);
    this.renderParamBar(comp);
    this.renderActions(comp);
    this.renderSelectedReadings();
  }

  // —— 底部参数条：选中元件的可调参数，紧贴底部弹出 ——
  renderParamBar(comp) {
    const bar = $('param-bar');
    bar.replaceChildren();
    const def = DEFS[comp.type];
    const head = document.createElement('b');
    head.className = 'param-title';
    head.textContent = def.label;
    bar.appendChild(head);
    const entries = Object.entries(def.params);
    if (!entries.length) {
      const note = document.createElement('span');
      note.className = 'param-note';
      note.textContent = def.kind === 'meter' ? '量程由所接接线柱决定' : '此元件无可调参数';
      bar.appendChild(note);
    }
    for (const [key, cfg] of entries) {
      if (comp.type === 'wire-board' && key === 'specimen') {
        bar.appendChild(this.selectRow(comp, key, cfg.label,
          WIRE_SPECIMENS.map(s => ({ value: s.id, label: `${s.label} ≈${s.R} Ω` })), comp.params.specimen));
        continue;
      }
      if (cfg.type === 'bool') {
        const lbl = document.createElement('label');
        lbl.className = 'param-check';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!comp.params[key];
        input.addEventListener('change', () => this.controller.setParam(comp.id, key, input.checked, { redraw: false }));
        lbl.appendChild(input);
        lbl.appendChild(document.createTextNode(cfg.label));
        bar.appendChild(lbl);
        continue;
      }
      if (cfg.options) {
        bar.appendChild(this.selectRow(comp, key, cfg.label,
          cfg.options.map(o => ({ value: o, label: `${o} ${cfg.unit ?? ''}` })), comp.params[key]));
        continue;
      }
      // range 滑块
      const row = document.createElement('div');
      row.className = 'param-row';
      const name = document.createElement('span');
      name.textContent = cfg.label;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = cfg.min; input.max = cfg.max; input.step = cfg.step;
      input.value = comp.params[key];
      const out = document.createElement('output');
      out.textContent = `${comp.params[key]} ${cfg.unit ?? ''}`;
      input.addEventListener('input', () => {
        comp.params[key] = Number(input.value);
        out.textContent = `${input.value} ${cfg.unit ?? ''}`;
        // 电池节数等结构性参数需要重画元件本体
        this.controller.setParam(comp.id, key, Number(input.value), { redraw: key === 'cells' });
      });
      row.append(name, input, out);
      bar.appendChild(row);
    }
    const close = document.createElement('button');
    close.className = 'param-close';
    close.setAttribute('aria-label', '收起参数条');
    close.textContent = '×';
    close.addEventListener('click', () => this.controller.select(null));
    bar.appendChild(close);
    bar.hidden = false;
  }

  selectRow(comp, key, labelText, options, current) {
    const row = document.createElement('div');
    row.className = 'param-row';
    row.style.gridTemplateColumns = '74px 1fr';
    const name = document.createElement('span');
    name.textContent = labelText;
    const select = document.createElement('select');
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = String(o.value);
      opt.textContent = o.label;
      opt.selected = String(o.value) === String(current);
      select.appendChild(opt);
    }
    select.addEventListener('change', () => this.controller.setParam(comp.id, key, select.value));
    row.append(name, select);
    return row;
  }

  renderActions(comp) {
    const wrap = $('sel-actions');
    wrap.replaceChildren();
    if (comp.type === 'switch' || comp.type === 'spdt-switch') {
      const btn = document.createElement('button');
      btn.textContent = comp.type === 'switch' ? (comp.params.closed ? '断开开关' : '闭合开关') : '切换掷向';
      btn.addEventListener('click', () => { this.controller.toggleSwitch(comp.id); this.renderSelected(); });
      wrap.appendChild(btn);
    }
    if (comp.type === 'fuse' && comp.blown) {
      const btn = document.createElement('button');
      btn.textContent = '更换保险丝';
      btn.addEventListener('click', () => { this.controller.replaceFuse(comp.id); this.renderSelected(); });
      wrap.appendChild(btn);
    }
    const del = document.createElement('button');
    del.className = 'danger';
    del.textContent = '删除元件（含导线）';
    del.addEventListener('click', () => this.controller.removeComponent(comp.id));
    wrap.appendChild(del);
  }

  renderSelectedReadings() {
    const sel = this.controller.selected;
    const comp = sel?.kind === 'comp' ? this.controller.getComp(sel.id) : null;
    if (!comp) return;
    const r = this.controller.results?.comps.get(comp.id);
    const dl = $('sel-reading');
    dl.replaceChildren();
    if (!r) return;
    const items = [];
    const def = DEFS[comp.type];
    if (def.kind === 'meter') {
      items.push(['读数', comp.type === 'voltmeter' ? fmtV(r.reading ?? 0) : fmtA(r.reading ?? 0), (r.reading ?? 0) < 0]);
      items.push(['量程', r.rangeLabel ?? '未接线', false]);
    } else {
      items.push(['电压 U', fmtV(r.U ?? 0), false]);
      items.push(['电流 I', fmtA(r.I ?? 0), (r.I ?? 0) < -1e-9]);
      items.push(['功率 P', `${(r.P ?? 0).toFixed(3)} W`, false]);
      if (comp.type === 'bulb-nl' && r.rNow !== undefined) items.push(['当前电阻', fmtR(r.rNow), false]);
    }
    for (const [k, v, neg] of items) {
      const div = document.createElement('div');
      div.innerHTML = `<dt>${k}</dt><dd class="${neg ? 'neg' : ''}">${v}</dd>`;
      dl.appendChild(div);
    }
  }

  // —— 右侧：实时读数 ——
  renderMeters() {
    const wrap = $('meter-list');
    wrap.replaceChildren();
    const rows = [];
    for (const comp of this.controller.bench.components) {
      const def = DEFS[comp.type];
      const r = this.controller.results?.comps.get(comp.id);
      if (!r) continue;
      if (def.kind === 'meter') {
        const unit = comp.type === 'voltmeter';
        const notes = [];
        if (r.rangeLabel) notes.push(`量程 ${r.rangeLabel}`);
        if ((r.reading ?? 0) < 0) notes.push('接线柱接反（指针反打）');
        else if (r.overrange) notes.push('超过量程！');
        rows.push({ name: def.label, value: unit ? fmtV(r.reading ?? 0) : fmtA(r.reading ?? 0), neg: (r.reading ?? 0) < 0, note: notes.join(' · ') });
      } else if (def.kind === 'source') {
        rows.push({ name: def.label, value: `${fmtV(r.U)} · ${fmtA(r.I)}`, neg: false, note: '电压 · 输出电流' });
      }
    }
    if (!rows.length) {
      wrap.innerHTML = '<p class="insp-empty">电路中还没有电表或电源。从元件箱添加后，这里会显示实时读数。</p>';
      return;
    }
    for (const row of rows) {
      const div = document.createElement('div');
      div.className = 'meter-row';
      div.innerHTML = `<b>${row.name}</b><span class="${row.neg ? 'neg' : ''}">${row.value}</span>${row.note ? `<small>${row.note}</small>` : ''}`;
      wrap.appendChild(div);
    }
  }

  // —— 右侧：数据记录 ——
  attachDataControls() {
    $('data-record').addEventListener('click', () => {
      const id = this.dataTarget;
      if (!id) return;
      const r = this.controller.results?.comps.get(id);
      if (!r) return;
      const list = this.records.get(id) ?? [];
      list.push({ u: r.U ?? 0, i: r.I ?? 0 });
      this.records.set(id, list);
      this.renderDataTable();
      this.renderPlot();
    });
    $('data-clear').addEventListener('click', () => {
      if (this.dataTarget) this.records.delete(this.dataTarget);
      this.renderDataTable();
      this.renderPlot();
    });
    $('data-target').addEventListener('change', () => {
      this.dataTarget = $('data-target').value || null;
      this.renderDataTable();
      this.renderPlot();
    });
    this.renderDataTargets();
  }

  renderDataTargets() {
    const select = $('data-target');
    const prev = this.dataTarget;
    select.replaceChildren();
    const comps = this.controller.measurableComponents();
    if (!comps.length) {
      select.innerHTML = '<option value="">（先放置元件）</option>';
      this.dataTarget = null;
      return;
    }
    for (const comp of comps) {
      const opt = document.createElement('option');
      opt.value = comp.id;
      opt.textContent = DEFS[comp.type].label;
      select.appendChild(opt);
    }
    this.dataTarget = comps.some(c => c.id === prev) ? prev : comps[0].id;
    select.value = this.dataTarget;
    this.renderDataTable();
  }

  renderDataTable() {
    const tbody = $('data-tbody');
    tbody.replaceChildren();
    const list = this.records.get(this.dataTarget) ?? [];
    list.forEach((rec, i) => {
      const tr = document.createElement('tr');
      const r = rec.i !== 0 ? Math.abs(rec.u / rec.i) : Infinity;
      tr.innerHTML = `<td>${i + 1}</td><td>${rec.u.toFixed(2)}</td><td>${rec.i.toFixed(3)}</td><td>${isFinite(r) ? r.toFixed(1) : '—'}</td>`;
      tbody.appendChild(tr);
    });
  }

  renderPlot() {
    const label = this.dataTarget ? DEFS[this.controller.getComp(this.dataTarget)?.type]?.label ?? '' : '';
    drawPlot($('plot-svg'), this.records.get(this.dataTarget) ?? [], label);
  }

  // —— 右侧：概念资料 ——
  buildConceptList() {
    const wrap = $('concept-list');
    wrap.replaceChildren();
    for (const [key, c] of Object.entries(CONCEPTS)) {
      const btn = document.createElement('button');
      btn.textContent = c.title;
      btn.dataset.concept = key;
      btn.addEventListener('click', () => this.showConcept(key));
      wrap.appendChild(btn);
    }
    $('sel-brief-btn').addEventListener('click', () => { this.selDetailed = false; this.renderSelected(); });
    $('sel-detail-btn').addEventListener('click', () => { this.selDetailed = true; this.renderSelected(); });
    $('concept-brief-btn').addEventListener('click', () => { this.conceptDetailed = false; this.showConcept(this.conceptKey); });
    $('concept-detail-btn').addEventListener('click', () => { this.conceptDetailed = true; this.showConcept(this.conceptKey); });
  }

  showConcept(key) {
    if (!key) return;
    this.conceptKey = key;
    const c = CONCEPTS[key];
    $('concept-body').hidden = false;
    $('concept-title').textContent = c.title;
    $('concept-en').textContent = c.en;
    $('concept-text').textContent = this.conceptDetailed ? c.detail : c.brief;
    $('concept-brief-btn').classList.toggle('active', !this.conceptDetailed);
    $('concept-detail-btn').classList.toggle('active', this.conceptDetailed);
    document.querySelectorAll('#concept-list button').forEach(b =>
      b.classList.toggle('active', b.dataset.concept === key));
  }

  // —— 面板折叠 ——
  attachCollapse() {
    const changed = () => this.hooks.onLayoutChange?.();
    $('library-close').addEventListener('click', () => {
      $('library-panel').classList.add('collapsed');
      $('library-reopen').hidden = false;
      changed();
    });
    $('library-reopen').addEventListener('click', () => {
      $('library-panel').classList.remove('collapsed');
      $('library-reopen').hidden = true;
      changed();
    });
    $('inspector-close').addEventListener('click', () => {
      $('inspector-panel').classList.add('collapsed');
      $('inspector-reopen').hidden = false;
      changed();
    });
    $('inspector-reopen').addEventListener('click', () => {
      $('inspector-panel').classList.remove('collapsed');
      $('inspector-reopen').hidden = true;
      changed();
    });
  }
}

function iconOf(type) {
  return {
    'student-supply': '⚡', 'battery-pack': '▮', accumulator: '▣',
    switch: '⎋', 'spdt-switch': '⇄',
    resistor: '▭', rheostat: '↔', 'resistance-box': '▤', 'wire-board': '〜',
    ammeter: 'A', voltmeter: 'V', galvanometer: 'G',
    diode: '▶', led: '✦', bulb: '☼', 'bulb-nl': '❋',
    fuse: '∿', bell: '🔔', motor: '↻'
  }[type] ?? '▫';
}
