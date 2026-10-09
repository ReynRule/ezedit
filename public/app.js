'use strict';
/* ===================== 공통 유틸 ===================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const num = (id, d = 0) => { const v = parseFloat($('#' + id).value); return Number.isFinite(v) ? v : d; };
const fmtSize = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(2) + ' MB';
const fmtTime = s => { const m = Math.floor(s / 60); return m + ':' + (s - m * 60).toFixed(1).padStart(4, '0'); };
const baseName = n => n.replace(/\.[^.]+$/, '');
const extOf = n => (n.match(/\.([a-z0-9]+)$/i) || [, 'bin'])[1].toLowerCase();

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

function bindDrop(dropId, inputId) {
  const d = $('#' + dropId), i = $('#' + inputId);
  ['dragenter', 'dragover'].forEach(e => d.addEventListener(e, ev => { ev.preventDefault(); d.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(e => d.addEventListener(e, ev => { ev.preventDefault(); d.classList.remove('over'); }));
  d.addEventListener('drop', ev => {
    if (!ev.dataTransfer.files.length) return;
    i.files = ev.dataTransfer.files;
    i.dispatchEvent(new Event('change'));
  });
}

/* ===================== 탭 ===================== */
$$('nav button').forEach(b => b.addEventListener('click', () => {
  $$('nav button').forEach(x => x.setAttribute('aria-selected', x === b));
  $$('section.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + b.dataset.tab));
}));

/* ===================== 상태바 ===================== */
const st = {
  show(t) { $('#status').classList.add('on'); $('#stText').textContent = t; },
  text(t) { $('#stText').textContent = t; },
  bar(p) { $('#stBar').style.width = Math.max(0, Math.min(1, p)) * 100 + '%'; },
  hide() { $('#status').classList.remove('on'); },
};
$('#logBtn').addEventListener('click', () => {
  const on = $('#log').classList.toggle('on');
  $('#logBtn').textContent = on ? '로그 닫기' : '로그 보기';
});

/* ===================== 이미지 ===================== */
let imgList = [];       // File[]
let imgOut = [];        // {blob, name}[]

bindDrop('imgDrop', 'imgFiles');
$('#imgFiles').addEventListener('change', e => {
  imgList = [...e.target.files].filter(f => f.type.startsWith('image/'));
  imgOut = [];
  $('#imgResults').innerHTML = '';
  $('#imgRun').disabled = !imgList.length;
  $('#imgAll').disabled = true;
  $('#imgCount').textContent = imgList.length ? `${imgList.length}장 선택됨` : '';
});

function syncImgMode() {
  const m = $('#imgMode').value;
  $$('[data-m]').forEach(el => { el.hidden = !el.dataset.m.split(' ').includes(m); });
}
$('#imgMode').addEventListener('change', syncImgMode); syncImgMode();
$('#imgQ').addEventListener('input', e => { $('#imgQv').textContent = e.target.value; });

const canvasToBlob = (c, type, q) => new Promise(r => c.toBlob(r, type, q));

async function processImage(file) {
  const bmp = await createImageBitmap(file);
  let w = bmp.width, h = bmp.height;
  const mode = $('#imgMode').value;
  if (mode === 'scale') { const s = num('imgScale', 100) / 100; w = Math.round(w * s); h = Math.round(h * s); }
  else if (mode === 'width') { const nw = num('imgW', w); h = Math.round(h * nw / w); w = Math.round(nw); }
  else if (mode === 'height') { const nh = num('imgH', h); w = Math.round(w * nh / h); h = Math.round(nh); }
  else { w = Math.round(num('imgW', w)); h = Math.round(num('imgH', h)); }
  w = Math.max(1, w); h = Math.max(1, h);
  if (w * h > 120e6 || w > 16000 || h > 16000) throw new Error('결과 크기가 너무 큽니다 (브라우저 한계).');

  let type = $('#imgFmt').value;
  if (type === 'keep') type = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? file.type : 'image/png';

  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h); bmp.close();

  let q = num('imgQ', 80) / 100, blob;
  const target = num('imgTarget', 0) * 1024;
  if (type === 'image/png') blob = await canvasToBlob(c, type);
  else if (target > 0) {
    let lo = 0.05, hi = 1; blob = await canvasToBlob(c, type, lo);
    if (blob.size <= target) {                       // 최저 화질로도 못 맞추면 그대로 둠
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2, b = await canvasToBlob(c, type, mid);
        if (b.size <= target) { lo = mid; blob = b; } else hi = mid;
      }
    }
  } else blob = await canvasToBlob(c, type, q);

  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
  return { blob, w, h, name: `${baseName(file.name)}_edit.${ext}`, target };
}

$('#imgRun').addEventListener('click', async () => {
  const box = $('#imgResults'); box.innerHTML = ''; imgOut = [];
  $('#imgRun').disabled = true;
  for (const [i, f] of imgList.entries()) {
    const row = document.createElement('div'); row.className = 'item';
    row.innerHTML = `<div class="meta"><div class="n"></div><div>처리 중…</div></div>`;
    $('.n', row).textContent = f.name; box.appendChild(row);
    try {
      const r = await processImage(f);
      imgOut.push(r);
      const diff = (1 - r.blob.size / f.size) * 100;
      const url = URL.createObjectURL(r.blob);
      const over = r.target && r.blob.size > r.target ? ' <span class="bad">(목표 용량에 못 미침 – 크기를 더 줄여보세요)</span>' : '';
      row.innerHTML = `<img alt="" src="${url}"><div class="meta"><div class="n"></div>
        <div>${fmtSize(f.size)} → <b>${fmtSize(r.blob.size)}</b>
        <span class="${diff >= 0 ? 'good' : 'bad'}">${diff >= 0 ? '−' : '+'}${Math.abs(diff).toFixed(0)}%</span> · ${r.w}×${r.h}px${over}</div></div>
        <button class="btn sm">다운로드</button>`;
      $('.n', row).textContent = r.name;
      $('button', row).addEventListener('click', () => download(r.blob, r.name));
    } catch (err) {
      row.innerHTML = `<div class="meta"><div class="n"></div><div class="bad">실패: ${err.message}</div></div>`;
      $('.n', row).textContent = f.name;
    }
  }
  $('#imgRun').disabled = false; $('#imgAll').disabled = !imgOut.length;
});
$('#imgAll').addEventListener('click', async () => {
  for (const r of imgOut) { download(r.blob, r.name); await new Promise(r => setTimeout(r, 350)); }
});

/* ===================== FFmpeg 공통 ===================== */
let ffmpeg = null, ffLoading = null, logBuf = [], busy = false;

async function getFF() {
  if (ffmpeg) return ffmpeg;
  if (ffLoading) return ffLoading;
  ffLoading = (async () => {
    st.show('엔진 불러오는 중… (처음 한 번, 약 30MB)'); st.bar(0.05);
    const ff = new FFmpegWASM.FFmpeg();
    ff.on('log', ({ message }) => {
      logBuf.push(message);
      const el = $('#log'); el.textContent += message + '\n'; el.scrollTop = el.scrollHeight;
    });
    ff.on('progress', ({ progress }) => { if (busy) { st.bar(progress); st.text(`처리 중… ${Math.max(0, Math.min(100, progress * 100)).toFixed(0)}%`); } });
    const abs = p => new URL(p, location.href).href;
    await ff.load({ coreURL: abs('vendor/core/ffmpeg-core.js'), wasmURL: abs('vendor/core/ffmpeg-core.wasm') });
    ffmpeg = ff; return ff;
  })();
  try { return await ffLoading; } finally { ffLoading = null; }
}

function resetFF() { try { ffmpeg && ffmpeg.terminate(); } catch (_) { } ffmpeg = null; }

async function writeInput(ff, file, name) { await ff.writeFile(name, await FFmpegUtil.fetchFile(file)); }

async function probeAudio(file) {
  const ff = await getFF(); const n = 'probe.' + extOf(file.name);
  await writeInput(ff, file, n); logBuf = [];
  try { await ff.exec(['-i', n, '-t', '0.05', '-f', 'null', '-']); } catch (_) { }
  await ff.deleteFile(n).catch(() => { });
  return /Stream #\d+:\d+.*Audio:/.test(logBuf.join('\n'));
}

async function runJob({ title, files, args, out }) {
  if (busy) return;
  busy = true; $('#log').textContent = '';
  $$('[data-cancel]').forEach(b => b.hidden = false);
  try {
    const ff = await getFF();
    st.show(title); st.bar(0);
    for (const f of files) await writeInput(ff, f.file, f.name);
    logBuf = [];
    const code = await ff.exec(args);
    if (code !== 0) throw new Error('ffmpeg 오류 (코드 ' + code + ')\n' + logBuf.slice(-6).join('\n'));
    const data = await ff.readFile(out);
    await Promise.all([...files.map(f => f.name), out].map(n => ff.deleteFile(n).catch(() => { })));
    st.text('완료'); st.bar(1);
    return new Blob([data.buffer], { type: 'video/mp4' });
  } finally {
    busy = false; $$('[data-cancel]').forEach(b => b.hidden = true);
  }
}
$$('[data-cancel]').forEach(b => b.addEventListener('click', () => {
  resetFF(); busy = false; st.text('취소됨'); st.bar(0);
  $$('[data-cancel]').forEach(x => x.hidden = true);
  $('#vcRun').disabled = !vcFile; $('#veRun').disabled = !veFile;
}));

/* 해상도/화질 공통 UI */
function qualityUI(prefix, host) {
  $(host).innerHTML = `<div class="grid">
    <div class="f"><label for="${prefix}Res">세로 해상도 (원본보다 크게 고르면 확대)</label>
      <select id="${prefix}Res"><option value="">원본 유지</option><option>2160</option><option>1440</option><option>1080</option>
      <option>720</option><option>480</option><option>360</option><option>240</option></select></div>
    <div class="f"><label for="${prefix}Crf">화질 CRF <span id="${prefix}CrfV">26</span> (낮을수록 고화질·큰 용량)</label>
      <input type="range" id="${prefix}Crf" min="18" max="38" value="26"></div>
    <div class="f"><label for="${prefix}Pre">속도</label>
      <select id="${prefix}Pre"><option value="ultrafast">가장 빠름 (용량 큼)</option><option value="superfast">매우 빠름</option>
      <option value="veryfast" selected>빠름 (권장)</option><option value="fast">보통</option><option value="medium">느림 (용량 작음)</option></select></div>
  </div>`;
  $(`#${prefix}Crf`).addEventListener('input', e => { $(`#${prefix}CrfV`).textContent = e.target.value; });
}
qualityUI('vc', '#vcQuality'); qualityUI('ve', '#veQuality');
$('#vcCrf').value = 28; $('#vcCrfV').textContent = 28;

const videoFilters = p => {
  const f = []; const r = $(`#${p}Res`).value;
  if (r) f.push(`scale=-2:${r}`);
  return f;
};
const x264 = p => ['-c:v', 'libx264', '-preset', $(`#${p}Pre`).value, '-crf', $(`#${p}Crf`).value, '-pix_fmt', 'yuv420p'];

function loadPreview(file, vid, info, cb) {
  vid.hidden = false; vid.src = URL.createObjectURL(file);
  vid.onloadedmetadata = () => {
    info.textContent = `${file.name} · ${fmtSize(file.size)} · ${fmtTime(vid.duration)} · ${vid.videoWidth}×${vid.videoHeight}`
      + (file.size > 1.5 * 1024 ** 3 ? ' · 1.5GB가 넘으면 브라우저 메모리 한계로 실패할 수 있어요' : '');
    cb && cb(vid);
  };
  vid.onerror = () => { info.textContent = '미리보기를 못 불러왔어요 (코덱 미지원일 수 있음). 변환은 시도해볼 수 있습니다.'; cb && cb(null); };
}

function showResult(host, blob, name, origSize) {
  const diff = origSize ? (1 - blob.size / origSize) * 100 : null;
  const url = URL.createObjectURL(blob);
  host.innerHTML = `<div class="out"><div>${origSize ? fmtSize(origSize) + ' → ' : ''}<b>${fmtSize(blob.size)}</b>
    ${diff !== null ? `<span class="${diff >= 0 ? 'good' : 'bad'}">${diff >= 0 ? '−' : '+'}${Math.abs(diff).toFixed(0)}%</span>` : ''}</div>
    <video controls src="${url}"></video>
    <div class="row" style="margin-top:12px"><button class="btn">다운로드</button></div></div>`;
  $('button', host).addEventListener('click', () => download(blob, name));
}

/* ===================== 동영상 압축 ===================== */
let vcFile = null;
bindDrop('vcDrop', 'vcFile');
$('#vcFile').addEventListener('change', e => {
  vcFile = e.target.files[0] || null; $('#vcOut').innerHTML = '';
  $('#vcRun').disabled = !vcFile; if (!vcFile) return;
  loadPreview(vcFile, $('#vcPrev'), $('#vcInfo'));
});
$('#vcRun').addEventListener('click', async () => {
  const inName = 'in.' + extOf(vcFile.name), out = 'out.mp4';
  const vf = videoFilters('vc'); const fps = $('#vcFps').value; if (fps) vf.push('fps=' + fps);
  const aud = $('#vcAud').value;
  const args = ['-i', inName, ...(vf.length ? ['-vf', vf.join(',')] : []), ...x264('vc'),
    ...(aud === 'none' ? ['-an'] : ['-c:a', 'aac', '-b:a', aud]), '-movflags', '+faststart', out];
  $('#vcRun').disabled = true;
  try {
    const blob = await runJob({ title: '동영상 압축 중…', files: [{ file: vcFile, name: inName }], args, out });
    if (blob) showResult($('#vcOut'), blob, baseName(vcFile.name) + '_compressed.mp4', vcFile.size);
  } catch (err) { st.text('실패'); $('#vcOut').innerHTML = `<p class="hint warn" style="white-space:pre-wrap">${err.message}</p>`; }
  $('#vcRun').disabled = false;
});

/* ===================== 동영상 편집 ===================== */
let veFile = null, veDur = 0, muFile = null, muDur = 0;
bindDrop('veDrop', 'veFile'); bindDrop('muDrop', 'muFile');

$('#veFile').addEventListener('change', e => {
  veFile = e.target.files[0] || null; $('#veOut').innerHTML = '';
  $('#veRun').disabled = !veFile; if (!veFile) return;
  loadPreview(veFile, $('#vePrev'), $('#veInfo'), v => {
    if (!v) return;
    veDur = v.duration; $('#veS').value = 0; $('#veE').value = veDur.toFixed(1);
    $('#veDur').textContent = `전체 ${fmtTime(veDur)}`;
  });
});
$('#veSnowS').addEventListener('click', () => { $('#veS').value = $('#vePrev').currentTime.toFixed(1); });
$('#veSnowE').addEventListener('click', () => { $('#veE').value = $('#vePrev').currentTime.toFixed(1); });
$('#vePreview').addEventListener('click', () => {
  const v = $('#vePrev'), s = num('veS'), e = num('veE', veDur);
  v.currentTime = s; v.play();
  const stop = () => { if (v.currentTime >= e) { v.pause(); v.removeEventListener('timeupdate', stop); } };
  v.addEventListener('timeupdate', stop);
});

$('#muFile').addEventListener('change', e => {
  muFile = e.target.files[0] || null;
  $('#muOpts').hidden = !muFile; $('#muPrev').hidden = !muFile;
  $('#muName').textContent = muFile ? muFile.name : '음악 파일 선택 (선택 사항)';
  if (!muFile) return;
  const a = $('#muPrev'); a.src = URL.createObjectURL(muFile);
  a.onloadedmetadata = () => { muDur = a.duration; };
});
$('#muVol').addEventListener('input', e => { $('#muVolV').textContent = e.target.value; });
$('#orVol').addEventListener('input', e => { $('#orVolV').textContent = e.target.value; });

const t3 = n => (+n).toFixed(3);

/** 필터 그래프 생성 */
function buildEdit(o) {
  const f = [], dur = o.dur;
  let S = Math.max(0, o.S), E = Math.min(dur, o.E);
  const segs = [];
  if (o.mode === 'keep') {
    if (E - S < 0.1) throw new Error('끝 시간이 시작 시간보다 커야 합니다.');
    segs.push([S, E]);
  } else if (o.mode === 'remove') {
    if (E - S < 0.1) throw new Error('끝 시간이 시작 시간보다 커야 합니다.');
    if (S > 0.05) segs.push([0, S]);
    if (E < dur - 0.05) segs.push([E, dur]);
    if (!segs.length) throw new Error('영상 전체가 삭제됩니다.');
  } else segs.push([0, dur]);

  const D = segs.reduce((a, [s, e]) => a + e - s, 0);
  const useOrig = o.hasAudio && !(o.music && o.mixMode === 'replace'); // 교체 모드면 원본 소리 체인 생략
  segs.forEach(([s, e], i) => {
    f.push(`[0:v]trim=start=${t3(s)}:end=${t3(e)},setpts=PTS-STARTPTS[v${i}]`);
    if (useOrig) f.push(`[0:a]atrim=start=${t3(s)}:end=${t3(e)},asetpts=PTS-STARTPTS[a${i}]`);
  });
  const n = segs.length;
  if (n > 1) {
    f.push(segs.map((_, i) => `[v${i}]`).join('') + `concat=n=${n}:v=1:a=0[vc]`);
    if (useOrig) f.push(segs.map((_, i) => `[a${i}]`).join('') + `concat=n=${n}:v=0:a=1[ac]`);
  } else {
    f.push('[v0]null[vc]'); if (useOrig) f.push('[a0]anull[ac]');
  }

  // 영상 후처리 (크기 → 페이드)
  const vch = [...o.vf];
  if (o.vFi > 0) vch.push(`fade=t=in:st=0:d=${t3(o.vFi)}`);
  if (o.vFo > 0) vch.push(`fade=t=out:st=${t3(Math.max(0, D - o.vFo))}:d=${t3(o.vFo)}`);
  vch.push('format=yuv420p');
  f.push(`[vc]${vch.join(',')}[vout]`);

  // 원본 소리
  let hasOrig = false;
  if (useOrig) {
    const a = [`volume=${t3(o.orVol)}`];
    if (o.vFa && o.vFi > 0) a.push(`afade=t=in:st=0:d=${t3(o.vFi)}`);
    if (o.vFa && o.vFo > 0) a.push(`afade=t=out:st=${t3(Math.max(0, D - o.vFo))}:d=${t3(o.vFo)}`);
    f.push(`[ac]${a.join(',')}[ao]`); hasOrig = true;
  }

  // 음악
  let hasMusic = false;
  if (o.music) {
    const off = Math.min(o.muOff, D - 0.1);
    let M = D - off;
    if (!o.muLoop && o.muDur) M = Math.min(M, o.muDur - o.muFrom);
    if (M < 0.1) throw new Error('음악이 들어갈 구간이 없습니다. 시작 시점/위치를 확인하세요.');
    const a = [`atrim=start=${t3(o.muFrom)}:duration=${t3(M)}`, 'asetpts=PTS-STARTPTS', 'aresample=44100',
      'aformat=channel_layouts=stereo', `volume=${t3(o.muVol)}`];
    if (o.muFi > 0) a.push(`afade=t=in:st=0:d=${t3(Math.min(o.muFi, M))}`);
    if (o.muFo > 0) a.push(`afade=t=out:st=${t3(Math.max(0, M - o.muFo))}:d=${t3(Math.min(o.muFo, M))}`);
    if (off > 0) { const ms = Math.round(off * 1000); a.push(`adelay=${ms}|${ms}`); }
    f.push(`[1:a]${a.join(',')}[am]`); hasMusic = true;
  }

  let amap = null;
  if (hasOrig && hasMusic) { f.push('[ao][am]amix=inputs=2:duration=longest:normalize=0[aout]'); amap = '[aout]'; }
  else if (hasMusic) amap = '[am]';
  else if (hasOrig) amap = '[ao]';
  return { graph: f.join(';'), amap, D };
}

$('#veRun').addEventListener('click', async () => {
  if (!veDur) { alert('영상 정보를 읽지 못했어요. 다른 파일로 시도하거나 압축 탭을 이용해 MP4로 먼저 변환해 주세요.'); return; }
  $('#veRun').disabled = true; $('#veOut').innerHTML = '';
  try {
    const vin = 'in.' + extOf(veFile.name), min = 'music.' + extOf(muFile ? muFile.name : 'mp3'), out = 'out.mp4';
    st.show('영상 분석 중…'); st.bar(0.02);
    const hasAudio = await probeAudio(veFile);
    const vf = videoFilters('ve'); const fps = '';
    const o = {
      dur: veDur, mode: $('#veMode').value, S: num('veS'), E: num('veE', veDur), hasAudio, vf,
      vFi: num('vFi'), vFo: num('vFo'), vFa: $('#vFa').checked,
      music: !!muFile, muDur, muOff: num('muOff'), muFrom: num('muFrom'), muVol: num('muVol', 100) / 100,
      orVol: num('orVol', 100) / 100, muFi: num('muFi'), muFo: num('muFo'), muLoop: $('#muLoop').checked,
      mixMode: $('#muMode').value,
    };
    const { graph, amap, D } = buildEdit(o);
    const args = [];
    args.push('-i', vin);
    if (muFile) { if (o.muLoop) args.push('-stream_loop', '-1'); args.push('-i', min); }
    args.push('-filter_complex', graph, '-map', '[vout]');
    if (amap) args.push('-map', amap, '-c:a', 'aac', '-b:a', '160k'); else args.push('-an');
    args.push(...x264('ve'), '-t', t3(D), '-movflags', '+faststart', out);

    const files = [{ file: veFile, name: vin }]; if (muFile) files.push({ file: muFile, name: min });
    const blob = await runJob({ title: '편집본 만드는 중…', files, args, out });
    if (blob) showResult($('#veOut'), blob, baseName(veFile.name) + '_edited.mp4', 0);
  } catch (err) {
    st.text('실패'); $('#veOut').innerHTML = `<p class="hint warn" style="white-space:pre-wrap">${err.message}</p>`;
  }
  $('#veRun').disabled = !veFile;
});
