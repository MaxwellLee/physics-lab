// 改进节点分析（MNA）线性直流求解器。
// 纯数学模块：不依赖 DOM，可在 node 中独立测试。
//
// 未知量：所有非地节点电压 + 每个理想电压源的支路电流。
// 约定：j[k] 为电源内部由正极节点流向负极节点的电流；
// 电源向外供电时 j[k] 为负，对外输出电流 = -j[k]。

export function solveMNA(nodeCount, resistors, vSources, ground = 0) {
  // resistors: [{a, b, r}]，r > 0，节点号 0..nodeCount-1
  // vSources:  [{p, n, e}]，p 正极节点，n 负极节点，e 电动势（V）
  const rowOf = new Map();
  let n = 0;
  for (let i = 0; i < nodeCount; i++) {
    if (i !== ground) rowOf.set(i, n++);
  }
  const m = vSources.length;
  const size = n + m;
  const v = new Float64Array(nodeCount);
  const j = new Float64Array(m);
  if (size === 0) return { v, j, singular: false };

  const A = new Float64Array(size * size);
  const z = new Float64Array(size);

  const stampConductance = (a, b, g) => {
    const ra = a === ground ? -1 : rowOf.get(a);
    const rb = b === ground ? -1 : rowOf.get(b);
    if (ra >= 0) A[ra * size + ra] += g;
    if (rb >= 0) A[rb * size + rb] += g;
    if (ra >= 0 && rb >= 0) {
      A[ra * size + rb] -= g;
      A[rb * size + ra] -= g;
    }
  };

  for (const { a, b, r } of resistors) {
    if (a === b || !(r > 0)) continue;
    stampConductance(a, b, 1 / r);
  }

  vSources.forEach(({ p, n: nn, e }, k) => {
    const col = n + k;
    if (p !== ground) {
      const rp = rowOf.get(p);
      A[rp * size + col] += 1;
      A[col * size + rp] += 1;
    }
    if (nn !== ground) {
      const rn = rowOf.get(nn);
      A[rn * size + col] -= 1;
      A[col * size + rn] -= 1;
    }
    z[col] = e;
  });

  // 高斯消元（部分主元）
  for (let col = 0; col < size; col++) {
    let piv = col;
    let max = Math.abs(A[col * size + col]);
    for (let r = col + 1; r < size; r++) {
      const cand = Math.abs(A[r * size + col]);
      if (cand > max) { max = cand; piv = r; }
    }
    if (max < 1e-12) return { v: null, j: null, singular: true };
    if (piv !== col) {
      for (let c = col; c < size; c++) {
        const t = A[col * size + c];
        A[col * size + c] = A[piv * size + c];
        A[piv * size + c] = t;
      }
      const t = z[col]; z[col] = z[piv]; z[piv] = t;
    }
    const inv = 1 / A[col * size + col];
    for (let r = col + 1; r < size; r++) {
      const f = A[r * size + col] * inv;
      if (f === 0) continue;
      for (let c = col; c < size; c++) A[r * size + c] -= f * A[col * size + c];
      z[r] -= f * z[col];
    }
  }

  // 回代
  const x = new Float64Array(size);
  for (let r = size - 1; r >= 0; r--) {
    let s = z[r];
    for (let c = r + 1; c < size; c++) s -= A[r * size + c] * x[c];
    x[r] = s / A[r * size + r];
  }

  for (const [node, row] of rowOf) v[node] = x[row];
  for (let k = 0; k < m; k++) j[k] = x[n + k];
  return { v, j, singular: false };
}
