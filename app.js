(function () {
  'use strict';

  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var D, mesIdx = {};
  var filtro = { periodo: '', cd: '', motivo: '', motorista: '', colaborador: '' };
  var graficos = {};

  // ---------- Formatação ----------
  var fmtInt = new Intl.NumberFormat('pt-BR');
  var fmtDec = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var fmtUma = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  function brl(v) { return 'R$ ' + fmtInt.format(Math.round(v)); }
  function brlCurto(v) { return v >= 1e3 ? 'R$ ' + fmtUma.format(v / 1e3) + ' mil' : brl(v); }
  function pct(v) { return fmtDec.format(v * 100) + '%'; }
  function rotuloMes(m) { var p = m.split('-'); return MESES[+p[1] - 1] + '/' + p[0].slice(2); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function cor(nome) { return getComputedStyle(document.documentElement).getPropertyValue(nome).trim(); }
  function anoAntes(m) { var p = m.split('-'); return (+p[0] - 1) + '-' + p[1]; }
  function primeiroNome(n) { var p = n.split(' '); return p[0] + ' ' + p[p.length - 1].charAt(0) + '.'; }
  function hexA(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }

  // ---------- Dados ----------
  // devolucoes: [mes, motorista, motivo, colaborador, qtd, custo, dias_soma]; entregas: [mes, motorista, entregas]
  function mesesDoPeriodo() {
    var p = filtro.periodo.split('|');
    return D.meses.filter(function (m) { return m >= p[0] && m <= p[1]; });
  }
  function cdDoMotorista(i) { return D.motoristas[i][1]; }

  function devs(meses, ignorar) {
    var set = {}; meses.forEach(function (m) { if (m in mesIdx) set[mesIdx[m]] = true; });
    return D.devolucoes.filter(function (l) {
      if (!set[l[0]]) return false;
      if (ignorar !== 'cd' && filtro.cd !== '' && cdDoMotorista(l[1]) !== +filtro.cd) return false;
      if (ignorar !== 'motivo' && filtro.motivo !== '' && l[2] !== +filtro.motivo) return false;
      if (ignorar !== 'motorista' && filtro.motorista !== '' && l[1] !== +filtro.motorista) return false;
      if (ignorar !== 'colaborador' && filtro.colaborador !== '' && l[3] !== +filtro.colaborador) return false;
      return true;
    });
  }
  // Entregas não têm motivo nem colaborador: filtram só por período, centro e motorista.
  function ents(meses, ignorar) {
    var set = {}; meses.forEach(function (m) { if (m in mesIdx) set[mesIdx[m]] = true; });
    return D.entregas.filter(function (l) {
      if (!set[l[0]]) return false;
      if (ignorar !== 'cd' && filtro.cd !== '' && cdDoMotorista(l[1]) !== +filtro.cd) return false;
      if (ignorar !== 'motorista' && filtro.motorista !== '' && l[1] !== +filtro.motorista) return false;
      return true;
    });
  }
  function somar(meses) {
    var t = { entregas: 0, dev: 0, custo: 0, dias: 0 };
    ents(meses).forEach(function (l) { t.entregas += l[2]; });
    devs(meses).forEach(function (l) { t.dev += l[4]; t.custo += l[5]; t.dias += l[6]; });
    t.taxa = t.entregas ? t.dev / t.entregas : 0;
    t.tempo = t.dev ? t.dias / t.dev : 0;
    return t;
  }
  function agrupar(ls, idx, val) {
    var m = {};
    ls.forEach(function (l) { var k = typeof idx === 'function' ? idx(l) : l[idx]; m[k] = (m[k] || 0) + l[val]; });
    return m;
  }

  // ---------- Base dos gráficos ----------
  function base() {
    return {
      animationDuration: 300,
      textStyle: { fontFamily: getComputedStyle(document.body).fontFamily, color: cor('--tinta-2') },
      tooltip: {
        backgroundColor: cor('--superficie'), borderColor: cor('--borda'), borderWidth: 1,
        textStyle: { color: cor('--tinta'), fontSize: 13 },
        extraCssText: 'box-shadow:0 6px 20px rgba(5,25,30,.16);border-radius:10px;',
      },
    };
  }
  function eixoCat(extra) {
    return Object.assign({ axisLine: { lineStyle: { color: cor('--eixo') } }, axisTick: { show: false }, axisLabel: { color: cor('--tinta-muda') } }, extra || {});
  }
  function eixoVal(extra) {
    return Object.assign({ splitLine: { lineStyle: { color: cor('--grade') } }, axisLine: { show: false }, axisLabel: { color: cor('--tinta-muda') } }, extra || {});
  }
  function dica(valor, rotulo) {
    return '<b style="font-size:14px">' + valor + '</b><br><span style="color:' + cor('--tinta-2') + '">' + esc(rotulo) + '</span>';
  }

  // ---------- Indicadores ----------
  // menorMelhor: queda é boa notícia (devoluções, taxa, custo, tempo).
  function renderIndicadores(meses, atual, anterior) {
    var porMes = meses.map(function (m) { return somar([m]); });
    var defs = [
      { id: 'ent', nome: 'Entregas', valor: fmtInt.format(atual.entregas), d: anterior && delta(atual.entregas, anterior.entregas, false), serie: porMes.map(function (t) { return t.entregas; }) },
      { id: 'dev', nome: 'Devoluções', valor: fmtInt.format(atual.dev), d: anterior && delta(atual.dev, anterior.dev, true), serie: porMes.map(function (t) { return t.dev; }) },
      { id: 'taxa', nome: 'Taxa de devolução', valor: pct(atual.taxa), d: anterior && diffPp(atual.taxa, anterior.taxa), serie: porMes.map(function (t) { return t.taxa; }) },
      { id: 'custo', nome: 'Custo das devoluções', valor: brlCurto(atual.custo), d: anterior && delta(atual.custo, anterior.custo, true), serie: porMes.map(function (t) { return t.custo; }) },
      { id: 'tempo', nome: 'Tempo médio de resolução', valor: fmtUma.format(atual.tempo) + ' dias', d: anterior && delta(atual.tempo, anterior.tempo, true), serie: porMes.map(function (t) { return t.tempo; }) },
    ];
    var raiz = document.getElementById('indicadores');
    if (!raiz.children.length) {
      defs.forEach(function (def) {
        var card = document.createElement('article'); card.className = 'indicador';
        card.innerHTML = '<p class="indicador-nome"></p><p class="indicador-valor"></p><p class="indicador-delta"></p><div class="indicador-mini" aria-hidden="true"></div>';
        card.querySelector('.indicador-mini').id = 'mini-' + def.id;
        raiz.appendChild(card);
      });
    }
    defs.forEach(function (def, i) {
      var card = raiz.children[i];
      card.querySelector('.indicador-nome').textContent = def.nome;
      card.querySelector('.indicador-valor').textContent = def.valor;
      var d = card.querySelector('.indicador-delta');
      d.className = 'indicador-delta'; d.textContent = '';
      if (def.d) {
        d.classList.add(def.d.bom === null ? 'neutro' : def.d.bom ? 'bom' : 'ruim');
        var b = document.createElement('b');
        b.textContent = (def.d.sinal > 0 ? '▲ ' : def.d.sinal < 0 ? '▼ ' : '= ') + def.d.texto;
        d.appendChild(b);
        d.appendChild(document.createTextNode(' vs ano anterior'));
      } else {
        d.textContent = 'sem ano anterior para comparar';
      }
      desenharMini('mini-' + def.id, def.serie);
    });
  }
  function delta(a, b, menorMelhor) {
    if (!b) return null;
    var r = a / b - 1, sinal = Math.abs(r) < 0.0005 ? 0 : Math.sign(r);
    return { sinal: sinal, bom: sinal === 0 ? null : (menorMelhor ? sinal < 0 : sinal > 0), texto: (r > 0 ? '+' : '') + fmtUma.format(r * 100) + '%' };
  }
  function diffPp(a, b) {
    var r = (a - b) * 100, sinal = Math.abs(r) < 0.005 ? 0 : Math.sign(r);
    return { sinal: sinal, bom: sinal === 0 ? null : sinal < 0, texto: (r > 0 ? '+' : '') + fmtDec.format(r) + ' p.p.' };
  }
  function desenharMini(id, serie) {
    var c = cor('--marca');
    desenhar(id, {
      animation: false,
      grid: { left: 2, right: 2, top: 4, bottom: 2 },
      xAxis: { type: 'category', show: false, boundaryGap: false, data: serie.map(function (_, i) { return i; }) },
      yAxis: { type: 'value', show: false, scale: true },
      series: [{ type: 'line', data: serie, symbol: 'none', smooth: 0.3, lineStyle: { width: 2, color: c },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: hexA(c, 0.22) }, { offset: 1, color: hexA(c, 0) }]) } }],
    });
  }

  // ---------- Devoluções mês a mês ----------
  function renderMensal(meses, temComparacao) {
    var marca = cor('--marca'), ref = cor('--serie-ref');
    var atual = meses.map(function (m) { return somar([m]).dev; });
    var anterior = temComparacao ? meses.map(function (m) { return somar([anoAntes(m)]).dev; }) : null;
    var series = [{
      name: 'Período atual', type: 'line', data: atual, symbol: 'circle', symbolSize: 8, z: 3,
      lineStyle: { width: 2.5, color: marca }, itemStyle: { color: marca, borderColor: cor('--superficie'), borderWidth: 2 },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: hexA(marca, 0.18) }, { offset: 1, color: hexA(marca, 0) }]) },
      endLabel: { show: true, formatter: 'Atual', color: cor('--tinta'), fontWeight: 600 },
    }];
    if (anterior) series.push({
      name: 'Ano anterior', type: 'line', data: anterior, symbol: 'circle', symbolSize: 7, z: 2,
      lineStyle: { width: 2, color: ref }, itemStyle: { color: ref, borderColor: cor('--superficie'), borderWidth: 2 },
      endLabel: { show: true, formatter: 'Ano anterior', color: cor('--tinta-muda') },
    });
    // Afasta os rótulos do fim das linhas: o da linha mais alta sobe, o da mais baixa desce.
    if (anterior && atual.length) {
      var atualAcima = atual[atual.length - 1] >= anterior[anterior.length - 1];
      series[0].endLabel.offset = [4, atualAcima ? -9 : 9];
      series[1].endLabel.offset = [4, atualAcima ? 9 : -9];
    }
    var opt = base();
    opt.grid = { left: 8, right: 92, top: 40, bottom: 4, containLabel: true };
    opt.legend = { top: 0, left: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 3, textStyle: { color: cor('--tinta-2') } };
    opt.tooltip.trigger = 'axis';
    opt.tooltip.axisPointer = { type: 'line', lineStyle: { color: cor('--eixo') } };
    opt.tooltip.formatter = function (ps) {
      var h = '<div style="font-weight:600;margin-bottom:4px">' + esc(ps[0].axisValue) + '</div>';
      ps.forEach(function (p) { h += '<div style="display:flex;align-items:center;gap:8px"><span style="width:12px;height:2px;background:' + p.color + '"></span><b>' + fmtInt.format(p.value) + '</b><span style="color:' + cor('--tinta-2') + '">' + esc(p.seriesName) + '</span></div>'; });
      return h;
    };
    opt.xAxis = eixoCat({ type: 'category', data: meses.map(rotuloMes), boundaryGap: false });
    opt.yAxis = eixoVal({ type: 'value' });
    opt.series = series;
    desenhar('g-mensal', opt);

    var tA = atual.reduce(function (a, b) { return a + b; }, 0);
    var tB = anterior ? anterior.reduce(function (a, b) { return a + b; }, 0) : 0;
    document.getElementById('sub-mensal').textContent = anterior && tB
      ? fmtInt.format(tA) + ' devoluções no período, ' + (tA <= tB ? fmtUma.format((1 - tA / tB) * 100) + '% a menos' : fmtUma.format((tA / tB - 1) * 100) + '% a mais') + ' que no ano anterior'
      : fmtInt.format(tA) + ' devoluções no período';
    var cab = ['Mês', 'Devoluções']; if (anterior) cab.push('Ano anterior');
    tabela('g-mensal', cab, meses.map(function (m, i) { var l = [rotuloMes(m), fmtInt.format(atual[i])]; if (anterior) l.push(fmtInt.format(anterior[i])); return l; }));
  }

  // ---------- Barras horizontais ----------
  function barrasH(id, itens, op) {
    var opt = base();
    opt.grid = { left: 4, right: op.margemDireita || 70, top: 4, bottom: 4, containLabel: true };
    opt.tooltip.trigger = 'item';
    opt.tooltip.formatter = function (p) { return dica(op.dica(itens[p.dataIndex]), itens[p.dataIndex].nome); };
    opt.xAxis = { type: 'value', show: false };
    opt.yAxis = eixoCat({ type: 'category', inverse: true, data: itens.map(function (i) { return op.curto ? op.curto(i) : i.nome; }),
      axisLine: { show: false }, axisLabel: { color: cor('--tinta-2'), width: op.larguraRotulo || 140, overflow: 'truncate' } });
    opt.series = [{
      type: 'bar', barWidth: '60%', cursor: op.aoClicar ? 'pointer' : 'default',
      showBackground: true, backgroundStyle: { color: cor('--superficie-2'), borderRadius: 4 },
      data: itens.map(function (i) { return { value: i.valor, itemStyle: { color: cor('--marca'), opacity: i.apagado ? 0.28 : 1, borderRadius: [0, 4, 4, 0] } }; }),
      label: { show: true, position: 'right', color: cor('--tinta-2'), formatter: function (p) { return op.rotulo(itens[p.dataIndex]); } },
      emphasis: { itemStyle: { color: cor('--marca-forte') } },
      markLine: op.linha ? { symbol: 'none', silent: true, label: { show: false }, lineStyle: { color: cor('--tinta-muda'), type: 'solid', width: 1 }, data: [{ xAxis: op.linha }] } : undefined,
    }];
    desenhar(id, opt, op.aoClicar ? function (p) { op.aoClicar(itens[p.dataIndex]); } : null);
  }
  function alternar(chave, valor) { filtro[chave] = filtro[chave] === String(valor) ? '' : String(valor); sincronizarSelects(); atualizar(); }

  function top(mapa, nomes, n, selecionado) {
    var todos = Object.keys(mapa).map(function (k) { return { idx: +k, nome: nomes(+k), valor: mapa[k] }; }).sort(function (a, b) { return b.valor - a.valor; });
    var t = todos.slice(0, n);
    if (selecionado !== '' && !t.some(function (x) { return x.idx === +selecionado; })) {
      var s = todos.filter(function (x) { return x.idx === +selecionado; })[0]; if (s) t[n - 1] = s;
    }
    t.forEach(function (x) { x.apagado = selecionado !== '' && x.idx !== +selecionado; });
    return { top: t, todos: todos };
  }

  function renderMotivos(meses) {
    var r = top(agrupar(devs(meses, 'motivo'), 2, 4), function (i) { return D.motivos[i]; }, 5, filtro.motivo);
    var tot = r.todos.reduce(function (a, x) { return a + x.valor; }, 0);
    barrasH('g-motivos', r.top, {
      larguraRotulo: 120, margemDireita: 48,
      rotulo: function (x) { return fmtUma.format(tot ? x.valor / tot * 100 : 0) + '%'; },
      dica: function (x) { return fmtInt.format(x.valor) + ' devoluções'; },
      aoClicar: function (x) { alternar('motivo', x.idx); },
    });
    document.getElementById('sub-motivos').textContent = r.top.length ? r.top[0].nome + ' lidera, com ' + fmtUma.format(r.top[0].valor / tot * 100) + '% das devoluções' : '';
    tabela('g-motivos', ['Motivo', 'Devoluções', 'Participação'], r.todos.map(function (x) { return [x.nome, fmtInt.format(x.valor), fmtUma.format(x.valor / tot * 100) + '%']; }));
  }

  function renderMotoristas(meses) {
    var dv = agrupar(devs(meses, 'motorista'), 1, 4), en = agrupar(ents(meses, 'motorista'), 1, 2);
    var r = top(dv, function (i) { return D.motoristas[i][0]; }, 5, filtro.motorista);
    barrasH('g-motoristas', r.top, {
      larguraRotulo: 120, margemDireita: 110, curto: function (x) { return primeiroNome(x.nome); },
      rotulo: function (x) { return fmtInt.format(x.valor) + ' · ' + pct(en[x.idx] ? x.valor / en[x.idx] : 0); },
      dica: function (x) { return fmtInt.format(x.valor) + ' devoluções em ' + fmtInt.format(en[x.idx] || 0) + ' entregas'; },
      aoClicar: function (x) { alternar('motorista', x.idx); },
    });
    tabela('g-motoristas', ['Motorista', 'Centro', 'Devoluções', 'Entregas', 'Taxa'], r.todos.map(function (x) {
      return [x.nome, D.cds[cdDoMotorista(x.idx)], fmtInt.format(x.valor), fmtInt.format(en[x.idx] || 0), pct(en[x.idx] ? x.valor / en[x.idx] : 0)];
    }));
  }

  function renderColaboradores(meses) {
    var r = top(agrupar(devs(meses, 'colaborador'), 3, 4), function (i) { return D.colaboradores[i][0]; }, 5, filtro.colaborador);
    var tot = r.todos.reduce(function (a, x) { return a + x.valor; }, 0);
    barrasH('g-colaboradores', r.top, {
      larguraRotulo: 120, margemDireita: 80, curto: function (x) { return primeiroNome(x.nome); },
      rotulo: function (x) { return fmtInt.format(x.valor) + ' · ' + fmtUma.format(tot ? x.valor / tot * 100 : 0) + '%'; },
      dica: function (x) { return fmtInt.format(x.valor) + ' devoluções'; },
      aoClicar: function (x) { alternar('colaborador', x.idx); },
    });
    tabela('g-colaboradores', ['Colaborador', 'Centro', 'Devoluções', 'Participação'], r.todos.map(function (x) {
      return [x.nome, D.cds[D.colaboradores[x.idx][1]], fmtInt.format(x.valor), fmtUma.format(x.valor / tot * 100) + '%'];
    }));
  }

  function renderCds(meses) {
    var cdDe = function (l) { return cdDoMotorista(l[1]); };
    var dv = agrupar(devs(meses, 'cd'), cdDe, 4), en = agrupar(ents(meses, 'cd'), cdDe, 2);
    var itens = D.cds.map(function (n, i) { return { idx: i, nome: n, dev: dv[i] || 0, ent: en[i] || 0, valor: en[i] ? (dv[i] || 0) / en[i] : 0, apagado: filtro.cd !== '' && i !== +filtro.cd }; })
      .sort(function (a, b) { return b.valor - a.valor; });
    var tE = itens.reduce(function (a, x) { return a + x.ent; }, 0), tD = itens.reduce(function (a, x) { return a + x.dev; }, 0);
    var media = tE ? tD / tE : 0;
    barrasH('g-cds', itens, {
      larguraRotulo: 150, margemDireita: 60, curto: function (x) { return x.nome.replace('CD ', ''); },
      rotulo: function (x) { return pct(x.valor); }, linha: media,
      dica: function (x) { return pct(x.valor) + ' · ' + fmtInt.format(x.dev) + ' de ' + fmtInt.format(x.ent); },
      aoClicar: function (x) { alternar('cd', x.idx); },
    });
    document.getElementById('sub-cds').textContent = 'A linha vertical marca a média geral: ' + pct(media) + '. Clique para filtrar.';
    tabela('g-cds', ['Centro', 'Entregas', 'Devoluções', 'Taxa'], itens.map(function (x) { return [x.nome, fmtInt.format(x.ent), fmtInt.format(x.dev), pct(x.valor)]; }));
  }

  function renderCusto(meses) {
    var r = top(agrupar(devs(meses, 'motivo'), 2, 5), function (i) { return D.motivos[i]; }, 8, filtro.motivo);
    var tot = r.todos.reduce(function (a, x) { return a + x.valor; }, 0);
    barrasH('g-custo', r.top, {
      larguraRotulo: 150, margemDireita: 70,
      rotulo: function (x) { return brlCurto(x.valor); },
      dica: function (x) { return brl(x.valor) + ' · ' + fmtUma.format(x.valor / tot * 100) + '% do custo'; },
      aoClicar: function (x) { alternar('motivo', x.idx); },
    });
    document.getElementById('sub-custo').textContent = r.todos.length ? 'Total de ' + brl(tot) + '. ' + r.todos[0].nome + ' é o motivo mais caro.' : '';
    tabela('g-custo', ['Motivo', 'Custo', 'Participação'], r.todos.map(function (x) { return [x.nome, brl(x.valor), fmtUma.format(x.valor / tot * 100) + '%']; }));
  }

  // ---------- Infra ----------
  function desenhar(id, opt, aoClicar) {
    if (!graficos[id]) {
      graficos[id] = echarts.init(document.getElementById(id), null, { renderer: 'svg' });
      graficos[id].on('click', function (p) { if (graficos[id].__clique) graficos[id].__clique(p); });
    }
    graficos[id].__clique = aoClicar;
    graficos[id].setOption(opt, true);
  }
  function tabela(id, cab, dados) {
    var wrap = document.querySelector('[data-tabela="' + id + '"]');
    var t = document.createElement('table');
    var th = t.createTHead().insertRow();
    cab.forEach(function (c, i) { var e = document.createElement('th'); e.textContent = c; if (i) e.className = 'num'; th.appendChild(e); });
    var tb = t.createTBody();
    dados.forEach(function (l) { var tr = tb.insertRow(); l.forEach(function (v, i) { var td = tr.insertCell(); td.textContent = v; if (i) td.className = 'num'; }); });
    wrap.textContent = ''; wrap.appendChild(t);
  }
  document.querySelectorAll('.botao-tabela').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = b.getAttribute('data-alvo'), g = document.getElementById(id), t = document.querySelector('[data-tabela="' + id + '"]');
      var mostrar = t.hidden; t.hidden = !mostrar; g.hidden = mostrar;
      b.textContent = mostrar ? 'Ver gráfico' : 'Ver tabela';
      if (!mostrar && graficos[id]) graficos[id].resize();
    });
  });

  // ---------- Filtros ----------
  function opcao(sel, valor, texto) { var o = document.createElement('option'); o.value = valor; o.textContent = texto; sel.appendChild(o); }
  function montarFiltros() {
    var cd = document.getElementById('f-cd'); opcao(cd, '', 'Todos'); D.cds.forEach(function (n, i) { opcao(cd, String(i), n); });
    var mo = document.getElementById('f-motivo'); opcao(mo, '', 'Todos'); D.motivos.forEach(function (n, i) { opcao(mo, String(i), n); });
    filtro.periodo = document.getElementById('f-periodo').value;
    [['f-periodo', 'periodo'], ['f-cd', 'cd'], ['f-motivo', 'motivo']].forEach(function (par) {
      document.getElementById(par[0]).addEventListener('change', function (e) { filtro[par[1]] = e.target.value; atualizar(); });
    });
    document.getElementById('botao-limpar').addEventListener('click', function () {
      filtro.cd = ''; filtro.motivo = ''; filtro.motorista = ''; filtro.colaborador = ''; sincronizarSelects(); atualizar();
    });
  }
  function sincronizarSelects() {
    document.getElementById('f-cd').value = filtro.cd;
    document.getElementById('f-motivo').value = filtro.motivo;
  }

  function atualizar() {
    var meses = mesesDoPeriodo();
    var ant = meses.map(anoAntes);
    var temComparacao = ant.every(function (m) { return m in mesIdx; });
    var atual = somar(meses), anterior = temComparacao ? somar(ant) : null;
    var sel = document.getElementById('f-periodo');
    var extra = [];
    if (filtro.motorista !== '') extra.push('motorista ' + D.motoristas[+filtro.motorista][0]);
    if (filtro.colaborador !== '') extra.push('colaborador(a) ' + D.colaboradores[+filtro.colaborador][0]);
    document.getElementById('comparacao').textContent =
      (temComparacao ? 'Comparando ' + sel.options[sel.selectedIndex].text.toLowerCase() + ' com os mesmos meses do ano anterior.' : 'Os dados começam em jan/2025, então este período não tem ano anterior para comparar.') +
      (extra.length ? ' Filtrando por ' + extra.join(' e ') + '.' : '');
    renderIndicadores(meses, atual, anterior);
    renderMensal(meses, temComparacao);
    renderMotivos(meses);
    renderMotoristas(meses);
    renderColaboradores(meses);
    renderCds(meses);
    renderCusto(meses);
  }

  // ---------- Menu no celular ----------
  var menu = document.getElementById('menu'), fundo = document.getElementById('menu-fundo'), botaoMenu = document.getElementById('botao-menu');
  function abrirMenu(abrir) {
    menu.classList.toggle('aberto', abrir); fundo.hidden = !abrir;
    botaoMenu.setAttribute('aria-expanded', String(abrir)); botaoMenu.setAttribute('aria-label', abrir ? 'Fechar menu' : 'Abrir menu');
  }
  botaoMenu.addEventListener('click', function () { abrirMenu(!menu.classList.contains('aberto')); });
  fundo.addEventListener('click', function () { abrirMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') abrirMenu(false); });
  menu.querySelectorAll('nav a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      menu.querySelectorAll('nav a').forEach(function (x) { x.classList.remove('ativo'); x.removeAttribute('aria-current'); });
      a.classList.add('ativo'); a.setAttribute('aria-current', 'page'); abrirMenu(false);
    });
  });

  // ---------- Tema ----------
  // O claro é o padrão: o escuro só entra quando a pessoa clica no botão de tema.
  function temaEscuro() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
  document.getElementById('botao-tema').addEventListener('click', function () {
    var novo = temaEscuro() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', novo);
    try { localStorage.setItem('tema-rota-analytics', novo); } catch (e) {}
    if (D) atualizar();
  });
  var espera;
  window.addEventListener('resize', function () { clearTimeout(espera); espera = setTimeout(function () { Object.keys(graficos).forEach(function (k) { graficos[k].resize(); }); }, 120); });

  // ---------- Início ----------
  fetch('data/logistica.json').then(function (r) { return r.json(); }).then(function (d) {
    D = d;
    D.meses.forEach(function (m, i) { mesIdx[m] = i; });
    montarFiltros();
    atualizar();
  }).catch(function (e) {
    document.getElementById('comparacao').textContent = 'Não foi possível carregar os dados: ' + e.message;
  });
})();
